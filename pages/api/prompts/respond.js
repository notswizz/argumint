import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { text, promptId } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty response' });
  if (!promptId) return res.status(400).json({ error: 'Missing promptId' });
  const now = new Date();
  const prompt = await Prompt.findOne({ _id: promptId, active: true, scheduledFor: { $gt: now } });
  if (!prompt) return res.status(400).json({ error: 'Prompt not active' });
  const existing = await PromptResponse.findOne({ promptId: prompt._id, userId: user._id });
  if (existing) return res.status(409).json({ error: 'Already responded' });
  const response = await PromptResponse.create({ promptId: prompt._id, userId: user._id, text: text.trim() });
  return res.status(201).json({ response });
} 