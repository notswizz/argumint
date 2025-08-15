import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { generateDebatePrompts } from '@/lib/openai';

export default async function handler(req, res) {
  await connectToDatabase();
  if (req.method === 'GET') {
    const { activeOnly } = req.query || {};
    if (activeOnly) {
      const now = new Date();
      const items = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
        .sort({ scheduledFor: 1, createdAt: -1 })
        .limit(5)
        .lean();
      return res.status(200).json({ items });
    }
    const items = await Prompt.find({}).sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ items });
  }
  const user = await getUserFromRequest(req);
  if (!user || !user.roles?.includes('admin')) return res.status(403).end();
  if (req.method === 'POST') {
    const { text, category, auto } = req.body || {};
    if (auto) {
      const prompts = await generateDebatePrompts();
      const created = await Prompt.insertMany(prompts.map((p) => ({ ...p, createdBy: user._id })));
      return res.status(201).json({ items: created });
    }
    const p = await Prompt.create({ text, category, createdBy: user._id });
    return res.status(201).json({ item: p });
  }
  if (req.method === 'PATCH') {
    const { id, active, durationHours } = req.body || {};
    const update = {};
    if (typeof active === 'boolean') update.active = active;
    if (durationHours) update.scheduledFor = new Date(Date.now() + durationHours * 3600 * 1000);
    const updated = await Prompt.findByIdAndUpdate(id, update, { new: true });
    return res.status(200).json({ item: updated });
  }
  return res.status(405).end();
} 