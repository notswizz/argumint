import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { scheduleDuePrompts } from '@/lib/scheduler';

export default async function handler(req, res) {
  await connectToDatabase();
  // Opportunistic backstop: if any prompts expired, schedule triads now
  try {
    await scheduleDuePrompts();
  } catch {}

  const now = new Date();
  const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();
  return res.status(200).json({ prompts });
} 