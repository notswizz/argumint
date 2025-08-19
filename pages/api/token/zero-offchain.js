import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const user = await getUserFromRequest(req);
    if (!user?._id) return res.status(401).json({ error: 'Unauthorized' });
    await connectToDatabase();
    await User.updateOne({ _id: user._id }, { $set: { tokens: 0 } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


