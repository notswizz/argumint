import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Debate, Prompt } from '@/models/Debate';
import { ChatRoom } from '@/models/Chat';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();

  // Find active prompt (latest)
  const prompt = await Prompt.findOne({ active: true }).sort({ createdAt: -1 }).lean();
  if (!prompt) return res.status(400).json({ error: 'No active prompt available' });

  // Try to find pending debate waiting for opponent
  let pending = await Debate.findOne({ promptId: prompt._id, status: 'pending', userA: { $ne: user._id }, userB: null });
  if (pending) {
    pending.userB = user._id;
    pending.stanceA = 'pro';
    pending.stanceB = 'con';
    pending.startedAt = new Date();
    pending.status = 'active';
    await pending.save();
    return res.status(200).json({ debateId: pending._id });
  }

  // Create room and debate for this user to wait
  const room = await ChatRoom.create({ name: 'Debate', isGroup: false, participants: [user._id] });
  const debate = await Debate.create({ promptId: prompt._id, roomId: room._id, userA: user._id, userB: null, status: 'pending', durationSec: 300 });
  return res.status(201).json({ debateId: debate._id });
} 