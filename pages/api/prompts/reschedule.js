import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';

export default async function handler(req, res) {
  const me = await getUserFromRequest(req);
  if (!me) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  // Only admins can reschedule AI prompts
  if (!Array.isArray(me.roles) || !me.roles.includes('admin')) return res.status(403).end();

  const { promptId, scheduledFor } = req.body || {};
  if (!promptId || !scheduledFor) return res.status(400).json({ error: 'Missing promptId or scheduledFor' });
  const newTime = new Date(scheduledFor);
  if (!Number.isFinite(newTime.getTime())) return res.status(400).json({ error: 'Invalid scheduledFor' });

  await connectToDatabase();
  const doc = await Prompt.findById(promptId);
  if (!doc) return res.status(404).json({ error: 'Prompt not found' });
  if (doc.active === false) return res.status(400).json({ error: 'Prompt already expired' });

  doc.scheduledFor = newTime;
  await doc.save();
  return res.status(200).json({ prompt: { _id: doc._id, scheduledFor: doc.scheduledFor } });
}


