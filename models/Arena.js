import mongoose, { Schema } from 'mongoose';

const InterviewTurnSchema = new Schema(
  {
    role: { type: String, enum: ['assistant', 'user', 'opponent', 'ai'], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ArenaTakeSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestKey: { type: String, index: true },
    statement: { type: String, required: true },
    status: { type: String, enum: ['draft', 'interviewing', 'trained'], default: 'draft' },
    interview: { type: [InterviewTurnSchema], default: [] },
    debateHistory: { type: [InterviewTurnSchema], default: [] },
    profile: {
      type: new Schema(
        {
          claim: { type: String, default: '' },
          key_points: { type: [String], default: [] },
          tone: { type: String, default: '' },
          facts: { type: [String], default: [] },
          definitions: { type: Schema.Types.Mixed, default: {} },
          assumptions: { type: [String], default: [] },
          potential_hang_ups: { type: [String], default: [] },
          opponent_arguments: { type: [String], default: [] },
          counters: { type: [String], default: [] },
          edge_cases: { type: [String], default: [] },
          scope_limits: { type: [String], default: [] },
          confidence: { type: String, default: '' },
          target_audience: { type: String, default: '' },
          summary: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: undefined,
    },
    agentPrompt: { type: String, default: '' },
    debateResult: {
      type: new Schema(
        {
          aiScore: { type: Number, required: true },
          opponentScore: { type: Number, required: true },
          winner: { type: String, enum: ['ai', 'opponent'], required: true },
          reasoning: { type: String, required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

// Remove any existing model to avoid conflicts
if (mongoose.models.ArenaTake) {
  delete mongoose.models.ArenaTake;
}

export const ArenaTake = mongoose.model('ArenaTake', ArenaTakeSchema);


