import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ArenaTake } from '@/models/Arena';
import OpenAI from 'openai';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();

  const { takeId, opponentMessage } = req.body || {};
  if (!takeId) return res.status(400).json({ error: 'Missing takeId' });
  const take = await ArenaTake.findOne({ _id: takeId, ownerId: user._id });
  if (!take) return res.status(404).json({ error: 'Not found' });
  if (take.status !== 'trained' || !take.agentPrompt) return res.status(400).json({ error: 'Take not trained yet' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  const client = new OpenAI({ apiKey: key });

  const messages = [
    { role: 'system', content: take.agentPrompt },
    { role: 'user', content: (opponentMessage || 'Argue your position clearly and succinctly.').slice(0, 4000) },
  ];
  try {
    const completion = await client.chat.completions.create({ model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', messages });
    const content = completion.choices?.[0]?.message?.content || '';
    return res.status(200).json({ reply: content });
  } catch {
    return res.status(500).json({ error: 'Failed to generate argument' });
  }
}


