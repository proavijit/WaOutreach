import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    messageTemplate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'running', 'paused', 'completed', 'stopped'],
      default: 'draft',
      index: true,
    },
    config: {
      minDelaySeconds: {
        type: Number,
        default: 45,
        min: 5,
      },
      maxDelaySeconds: {
        type: Number,
        default: 90,
        min: 10,
      },
      batchSize: {
        type: Number,
        default: 15,
        min: 1,
      },
      batchCooldownMinutesMin: {
        type: Number,
        default: 12,
        min: 1,
      },
      batchCooldownMinutesMax: {
        type: Number,
        default: 18,
        min: 1,
      },
      dailyCap: {
        type: Number,
        default: 100,
        min: 1,
      },
    },
    stats: {
      totalLeads: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
      blacklistedCount: { type: Number, default: 0 },
      repliedCount: { type: Number, default: 0 },
      deliveredCount: { type: Number, default: 0 },
    },
    currentBatchCount: {
      type: Number,
      default: 0,
    },
    lastDispatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Campaign = mongoose.model('Campaign', CampaignSchema);
export default Campaign;
