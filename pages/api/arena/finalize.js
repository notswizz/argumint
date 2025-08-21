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
    'You are an expert argument analyst. From an interview transcript, extract ONLY what the user explicitly stated.',
    'IMPORTANT: Do NOT add any facts, arguments, or content that the user did not mention. Only extract what they actually said.',
    'Return ONLY valid JSON object with keys:',
    '- "claim": The core position being defended (string)',
    '- "key_points": Array of main supporting arguments the user explicitly stated (array of strings)',
    '- "tone": The communication style the user demonstrated (string)',
    '- "facts": Array of concrete facts, statistics, or evidence the user actually cited (array of strings)',
    '- "definitions": Object of key terms and their meanings as defined by the user (object)',
    '- "assumptions": Array of underlying assumptions the user expressed (array of strings)',
    '- "potential_hang_ups": Array of weaknesses or concerns the user mentioned (array of strings)',
    '- "opponent_arguments": Array of what opponents might say based on user\'s own analysis (array of strings)',
    '- "counters": Array of responses to opponent arguments the user provided (array of strings)',
    '- "edge_cases": Array of boundary conditions or exceptions the user discussed (array of strings)',
    '- "scope_limits": Array of what the argument does NOT cover as stated by user (array of strings)',
    '- "confidence": Level of certainty the user expressed (high/medium/low)',
    '- "target_audience": Who this argument is aimed at as described by user (string)',
    '- "summary": Concise 2-3 sentence summary of the user\'s position (string)',
    'Be specific and actionable. Each array should have 3-7 items. If the user didn\'t mention something, leave that array empty or use minimal placeholder text.'
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
      'CRITICAL: Only use the knowledge and arguments the user explicitly provided during their interview. Do NOT add any new facts, statistics, examples, or arguments that the user did not mention.',
      'If asked about something not covered in your training, say "I wasn\'t trained on that specific point" or "The user didn\'t provide information about that."',
      `Your core position: ${profile.claim || take.statement}`,
      profile.key_points?.length ? `Key supporting points (user stated): ${profile.key_points.join('; ')}` : '',
      profile.tone ? `Communication tone (user demonstrated): ${profile.tone}` : '',
      profile.facts?.length ? `Your facts and evidence (user provided): ${profile.facts.join('; ')}` : '',
      profile.definitions ? `Key definitions (user defined): ${JSON.stringify(profile.definitions)}` : '',
      profile.assumptions?.length ? `Your assumptions (user expressed): ${profile.assumptions.join('; ')}` : '',
      profile.potential_hang_ups?.length ? `Be aware of these concerns (user mentioned): ${profile.potential_hang_ups.join('; ')}` : '',
      profile.opponent_arguments?.length ? `Common opponent arguments (user analyzed): ${profile.opponent_arguments.join('; ')}` : '',
      profile.counters?.length ? `Your counter-responses (user provided): ${profile.counters.join('; ')}` : '',
      profile.edge_cases?.length ? `Edge cases you considered (user discussed): ${profile.edge_cases.join('; ')}` : '',
      profile.scope_limits?.length ? `Scope limits (user stated): ${profile.scope_limits.join('; ')}` : '',
      profile.confidence ? `Confidence level (user expressed): ${profile.confidence}` : '',
      profile.target_audience ? `Target audience (user described): ${profile.target_audience}` : '',
      'Debate style: Be conversational, concise (1-3 sentences max), and ONLY use the above knowledge that the user explicitly provided. Do not strengthen arguments with additional facts or examples. Stay true to the user\'s exact position and knowledge.'
    ].filter(Boolean).join('\n');
    take.agentPrompt = agent;
    take.status = 'trained';
    await take.save();
    return res.status(200).json({ item: take });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to finalize profile' });
  }
}


