import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';
import { ChatRoom } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import mongoose from 'mongoose';
import { generateDebatePrompts, analyzeSentiment, extractMessageTags } from '@/lib/openai';
import { Message } from '@/models/Chat';
// Bots removed; human-only debates
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';
import OpenAI from 'openai';
import { parseJsonArraySafe, scoreDebateWithRubric } from '@/lib/openai';
import { System } from '@/models/System';

export async function scheduleDuePrompts() {
  await connectToDatabase();
  const now = new Date();
  const duePrompts = await Prompt.find({ active: true, scheduledFor: { $lte: now } });
  for (const p of duePrompts) {
    // Atomically claim this prompt to avoid duplicate scheduling
    const prompt = await Prompt.findOneAndUpdate(
      { _id: p._id, active: true },
      { $set: { active: false, scheduledAt: new Date() } },
      { new: true }
    );
    if (!prompt) continue; // Already claimed by another worker

    const existingTriads = await Triad.find({ promptId: prompt._id }).lean();
    const alreadyAssigned = new Set(existingTriads.flatMap((t) => t.participants.map((id) => id.toString())));
    const responses = await PromptResponse.find({ promptId: prompt._id }).sort({ createdAt: 1 }).lean();
    const queue = [];
    const seen = new Set();
    for (const r of responses) {
      const uid = r.userId.toString();
      if (alreadyAssigned.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }
    const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(id));
    // Schedule triads as human-only groups: 3 first, then 2
    while (queue.length >= 3) {
      const participants = queue.splice(0, 3);
      const participantsObj = toObjectIds(participants);
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: participantsObj, lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: participantsObj, startedAt: new Date(), status: 'active' });
      try {
        // Do not post participant intro responses into chat; they are shown above the room UI
        // Previously posted each user's PromptResponse as a Message here.
      } catch {}
    }
    // If only two humans remain, create a room with 2 participants
    if (queue.length === 2) {
      const participants = queue.splice(0, 2);
      const participantsObj = toObjectIds(participants);
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: participantsObj, lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: participantsObj, startedAt: new Date(), status: 'active' });
      try {
        // Do not post participant intro responses into chat; they are shown above the room UI
      } catch {}
    }
    // prompt already marked inactive above
  }
}

export async function ensureFiveActivePrompts() {
  await connectToDatabase();
  const now = new Date();
  // Acquire a short lock to prevent concurrent top-ups creating duplicate schedules
  const lockKey = 'ai_prompts_lock';
  const lockMs = 5000;
  const acquired = await System.findOneAndUpdate(
    { key: lockKey, $or: [ { lockedUntil: { $lt: now } }, { lockedUntil: { $exists: false } } ] },
    { $set: { key: lockKey, lockedUntil: new Date(now.getTime() + lockMs) } },
    { upsert: true, new: true }
  ).lean();
  if (!acquired || (acquired.lockedUntil && new Date(acquired.lockedUntil).getTime() < now.getTime() + lockMs - 1)) {
    // Lock was not acquired by this process; skip to avoid duplicates
    return { created: 0 };
  }
  // Ensure there are always at least 5 AI prompts (ignoring user-submitted)
  let active = await Prompt.find({ active: true, scheduledFor: { $gt: now }, category: { $ne: 'user' } })
    .sort({ scheduledFor: 1 })
    .lean();

  const SPACING_MS = 10 * 60 * 1000; // exactly 10 minutes between AI prompts
  const JITTER_MS = Number(process.env.PROMPTS_STAGGER_JITTER_MS || 0); // optional small jitter; default 0

  // Next deadline is either now+10m if nothing scheduled, or latest+10m
  // Respect any manual reschedules by looking at the true latest scheduled time, not just array tail
  const latestMs = active.reduce((max, p) => Math.max(max, new Date(p.scheduledFor).getTime()), 0);
  let nextDeadlineMs = latestMs ? latestMs + SPACING_MS : Date.now() + SPACING_MS;
  // Guard against duplicates: track already-used times
  const usedTimes = new Set(active.map((p) => new Date(p.scheduledFor).getTime()));

  let attempts = 0;
  while (active.length < 5 && attempts < 3) {
    const deficit = 5 - active.length;
    const generated = await generateDebatePrompts();
    const toMake = Math.min(deficit, generated.length);
    if (toMake === 0) break;

    const docs = [];
    for (let i = 0; i < toMake; i++) {
      const g = generated[i];
      // Ensure this timeslot isn't already taken; advance by spacing until unique
      while (usedTimes.has(nextDeadlineMs)) nextDeadlineMs += SPACING_MS;
      const scheduledFor = new Date(nextDeadlineMs + (JITTER_MS ? Math.floor(Math.random() * JITTER_MS) : 0));
      usedTimes.add(scheduledFor.getTime());
      docs.push({
        text: g.text,
        category: g.category,
        active: true,
        scheduledFor,
      });
      nextDeadlineMs += SPACING_MS;
    }
    if (docs.length) await Prompt.insertMany(docs);

    // Requery to confirm count and update latest schedule
    active = await Prompt.find({ active: true, scheduledFor: { $gt: new Date() }, category: { $ne: 'user' } })
      .sort({ scheduledFor: 1 })
      .lean();
    attempts += 1;
  }

  return { created: Math.max(0, 5 - active.length) === 0 ? 1 : 0 };
}

