import mongoose, { Schema } from 'mongoose';

const PromptResponseSchema = new Schema(
  {
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export const PromptResponse =
  mongoose.models.PromptResponse || mongoose.model('PromptResponse', PromptResponseSchema); 