import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';
import { Message, ChatRoom } from '@/models/Chat';
import { TokenTransaction } from '@/models/Token';
import User from '@/models/User';
import { Prompt } from '@/models/Debate';
import OpenAI from 'openai';
import { parseJsonArraySafe, scoreDebateWithRubric } from '@/lib/openai';

const WIN_TOKENS = 30;
const PARTICIPATION_TOKENS = 10;

export default async function handler(req, res) {
  const admin = await getUserFromRequest(req);
  if (!admin || !admin.roles?.includes('admin')) return res.status(403).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { promptId } = req.body || {};
  const prompt = await Prompt.findById(promptId);
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  const triads = await Triad.find({ promptId, status: { $in: ['active', 'finished'] } }).lean();
  const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  let best = null;
  for (const t of triads) {
    const msgs = await Message.find({ triadId: t._id }).sort({ createdAt: 1 }).lean();
    const transcript = msgs.map((m) => m.content).join('\n');
    let triadScore = 0;
    let userScores = [];
    let groupFeedback = '';

    if (client && transcript) {
      // Rubric-based per-user scoring
      try {
        const result = await scoreDebateWithRubric({
          promptText: prompt.text,
          participantsCount: (t.participants || []).length,
          transcript,
        });
        if (result && Array.isArray(result.per_user) && result.per_user.length) {
          userScores = result.per_user
            .filter((r) => typeof r.userIndex === 'number')
            .map((r) => ({
              userId: t.participants[r.userIndex],
              score: Math.max(0, Math.min(100, Math.round(r.overall || 0))),
              rubric: {
                defense: Math.max(0, Math.min(100, Math.round(r.defense || 0))),
                evidence: Math.max(0, Math.min(100, Math.round(r.evidence || 0))),
                logic: Math.max(0, Math.min(100, Math.round(r.logic || 0))),
                responsiveness: Math.max(0, Math.min(100, Math.round(r.responsiveness || 0))),
                clarity: Math.max(0, Math.min(100, Math.round(r.clarity || 0))),
              },
              feedback: (r.feedback || '').slice(0, 600),
            }));
          groupFeedback = (result.group_feedback || '').slice(0, 600);
        }
      } catch {}

      // Overall triad score
      try {
        if (Array.isArray(userScores) && userScores.length) {
          triadScore = Math.round(userScores.reduce((s, u) => s + (u.score || 0), 0) / userScores.length);
        } else {
          const resp = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Score the debate from 0-100 for intellectual rigor, clarity, and evidence. Respond ONLY with a number.' },
              { role: 'user', content: `Prompt: ${prompt.text}\nDebate Transcript:\n${transcript}` },
            ],
            temperature: 0,
          });
          const content = resp.choices?.[0]?.message?.content?.trim() || '0';
          triadScore = parseInt(content.replace(/[^0-9]/g, ''), 10) || 0;
        }
      } catch {}
    }

    // Fallback: if userScores empty, assign equal participation scores
    if (!userScores.length) {
      userScores = (t.participants || []).map((uid) => ({ userId: uid, score: 50 }));
    }

    await Triad.updateOne({ _id: t._id }, { userScores, groupFeedback });

    t.userScores = userScores;
    t.score = triadScore;
    if (!best || triadScore > best.score) best = t;
  }

  // Mark winner and award tokens
  const endedAt = new Date();
  if (best) {
    await Triad.updateOne({ _id: best._id }, { status: 'finished', endedAt, score: best.score || 0, isWinner: true });
    for (const uid of best.participants) {
      await User.findByIdAndUpdate(uid, { $inc: { tokens: WIN_TOKENS } });
      await TokenTransaction.create({ userId: uid, amount: WIN_TOKENS, type: 'earn_win', metadata: { triadId: best._id, promptId } });
    }
    // Post rubric summary to winning room if not already posted
    try {
      const triadFresh = await Triad.findById(best._id).lean();
      if (!triadFresh.rubricPostedAt) {
        const users = await User.find({ _id: { $in: triadFresh.participants } }).lean();
        const idToName = new Map(users.map((u) => [u._id.toString(), u.username || u.email || 'user']));
        const scores = Array.isArray(triadFresh.userScores) ? [...triadFresh.userScores] : [];
        scores.sort((a, b) => (b.score || 0) - (a.score || 0));
        const payload = {
          type: 'rubric',
          groupScore: Math.round(triadFresh.score || 0),
          isWinner: true,
          groupFeedback: triadFresh.groupFeedback || '',
          entries: scores.map((s, idx) => ({
            userId: s.userId,
            username: idToName.get((s.userId || '').toString()) || `#${idx + 1}`,
            overall: Math.round(s.score || 0),
            rubric: {
              defense: Math.round(s.rubric?.defense || 0),
              evidence: Math.round(s.rubric?.evidence || 0),
              logic: Math.round(s.rubric?.logic || 0),
              responsiveness: Math.round(s.rubric?.responsiveness || 0),
              clarity: Math.round(s.rubric?.clarity || 0),
            },
            feedback: s.feedback || '',
          })),
        };
        await Message.create({ roomId: triadFresh.roomId, senderId: null, content: JSON.stringify(payload), isDebate: false, triadId: triadFresh._id, promptId: triadFresh.promptId, tags: ['rubric'] });
        await ChatRoom.findByIdAndUpdate(triadFresh.roomId, { lastMessageAt: new Date() });
        await Triad.updateOne({ _id: triadFresh._id }, { rubricPostedAt: new Date() });
      }
    } catch {}
  }
  // Others get participation
  for (const t of triads) {
    if (best && t._id.toString() === best._id.toString()) continue;
    await Triad.updateOne({ _id: t._id }, { status: 'finished', endedAt, score: t.score || 0, isWinner: false });
    for (const uid of t.participants) {
      await User.findByIdAndUpdate(uid, { $inc: { tokens: PARTICIPATION_TOKENS } });
      await TokenTransaction.create({ userId: uid, amount: PARTICIPATION_TOKENS, type: 'earn_participation', metadata: { triadId: t._id, promptId } });
    }
    // Post rubric summary to non-winning rooms as well
    try {
      const triadFresh = await Triad.findById(t._id).lean();
      if (!triadFresh.rubricPostedAt) {
        const users = await User.find({ _id: { $in: triadFresh.participants } }).lean();
        const idToName = new Map(users.map((u) => [u._id.toString(), u.username || u.email || 'user']));
        const scores = Array.isArray(triadFresh.userScores) ? [...triadFresh.userScores] : [];
        scores.sort((a, b) => (b.score || 0) - (a.score || 0));
        const payload = {
          type: 'rubric',
          groupScore: Math.round(triadFresh.score || 0),
          isWinner: false,
          groupFeedback: triadFresh.groupFeedback || '',
          entries: scores.map((s, idx) => ({
            userId: s.userId,
            username: idToName.get((s.userId || '').toString()) || `#${idx + 1}`,
            overall: Math.round(s.score || 0),
            rubric: {
              defense: Math.round(s.rubric?.defense || 0),
              evidence: Math.round(s.rubric?.evidence || 0),
              logic: Math.round(s.rubric?.logic || 0),
              responsiveness: Math.round(s.rubric?.responsiveness || 0),
              clarity: Math.round(s.rubric?.clarity || 0),
            },
            feedback: s.feedback || '',
          })),
        };
        await Message.create({ roomId: triadFresh.roomId, senderId: null, content: JSON.stringify(payload), isDebate: false, triadId: triadFresh._id, promptId: triadFresh.promptId, tags: ['rubric'] });
        await ChatRoom.findByIdAndUpdate(triadFresh.roomId, { lastMessageAt: new Date() });
        await Triad.updateOne({ _id: triadFresh._id }, { rubricPostedAt: new Date() });
      }
    } catch {}
  }

  return res.status(200).json({ winnerTriadId: best?._id || null, score: best?.score || 0 });
} 