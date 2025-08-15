import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';

const COST_TOKENS = 10;

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();

  const { text, durationMinutes, durationHours } = req.body || {};
  const content = (text || '').trim();
  if (!content || content.length < 5) return res.status(400).json({ error: 'Prompt text too short' });

  const durationMs = durationMinutes
    ? Number(durationMinutes) * 60 * 1000
    : durationHours
    ? Number(durationHours) * 3600 * 1000
    : 10 * 60 * 1000; // default 10 minutes
  if (!Number.isFinite(durationMs) || durationMs <= 0) return res.status(400).json({ error: 'Invalid duration' });

  const freshUser = await User.findById(user._id);
  if (!freshUser) return res.status(401).end();
  if ((freshUser.tokens || 0) < COST_TOKENS) return res.status(402).json({ error: 'Not enough tokens' });

  freshUser.tokens = (freshUser.tokens || 0) - COST_TOKENS;
  await freshUser.save();
  await TokenTransaction.create({ userId: freshUser._id, amount: -COST_TOKENS, type: 'spend_customization', metadata: { reason: 'submit_prompt' } });

  const scheduledFor = new Date(Date.now() + durationMs);
  const prompt = await Prompt.create({ text: content, category: 'user', createdBy: freshUser._id, scheduledFor, active: true });

  return res.status(201).json({ prompt, balance: freshUser.tokens });
} 