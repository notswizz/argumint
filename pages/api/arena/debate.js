import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ArenaTake } from '@/models/Arena';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();

  const { takeId, opponentMessage } = req.body || {};
  if (!takeId) return res.status(400).json({ error: 'Missing takeId' });
  
  let take = null;
  if (user) {
    take = await ArenaTake.findOne({ _id: takeId, ownerId: user._id });
  } else {
    const guestKey = req.cookies?.arena_guest || null;
    if (guestKey) take = await ArenaTake.findOne({ _id: takeId, guestKey });
  }
  
  if (!take) return res.status(404).json({ error: 'Not found' });
  if (take.status !== 'trained') return res.status(400).json({ error: 'Take not trained yet' });

  try {
    // Add opponent message to debate history
    if (opponentMessage) {
      take.debateHistory.push({ role: 'opponent', content: opponentMessage });
    }

    // Generate AI response if OpenAI is configured
    let aiResponse = '';
    if (OPENAI_API_KEY) {
      try {
        const client = new OpenAI({ apiKey: OPENAI_API_KEY });
        const messages = [
          { role: 'system', content: take.agentPrompt },
          { role: 'user', content: `Respond to this argument in 1-3 sentences max, using ONLY the knowledge and arguments the user provided during their interview. Do not add any new facts, examples, or arguments that the user did not mention. If you don't have information about something, say so. Opponent's message: ${opponentMessage}` },
        ];
        
        const completion = await client.chat.completions.create({
          model: CHAT_MODEL,
          messages,
        });
        
        aiResponse = completion.choices?.[0]?.message?.content || '';
        
        if (aiResponse) {
          take.debateHistory.push({ role: 'ai', content: aiResponse });
        }
      } catch (e) {
        console.error('OpenAI error:', e);
      }
    }

    await take.save();
    
    return res.status(200).json({ 
      success: true, 
      debateHistory: take.debateHistory,
      aiResponse 
    });
  } catch (e) {
    console.error('Debate error:', e);
    return res.status(500).json({ error: 'Failed to save debate message' });
  }
}
