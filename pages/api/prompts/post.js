import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';

export default async function handler(req, res) {
  const admin = await getUserFromRequest(req);
  if (!admin || !admin.roles?.includes('admin')) return res.status(403).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { text, category, durationHours } = req.body || {};
  const scheduledFor = durationHours
    ? new Date(Date.now() + durationHours * 3600 * 1000)
    : new Date(Date.now() + 10 * 60 * 1000);
  const prompt = await Prompt.create({ text, category, createdBy: admin._id, scheduledFor, active: true });
  return res.status(201).json({ prompt });
} 