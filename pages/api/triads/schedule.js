import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { Prompt } from '@/models/Debate';
import { PromptResponse } from '@/models/PromptResponse';
import { ChatRoom } from '@/models/Chat';
import { Triad } from '@/models/Triad';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || !admin.roles?.includes('admin')) return res.status(403).end();
    if (req.method !== 'POST') return res.status(405).end();
    await connectToDatabase();
    const { promptId, force = false, allowPairs = true } = req.body || {};
    const now = new Date();
    const prompt = await Prompt.findOne(promptId ? { _id: promptId } : {}).sort({ createdAt: -1 });
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    if (!force && !(prompt.scheduledFor && prompt.scheduledFor <= now)) {
      return res.status(400).json({ error: 'Prompt deadline not reached. Pass force=true to override.' });
    }

    // Exclude users already scheduled into a triad for this prompt
    const existingTriads = await Triad.find({ promptId: prompt._id }).lean();
    const alreadyAssigned = new Set(existingTriads.flatMap((t) => t.participants.map((id) => id.toString())));

    const responses = await PromptResponse.find({ promptId: prompt._id })
      .sort({ createdAt: 1 })
      .lean();

    // Build unique queue of unassigned responders
    const seen = new Set();
    const queue = [];
    for (const r of responses) {
      const uid = r.userId.toString();
      if (alreadyAssigned.has(uid)) continue;
      if (seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }

    if (queue.length < 2) {
      return res.status(200).json({ created: 0, message: 'Not enough respondents to form a debate (need at least 2).', triads: [] });
    }

    const triads = [];
    // Helper to cast participants to ObjectIds
    const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(id));

    // Group by 3 first
    while (queue.length >= 3) {
      const participants = queue.splice(0, 3);
      const participantsObj = toObjectIds(participants);
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: participantsObj, lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: participantsObj, startedAt: new Date(), status: 'active' });
      triads.push({ triadId: triad._id, roomId: room._id, participants });
    }
    // If 2 remain and allowed, create a pair session using Triad model
    if (allowPairs && queue.length === 2) {
      const participants = queue.splice(0, 2);
      const participantsObj = toObjectIds(participants);
      const room = await ChatRoom.create({ name: prompt.text, isGroup: true, participants: participantsObj, lastMessageAt: new Date() });
      const triad = await Triad.create({ promptId: prompt._id, roomId: room._id, participants: participantsObj, startedAt: new Date(), status: 'active' });
      triads.push({ triadId: triad._id, roomId: room._id, participants });
    }

    // Optionally mark prompt inactive when scheduling is initiated
    if (force || (prompt.scheduledFor && prompt.scheduledFor <= now)) {
      prompt.active = false;
      await prompt.save();
    }

    return res.status(201).json({ created: triads.length, triads });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Scheduling failed' });
  }
} 