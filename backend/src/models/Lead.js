import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      trim: true,
      default: '',
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'failed', 'delivered', 'read', 'replied', 'blacklisted'],
      default: 'pending',
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
      default: null,
    },
    sentContent: {
      type: String,
      default: '',
    },
    whatsappMessageId: {
      type: String,
      default: null,
      index: true,
    },
    assignedSessionId: {
      type: String,
      default: null,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastMessageSentAt: {
      type: Date,
      default: null,
    },
    blacklistedAt: {
      type: Date,
      default: null,
    },
    blacklistReason: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate phone numbers per campaign
LeadSchema.index({ phone: 1, campaignId: 1 }, { unique: true, sparse: true });

export const Lead = mongoose.model('Lead', LeadSchema);
export default Lead;
