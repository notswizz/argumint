import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';
import User from '@/models/User';
import { BotAssignment } from '@/models/BotAssignment';
import OpenAI from 'openai';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const PERSONAS = {
  witty: {
    username: 'WittyBot',
    profilePictureUrl: '/file.svg',
    system: [
      'You are WittyBot. You deliver playful, punchy one-liners with clever analogies.',
      'Stay friendly, concise (2-3 sentences), and insightful. No profanity. Family-friendly.',
    ].join('\n'),
  },
  professor: {
    username: 'ProfessorBot',
    profilePictureUrl: '/globe.svg',
    system: [
      'You are ProfessorBot. You argue in a structured, evidence-minded way and explain your reasoning.',
      'Be clear and respectful. Keep to 3-5 sentences. No citations needed, but sound grounded.',
    ].join('\n'),
  },
  trash: {
    username: 'TrashTalkBot',
    profilePictureUrl: '/window.svg',
    system: [
      'You are TrashTalkBot. You bring friendly banter and confident swagger while staying clean and respectful.',
      'Keep it bold but family-friendly. 2-4 sentences.',
    ].join('\n'),
  },
};

async function getOrCreateBotUser(botKey) {
  const persona = PERSONAS[botKey];
  if (!persona) throw new Error('Unknown bot');
  const email = `${botKey}@bots.local`;
  let bot = await User.findOne({ email }).lean();
  if (bot) return bot;
  // Minimal user; passwordHash can be any string since bots do not log in
  bot = await User.create({
    email,
    username: persona.username,
    passwordHash: '!',
    profilePictureUrl: persona.profilePictureUrl,
    roles: ['bot'],
  });
  return bot.toObject();
}

export default async function handler(req, res) {
  const me = await getUserFromRequest(req);
  if (!me) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { promptId, botKey } = req.body || {};
  if (!promptId || !botKey) return res.status(400).json({ error: 'Missing promptId or botKey' });
  await connectToDatabase();

  const prompt = await Prompt.findOne({ _id: promptId, active: true }).lean();
  if (!prompt) return res.status(400).json({ error: 'Prompt not active' });

  try {
    const bot = await getOrCreateBotUser(botKey);

    // If already assigned, just return existing
    const existing = await PromptResponse.findOne({ promptId, userId: bot._id }).lean();
    if (existing) return res.status(200).json({ response: existing, bot });

    let text = '';
    if (client) {
      try {
        const persona = PERSONAS[botKey];
        const chat = await client.chat.completions.create({
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${persona.system}\nYour task for this message: Reply ONLY with a short stance (max 8 words). No reasons, no setup, no emojis, no hashtags.` },
            { role: 'user', content: `Prompt: ${prompt.text}\nRespond with stance only.` },
          ],
          temperature: 0.7,
        });
        text = (chat.choices?.[0]?.message?.content || '').trim() || '';
      } catch {}
    }
    if (!text) {
      const p = String(prompt.text || '').trim();
      if (botKey === 'witty') text = 'Going bold.';
      else if (botKey === 'professor') text = 'Leaning pragmatic.';
      else if (botKey === 'trash') text = 'Taking the hot side.';
      else text = 'My stance is set.';
    }

    const response = await PromptResponse.create({ promptId, userId: bot._id, text });
    await BotAssignment.create({ promptId, assignerId: me._id, botUserId: bot._id, personaKey: botKey });
    return res.status(201).json({ response, bot });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to assign bot' });
  }
}


