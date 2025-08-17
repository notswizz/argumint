import OpenAI from 'openai';
import { connectToDatabase } from '@/lib/db';
import { ChatRoom, Message } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import { Prompt } from '@/models/Debate';
import { BotAssignment } from '@/models/BotAssignment';
import User from '@/models/User';
import { analyzeSentiment, extractMessageTags } from '@/lib/openai';
import { getOrCreateIO } from '@/lib/socket';

export const PERSONAS = {
  witty: {
    username: 'WittyBot',
    profilePictureUrl: '/file.svg',
    system: [
      'You are WittyBot. You deliver playful, punchy one-liners with clever analogies.',
      'Stay friendly, insightful, and human-feeling. Keep it to 2-4 sentences. No profanity; family-friendly.',
      'Read the prompt and recent chat, add something genuinely helpful or funny, not generic.',
      'If you have nothing meaningful to add, reply exactly with [SKIP].',
    ].join('\n'),
  },
  professor: {
    username: 'ProfessorBot',
    profilePictureUrl: '/globe.svg',
    system: [
      'You are ProfessorBot. You argue in a structured, evidence-minded way and explain your reasoning like a helpful teacher.',
      'Be clear and respectful. Keep it to 3-6 sentences. Use concrete reasoning, not fluff.',
      'Read the prompt and chat transcript to tailor your response. If you have nothing meaningful to add, reply exactly with [SKIP].',
    ].join('\n'),
  },
  trash: {
    username: 'TrashTalkBot',
    profilePictureUrl: '/window.svg',
    system: [
      'You are TrashTalkBot. You bring friendly banter and confident swagger while staying clean and respectful.',
      'Bold takes with charm. Keep it to 2-4 sentences. Family-friendly; no insults or harassment.',
      'Read the prompt and chat transcript and add spicy but constructive takes. If not useful, reply exactly with [SKIP].',
    ].join('\n'),
  },
};

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function ensureBotUser(personaKey) {
  await connectToDatabase();
  const persona = PERSONAS[personaKey];
  if (!persona) throw new Error('Unknown bot');
  const email = `${personaKey}@bots.local`;
  let bot = await User.findOne({ email }).lean();
  if (bot) return bot;
  bot = await User.create({
    email,
    username: persona.username,
    passwordHash: '!',
    profilePictureUrl: persona.profilePictureUrl,
    roles: ['bot'],
  });
  return bot.toObject();
}

