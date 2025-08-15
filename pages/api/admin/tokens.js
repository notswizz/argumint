import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';

export default async function handler(req, res) {
  const admin = await getUserFromRequest(req);
  if (!admin || !admin.roles?.includes('admin')) return res.status(403).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { userId, amount, reason } = req.body || {};
  await User.findByIdAndUpdate(userId, { $inc: { tokens: amount } });
  await TokenTransaction.create({ userId, amount, type: 'admin_adjust', metadata: { reason } });
  return res.status(200).json({ ok: true });
} 