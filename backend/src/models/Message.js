import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatThread',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: false,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    whatsappMessageId: {
      type: String,
      default: null,
      index: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isOutreach: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Message = mongoose.model('Message', MessageSchema);
export default Message;
