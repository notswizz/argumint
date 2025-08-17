import mongoose, { Schema } from 'mongoose';

const SystemSchema = new Schema(
  {
    key: { type: String, unique: true, index: true },
    lastSweepAt: { type: Date },
    lockedUntil: { type: Date },
  },
  { timestamps: true }
);

export const System = mongoose.models.System || mongoose.model('System', SystemSchema); 