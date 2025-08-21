import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ArenaTake } from '@/models/Arena';
import OpenAI from 'openai';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  await connectToDatabase();

  if (req.method === 'GET') {
    // Support guest testing: list by guestKey from cookie if no user
    const guestKey = req.cookies?.arena_guest || null;
    const query = user ? { ownerId: user._id } : guestKey ? { guestKey } : { _id: null };
    const items = await ArenaTake.find(query).sort({ updatedAt: -1 }).limit(100).lean();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    try {
      // Allow guests to create takes for testing; identify by cookie
      let guestKey = req.cookies?.arena_guest || '';
      if (!user && !guestKey) {
        guestKey = Math.random().toString(36).slice(2) + Date.now().toString(36);
        // Set a lax cookie for 7 days
        res.setHeader('Set-Cookie', `arena_guest=${guestKey}; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`);
      }
      if (!user && !guestKey) return res.status(500).json({ error: 'Failed to create guest session' });

      const { statement } = req.body || {};
      const text = (statement || '').trim();
      if (!text || text.length < 4) return res.status(400).json({ error: 'Statement too short' });

      // Create the take with proper fields
      const takeData = {
        statement: text,
        status: 'interviewing'
      };
      
      if (user) {
        takeData.ownerId = user._id;
      } else {
        takeData.guestKey = guestKey;
      }

      console.log('Creating take with data:', JSON.stringify(takeData, null, 2));
      const created = await ArenaTake.create(takeData);

      // Seed first AI question if OpenAI is configured
      try {
        const key = process.env.OPENAI_API_KEY;
        if (key) {
          const client = new OpenAI({ apiKey: key });
          const sys = 'You are a friendly, conversational AI having a natural discussion with someone about their take on an issue. Ask open-ended questions to understand their perspective, but don\'t push them to do research or provide more information than they want to share. Let the conversation flow naturally. Ask one question at a time.';
          const userMsg = `User's take: ${text}\n\nStart a natural conversation about their position. Ask an open question to understand their thinking, but don\'t pressure them to elaborate or research.`;
          const completion = await client.chat.completions.create({ 
            model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', 
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: userMsg },
            ]
          });
          const q = completion.choices?.[0]?.message?.content?.trim();
          if (q) {
            created.interview.push({ role: 'assistant', content: q });
            await created.save();
          }
        }
      } catch (e) {
        console.error('OpenAI error:', e);
      }

      return res.status(201).json({ item: created });
    } catch (e) {
      console.error('Create take error:', e);
      return res.status(500).json({ error: 'Failed to create take: ' + e.message });
    }
  }

  return res.status(405).end();
}


