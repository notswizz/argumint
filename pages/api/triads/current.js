import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';
import { Prompt } from '@/models/Debate';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  const triad = await Triad.findOne({ participants: user._id, status: 'active' })
    .populate('promptId')
    .lean();
  if (!triad) return res.status(200).json({ triad: null });
  return res.status(200).json({ triad: { ...triad, prompt: triad.promptId } });
} 