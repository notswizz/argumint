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
    // winnerUserId retained for human-only winner
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    userScores: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            score: { type: Number, default: 0 },
            rubric: new Schema(
              {
                defense: { type: Number, default: 0 },
                evidence: { type: Number, default: 0 },
                logic: { type: Number, default: 0 },
                responsiveness: { type: Number, default: 0 },
                clarity: { type: Number, default: 0 },
              },
              { _id: false }
            ),
            feedback: { type: String, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    rubricPostedAt: { type: Date },
    groupFeedback: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Triad = mongoose.models.Triad || mongoose.model('Triad', TriadSchema); 