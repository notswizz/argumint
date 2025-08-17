import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';
import { ChatRoom } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import mongoose from 'mongoose';
import { generateDebatePrompts, analyzeSentiment, extractMessageTags } from '@/lib/openai';
import { Message } from '@/models/Chat';
import { BotAssignment } from '@/models/BotAssignment';
import { triggerBotReplies, getAllBotUsers, generateBotStanceShort } from '@/lib/bots';
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';
import OpenAI from 'openai';
import { parseJsonArraySafe } from '@/lib/openai';
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
    const assignments = await BotAssignment.find({ promptId: prompt._id }).lean();
    const assignerIds = assignments.map((a) => a.assignerId.toString());
    const queue = [];
    const seen = new Set();
    for (const r of responses) {
      const uid = r.userId.toString();
      if (alreadyAssigned.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }
    // Include users who assigned bots (so they get a room even if they didn't respond)
    for (const uid of assignerIds) {
      if (alreadyAssigned.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }
    const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(id));
    // Always schedule triads as 2 humans + 1 bot
    const bots = await getAllBotUsers();
    let botIdx = Math.floor(Math.random() * Math.max(1, bots.length));
    while (queue.length >= 2) {
      const humanIds = queue.splice(0, 2);
      const participantsObj = toObjectIds(humanIds);
      const chosen = bots[botIdx % bots.length];
      botIdx++;
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: [...participantsObj, chosen.user._id], lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: [...participantsObj, chosen.user._id], botUserId: chosen.user._id, botPersonaKey: chosen.personaKey, startedAt: new Date(), status: 'active' });
      try {
        const introResponses = await PromptResponse.find({ promptId: prompt._id, userId: { $in: participantsObj } }).lean();
        for (const r of introResponses) {
          const sentiment = await analyzeSentiment(r.text || '');
          const { tags, wordCount } = await extractMessageTags(r.text || '');
          await Message.create({ roomId: room._id, senderId: r.userId, content: r.text, triadId: triad._id, promptId: prompt._id, isDebate: true, sentiment, tags, wordCount });
        }
        // Bot stance intro (short), then trigger contextual reply
        try {
          let stance = await generateBotStanceShort(chosen.personaKey, prompt.text);
          if (!stance) {
            stance = chosen.personaKey === 'witty' ? 'Bold take' : chosen.personaKey === 'professor' ? 'Pragmatic' : chosen.personaKey === 'trash' ? 'Hot take' : 'Stance';
          }
          const sSent = await analyzeSentiment(stance);
          const sMeta = await extractMessageTags(stance);
          await Message.create({ roomId: room._id, senderId: chosen.user._id, content: stance, triadId: triad._id, promptId: prompt._id, isDebate: true, sentiment: sSent, tags: sMeta.tags, wordCount: sMeta.wordCount });
          // Ensure bot's stance is recorded as a PromptResponse for intro listings
          const existingBotPR = await PromptResponse.findOne({ promptId: prompt._id, userId: chosen.user._id });
          if (!existingBotPR) {
            await PromptResponse.create({ promptId: prompt._id, userId: chosen.user._id, text: stance });
          }
        } catch {}
        triggerBotReplies({ roomId: room._id, triadId: triad._id, promptId: prompt._id });
      } catch {}
    }

    // If only one human left, create a room with 1 human + 1 bot
    if (queue.length === 1) {
      const humanIds = queue.splice(0, 1);
      const participantsObj = toObjectIds(humanIds);
      const chosen = bots[botIdx % bots.length];
      botIdx++;
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: [...participantsObj, chosen.user._id], lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: [...participantsObj, chosen.user._id], botUserId: chosen.user._id, botPersonaKey: chosen.personaKey, startedAt: new Date(), status: 'active' });
      try {
        const introResponses = await PromptResponse.find({ promptId: prompt._id, userId: { $in: participantsObj } }).lean();
        for (const r of introResponses) {
          const sentiment = await analyzeSentiment(r.text || '');
          const { tags, wordCount } = await extractMessageTags(r.text || '');
          await Message.create({ roomId: room._id, senderId: r.userId, content: r.text, triadId: triad._id, promptId: prompt._id, isDebate: true, sentiment, tags, wordCount });
        }
        try {
          let stance = await generateBotStanceShort(chosen.personaKey, prompt.text);
          if (!stance) {
            stance = chosen.personaKey === 'witty' ? 'Bold take' : chosen.personaKey === 'professor' ? 'Pragmatic' : chosen.personaKey === 'trash' ? 'Hot take' : 'Stance';
          }
          const sSent = await analyzeSentiment(stance);
          const sMeta = await extractMessageTags(stance);
          await Message.create({ roomId: room._id, senderId: chosen.user._id, content: stance, triadId: triad._id, promptId: prompt._id, isDebate: true, sentiment: sSent, tags: sMeta.tags, wordCount: sMeta.wordCount });
          const existingBotPR = await PromptResponse.findOne({ promptId: prompt._id, userId: chosen.user._id });
          if (!existingBotPR) {
            await PromptResponse.create({ promptId: prompt._id, userId: chosen.user._id, text: stance });
          }
        } catch {}
        triggerBotReplies({ roomId: room._id, triadId: triad._id, promptId: prompt._id });
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
  const latest = active.length ? new Date(active[active.length - 1].scheduledFor).getTime() : 0;
  let nextDeadlineMs = latest ? latest + SPACING_MS : Date.now() + SPACING_MS;

  let attempts = 0;
  while (active.length < 5 && attempts < 3) {
    const deficit = 5 - active.length;
    const generated = await generateDebatePrompts();
    const toMake = Math.min(deficit, generated.length);
    if (toMake === 0) break;

    const docs = [];
    for (let i = 0; i < toMake; i++) {
      const g = generated[i];
      docs.push({
        text: g.text,
        category: g.category,
        active: true,
        scheduledFor: new Date(nextDeadlineMs + (JITTER_MS ? Math.floor(Math.random() * JITTER_MS) : 0)),
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

  // Compute per-user and overall triad scores
  for (const t of needsGrading) {
    const messages = await Message.find({ triadId: t._id }).sort({ createdAt: 1 }).lean();
    const transcript = messages.map((m) => m.content).join('\n');

    // Per-user scoring
    let userScores = [];
    if (client && transcript) {
      try {
        const promptDoc = await Prompt.findById(t.promptId).lean();
        const perUser = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Given a debate transcript with multiple participants, assign each participant a score from 0-100 based on rigor, clarity, and evidence. Respond ONLY as JSON array of {userIndex: number, score: number} where userIndex matches the order of participants array.' },
            { role: 'user', content: `Prompt: ${promptDoc?.text || ''}\nParticipants (in order): ${t.participants.map((_, i) => `#${i}`).join(', ')}\nTranscript:\n${transcript}` },
          ],
          temperature: 0,
        });
        const arr = parseJsonArraySafe(perUser.choices?.[0]?.message?.content || '[]') || [];
        userScores = arr
          .filter((r) => typeof r.userIndex === 'number' && typeof r.score === 'number')
          .map((r) => ({ userId: t.participants[r.userIndex], score: Math.max(0, Math.min(100, Math.round(r.score))) }));
      } catch {}
    }
    if (!userScores.length) {
      userScores = (t.participants || []).map((uid) => ({ userId: uid, score: 50 }));
    }
    await Triad.updateOne({ _id: t._id }, { userScores });

    // Overall triad score
    if (t.status === 'active') {
      let score = 0;
      if (client && transcript) {
        try {
          const promptDoc = await Prompt.findById(t.promptId).lean();
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
    }
  }
} 