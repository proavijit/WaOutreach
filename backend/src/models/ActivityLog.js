import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['info', 'warning', 'error', 'success', 'opt_out', 'cooldown', 'guardrail'],
      default: 'info',
    },
    action: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
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

// TTL index to automatically prune logs older than 7 days if desired
ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);
export default ActivityLog;
