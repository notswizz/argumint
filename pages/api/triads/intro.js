import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';
import { PromptResponse } from '@/models/PromptResponse';
import User from '@/models/User';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  const { triadId } = req.query;
  if (!triadId) return res.status(400).json({ error: 'Missing triadId' });

  const triad = await Triad.findById(triadId).lean();
  if (!triad) return res.status(404).json({ error: 'Triad not found' });

  const participantIds = triad.participants.map((id) => id.toString());
  const users = await User.find({ _id: { $in: participantIds } }).lean();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
  const responses = await PromptResponse.find({ promptId: triad.promptId, userId: { $in: participantIds } })
    .sort({ createdAt: 1 })
    .lean();

  const items = responses.map((r) => ({
    userId: r.userId,
    username: userMap[r.userId.toString()]?.username || 'User',
    text: r.text,
  }));

  return res.status(200).json({ promptId: triad.promptId, items });
} 