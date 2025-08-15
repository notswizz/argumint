import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { TriadVote } from '@/models/TriadVote';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { triadId } = req.body || {};
  if (!triadId) return res.status(400).json({ error: 'Missing triadId' });
  const existing = await TriadVote.findOne({ triadId, voterId: user._id });
  if (existing) return res.status(409).json({ error: 'Already voted' });
  await TriadVote.create({ triadId, voterId: user._id });
  return res.status(201).json({ ok: true });
} 