export async function evaluateExpiredTriads() {
  await connectToDatabase();
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  // Triads that need grading: expired actives OR finished with missing user scores
  const needsGrading = await Triad.find({
    $or: [
      { status: 'active', startedAt: { $lte: cutoff } },
      { status: 'finished', $or: [ { userScores: { $exists: false } }, { 'userScores.0': { $exists: false } } ] },
    ],
  }).lean();

  // Compute per-user rubric scores and overall triad scores
  for (const t of needsGrading) {
    const messages = await Message.find({ triadId: t._id }).sort({ createdAt: 1 }).lean();
    const transcript = messages.map((m) => m.content).join('\n');

    // Rubric-based per-user scoring
    let userScores = [];
    let groupFeedback = '';
    if (client && transcript) {
      try {
        const promptDoc = await Prompt.findById(t.promptId).lean();
        const result = await scoreDebateWithRubric({
          promptText: promptDoc?.text || '',
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
    }
    if (!userScores.length) {
      userScores = (t.participants || []).map((uid) => ({ userId: uid, score: 50 }));
    }
    await Triad.updateOne({ _id: t._id }, { userScores, groupFeedback });

    // Overall triad score
    if (t.status === 'active') {
      let score = 0;
      if (client && transcript) {
        try {
          const promptDoc = await Prompt.findById(t.promptId).lean();
          // Group score = average of per-user overall scores if available; else fallback to model numeric score
          if (Array.isArray(userScores) && userScores.length && typeof userScores[0].score === 'number') {
            score = Math.round(userScores.reduce((s, u) => s + (u.score || 0), 0) / userScores.length);
          } else if (client && transcript) {
            const resp = await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Score the debate from 0-100 for intellectual rigor, clarity, and evidence. Respond ONLY with a number.' },
                { role: 'user', content: `Prompt: ${promptDoc?.text || ''}\nDebate Transcript:\n${transcript}` },
              ],
              temperature: 0,
            });
            const content = resp.choices?.[0]?.message?.content?.trim() || '0';
            score = parseInt(content.replace(/[^0-9]/g, ''), 10) || 0;
          }
        } catch {}
      }
      // Set overall score and winner (highest user score if available)
      let winnerUserId = null;
      if (Array.isArray(userScores) && userScores.length) {
        const sorted = [...userScores].sort((a, b) => (b.score || 0) - (a.score || 0));
        winnerUserId = sorted[0]?.userId || null;
      }
      await Triad.updateOne({ _id: t._id }, { score, winnerUserId });
    }
  }

  // Now close and award for those that were active and expired
  const toFinish = await Triad.find({ status: 'active', startedAt: { $lte: cutoff } }).lean();
  const byPrompt = new Map();
  for (const t of toFinish) {
    const key = t.promptId.toString();
    if (!byPrompt.has(key)) byPrompt.set(key, []);
    byPrompt.get(key).push(t);
  }

  const endedAt = new Date();
  const WIN_TOKENS = 30;
  const PARTICIPATION_TOKENS = 10;
  for (const [promptId, triads] of byPrompt.entries()) {
    // Fetch updated scores
    const fresh = await Triad.find({ _id: { $in: triads.map((x) => x._id) } }).lean();
    let best = null;
    for (const tr of fresh) {
      if (!best || (tr.score || 0) > (best.score || 0)) best = tr;
    }
    for (const tr of fresh) {
      const isWinner = best && tr._id.toString() === best._id.toString();
      await Triad.updateOne({ _id: tr._id }, { status: 'finished', endedAt, isWinner });
      for (const uid of tr.participants) {
        const amount = isWinner ? WIN_TOKENS : PARTICIPATION_TOKENS;
        await User.findByIdAndUpdate(uid, { $inc: { tokens: amount } });
        await TokenTransaction.create({ userId: uid, amount, type: isWinner ? 'earn_win' : 'earn_participation', metadata: { triadId: tr._id, promptId } });
      }

      // Post rubric summary to the room once
      try {
        const triadFresh = await Triad.findById(tr._id).lean();
        if (!triadFresh.rubricPostedAt) {
          const users = await User.find({ _id: { $in: triadFresh.participants } }).lean();
          const idToName = new Map(users.map((u) => [u._id.toString(), u.username || u.email || 'user']));
          const scores = Array.isArray(triadFresh.userScores) ? [...triadFresh.userScores] : [];
          scores.sort((a, b) => (b.score || 0) - (a.score || 0));
          const payload = {
            type: 'rubric',
            groupScore: Math.round(triadFresh.score || 0),
            isWinner: Boolean(isWinner),
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
  }
} 