import { Server as IOServer } from 'socket.io';
import { analyzeSentiment, moderateContent, extractMessageTags } from './openai';
import { connectToDatabase } from './db';
import { ChatRoom, Message } from '@/models/Chat';
import { Triad } from '@/models/Triad';

let ioInstance = null;

export function getOrCreateIO(server) {
  if (ioInstance) return ioInstance;
  ioInstance = new IOServer(server, {
    path: '/api/socket/io',
    cors: { origin: '*' },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('join', async ({ roomId }) => {
      socket.join(roomId);
      // Send lock state if triad in this room has expired
      try {
        await connectToDatabase();
        const triad = await Triad.findOne({ roomId, status: 'active' }).lean();
        if (triad && triad.startedAt) {
          const startMs = new Date(triad.startedAt).getTime();
          const durMs = (triad.durationSec || 600) * 1000;
          const end = startMs + durMs;
          const now = Date.now();
          if (Number.isFinite(end)) {
            if (now >= end) {
              ioInstance.to(roomId).emit('triad_locked', { roomId });
            } else {
              const ms = end - now;
              if (ms > 0) setTimeout(() => ioInstance.to(roomId).emit('triad_locked', { roomId }), ms);
            }
          }
        }
      } catch {}
    });

    socket.on('leave', ({ roomId }) => {
      try {
        socket.leave(roomId);
      } catch {}
    });

    socket.on('typing', ({ roomId, userId }) => {
      socket.to(roomId).emit('typing', { userId });
    });

    socket.on('message', async ({ roomId, userId, content, isDebate = false, debateId = null, triadId = null, promptId = null }) => {
      await connectToDatabase();
      // If triad is over, reject messages
      if (triadId) {
        const triad = await Triad.findById(triadId);
        if (triad && triad.startedAt) {
          const end = new Date(triad.startedAt).getTime() + (triad.durationSec || 600) * 1000;
          if (Number.isFinite(end) && Date.now() >= end) {
            socket.emit('message_rejected', { reason: 'Debate time is over' });
            ioInstance.to(roomId).emit('triad_locked', { roomId });
            return;
          }
        }
      }

      const moderation = await moderateContent(content);
      if (!moderation.allowed) {
        socket.emit('message_rejected', { reason: 'Content violates policy' });
        return;
      }
      const sentiment = await analyzeSentiment(content);
      const { tags, wordCount } = await extractMessageTags(content);
      const message = await Message.create({ roomId, senderId: userId, content, isDebate, debateId, triadId, promptId, sentiment, tags, wordCount });
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessageAt: new Date(), $addToSet: { tags: { $each: tags } } });
      if (triadId) {
        await Triad.findByIdAndUpdate(triadId, { $push: { transcript: message._id } });
      }
      ioInstance.to(roomId).emit('message', { ...message.toObject() });
    });
  });

  return ioInstance;
}

export function getSocketClientUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}`;
} 