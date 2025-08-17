import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { PromptResponse } from '@/models/PromptResponse';
import { Message } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import { BotAssignment } from '@/models/BotAssignment';
import User from '@/models/User';

const PERSONAS = [
  { key: 'witty', email: 'witty@bots.local', name: 'WittyBot' },
  { key: 'professor', email: 'professor@bots.local', name: 'ProfessorBot' },
  { key: 'trash', email: 'trash@bots.local', name: 'TrashTalkBot' },
];

export default async function handler(req, res) {
  const me = await getUserFromRequest(req);
  if (!me) return res.status(401).end();
  await connectToDatabase();

  try {
    const results = [];
    for (const p of PERSONAS) {
      const bot = await User.findOne({ email: p.email }).lean();
      if (!bot) {
        results.push({
          personaKey: p.key,
          name: p.name,
          botUser: null,
          promptsAssigned: await BotAssignment.countDocuments({ personaKey: p.key }),
          promptsResponded: 0,
          totalMessages: 0,
          triadsParticipated: 0,
          groupWins: 0,
          avgSentiment: 0,
          topTags: [],
          lastActiveAt: null,
        });
        continue;
      }

      const [promptsAssigned, promptsResponded] = await Promise.all([
        BotAssignment.countDocuments({ personaKey: p.key }),
        PromptResponse.countDocuments({ userId: bot._id }),
      ]);

      // Messages aggregation
      const msgAgg = await Message.aggregate([
        { $match: { senderId: bot._id } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          triads: { $addToSet: '$triadId' },
          rooms: { $addToSet: '$roomId' },
          avgSentiment: { $avg: '$sentiment' },
          lastActiveAt: { $max: '$createdAt' },
        }},
      ]);
      const msgStats = msgAgg[0] || { total: 0, triads: [], rooms: [], avgSentiment: 0, lastActiveAt: null };

      // Top tags
      const tagsAgg = await Message.aggregate([
        { $match: { senderId: bot._id } },
        { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$tags', c: { $sum: 1 } } },
        { $sort: { c: -1 } },
        { $limit: 7 },
      ]);
      const topTags = tagsAgg.map((t) => ({ tag: t._id, count: t.c }));

      // Group wins: triads the bot contributed to that were overall winners
      const triadIds = (msgStats.triads || []).filter(Boolean);
      let groupWins = 0;
      if (triadIds.length) {
        groupWins = await Triad.countDocuments({ _id: { $in: triadIds }, isWinner: true });
      }

      results.push({
        personaKey: p.key,
        name: p.name,
        botUser: { _id: bot._id, username: bot.username, profilePictureUrl: bot.profilePictureUrl },
        promptsAssigned,
        promptsResponded,
        totalMessages: msgStats.total || 0,
        triadsParticipated: (msgStats.triads || []).filter(Boolean).length,
        groupWins,
        avgSentiment: Number.isFinite(msgStats.avgSentiment) ? Number(msgStats.avgSentiment.toFixed(2)) : 0,
        topTags,
        lastActiveAt: msgStats.lastActiveAt || null,
      });
    }

    // Totals
    const totals = {
      promptsAssigned: results.reduce((a, r) => a + (r.promptsAssigned || 0), 0),
      promptsResponded: results.reduce((a, r) => a + (r.promptsResponded || 0), 0),
      totalMessages: results.reduce((a, r) => a + (r.totalMessages || 0), 0),
      triadsParticipated: results.reduce((a, r) => a + (r.triadsParticipated || 0), 0),
      groupWins: results.reduce((a, r) => a + (r.groupWins || 0), 0),
    };

    return res.status(200).json({ bots: results, totals });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to compute bot stats' });
  }
}


