import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).end();
  await connectToDatabase();
  const now = new Date();
  const prompts = await Prompt.find({ active: true, scheduledFor: { $gt: now } })
    .sort({ scheduledFor: 1, createdAt: -1 })
    .limit(5)
    .lean();
  if (!prompts?.length) return res.status(200).json({ responses: [] });
  const ids = prompts.map((p) => p._id);
  const responses = await PromptResponse.find({ promptId: { $in: ids }, userId: user._id }).lean();
  const responseByPrompt = new Map(responses.map((r) => [r.promptId.toString(), r]));
  return res.status(200).json({ responses: prompts.map((p) => ({ promptId: p._id, response: responseByPrompt.get(p._id.toString()) || null })) });
} 