import mongoose, { Schema } from 'mongoose';

const DebateSchema = new Schema(
  {
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt' },
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom' },
    userA: { type: Schema.Types.ObjectId, ref: 'User' },
    userB: { type: Schema.Types.ObjectId, ref: 'User' },
    stanceA: { type: String, enum: ['pro', 'con'] },
    stanceB: { type: String, enum: ['pro', 'con'] },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 300 },
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    transcript: { type: [Schema.Types.ObjectId], ref: 'Message', default: [] },
    status: { type: String, enum: ['pending', 'active', 'finished'], default: 'pending' },
  },
  { timestamps: true }
);

const PromptSchema = new Schema(
  {
    text: { type: String, required: true },
    category: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduledFor: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const VoteSchema = new Schema(
  {
    debateId: { type: Schema.Types.ObjectId, ref: 'Debate', index: true },
    voterId: { type: Schema.Types.ObjectId, ref: 'User' },
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Debate = mongoose.models.Debate || mongoose.model('Debate', DebateSchema);
export const Prompt = mongoose.models.Prompt || mongoose.model('Prompt', PromptSchema);
export const Vote = mongoose.models.Vote || mongoose.model('Vote', VoteSchema); 