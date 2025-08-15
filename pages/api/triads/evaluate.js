import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';
import { Message } from '@/models/Chat';
import { TokenTransaction } from '@/models/Token';
import User from '@/models/User';
import { Prompt } from '@/models/Debate';
import OpenAI from 'openai';
import { parseJsonArraySafe } from '@/lib/openai';

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

    if (client && transcript) {
      // Per-user scoring
      try {
        const perUser = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Given a debate transcript with multiple participants, assign each participant a score from 0-100 based on rigor, clarity, and evidence. Respond ONLY as JSON array of {userIndex: number, score: number} where userIndex matches the order of participants array.' },
            { role: 'user', content: `Prompt: ${prompt.text}\nParticipants (in order): ${t.participants.map((_, i) => `#${i}`).join(', ')}\nTranscript:\n${transcript}` },
          ],
          temperature: 0,
        });
        const arr = parseJsonArraySafe(perUser.choices?.[0]?.message?.content || '[]') || [];
        userScores = arr
          .filter((r) => typeof r.userIndex === 'number' && typeof r.score === 'number')
          .map((r) => ({ userId: t.participants[r.userIndex], score: Math.max(0, Math.min(100, Math.round(r.score))) }));
      } catch {}

      // Overall triad score
      try {
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
      } catch {}
    }

    // Fallback: if userScores empty, assign equal participation scores
    if (!userScores.length) {
      userScores = (t.participants || []).map((uid) => ({ userId: uid, score: 50 }));
    }

    await Triad.updateOne({ _id: t._id }, { userScores });

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
  }
  // Others get participation
  for (const t of triads) {
    if (best && t._id.toString() === best._id.toString()) continue;
    await Triad.updateOne({ _id: t._id }, { status: 'finished', endedAt, score: t.score || 0, isWinner: false });
    for (const uid of t.participants) {
      await User.findByIdAndUpdate(uid, { $inc: { tokens: PARTICIPATION_TOKENS } });
      await TokenTransaction.create({ userId: uid, amount: PARTICIPATION_TOKENS, type: 'earn_participation', metadata: { triadId: t._id, promptId } });
    }
  }

  return res.status(200).json({ winnerTriadId: best?._id || null, score: best?.score || 0 });
} 