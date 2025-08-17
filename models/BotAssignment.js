import mongoose, { Schema } from 'mongoose';

const BotAssignmentSchema = new Schema(
  {
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt', index: true },
    assignerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    botUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    personaKey: { type: String },
  },
  { timestamps: true }
);

export const BotAssignment =
  mongoose.models.BotAssignment || mongoose.model('BotAssignment', BotAssignmentSchema);


