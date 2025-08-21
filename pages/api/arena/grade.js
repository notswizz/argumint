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

  const { takeId } = req.body || {};
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
  if (!Array.isArray(take.debateHistory) || take.debateHistory.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 debate messages to grade' });
  }

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const system = [
    'You are an impartial debate judge. Evaluate the debate between an opponent and an AI defending a specific position.',
    'Your primary focus is on TWO key areas:',
    '1. FACT-CHECKING (50% of score): Verify if claims, statistics, and evidence are accurate and properly cited',
    '2. ARGUMENT QUALITY (50% of score): Evaluate logic, reasoning, persuasiveness, and response to counterarguments',
    '',
    'Scoring breakdown:',
    '- Fact-checking (50%): Accuracy of claims, proper evidence, no false statements',
    '- Argument quality (50%): Logical structure, reasoning, persuasiveness, counter-argument handling',
    '',
    'Return ONLY valid JSON: {"aiScore": number, "opponentScore": number, "winner": "ai"|"opponent", "reasoning": "string"}',
    'The reasoning should focus on fact accuracy and argument strength.'
  ].join('\n');

  const debateText = take.debateHistory
    .map((msg, idx) => `${msg.role === 'opponent' ? 'Opponent' : 'AI'}: ${msg.content}`)
    .join('\n');
  
  const userMsg = `Position being defended: ${take.statement}\n\nDebate transcript:\n${debateText}\n\nGrade this debate with heavy emphasis on:\n1. FACT-CHECKING: Are claims accurate? Is evidence properly cited? Are there false statements?\n2. ARGUMENT QUALITY: Who made the stronger logical case? Who responded better to counterarguments?\n\nFocus on these two components equally. Be strict about factual accuracy.`;

  try {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg.slice(0, 45000) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    
    // Validate the response
    if (typeof result.aiScore !== 'number' || typeof result.opponentScore !== 'number' || 
        !['ai', 'opponent'].includes(result.winner) || typeof result.reasoning !== 'string') {
      throw new Error('Invalid grading response format');
    }

    // Update the take with the debate result
    take.debateResult = result;
    await take.save();

    return res.status(200).json(result);
  } catch (e) {
    console.error('Grading error:', e);
    return res.status(500).json({ error: 'Failed to grade debate' });
  }
}
