import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Debate, Vote } from '@/models/Debate';
import User from '@/models/User';
import { TokenTransaction } from '@/models/Token';

const PARTICIPATION_TOKENS = 5;
const WIN_TOKENS = 15;

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();
  await connectToDatabase();
  const { debateId, winnerUserId } = req.body || {};
  const debate = await Debate.findById(debateId);
  if (!debate) return res.status(404).json({ error: 'Debate not found' });
  await Vote.create({ debateId, voterId: user._id, winnerUserId });
  // Mark finished and award tokens if not already
  if (debate.status !== 'finished') {
    debate.status = 'finished';
    debate.endedAt = new Date();
    debate.winnerUserId = winnerUserId;
    await debate.save();
    // Award tokens
    const userIds = [debate.userA, debate.userB].filter(Boolean);
    await Promise.all(
      userIds.map(async (uid) => {
        await User.findByIdAndUpdate(uid, { $inc: { tokens: PARTICIPATION_TOKENS } });
        await TokenTransaction.create({ userId: uid, amount: PARTICIPATION_TOKENS, type: 'earn_participation', metadata: { debateId } });
      })
    );
    if (winnerUserId) {
      await User.findByIdAndUpdate(winnerUserId, { $inc: { tokens: WIN_TOKENS } });
      await TokenTransaction.create({ userId: winnerUserId, amount: WIN_TOKENS, type: 'earn_win', metadata: { debateId } });
    }
  }
  return res.status(200).json({ ok: true });
} 