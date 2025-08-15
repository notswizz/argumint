import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  const triad = await Triad.findOne({ roomId }).populate('promptId').lean();
  if (!triad) return res.status(200).json({ triad: null });
  return res.status(200).json({ triad: { ...triad, prompt: triad.promptId } });
} 