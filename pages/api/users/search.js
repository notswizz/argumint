import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import User from '@/models/User';

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();

  if (req.method !== 'GET') return res.status(405).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(200).json({ users: [] });

  try {
    const regex = new RegExp(escapeRegex(q), 'i');
    const items = await User.find({ username: { $regex: regex } })
      .select('_id username')
      .limit(10)
      .lean();
    return res.status(200).json({ users: items });
  } catch (e) {
    return res.status(500).json({ error: 'Search failed' });
  }
}


