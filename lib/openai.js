import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set. OpenAI features will be disabled.');
}

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export function parseJsonArraySafe(content) {
  const text = (content || '').trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      return Array.isArray(parsed) ? parsed : null;
    } catch {}
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      return Array.isArray(parsed) ? parsed : null;
    } catch {}
  }
  return null;
}

export async function generateDebatePrompts(
  categories = [
    'sports',
    'basketball',
    'football',
    'soccer',
    'baseball',
    'pop_culture',
    'tv_film',
    'music',
    'hip_hop',
    'internet_trends',
    'memes',
    'gaming',
    'food',
    'tech',
    'politics',
    'ethics',
    'economics',
    'science',
    'society',
    'humor',
    'random'
  ]
) {
  if (!client) throw new Error('OPENAI_API_KEY not configured');
  const system = [
    'You generate timely, fun, open-ended debate prompts for casual group chats.',
    'Output format:',
    '- Return ONLY a JSON array of objects {"text": string, "category": string}. No prose, no markdown, no bullets.',
    'Specificity & recency:',
    '- Reference trending celebrities, creators, athletes, teams, shows, movies, games, products, or tech. Use proper names where fitting.',
    '- Be timely but do NOT include specific dates/years or spoilers.',
    'Open-endedness & debate energy:',
    "- Every prompt must be a question that invites reasoning, e.g., starting with 'Which', 'Who', 'How', 'Why', 'What', 'Rank', 'Draft', 'Build', 'Pitch', 'Defend'. Avoid yes/no phrasing.",
    "- Encourage justification with endings like '— and why?' or 'make the case'.",
    'Style & vibe:',
    '- Conversational, playful, and fun. Avoid academic tone and heavy policy talk.',
    "- Use entertaining formats when natural: 'who takes the last shot?', 'Mount Rushmore of X', 'start/bench/cut', 'rank your top 3', 'would you rather', 'overrated or underrated', 'draft a team of', 'keep 2 / cut 1', 'hot take on X'.",
    'Topical mix:',
    '- At least 3 FUN prompts (sports, pop culture, food, music, gaming, memes, internet trends).',
    '- Up to 2 SERIOUS prompts (tech, politics, ethics, economics, science, society) — keep approachable and not too heavy.',
    'Constraints:',
    '- Family-friendly; no explicit/NSFW content. No hate, harassment, or targeted identities.',
    '- No defamation or harmful claims about real people.',
    '- Keep prompts short (<= ~120 characters), neutral/arguable, and not leading. No emojis, no hashtags, no quotes.',
    '- Use a broad/global lens; avoid niche local references unless widely known.',
  ].join('\n');
  const user = `Generate 5 timely, specific, open-ended debate prompts that use named, trending entities where natural. Categories to draw from: ${categories.join(', ')}. Ensure each item includes a \\"category\\" from that list and reads as a question.`;
  const res = await client.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 1.05,
  });
  const content = res.choices?.[0]?.message?.content || '[]';
  const json = parseJsonArraySafe(content);
  if (!json || json.length < 1) throw new Error('Failed to parse AI prompt generation response');
  return json;
}

export async function moderateContent(text) {
  if (!client) return { allowed: true };
  const res = await client.moderations.create({ model: 'omni-moderation-latest', input: text });
  const result = res.results?.[0];
  const flagged = result?.flagged || false;
  return { allowed: !flagged, categories: result?.categories };
}

export async function analyzeSentiment(text) {
  try {
    const { default: Sentiment } = await import('sentiment');
    const analyzer = new Sentiment();
    const score = analyzer.analyze(text).score;
    return score;
  } catch {
    return 0;
  }
}

export async function extractMessageTags(text) {
  const tags = new Set();
  const lc = (text || '').toLowerCase();
  const words = lc.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (/(https?:\/\/|www\.)/.test(lc)) tags.add('has_link');
  if (/\?$/.test(lc.trim())) tags.add('question');
  if (/\b(source|citation|evidence)\b/.test(lc)) tags.add('evidence');
  if (/\b(agree|disagree|rebut|counter)\b/.test(lc)) tags.add('argumentation');
  if (wordCount > 80) tags.add('long');
  if (wordCount < 8) tags.add('short');

  if (client) {
    try {
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Extract up to 5 concise tags describing the rhetorical function and topic. Respond as comma-separated list only.' },
          { role: 'user', content: text.slice(0, 2000) },
        ],
        temperature: 0,
      });
      const extra = res.choices?.[0]?.message?.content || '';
      extra.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).forEach((t) => tags.add(t.replace(/\s+/g, '_')));
    } catch {}
  }

  return { tags: Array.from(tags), wordCount };
} 