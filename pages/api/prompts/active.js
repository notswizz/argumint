import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { scheduleDuePrompts, ensureFiveActivePrompts, evaluateExpiredTriads } from '@/lib/scheduler';
import { System } from '@/models/System';

export default async function handler(req, res) {
  await connectToDatabase();

  try {
    const sys = (await System.findOne({ key: 'cron' })) || (await System.create({ key: 'cron', lastSweepAt: new Date(0) }));
    const now = new Date();
    if (!sys.lastSweepAt || now.getTime() - new Date(sys.lastSweepAt).getTime() > 60 * 1000) {
      await scheduleDuePrompts();
      await ensureFiveActivePrompts();
      await evaluateExpiredTriads();
      sys.lastSweepAt = new Date();
      await sys.save();
    }
  } catch {}

  const now = new Date();
  const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();
  return res.status(200).json({ prompts });
} 