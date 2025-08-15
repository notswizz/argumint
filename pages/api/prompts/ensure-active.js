import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { generateDebatePrompts } from '@/lib/openai';
import { scheduleDuePrompts } from '@/lib/scheduler';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user || !user.roles?.includes('admin')) return res.status(403).end();
  await connectToDatabase();

  // Backstop: schedule expired ones now
  await scheduleDuePrompts();

  const now = new Date();
  let active = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .lean();

  const deficit = Math.max(0, 5 - active.length);
  if (deficit > 0) {
    // No fallback: require AI generation
    const generated = await generateDebatePrompts();
    if (!generated?.length) return res.status(500).json({ error: 'AI generation returned no prompts' });
    const created = await Prompt.insertMany(
      generated.slice(0, deficit).map((g, idx) => ({
        text: g.text,
        category: g.category || 'ai',
        createdBy: null,
        active: true,
        scheduledFor: new Date(Date.now() + (idx + 1) * 10 * 60 * 1000),
      }))
    );
    active = active.concat(created);
  }

  const items = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();

  return res.status(200).json({ items });
} 