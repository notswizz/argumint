import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ArenaTake } from '@/models/Arena';
import OpenAI from 'openai';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();

  if (req.method === 'GET') {
    const items = await ArenaTake.find({ ownerId: user._id }).sort({ updatedAt: -1 }).limit(100).lean();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const { statement } = req.body || {};
    const text = (statement || '').trim();
    if (!text || text.length < 4) return res.status(400).json({ error: 'Statement too short' });
    const created = await ArenaTake.create({ ownerId: user._id, statement: text, status: 'interviewing' });

    // Seed first AI question if OpenAI is configured
    try {
      const key = process.env.OPENAI_API_KEY;
      if (key) {
        const client = new OpenAI({ apiKey: key });
        const sys = 'You interview a user to fully understand their take. Ask one precise question at a time to clarify definitions, premises, evidence, scope, and edge cases. Keep questions short.';
        const userMsg = `User's take: ${text}\nAsk your first question.`;
        const completion = await client.chat.completions.create({ model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ]});
        const q = completion.choices?.[0]?.message?.content?.trim();
        if (q) {
          created.interview.push({ role: 'assistant', content: q });
          await created.save();
        }
      }
    } catch {}
    return res.status(201).json({ item: created });
  }

  return res.status(405).end();
}


