import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Message } from '@/models/Chat';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  const { roomId, limit = 200, since } = req.query;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  const query = { roomId };
  if (since) query.createdAt = { $gt: new Date(since) };
  const items = await Message.find(query)
    .sort({ createdAt: 1 })
    .limit(Number(limit))
    .lean();
  return res.status(200).json({ messages: items });
} 