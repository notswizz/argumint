import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';
import { Triad } from '@/models/Triad';
import { ChatRoom, Message } from '@/models/Chat';
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';
import OpenAI from 'openai';
import { generateDebatePrompts } from '@/lib/openai';
import { scheduleDuePrompts, ensureFiveActivePrompts, evaluateExpiredTriads } from '@/lib/scheduler';

const WIN_TOKENS = 30;
const PARTICIPATION_TOKENS = 10;
const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export default async function handler(req, res) {
  await connectToDatabase();
  const now = new Date();

  // 1) Ensure 5 active (10-min deadline, then 5-min staggers)
  const activePrompts = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1 })
    .lean();
  const deficit = Math.max(0, 5 - activePrompts.length);
  if (deficit > 0) {
    try {
      const generated = await generateDebatePrompts();
      if (!generated?.length) return res.status(500).json({ error: 'AI generation returned no prompts' });
      const toCreate = generated.slice(0, deficit).map((g, idx) => ({
        text: g.text,
        category: g.category,
        active: true,
        scheduledFor: new Date(Date.now() + TEN_MIN + idx * FIVE_MIN),
      }));
      if (toCreate.length) await Prompt.insertMany(toCreate);
    } catch (e) {
      return res.status(500).json({ error: e.message || 'AI prompt generation failed' });
    }
  }

  // 2) Schedule triads for prompts whose timers ended
  await scheduleDuePrompts();

  // 3) Immediately top back up to 5 with 10-min base and 5-min staggers
  try {
    await ensureFiveActivePrompts();
  } catch (e) {}

  // 4) Auto-finish and evaluate triads whose 10m elapsed
  await evaluateExpiredTriads();

  return res.status(200).json({ ok: true });
} 