import { connectToDatabase } from '@/lib/db';
import { Debate, Prompt } from '@/models/Debate';
import User from '@/models/User';

export default async function handler(req, res) {
  await connectToDatabase();
  const items = await Debate.find({ status: 'finished' })
    .sort({ updatedAt: -1 })
    .limit(20)
    .populate('promptId userA userB')
    .lean();
  return res.status(200).json({
    items: items.map((d) => ({ ...d, prompt: d.promptId })),
  });
} 