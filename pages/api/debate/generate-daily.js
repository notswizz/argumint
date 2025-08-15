import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { generateDebatePrompts } from '@/lib/openai';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user || !user.roles?.includes('admin')) return res.status(403).end();
  await connectToDatabase();
  const prompts = await generateDebatePrompts();
  const created = await Prompt.insertMany(prompts.map((p) => ({ ...p, createdBy: user._id })));
  return res.status(201).json({ items: created });
} 