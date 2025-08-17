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
  // Single cron endpoint: schedule due prompts, ensure five active, evaluate expired
  try {
    await scheduleDuePrompts();
  } catch {}
  try {
    await ensureFiveActivePrompts();
  } catch {}
  try {
    await evaluateExpiredTriads();
  } catch {}
  return res.status(200).json({ ok: true });
}