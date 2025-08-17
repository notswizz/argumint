import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Message, ChatRoom } from '@/models/Chat';
import { Triad } from '@/models/Triad';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();

  if (req.method === 'GET') {
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

  if (req.method === 'POST') {
    try {
      const { roomId, content, isDebate = false, triadId = null, promptId = null } = req.body || {};
      if (!roomId || !content) return res.status(400).json({ error: 'Missing roomId or content' });

      // Simple time lock enforcement for debates (same as socket server)
      if (triadId) {
        const triad = await Triad.findById(triadId);
        if (triad?.startedAt) {
          const end = new Date(triad.startedAt).getTime() + (triad.durationSec || 600) * 1000;
          if (Number.isFinite(end) && Date.now() >= end) {
            return res.status(403).json({ error: 'Debate time is over' });
          }
        }
      }

      const message = await Message.create({
        roomId,
        senderId: user._id,
        content,
        isDebate: Boolean(isDebate),
        triadId: triadId || null,
        promptId: promptId || null,
      });
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessageAt: new Date() });
      if (triadId) {
        await Triad.findByIdAndUpdate(triadId, { $push: { transcript: message._id } });
      }
      return res.status(201).json({ message });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save message' });
    }
  }

  return res.status(405).end();
}