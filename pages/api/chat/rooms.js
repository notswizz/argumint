import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { ChatRoom } from '@/models/Chat';
import { Triad } from '@/models/Triad';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  if (req.method === 'GET') {
    const rooms = await ChatRoom.find({ participants: user._id })
      .sort({ updatedAt: -1 })
      .lean();
    const roomIds = rooms.map((r) => r._id);
    const triads = await Triad.find({ roomId: { $in: roomIds } })
      .select('roomId status isWinner userScores participants score')
      .lean();

    const triadMap = new Map();
    for (const t of triads) {
      const participants = (t.participants || []).map((id) => id.toString());
      const myId = user._id.toString();
      let myScore = null;
      let myPlace = null;
      const scores = Array.isArray(t.userScores)
        ? t.userScores.map((us) => {
            const uid = us.userId?.toString();
            const r = us.rubric || {};
            // Prefer rubric re-compute to guarantee consistency with the rubric card
            const hasRubric = [r.defense, r.evidence, r.logic, r.responsiveness, r.clarity].some((v) => typeof v === 'number');
            const weighted = hasRubric
              ? Math.round(
                  0.35 * (r.defense || 0) +
                    0.20 * (r.evidence || 0) +
                    0.20 * (r.logic || 0) +
                    0.15 * (r.responsiveness || 0) +
                    0.10 * (r.clarity || 0)
                )
              : Math.round(us.score || 0);
            return { userId: uid, score: weighted };
          })
        : [];
      if (scores.length) {
        const sorted = [...scores].sort((a, b) => (b.score || 0) - (a.score || 0));
        const idx = sorted.findIndex((s) => s.userId === myId);
        if (idx >= 0) {
          myScore = sorted[idx].score || 0;
          myPlace = idx + 1;
        }
      }
      triadMap.set(t.roomId.toString(), {
        status: t.status,
        isWinner: !!t.isWinner,
        groupScore: Math.round(t.score || 0),
        myScore,
        myPlace,
        participantsCount: participants.length,
      });
    }

    const enriched = rooms.map((r) => ({ ...r, triad: triadMap.get(r._id.toString()) || null }));
    return res.status(200).json({ rooms: enriched });
  } else if (req.method === 'POST') {
    const { name } = req.body || {};
    const room = await ChatRoom.create({ name: name || 'New Room', isGroup: true, participants: [user._id] });
    return res.status(201).json({ room });
  }
  return res.status(405).end();
} 