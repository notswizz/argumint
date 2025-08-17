import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ChatRoom } from '@/models/Chat';
import User from '@/models/User';

export default async function handler(req, res) {
  const me = await getUserFromRequest(req);
  if (!me) return res.status(401).end();
  await connectToDatabase();

  if (req.method !== 'POST') return res.status(405).end();

  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Missing username' });
  }
  try {
    const other = await User.findOne({ username }).select('_id username').lean();
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (String(other._id) === String(me._id)) {
      return res.status(400).json({ error: 'Cannot DM yourself' });
    }

    // Find existing DM room with exactly these two participants and not a group
    const existing = await ChatRoom.findOne({
      isGroup: false,
      participants: { $all: [me._id, other._id], $size: 2 },
    }).lean();
    if (existing) return res.status(200).json({ room: existing });

    const room = await ChatRoom.create({
      name: `${me.username} ↔ ${other.username}`,
      isGroup: false,
      participants: [me._id, other._id],
    });
    return res.status(201).json({ room });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create or fetch DM' });
  }
}


