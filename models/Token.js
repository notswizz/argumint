import mongoose, { Schema } from 'mongoose';

const TokenTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['earn_participation', 'earn_win', 'spend_boost', 'spend_customization', 'admin_adjust'],
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const TokenTransaction =
  mongoose.models.TokenTransaction || mongoose.model('TokenTransaction', TokenTransactionSchema); 