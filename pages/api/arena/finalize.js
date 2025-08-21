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
  if (!Array.isArray(take.interview) || take.interview.length < 1) return res.status(400).json({ error: 'Interview is empty' });

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const system = [
    'You are an expert argument modeler. From an interview transcript, extract a complete, concise profile to argue on the user\'s behalf.',
    'Return ONLY valid JSON object with keys: claim, definitions (object), premises (array), evidence (array), counterarguments (array), responses (array), assumptions (array), edge_cases (array), scope_limits (array), tone (string), style (string), target_audience (string), confidence (string), summary (string).',
  ].join('\n');
  const convoText = take.interview
    .map((t) => `${t.role === 'assistant' ? 'AI' : 'User'}: ${t.content}`)
    .join('\n');
  const userMsg = `User's core statement: ${take.statement}\nInterview transcript (chronological):\n${convoText}`;
  const options = {
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg.slice(0, 45000) },
    ],
    response_format: { type: 'json_object' },
  };

  try {
    const completion = await client.chat.completions.create(options);
    const content = completion.choices?.[0]?.message?.content || '{}';
    const profile = JSON.parse(content);
    take.profile = profile;
    // Build an agent system prompt for later use in debates
    const agent = [
      'You are a conversational AI that argues on behalf of a specific user. Stay focused and concise.',
      'IMPORTANT: Only use the knowledge and arguments you were trained on. Do not make up new facts or arguments.',
      `Your core position: ${profile.claim || take.statement}`,
      profile.definitions ? `Key definitions: ${JSON.stringify(profile.definitions)}` : '',
      profile.premises?.length ? `Your premises: ${profile.premises.join('; ')}` : '',
      profile.evidence?.length ? `Your evidence: ${profile.evidence.join('; ')}` : '',
      profile.counterarguments?.length ? `Common counters you know: ${profile.counterarguments.join('; ')}` : '',
      profile.responses?.length ? `Your responses to counters: ${profile.responses.join('; ')}` : '',
      profile.assumptions?.length ? `Your assumptions: ${profile.assumptions.join('; ')}` : '',
      profile.edge_cases?.length ? `Edge cases you considered: ${profile.edge_cases.join('; ')}` : '',
      profile.scope_limits?.length ? `Scope limits: ${profile.scope_limits.join('; ')}` : '',
      profile.tone ? `Tone: ${profile.tone}` : '',
      profile.style ? `Style: ${profile.style}` : '',
      profile.target_audience ? `Target audience: ${profile.target_audience}` : '',
      profile.confidence ? `Confidence level: ${profile.confidence}` : '',
      'Debate style: Be conversational, concise (1-3 sentences max), and only use the above knowledge. If asked about something not covered, say "I wasn\'t trained on that specific point." Stay true to your position.'
    ].filter(Boolean).join('\n');
    take.agentPrompt = agent;
    take.status = 'trained';
    await take.save();
    return res.status(200).json({ item: take });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to finalize profile' });
  }
}


