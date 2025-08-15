import mongoose, { Schema } from 'mongoose';

const TriadSchema = new Schema(
  {
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt', index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 600 },
    transcript: { type: [Schema.Types.ObjectId], ref: 'Message', default: [] },
    status: { type: String, enum: ['pending', 'active', 'finished'], default: 'pending' },
    score: { type: Number, default: 0 },
    isWinner: { type: Boolean, default: false },
    userScores: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            score: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Triad = mongoose.models.Triad || mongoose.model('Triad', TriadSchema); 