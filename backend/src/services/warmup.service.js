import { sessionManager } from './sessionManager.js';
import { getRandomWarmupDialogue } from '../utils/warmupCorpus.js';
import Account from '../models/Account.js';
import { broadcastEvent } from '../socket.js';

class WarmupService {
  constructor() {
    this.isEnabled = true;
    this.timer = null;
    this.nextRunAt = null;
    this.warmupStats = {
      totalExchanges: 0,
      lastExchangeAt: null,
      activeJobs: 0,
    };
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRandomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Checks if current time is within natural daytime hours (9 AM to 9 PM)
   */
  isAllowedHours() {
    const currentHour = new Date().getHours();
    return currentHour >= 9 && currentHour < 21;
  }

  /**
   * Starts the automated background scheduler
   */
  startScheduler() {
    if (this.timer) clearTimeout(this.timer);

    console.log('[WarmupService] Automated Peer-to-Peer Warm-up Engine initialized.');
    this.scheduleNextRun();
  }

  /**
   * Stops the automated scheduler
   */
  stopScheduler() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nextRunAt = null;
    console.log('[WarmupService] Automated Warm-up Engine stopped.');
  }

  /**
   * Schedules next run with a random jitter of 15 to 30 minutes
   */
  scheduleNextRun() {
    if (!this.isEnabled) return;

    // Random interval between 15 and 30 minutes in milliseconds
    const intervalMinutes = this.getRandomBetween(15, 30);
    const delayMs = intervalMinutes * 60 * 1000;
    this.nextRunAt = new Date(Date.now() + delayMs);

    console.log(`[WarmupService] Next peer-to-peer warm-up exchange scheduled in ${intervalMinutes} minutes at ${this.nextRunAt.toLocaleTimeString()}.`);

    this.timer = setTimeout(async () => {
      try {
        await this.executeWarmupCycle();
      } catch (err) {
        console.error('[WarmupService] Error during automated warmup cycle:', err.message);
      } finally {
        this.scheduleNextRun();
      }
    }, delayMs);
  }

  /**
   * Main warm-up cycle: selects two accounts and executes an authentic 2-way dialogue
   */
  async executeWarmupCycle(force = false, fastMode = false) {
    if (!this.isEnabled && !force) {
      console.log('[WarmupService] Warmup is currently paused by operator.');
      return { success: false, reason: 'Warmup paused' };
    }

    if (!this.isAllowedHours() && !force) {
      console.log('[WarmupService] Outside 9 AM - 9 PM daytime hours window. Skipping until next interval.');
      return { success: false, reason: 'Outside permitted daytime hours (9 AM - 9 PM)' };
    }

    // Find all connected accounts with active sockets
    const accounts = await Account.find({ status: 'CONNECTED', warmupActive: { $ne: false } });
    const activeCandidates = accounts.filter(
      (acc) => sessionManager.sessions.has(acc.sessionId) && acc.phone
    );

    if (activeCandidates.length < 2) {
      const msg = `Peer-to-peer warm-up requires at least 2 connected WhatsApp accounts. Currently active: ${activeCandidates.length}`;
      console.log(`[WarmupService] ${msg}`);
      broadcastEvent('warmup:warning', { message: msg });
      return { success: false, reason: msg };
    }

    // Randomly pick Session A (Initiator) and Session B (Responder)
    const shuffled = [...activeCandidates].sort(() => 0.5 - Math.random());
    const accountA = shuffled[0];
    const accountB = shuffled[1];

    return await this.runConversation(accountA, accountB, fastMode);
  }

