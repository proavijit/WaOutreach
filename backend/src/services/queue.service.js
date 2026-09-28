import { sessionManager } from './sessionManager.js';
import { parseSpintax } from '../utils/spintax.js';
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';
import Account from '../models/Account.js';
import { broadcastEvent } from '../socket.js';

class QueueService {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentCampaignId = null;
    this.workerState = 'idle'; // 'idle' | 'processing' | 'jitter_delay' | 'batch_cooldown' | 'daily_cap_reached' | 'paused' | 'waiting_sessions'
    this.currentCountdown = 0; // seconds remaining in delay or cooldown
    this.countdownTimer = null;
    this.testMode = false; // Fast-forward toggle (3-6s delays instead of 45-90s)
    this.activeBatchCount = 0;
    this.sessionIndexPointer = 0; // Round-robin pointer across active sessions
  }

  /**
   * Helper sleep promise with cancel check
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generates a random integer between min and max (inclusive)
   */
  getRandomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Runs an animated countdown in seconds, streaming to Socket.io
   */
  async runCountdown(seconds, stateType, metadata = {}) {
    this.workerState = stateType;
    this.currentCountdown = seconds;

    while (this.currentCountdown > 0) {
      if (!this.isRunning || this.isPaused) {
        break;
      }

      broadcastEvent('queue:countdown', {
        state: this.workerState,
        secondsRemaining: this.currentCountdown,
        totalSeconds: seconds,
        metadata,
      });

      await this.sleep(1000);
      this.currentCountdown--;
    }

    this.currentCountdown = 0;
  }

  /**
   * Calculates messages dispatched in the last 24 hours to enforce daily guardrails
   */
  async getMessagesSentLast24Hours() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await Lead.countDocuments({
      status: { $in: ['sent', 'delivered', 'read', 'replied'] },
      lastMessageSentAt: { $gte: twentyFourHoursAgo },
    });
  }

  /**
   * Starts or resumes queue processing for a campaign
   */
  async startQueue(campaignId = null, testMode = false) {
    if (this.isRunning && !this.isPaused) {
      console.log('[QueueService] Queue is already actively running.');
      return;
    }

    this.testMode = !!testMode;
    this.isRunning = true;
    this.isPaused = false;
    this.currentCampaignId = campaignId;

    if (campaignId) {
      await Campaign.findByIdAndUpdate(campaignId, { status: 'running' });
    }

    broadcastEvent('queue:status', {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      workerState: 'processing',
      campaignId: this.currentCampaignId,
      testMode: this.testMode,
      message: 'Distributed round-robin queue processing started',
    }, true);

    // Launch worker loop asynchronously
    this.processQueueLoop().catch((err) => {
      console.error('[QueueService] Critical error in queue loop:', err);
      this.workerState = 'idle';
      this.isRunning = false;
      broadcastEvent('queue:status', this.getQueueStatus());
    });
  }

  /**
   * Pauses the queue worker gracefully
   */
  async pauseQueue() {
    this.isPaused = true;
    this.workerState = 'paused';
    if (this.currentCampaignId) {
      await Campaign.findByIdAndUpdate(this.currentCampaignId, { status: 'paused' });
    }

    broadcastEvent('queue:status', {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      workerState: this.workerState,
      message: 'Queue paused by operator',
    }, true);
  }

  /**
   * Stops the queue and resets state
   */
  async stopQueue() {
    this.isRunning = false;
    this.isPaused = false;
    this.workerState = 'idle';
    this.currentCountdown = 0;

    if (this.currentCampaignId) {
      await Campaign.findByIdAndUpdate(this.currentCampaignId, { status: 'stopped' });
    }

    broadcastEvent('queue:status', {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      workerState: this.workerState,
      message: 'Queue stopped',
    }, true);
  }

  /**
   * Main sequential FIFO worker loop with Round-Robin Multi-Account load balancing
   */
  async processQueueLoop() {
    console.log('[QueueService] Distributed round-robin worker loop initialized.');

    while (this.isRunning) {
      if (this.isPaused) {
        await this.sleep(2000);
        continue;
      }

      // 1. Query all active, connected WhatsApp sessions with remaining quota
      const activeSessions = await sessionManager.getActiveSessions();

      if (activeSessions.length === 0) {
        this.workerState = 'waiting_sessions';
        broadcastEvent('queue:warning', {
          message: 'No connected WhatsApp accounts with remaining quota. Connect accounts or wait for 24h reset.',
        }, true);
        await this.sleep(5000);
        continue;
      }

      // 2. Load Campaign details & custom anti-ban configs
      let campaign = null;
      if (this.currentCampaignId) {
        campaign = await Campaign.findById(this.currentCampaignId);
      } else {
        campaign = await Campaign.findOne({ status: 'running' });
      }

      const batchSize = campaign?.config?.batchSize || 15;
      const cooldownMin = campaign?.config?.batchCooldownMinutesMin || 12;
      const cooldownMax = campaign?.config?.batchCooldownMinutesMax || 18;
      const minDelay = campaign?.config?.minDelaySeconds || 45;
      const maxDelay = campaign?.config?.maxDelaySeconds || 90;

      // 3. Cluster Daily Guardrail: sum of all active account limits or campaign cap
      const clusterTotalLimit = activeSessions.reduce((acc, s) => acc + s.dailyLimit, 0);
      const sentLast24Hours = await this.getMessagesSentLast24Hours();

      // Check if cluster capacity is exhausted
      const anySessionHasQuota = activeSessions.some((s) => s.sentToday < s.dailyLimit);
      if (!anySessionHasQuota) {
        this.workerState = 'daily_cap_reached';
        this.isPaused = true;

        if (campaign) {
          campaign.status = 'paused';
          await campaign.save();
        }

        broadcastEvent('queue:guardrail', {
          action: 'DAILY_CAP_REACHED',
          message: `All accounts reached their daily dispatch quotas (${sentLast24Hours} total messages sent in 24h). Queue safely paused.`,
          sentLast24Hours,
          clusterTotalLimit,
        }, true);

        break;
      }

      // 4. Fetch next pending lead (FIFO by createdAt)
      const query = {
        status: { $in: ['pending', 'queued'] },
      };
      if (campaign) {
        query.campaignId = campaign._id;
      }

      const lead = await Lead.findOne(query).sort({ createdAt: 1 });

      if (!lead) {
        console.log('[QueueService] No pending leads in queue. Marking campaign complete.');
        this.isRunning = false;
        this.workerState = 'idle';

        if (campaign) {
          campaign.status = 'completed';
          await campaign.save();
        }

        broadcastEvent('queue:complete', {
          message: 'All leads in queue have been processed.',
          campaignId: campaign?._id,
        }, true);
        break;
      }

      // Check if lead phone was blacklisted
      const isBlacklisted = await Lead.exists({
        phone: lead.phone,
        status: 'blacklisted',
      });

      if (isBlacklisted) {
        console.log(`[QueueService] Lead ${lead.phone} is blacklisted. Skipping.`);
        lead.status = 'blacklisted';
        lead.blacklistReason = 'Globally blacklisted phone number';
        await lead.save();
        broadcastEvent('lead:updated', { lead });
        continue;
      }

      // 5. Select Next Account via Round-Robin with quota availability check
      let selectedAccount = null;
      for (let i = 0; i < activeSessions.length; i++) {
        const candidate = activeSessions[(this.sessionIndexPointer + i) % activeSessions.length];
        if (candidate.sentToday < candidate.dailyLimit) {
          selectedAccount = candidate;
          this.sessionIndexPointer = (this.sessionIndexPointer + i + 1) % activeSessions.length;
          break;
        }
      }

      if (!selectedAccount) {
        console.log('[QueueService] All active accounts have hit daily limits for today.');
        this.workerState = 'daily_cap_reached';
        this.isPaused = true;
        break;
      }

      // 6. Build personalized message using Spintax Parser
      this.workerState = 'processing';
      const template = campaign?.messageTemplate || 'Hi {{name}}, connecting regarding {{company}}!';

      const leadVars = {
        name: lead.name || 'there',
        company: lead.company || 'your business',
        phone: lead.phone,
        ...(lead.customFields ? Object.fromEntries(lead.customFields) : {}),
      };

      const finalMessage = parseSpintax(template, leadVars);

      // 7. Dispatch message through the selected round-robin account
      try {
        console.log(`[QueueService] Dispatching message to ${lead.phone} via Account [${selectedAccount.label}] (${selectedAccount.sessionId})...`);
        lead.status = 'queued';
        lead.assignedSessionId = selectedAccount.sessionId;
        lead.attempts += 1;
        await lead.save();
        broadcastEvent('lead:updated', { lead });

        const sendResult = await sessionManager.sendMessage(
          selectedAccount.sessionId,
          lead.phone,
          finalMessage,
          lead._id,
          { isOutreach: true }
        );

        // Update Lead state to sent
        lead.status = 'sent';
        lead.sentContent = finalMessage;
        lead.whatsappMessageId = sendResult.messageId;
        lead.assignedSessionId = selectedAccount.sessionId;
        lead.lastMessageSentAt = new Date();
        lead.errorMessage = '';
        await lead.save();

        this.activeBatchCount++;

        // Update Campaign stats
        if (campaign) {
          campaign.stats.sentCount += 1;
          campaign.currentBatchCount = this.activeBatchCount;
          campaign.lastDispatchedAt = new Date();
          await campaign.save();
        }

        broadcastEvent('message:dispatched', {
          leadId: lead._id,
          phone: lead.phone,
          name: lead.name,
          preview: finalMessage.slice(0, 60) + '...',
          sessionId: selectedAccount.sessionId,
          accountLabel: selectedAccount.label,
          accountQuota: `${selectedAccount.sentToday + 1}/${selectedAccount.dailyLimit}`,
          batchProgress: `${this.activeBatchCount}/${batchSize}`,
          sentTodayTotal: sentLast24Hours + 1,
        }, true);

        broadcastEvent('lead:updated', { lead });
      } catch (dispatchErr) {
        console.error(`[QueueService] Failed to send message to ${lead.phone}:`, dispatchErr.message);

        lead.status = 'failed';
        lead.errorMessage = dispatchErr.message;
        await lead.save();

        if (campaign) {
          campaign.stats.failedCount += 1;
          await campaign.save();
        }

        broadcastEvent('message:failed', {
          leadId: lead._id,
          phone: lead.phone,
          sessionId: selectedAccount?.sessionId,
          error: dispatchErr.message,
        }, true);

        broadcastEvent('lead:updated', { lead });
      }

      if (!this.isRunning || this.isPaused) break;

      // 8. Check Batch Cooldown Mechanism (After every 15 messages -> 12 to 18 min cooldown)
      if (this.activeBatchCount >= batchSize) {
        this.activeBatchCount = 0;
        if (campaign) {
          campaign.currentBatchCount = 0;
          await campaign.save();
        }

        let cooldownSeconds = this.testMode
          ? this.getRandomBetween(10, 15)
          : this.getRandomBetween(cooldownMin * 60, cooldownMax * 60);

        console.log(`[QueueService] Batch threshold reached (${batchSize} msgs). Entering cluster cooldown for ${Math.round(cooldownSeconds / 60)} minutes.`);

        broadcastEvent('queue:cooldown_start', {
          type: 'cooldown',
          cooldownSeconds,
          message: `Batch cap of ${batchSize} reached. Anti-ban safety cooldown active: ${Math.round(cooldownSeconds / 60)} mins.`,
        }, true);

        await this.runCountdown(cooldownSeconds, 'batch_cooldown', {
          reason: `Mandatory batch cooldown after ${batchSize} messages`,
        });

        broadcastEvent('queue:cooldown_end', {
          message: 'Cooldown completed. Resuming message dispatching.',
        }, true);
      } else {
        // 9. Jitter Delay Mechanism (45 to 90 seconds random delay between each message)
        let jitterSeconds = this.testMode
          ? this.getRandomBetween(3, 6)
          : this.getRandomBetween(minDelay, maxDelay);

        console.log(`[QueueService] Jitter delay active: ${jitterSeconds}s before next message.`);

        await this.runCountdown(jitterSeconds, 'jitter_delay', {
          nextLeadDelay: jitterSeconds,
          batchProgress: `${this.activeBatchCount}/${batchSize}`,
        });
      }
    }

    if (!this.isRunning) {
      this.workerState = 'idle';
    }
    console.log('[QueueService] Queue loop terminated.');
  }

  getQueueStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      workerState: this.workerState,
      currentCountdown: this.currentCountdown,
      currentCampaignId: this.currentCampaignId,
      activeBatchCount: this.activeBatchCount,
      testMode: this.testMode,
    };
  }
}

export const queueService = new QueueService();
export default queueService;
