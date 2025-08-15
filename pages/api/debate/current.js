import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Debate, Prompt } from '@/models/Debate';
import { ChatRoom } from '@/models/Chat';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  let debate = await Debate.findOne({ $or: [{ userA: user._id }, { userB: user._id }], status: { $in: ['pending', 'active'] } })
    .populate('promptId')
    .lean();
  if (!debate) return res.status(200).json({ debate: null });
  return res.status(200).json({ debate: { ...debate, prompt: debate.promptId } });
} 