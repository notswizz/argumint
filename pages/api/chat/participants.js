import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ChatRoom } from '@/models/Chat';
import User from '@/models/User';

export default async function handler(req, res) {
  const me = await getUserFromRequest(req);
  if (!me) return res.status(401).end();
  await connectToDatabase();

  if (req.method !== 'GET') return res.status(405).end();
  const { roomId } = req.query || {};
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  try {
    const room = await ChatRoom.findById(roomId).select('participants').lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const users = await User.find({ _id: { $in: room.participants || [] } })
      .select('_id username profilePictureUrl')
      .lean();
    return res.status(200).json({ users });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load participants' });
  }
}


