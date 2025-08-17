import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';
import { scheduleDuePrompts, ensureFiveActivePrompts, evaluateExpiredTriads } from '@/lib/scheduler';
import { System } from '@/models/System';
import { getUserFromRequest } from '@/lib/auth';

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

  // If requesting only this user's upcoming prompts, return all of theirs (reasonable cap)
  const { mine, users, ai } = req.query || {};
  if (mine) {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).end();
    const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now }, createdBy: user._id })
      .sort({ scheduledFor: 1, createdAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ prompts });
  }

  if (users) {
    const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now }, category: 'user' })
      .sort({ scheduledFor: 1, createdAt: -1 })
      .limit(500)
      .lean();
    return res.status(200).json({ prompts });
  }

  if (ai) {
    const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now }, category: { $ne: 'user' } })
      .sort({ scheduledFor: 1, createdAt: -1 })
      .limit(5)
      .lean();
    return res.status(200).json({ prompts });
  }

  // Default: return the next 5 globally active prompts
  const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();
  return res.status(200).json({ prompts });
} 