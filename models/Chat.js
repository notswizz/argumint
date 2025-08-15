import mongoose, { Schema } from 'mongoose';

const MessageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    content: { type: String, required: true },
    isDebate: { type: Boolean, default: false },
    debateId: { type: Schema.Types.ObjectId, ref: 'Debate' },
    triadId: { type: Schema.Types.ObjectId, ref: 'Triad' },
    sentiment: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt' },
    wordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ChatRoomSchema = new Schema(
  {
    name: { type: String },
    isGroup: { type: Boolean, default: false },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastMessageAt: { type: Date },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
export const ChatRoom = mongoose.models.ChatRoom || mongoose.model('ChatRoom', ChatRoomSchema); 