async function generateBotReply({ personaKey, promptText, transcript }) {
  if (!client) return null;
  const persona = PERSONAS[personaKey];
  if (!persona) return null;
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: persona.system },
        { role: 'user', content: `Prompt: ${promptText}\n\nRecent chat (oldest first):\n${transcript}\n\nRespond naturally with your take. Defend your take at all costs.` },
      ],
      response_format: { type: 'text' },
      verbosity: 'medium',
      reasoning_effort: 'medium',
    });
    const text = (res.choices?.[0]?.message?.content || '').trim();
    if (!text || /\[\s*skip\s*\]/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function triggerBotReplies({ roomId, triadId, promptId, excludeUserId = null }) {
  try {
    await connectToDatabase();
    // Ensure triad is active
    const triad = await Triad.findById(triadId).lean();
    if (!triad || triad.status !== 'active') return;

    const prompt = await Prompt.findById(promptId).lean();
    if (!prompt) return;

    const assignments = await BotAssignment.find({ promptId }).lean();
    if (!assignments.length) return;

    // Load recent messages and map user ids to usernames
    const recent = await Message.find({ triadId }).sort({ createdAt: -1 }).limit(40).lean();
    const reversed = [...recent].reverse();
    const userIds = Array.from(new Set(reversed.map((m) => String(m.senderId))));
    const users = await User.find({ _id: { $in: userIds } }).select('_id username roles').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // Decide helper and IO getter
    function shouldReplyDecision(personaKey, lines) {
      try {
        const last = (lines[lines.length - 1] || '').toLowerCase();
        const mentions = ['@wittybot', '@professorbot', '@trashtalkbot', 'wittybot', 'professorbot', 'trashtalkbot'];
        const isQuestion = /\?$/.test(last) || /\b(why|how|what|which|who|where|when)\b\s*\?/.test(last);
        const callsBot = mentions.some((m) => last.includes(m));
        const randomChance = Math.random() < 0.45;
        return callsBot || isQuestion || randomChance;
      } catch { return true; }
    }
    function getIOIfReady() { try { return getOrCreateIO(); } catch { return null; } }

    // For each bot assignment, consider responding
    for (const a of assignments) {
      const bot = await ensureBotUser(a.personaKey);
      if (!bot?._id) continue;
      // Skip if last message was by this bot (to avoid echo)
      const lastBot = await Message.findOne({ triadId, senderId: bot._id }).sort({ createdAt: -1 }).lean();
      if (lastBot && Date.now() - new Date(lastBot.createdAt).getTime() < 20 * 1000) continue;
      if (excludeUserId && String(excludeUserId) === String(bot._id)) continue;

      // Build transcript text
      const lines = reversed.map((m) => {
        const u = userMap.get(String(m.senderId));
        const name = u?.username || 'User';
        return `${name}: ${m.content}`;
      });
      const transcript = lines.join('\n').slice(0, 4000);

      // Decide whether to reply now
      if (!shouldReplyDecision(a.personaKey, lines)) continue;

      // Human-like delay and typing indication
      const delay = 1200 + Math.floor(Math.random() * 3300);
      const io = getIOIfReady();
      if (io && io.to) {
        try { io.to(roomId).emit('typing', { userId: bot._id }); } catch {}
        setTimeout(() => { try { io.to(roomId).emit('typing', { userId: bot._id }); } catch {} }, Math.floor(delay / 2));
      }

      setTimeout(async () => {
        try {
          const lastBotNow = await Message.findOne({ triadId, senderId: bot._id }).sort({ createdAt: -1 }).lean();
          if (lastBotNow && Date.now() - new Date(lastBotNow.createdAt).getTime() < 10 * 1000) return;
          const recentNow = await Message.find({ triadId }).sort({ createdAt: -1 }).limit(40).lean();
          const reversedNow = [...recentNow].reverse();
          const linesNow = reversedNow.map((m) => {
            const u = userMap.get(String(m.senderId));
            const name = u?.username || 'User';
            return `${name}: ${m.content}`;
          });
          const transcriptNow = linesNow.join('\n').slice(0, 4000);

          let text = await generateBotReply({ personaKey: a.personaKey, promptText: prompt.text, transcript: transcriptNow });
          if (!text) {
            const target = reversedNow.filter((m) => String(m.senderId) !== String(bot._id)).slice(-1)[0] || reversedNow[reversedNow.length - 1];
            const snippet = (target?.content || '').split(/\s+/).slice(0, 24).join(' ');
            if (a.personaKey === 'witty') text = snippet ? `I’m with this energy. ${snippet} — but here’s the twist…` : 'Here’s the twist I see…';
            else if (a.personaKey === 'professor') text = snippet ? `Good point. If we formalize it: ${snippet}. Two implications follow…` : 'Let’s structure this: define goals, constraints, then compare options.';
            else if (a.personaKey === 'trash') text = snippet ? `Nah, I’m calling it: ${snippet}. I’m betting on the upside.` : 'I’m calling it—taking the bold side.';
            else text = 'Here’s how I see it.';
          }
          if (!text) return;

          await ChatRoom.updateOne({ _id: roomId }, { $addToSet: { participants: bot._id } });
          const sentiment = await analyzeSentiment(text);
          const { tags, wordCount } = await extractMessageTags(text);
          const created = await Message.create({ roomId, senderId: bot._id, content: text, isDebate: true, triadId, promptId, sentiment, tags, wordCount });
          try {
            const io2 = getIOIfReady();
            if (io2 && io2.to) {
              let msg = created.toObject ? created.toObject() : created;
              io2.to(roomId).emit('message', msg);
            }
          } catch {}
        } catch {}
      }, delay);
    }
  } catch {}
}


