import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ArenaTake } from '@/models/Arena';
import { moderateContent } from '@/lib/openai';
import OpenAI from 'openai';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  await connectToDatabase();

  const { takeId } = req.body || req.query || {};
  if (!takeId) return res.status(400).json({ error: 'Missing takeId' });
  let take = null;
  if (user) {
    take = await ArenaTake.findOne({ _id: takeId, ownerId: user._id });
  } else {
    const guestKey = req.cookies?.arena_guest || null;
    if (guestKey) take = await ArenaTake.findOne({ _id: takeId, guestKey });
  }
  if (!take) return res.status(404).json({ error: 'Not found' });

  if (req.method === 'GET') {
    return res.status(200).json({ item: take });
  }

  if (req.method === 'POST') {
    const { userMessage } = req.body || {};
    const content = (userMessage || '').trim();
    if (!content) return res.status(400).json({ error: 'Empty message' });

    const mod = await moderateContent(content);
    if (!mod.allowed) return res.status(400).json({ error: 'Message not allowed' });

    take.interview.push({ role: 'user', content });
    // Generate next assistant question if OpenAI configured
    try {
      const key = process.env.OPENAI_API_KEY;
      if (key) {
        const client = new OpenAI({ apiKey: key });
        const sys = 'You are having a natural, friendly conversation with someone about their take on an issue. Ask gentle follow-up questions to understand their perspective better, but don\'t push them to elaborate or provide more information than they want to share. Let them express their thoughts naturally. Ask ONE conversational question at a time.';
        const transcript = take.interview
          .map((t) => `${t.role === 'assistant' ? 'AI' : 'User'}: ${t.content}`)
          .join('\n');
        const userMsg = `User's take: ${take.statement}\n\nConversation so far:\n${transcript}\n\nAsk a natural follow-up question to continue the conversation. Don\'t pressure them to elaborate or research - just let them share what they want to share.`;
        const completion = await client.chat.completions.create({ model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg.slice(0, 45000) },
        ]});
        const nextQ = completion.choices?.[0]?.message?.content?.trim();
        if (nextQ) take.interview.push({ role: 'assistant', content: nextQ });
      }
    } catch {}

    await take.save();
    return res.status(201).json({ item: take });
  }

  return res.status(405).end();
}


