import mongoose, { Schema } from 'mongoose';

const TriadVoteSchema = new Schema(
  {
    triadId: { type: Schema.Types.ObjectId, ref: 'Triad', index: true },
    voterId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

export const TriadVote = mongoose.models.TriadVote || mongoose.model('TriadVote', TriadVoteSchema); 