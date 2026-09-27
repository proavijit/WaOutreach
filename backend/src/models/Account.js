import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      default: 'Outreach Account',
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'BANNED', 'QR_READY'],
      default: 'DISCONNECTED',
      index: true,
    },
    dailyLimit: {
      type: Number,
      default: 20,
      min: 1,
      max: 200,
    },
    sentToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReset: {
      type: Date,
      default: Date.now,
    },
    // Peer-to-Peer Warmup Engine Metrics
    warmupDays: {
      type: Number,
      default: 1,
      min: 0,
    },
    healthScore: {
      type: Number,
      default: 65,
      min: 0,
      max: 100,
    },
    warmupActive: {
      type: Boolean,
      default: true,
    },
    warmupMessagesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastWarmupAt: {
      type: Date,
      default: null,
    },
    userJid: {
      type: String,
      default: '',
    },
    userName: {
      type: String,
      default: '',
    },
    lastActiveAt: {
      type: Date,
      default: null,
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

// Method to verify & reset daily quota if 24 hours or calendar day passed
AccountSchema.methods.checkAndResetDailyQuota = function () {
  const now = new Date();
  const last = new Date(this.lastReset || 0);

  const isDifferentDay =
    now.getUTCFullYear() !== last.getUTCFullYear() ||
    now.getUTCMonth() !== last.getUTCMonth() ||
    now.getUTCDate() !== last.getUTCDate();

  if (isDifferentDay || now.getTime() - last.getTime() >= 24 * 60 * 60 * 1000) {
    this.sentToday = 0;
    this.lastReset = now;

    // Increment warmupDays each distinct active day
    if (this.status === 'CONNECTED' && this.warmupActive) {
      this.warmupDays += 1;
      this.recalculateHealthScore();
    }
    return true;
  }
  return false;
};

// Calculates dynamic health score (0-100) based on age, warmup engagement, and status
AccountSchema.methods.recalculateHealthScore = function () {
  let score = 50;

  // Days in warmup bonus (up to +30 points for 7+ days)
  const daysBonus = Math.min(30, (this.warmupDays || 1) * 4);
  score += daysBonus;

  // Peer-to-peer exchanges bonus (up to +20 points for 20+ warmup msgs)
  const exchangeBonus = Math.min(20, Math.floor((this.warmupMessagesCount || 0) * 1.5));
  score += exchangeBonus;

  // Penalty if banned or persistent errors
  if (this.status === 'BANNED') {
    score = 0;
  } else if (this.status === 'DISCONNECTED') {
    score = Math.max(20, score - 15);
  }

  this.healthScore = Math.max(0, Math.min(100, Math.round(score)));
  return this.healthScore;
};

export const Account = mongoose.model('Account', AccountSchema);
export default Account;
