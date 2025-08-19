import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    // Traditional auth fields (optional for Farcaster users)
    email: { type: String },
    username: { type: String, required: true },
    passwordHash: { type: String },

    // Farcaster identity
    fid: { type: Number, unique: true, sparse: true, index: true },
    fcUsername: { type: String },
    profilePictureUrl: { type: String },
    custodyAddress: { type: String },
    tokens: { type: Number, default: 0 },
    roles: { type: [String], default: ['user'] },
    acceptedTermsAt: { type: Date },
  },
  { timestamps: true }
);

// Ensure only real string emails are unique; allow many docs without email
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

export default mongoose.models.User || mongoose.model('User', UserSchema); 