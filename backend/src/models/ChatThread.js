import mongoose from 'mongoose';

const ChatThreadSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: false,
      index: true,
    },
    leadPhone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    leadName: {
      type: String,
      default: '',
      trim: true,
    },
    leadCompany: {
      type: String,
      default: '',
      trim: true,
    },
    assignedSessionId: {
      type: String,
      required: true,
      index: true,
    },
    accountLabel: {
      type: String,
      default: '',
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'blacklisted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index on phone and assignedSessionId
ChatThreadSchema.index({ leadPhone: 1, assignedSessionId: 1 }, { unique: true });

export const ChatThread = mongoose.model('ChatThread', ChatThreadSchema);
export default ChatThread;
