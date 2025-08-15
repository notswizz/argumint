import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { TokenTransaction } from '@/models/Token';

export default async function handler(req, res) {
  const authUser = await getUserFromRequest(req);
  if (!authUser) return res.status(401).end();
  await connectToDatabase();
  const userId = req.query.userId || authUser._id;
  const history = await TokenTransaction.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  return res.status(200).json({ history });
} 