  /**
   * Executes a humanized 2-way dialogue between Account A and Account B
   */
  async runConversation(accountA, accountB, fastMode = false) {
    const sockA = sessionManager.sessions.get(accountA.sessionId);
    const sockB = sessionManager.sessions.get(accountB.sessionId);

    if (!sockA || !sockB) {
      throw new Error('One or both selected sockets disconnected before warmup execution.');
    }

    const jidB = sessionManager.formatToJid(accountB.phone);
    const jidA = sessionManager.formatToJid(accountA.phone);

    const dialogue = getRandomWarmupDialogue();
    console.log(`[WarmupService] Starting P2P exchange: [${accountA.label}] -> [${accountB.label}] (Topic: ${dialogue.topic})`);

    this.warmupStats.activeJobs++;
    broadcastEvent('warmup:started', {
      fromSession: accountA.sessionId,
      fromLabel: accountA.label,
      toSession: accountB.sessionId,
      toLabel: accountB.label,
      topic: dialogue.topic,
    }, true);

    try {
      // Step 1: Simulate human typing presence on Session A (3-5 seconds)
      const typingDuration = fastMode ? 1500 : this.getRandomBetween(3000, 5000);
      try {
        await sockA.sendPresenceUpdate('composing', jidB);
      } catch (e) {
        // presence updates are advisory, continue if error
      }

      await this.sleep(typingDuration);

      try {
        await sockA.sendPresenceUpdate('paused', jidB);
      } catch (e) {}

      // Step 2: Session A dispatches the starter phrase to Session B
      const sendResultA = await sockA.sendMessage(jidB, { text: dialogue.starter });
      const messageKeyA = sendResultA?.key;

      // Update Account A warmup telemetry
      accountA.warmupMessagesCount += 1;
      accountA.lastWarmupAt = new Date();
      accountA.recalculateHealthScore();
      await accountA.save();

      broadcastEvent('warmup:message_sent', {
        sessionId: accountA.sessionId,
        recipient: accountB.phone,
        text: dialogue.starter,
        healthScore: accountA.healthScore,
      }, true);

      // Step 3: Randomized delay before Session B replies (1 to 4 minutes, or 6-10s if fastMode)
      const replyDelayMs = fastMode
        ? this.getRandomBetween(5000, 9000)
        : this.getRandomBetween(60, 240) * 1000;

      console.log(`[WarmupService] Session B will reply in ${Math.round(replyDelayMs / 1000)} seconds...`);

      // Schedule Session B's asynchronous reply
      setTimeout(async () => {
        try {
          const currentSockB = sessionManager.sessions.get(accountB.sessionId);
          if (!currentSockB) {
            console.warn('[WarmupService] Session B disconnected prior to sending reply.');
            return;
          }

          // Session B marks message as read
          if (messageKeyA) {
            try {
              await currentSockB.readMessages([messageKeyA]);
            } catch (e) {}
          }

          // Session B simulates human typing (2-4 seconds)
          const replyTypingDuration = fastMode ? 1500 : this.getRandomBetween(2500, 4500);
          try {
            await currentSockB.sendPresenceUpdate('composing', jidA);
          } catch (e) {}

          await this.sleep(replyTypingDuration);

          try {
            await currentSockB.sendPresenceUpdate('paused', jidA);
          } catch (e) {}

          // Session B sends the reply
          await currentSockB.sendMessage(jidA, { text: dialogue.reply });

          // Update Account B warmup telemetry
          accountB.warmupMessagesCount += 1;
          accountB.lastWarmupAt = new Date();
          accountB.recalculateHealthScore();
          await accountB.save();

          this.warmupStats.totalExchanges += 1;
          this.warmupStats.lastExchangeAt = new Date();

          broadcastEvent('warmup:completed', {
            fromSession: accountB.sessionId,
            toSession: accountA.sessionId,
            replyText: dialogue.reply,
            totalExchanges: this.warmupStats.totalExchanges,
            accountBHealth: accountB.healthScore,
          }, true);

          console.log(`[WarmupService] P2P exchange completed successfully between [${accountA.label}] and [${accountB.label}].`);
        } catch (replyErr) {
          console.error('[WarmupService] Failed to send warmup reply from Session B:', replyErr.message);
        } finally {
          this.warmupStats.activeJobs = Math.max(0, this.warmupStats.activeJobs - 1);
        }
      }, replyDelayMs);

      return {
        success: true,
        message: `P2P exchange initiated: [${accountA.label}] -> [${accountB.label}]`,
        data: {
          initiator: accountA.label,
          responder: accountB.label,
          starterText: dialogue.starter,
          replyText: dialogue.reply,
          replyDelaySeconds: Math.round(replyDelayMs / 1000),
        },
      };
    } catch (err) {
      this.warmupStats.activeJobs = Math.max(0, this.warmupStats.activeJobs - 1);
      console.error('[WarmupService] Error initiating warmup dialogue:', err);
      throw err;
    }
  }

  /**
   * Manually triggers an immediate warm-up exchange
   */
  async triggerManual(sessionAId = null, sessionBId = null, fastMode = true) {
    if (sessionAId && sessionBId) {
      const accountA = await Account.findOne({ sessionId: sessionAId });
      const accountB = await Account.findOne({ sessionId: sessionBId });

      if (!accountA || !accountB) {
        throw new Error('Specified warmup accounts not found.');
      }
      return await this.runConversation(accountA, accountB, fastMode);
    }

    return await this.executeWarmupCycle(true, fastMode);
  }

  /**
   * Returns engine status and metrics
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isAllowedHours: this.isAllowedHours(),
      nextRunAt: this.nextRunAt,
      stats: this.warmupStats,
    };
  }
}

export const warmupService = new WarmupService();
export default warmupService;
