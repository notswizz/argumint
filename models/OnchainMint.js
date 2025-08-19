import mongoose, { Schema } from 'mongoose';

const OnchainMintSchema = new Schema(
  {
    fid: { type: Number, index: true },
    toAddress: { type: String, index: true },
    amountTokens: { type: Number, required: true },
    nonce: { type: Number },
    reason: { type: String, enum: ['first_claim'], default: 'first_claim' },
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'mined', 'failed'], default: 'pending' },
  },
  { timestamps: true }
);

// Ensure we don't reuse the same nonce for a fid
OnchainMintSchema.index({ fid: 1, nonce: 1 }, { unique: true, sparse: true });

export default mongoose.models.OnchainMint || mongoose.model('OnchainMint', OnchainMintSchema);


