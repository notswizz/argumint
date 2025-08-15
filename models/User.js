import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    profilePictureUrl: { type: String },
    tokens: { type: Number, default: 0 },
    roles: { type: [String], default: ['user'] },
    acceptedTermsAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema); 