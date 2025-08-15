import { connectToDatabase } from '@/lib/db';
import { Message } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import { Prompt } from '@/models/Debate';
import { stringify } from 'csv-stringify/sync';

function anonymize(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{3}[-.)\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone]');
}

export default async function handler(req, res) {
  await connectToDatabase();
  const format = (req.query.format || 'json').toLowerCase();
  const items = await Message.find({}).lean();

  // Preload triads and prompts when referenced
  const triadIds = [...new Set(items.map((m) => m.triadId).filter(Boolean).map(String))];
  const triads = triadIds.length ? await Triad.find({ _id: { $in: triadIds } }).lean() : [];
  const promptIds = [...new Set(triads.map((t) => String(t.promptId)))];
  const prompts = promptIds.length ? await Prompt.find({ _id: { $in: promptIds } }).lean() : [];
  const triadMap = Object.fromEntries(triads.map((t) => [String(t._id), t]));
  const promptMap = Object.fromEntries(prompts.map((p) => [String(p._id), p]));

  const records = items.map((m) => {
    const triad = m.triadId ? triadMap[String(m.triadId)] : null;
    const prompt = triad ? promptMap[String(triad.promptId)] : null;
    return {
      _id: m._id,
      content: anonymize(m.content),
      createdAt: m.createdAt,
      promptId: m.promptId || (triad ? triad.promptId : null),
      debateTopic: prompt?.text || null,
      isDebate: Boolean(m.triadId),
      triadId: m.triadId || null,
      sentiment: m.sentiment,
      tags: m.tags,
      wordCount: m.wordCount || 0,
    };
  });

  if (format === 'csv') {
    const csv = stringify(records, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="conversations.csv"');
    return res.status(200).send(csv);
  }
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify(records));
} 