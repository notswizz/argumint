import { connectToDatabase } from '@/lib/db';
import { Prompt } from '@/models/Debate';

export default async function handler(req, res) {
  await connectToDatabase();
  const now = new Date();
  const active = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();
  return res.status(200).json({ items: active });
} 