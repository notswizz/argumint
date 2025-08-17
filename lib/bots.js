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
      'Avoid boilerplate openings and templates. Do NOT use phrases like "Good point.", "If we formalize it:", or "Two implications follow". Vary your openings and tone.',
      'Do not copy user text verbatim. Paraphrase and move the idea forward.',
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

export async function getAllBotUsers() {
  const keys = Object.keys(PERSONAS);
  const bots = [];
  for (const k of keys) {
    const u = await ensureBotUser(k);
    bots.push({ personaKey: k, user: u });
  }
  return bots;
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
        { role: 'user', content: `You are in a chat room and your task is to create conversation around each user's take on the prompt. Prompt: ${promptText}\n\nRecent chat (oldest first):\n${transcript}\n\nRespond naturally with your take. Defend your take at all costs.` },
      ],
      response_format: { type: 'text' },
      verbosity: 'low',
      reasoning_effort: 'low',
      max_tokens: 140,
    });
    const text = (res.choices?.[0]?.message?.content || '').trim();
    if (!text || /\[\s*skip\s*\]/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function generateBotStanceShort(personaKey, promptText) {
  if (!client) return null;
  const persona = PERSONAS[personaKey];
  if (!persona) return null;
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: `${persona.system}\nYour task: Reply ONLY with a short take on the prompt (max 8 words). No reasons, no setup, no emojis, no hashtags. You will havce to defend your position later` },
        { role: 'user', content: `Prompt: ${promptText}\nRespond with stance only.` },
      ],
      response_format: { type: 'text' },
      verbosity: 'low',
      reasoning_effort: 'low',
      max_tokens: 20,
    });
    const text = (res.choices?.[0]?.message?.content || '').trim();
    return text || null;
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

    // Determine bots by triad participants (no manual assignment needed)
    const allBots = await getAllBotUsers();
    const botById = new Map(allBots.map((b) => [String(b.user._id), b]));
    const botParticipants = (triad.participants || [])
      .map((id) => botById.get(String(id)))
      .filter(Boolean);
    if (!botParticipants.length) return;

    // Load recent messages and map user ids to usernames
    const recent = await Message.find({ triadId }).sort({ createdAt: 1 }).limit(80).lean();
    const reversed = [...recent];
    const userIds = Array.from(new Set(reversed.map((m) => String(m.senderId))));
    const users = await User.find({ _id: { $in: userIds } }).select('_id username roles').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // Decide helper and IO getter
    function shouldReplyDecision() { return true; }
    function getIOIfReady() { try { return getOrCreateIO(); } catch { return null; } }

    // Simple similarity checker to avoid loops/echoes
    function isTooSimilar(a = '', b = '') {
      const na = String(a).toLowerCase().replace(/[\W_]+/g, ' ').trim();
      const nb = String(b).toLowerCase().replace(/[\W_]+/g, ' ').trim();
      if (!na || !nb) return false;
      if (na === nb) return true;
      if (na.includes(nb) || nb.includes(na)) return true;
      const wa = new Set(na.split(/\s+/).filter(Boolean));
      const wb = new Set(nb.split(/\s+/).filter(Boolean));
      const inter = [...wa].filter((w) => wb.has(w)).length;
      const jaccard = inter / (wa.size + wb.size - inter || 1);
      return jaccard > 0.8;
    }

    // Persona-specific fallback variants to avoid repeated templates
    function fallbackVariant(personaKey, snippet = '') {
      const s = snippet ? snippet.replace(/\s+/g, ' ').trim() : '';
      const witty = [
        s ? `I’m into this: ${s} — but here’s my twist.` : 'Here’s a twist I see…',
        s ? `Fair point on ${s}. I’ll zag:` : 'I’ll zag for a second…',
        s ? `Hot angle: not just ${s}, here’s the catch.` : 'Hot angle: here’s the catch.',
      ];
      const prof = [
        s ? `Framed differently: ${s}. One key tradeoff matters.` : 'Let’s frame it: one key tradeoff matters.',
        s ? `Practical lens on ${s}: here’s the core constraint.` : 'Practical lens: here’s the core constraint.',
        s ? `Evidence-wise, ${s} hints at a better option.` : 'Evidence-wise, there’s a better option.',
      ];
      const trash = [
        s ? `I’m taking the swing: ${s}. Call it now.` : 'I’m taking the swing—calling it now.',
        s ? `Betting on ${s}. No hedge.` : 'No hedge—I’m betting bold.',
        s ? `${s}? I’m all in.` : 'I’m all in on the upside.',
      ];
      const pool = personaKey === 'witty' ? witty : personaKey === 'professor' ? prof : trash;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // For each bot participant, consider responding
    for (const b of botParticipants) {
      const bot = b.user;
      if (!bot?._id) continue;
      // Skip if last message was by this bot (to avoid echo)
      const lastBotRecent = await Message.findOne({ triadId, senderId: bot._id }).sort({ createdAt: -1 }).lean();
      if (lastBotRecent && Date.now() - new Date(lastBotRecent.createdAt).getTime() < 1000) continue;
      if (excludeUserId && String(excludeUserId) === String(bot._id)) continue;

      // Build transcript text
      const lines = reversed.map((m) => {
        const u = userMap.get(String(m.senderId));
        const name = u?.username || 'User';
        return `${name}: ${m.content}`;
      });
      const transcript = lines.join('\n').slice(0, 4000);

      // Decide whether to reply now
      if (!shouldReplyDecision(b.personaKey, lines)) continue;

      // Immediate attempt, minimal anti-spam guard
      const lastBotNow2 = await Message.findOne({ triadId, senderId: bot._id }).sort({ createdAt: -1 }).lean();
      if (lastBotNow2 && Date.now() - new Date(lastBotNow2.createdAt).getTime() < 400) continue;
      const recentNow = await Message.find({ triadId }).sort({ createdAt: 1 }).limit(80).lean();
      const reversedNow = [...recentNow];
      const linesNow = reversedNow.map((m) => {
        const u = userMap.get(String(m.senderId));
        const name = u?.username || 'User';
        return `${name}: ${m.content}`;
      });
      const transcriptNow = linesNow.join('\n').slice(0, 4000);

      // Fast path: small-context probe for a quick short response
      let text = await (async () => {
        try {
          const shortRes = await client.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: `${PERSONAS[b.personaKey].system}\nBe brief and concrete. Avoid boilerplate. Do not use phrases like "Good point.", "If we formalize it:", or "Two implications follow".` },
              { role: 'user', content: `Prompt: ${prompt.text}\nLast few messages:\n${linesNow.slice(-6).join('\n')}\nReply naturally.` },
            ],
            response_format: { type: 'text' },
            verbosity: 'low',
            reasoning_effort: 'low',
            max_tokens: 120,
          });
          return (shortRes.choices?.[0]?.message?.content || '').trim();
        } catch { return null; }
      })();
      if (!text) {
        text = await generateBotReply({ personaKey: b.personaKey, promptText: prompt.text, transcript: transcriptNow });
      }
      if (!text) {
        const target = reversedNow.filter((m) => String(m.senderId) !== String(bot._id)).slice(-1)[0] || reversedNow[reversedNow.length - 1];
        const snippet = (target?.content || '').split(/\s+/).slice(0, 24).join(' ');
        text = fallbackVariant(b.personaKey, snippet);
      }
      if (!text) continue;

      // Loop/echo guards: avoid posting near-duplicate content
      const lastBotCheck = await Message.findOne({ triadId, senderId: bot._id }).sort({ createdAt: -1 }).lean();
      if (lastBotCheck && isTooSimilar(text, lastBotCheck.content)) continue;
      const lastHuman = reversedNow.slice(-1)[0];
      if (lastHuman && isTooSimilar(text, lastHuman.content)) continue;

      await ChatRoom.updateOne({ _id: roomId }, { $addToSet: { participants: bot._id } });
      const sentiment = await analyzeSentiment(text);
      const { tags, wordCount } = await extractMessageTags(text);
      const created = await Message.create({ roomId, senderId: bot._id, content: text, isDebate: true, triadId, promptId, sentiment, tags, wordCount });
      try {
        const io2 = getIOIfReady();
        if (io2 && io2.to) {
          let msg = created.toObject ? created.toObject() : created;
          io2.to(roomId).emit('message', msg);
        } else {
          // Fallback: hit same-origin socket warmup to ensure server-side IO is ready
          if (typeof fetch !== 'undefined') {
            try { fetch(`/api/socket`); } catch {}
          }
        }
      } catch {}
    }
  } catch {}
}


