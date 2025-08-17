import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Triad } from '@/models/Triad';
import { Prompt } from '@/models/Debate';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();

  const userId = user._id.toString();
  const triads = await Triad.find({ participants: user._id, status: { $in: ['active', 'finished'] } })
    .sort({ startedAt: -1 })
    .lean();

  // Attach prompt texts
  const promptIds = Array.from(new Set(triads.map((t) => t.promptId?.toString()).filter(Boolean)));
  const prompts = await Prompt.find({ _id: { $in: promptIds } })
    .select('text')
    .lean();
  const promptMap = new Map(prompts.map((p) => [p._id.toString(), p.text]));

  let debatesParticipated = 0;
  let groupWins = 0;
  let groupAvg = 0;
  let groupBest = 0;
  let groupWorst = null;

  let indAvg = 0;
  let indBest = 0;
  let indWorst = null;
  let place1 = 0, place2 = 0, place3 = 0;

  const recent = [];

  for (const t of triads) {
    debatesParticipated += 1;
    const gscore = Math.round(t.score || 0);
    groupAvg += gscore;
    groupBest = Math.max(groupBest, gscore);
    groupWorst = groupWorst == null ? gscore : Math.min(groupWorst, gscore);
    if (t.isWinner) groupWins += 1;

    // My individual score and place
    const scores = Array.isArray(t.userScores) ? t.userScores.map((u) => ({
      userId: u.userId?.toString(),
      score: Math.round(u.score || 0),
    })) : [];
    const mine = scores.find((s) => s.userId === userId);
    let myScore = mine?.score ?? 0;
    // If rubric exists, recompute as safeguard (matches rubric card)
    const myRubric = (Array.isArray(t.userScores) ? t.userScores : []).find((u) => (u.userId?.toString() || '') === userId)?.rubric || null;
    if (myRubric) {
      const r = myRubric;
      myScore = Math.round(0.35 * (r.defense || 0) + 0.20 * (r.evidence || 0) + 0.20 * (r.logic || 0) + 0.15 * (r.responsiveness || 0) + 0.10 * (r.clarity || 0));
    }
    indAvg += myScore;
    indBest = Math.max(indBest, myScore);
    indWorst = indWorst == null ? myScore : Math.min(indWorst, myScore);

    const sorted = [...scores].sort((a, b) => (b.score || 0) - (a.score || 0));
    const myIdx = sorted.findIndex((s) => s.userId === userId);
    const myPlace = myIdx >= 0 ? myIdx + 1 : null;
    if (myPlace === 1) place1 += 1; else if (myPlace === 2) place2 += 1; else if (myPlace === 3) place3 += 1;

    recent.push({
      triadId: t._id,
      promptText: promptMap.get(t.promptId?.toString() || '') || '',
      date: t.endedAt || t.startedAt,
      groupScore: gscore,
      isGroupWinner: !!t.isWinner,
      myScore,
      myPlace,
      participants: (t.participants || []).length,
    });
  }

  const denom = Math.max(1, debatesParticipated);
  const summary = {
    debatesParticipated,
    groupWins,
    groupAvg: Math.round(groupAvg / denom),
    groupBest,
    groupWorst: groupWorst == null ? 0 : groupWorst,
    indAvg: Math.round(indAvg / denom),
    indBest,
    indWorst: indWorst == null ? 0 : indWorst,
    placeDist: { first: place1, second: place2, third: place3 },
  };

  return res.status(200).json({ summary, recent });
}


