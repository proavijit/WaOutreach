import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { broadcastEvent } from '../socket.js';
import Account from '../models/Account.js';
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';
import ChatThread from '../models/ChatThread.js';
import Message from '../models/Message.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_BASE_DIR = path.resolve(__dirname, '../../auth_sessions');
const LEGACY_AUTH_DIR = path.resolve(__dirname, '../../auth_info_baileys');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> WASocket instance
    this.qrCodes = new Map(); // sessionId -> base64 data URL
    this.reconnectTimers = new Map(); // sessionId -> NodeJS.Timeout
  }

  /**
   * Initializes all accounts on engine startup.
   * Migrates legacy single-session credentials if present.
   */
  async initAllSessions() {
    if (!fs.existsSync(SESSIONS_BASE_DIR)) {
      fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
    }

    let accounts = await Account.find();

    // Check for backwards compatibility / legacy single-session migration
    if (accounts.length === 0) {
      const primarySessionId = 'session_1';
      const targetDir = path.join(SESSIONS_BASE_DIR, `session_${primarySessionId}`);

      // If legacy auth folder exists, migrate it
      if (fs.existsSync(LEGACY_AUTH_DIR) && fs.existsSync(path.join(LEGACY_AUTH_DIR, 'creds.json'))) {
        try {
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            fs.cpSync(LEGACY_AUTH_DIR, targetDir, { recursive: true });
            console.log(`[SessionManager] Migrated legacy auth session to ${targetDir}`);
          }
        } catch (copyErr) {
          console.error('[SessionManager] Error copying legacy auth:', copyErr);
        }
      }

      const initialAccount = await Account.create({
        sessionId: primarySessionId,
        label: 'Primary Outreach Account',
        dailyLimit: 20,
        status: 'CONNECTING',
      });
      accounts = [initialAccount];
    }

    console.log(`[SessionManager] Spawning ${accounts.length} WhatsApp session(s)...`);

    for (const acc of accounts) {
      acc.checkAndResetDailyQuota();
      await acc.save();
      this.spawnSession(acc.sessionId).catch((err) => {
        console.error(`[SessionManager] Failed to spawn session ${acc.sessionId}:`, err.message);
      });
    }
  }

  /**
   * Spawns an isolated Baileys socket for a specific sessionId
   */
  async spawnSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} already active.`);
      return this.sessions.get(sessionId);
    }

    const sessionDir = path.join(SESSIONS_BASE_DIR, `session_${sessionId}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    await Account.findOneAndUpdate(
      { sessionId },
      { status: 'CONNECTING', errorMessage: '' },
      { upsert: true }
    );

    broadcastEvent('session:status', {
      sessionId,
      status: 'CONNECTING',
      message: `Initializing session ${sessionId}...`,
    });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS(`WaOutreach-${sessionId}`),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.sessions.set(sessionId, sock);

      // Handle credentials update
      sock.ev.on('creds.update', async () => {
        await saveCreds();
      });

      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            this.qrCodes.set(sessionId, qrDataUrl);

            await Account.findOneAndUpdate(
              { sessionId },
              { status: 'QR_READY' }
            );

            broadcastEvent('session:qr', {
              sessionId,
              qr,
              qrDataUrl,
            });

            broadcastEvent('session:status', {
              sessionId,
              status: 'QR_READY',
              hasQr: true,
              qrDataUrl,
              message: `Scan QR for session ${sessionId}`,
            });
          } catch (qrErr) {
            console.error(`[SessionManager] QR error for ${sessionId}:`, qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.sessions.delete(sessionId);
          this.qrCodes.delete(sessionId);

          const finalStatus = shouldReconnect ? 'DISCONNECTED' : 'DISCONNECTED';

          await Account.findOneAndUpdate(
            { sessionId },
            {
              status: finalStatus,
              errorMessage: `Closed (${statusCode || 'unknown'}). ${shouldReconnect ? 'Reconnecting...' : 'Logged out.'}`,
            }
          );

          broadcastEvent('session:status', {
            sessionId,
            status: finalStatus,
            message: `Session ${sessionId} disconnected (${statusCode}).`,
          });

          if (shouldReconnect) {
            // Clear existing reconnect timer if any
            if (this.reconnectTimers.has(sessionId)) {
              clearTimeout(this.reconnectTimers.get(sessionId));
            }
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(sessionId);
              this.spawnSession(sessionId);
            }, 5000);
            this.reconnectTimers.set(sessionId, timer);
          } else {
            // Clean up session auth folder if logged out permanently
            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
            } catch (rmErr) {
              console.warn(`[SessionManager] Auth cleanup error for ${sessionId}:`, rmErr.message);
            }
          }
        } else if (connection === 'open') {
          this.qrCodes.delete(sessionId);
          const rawJid = sock.user?.id || '';
          const cleanPhone = rawJid.split(':')[0]?.replace(/[^0-9]/g, '') || '';
          const userName = sock.user?.name || `WhatsApp Account ${sessionId}`;

          await Account.findOneAndUpdate(
            { sessionId },
            {
              status: 'CONNECTED',
              phone: cleanPhone,
              userJid: rawJid,
              userName,
              lastActiveAt: new Date(),
              errorMessage: '',
            }
          );

          broadcastEvent('session:status', {
            sessionId,
            status: 'CONNECTED',
            phone: cleanPhone,
            userName,
            message: `Session ${sessionId} connected successfully (${cleanPhone})`,
          }, true);
        }
      });

      // Handle incoming messages for Universal Inbox and Opt-Outs
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!messages || !messages.length) return;

        for (const msg of messages) {
          if (msg.key?.fromMe) continue;

          const senderJid = msg.key?.remoteJid;
          if (!senderJid || senderJid.endsWith('@g.us')) continue; // Ignore groups

          const phone = senderJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          const body =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          if (!body) continue;

          console.log(`[Universal Inbox] Incoming message on session [${sessionId}] from ${phone}: "${body}"`);

          // Auto-Blacklist / Opt-Out Engine: /stop|unsubscribe|remove|no/i
          const optOutRegex = /^(stop|unsubscribe|remove|no)$/i;
          const optOutKeywordRegex = /\b(stop|unsubscribe|remove|don'?t text|cancel|leave me alone)\b/i;

          if (optOutRegex.test(body.trim()) || optOutKeywordRegex.test(body)) {
            await this.handleOptOut(sessionId, phone, body);
          } else {
            await this.handleIncomingMessage(sessionId, phone, body, msg.key?.id);
          }
        }
      });

      // Handle delivery and read receipts
      sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          if (!update.key?.id) continue;
          const msgId = update.key.id;
          const status = update.update?.status;

          // Baileys status: 3 = DELIVERY_ACK, 4 = READ
          if (status === 3 || status === 4) {
            const newStatus = status === 4 ? 'read' : 'delivered';

            await Message.findOneAndUpdate(
              { whatsappMessageId: msgId },
              { status: newStatus }
            );

            await Lead.findOneAndUpdate(
              { whatsappMessageId: msgId, status: { $in: ['sent', 'delivered'] } },
              { status: newStatus }
            );

            broadcastEvent('message:receipt', {
              whatsappMessageId: msgId,
              status: newStatus,
            });
          }
        }
      });

      return sock;
    } catch (err) {
      console.error(`[SessionManager] Error spawning session ${sessionId}:`, err);
      await Account.findOneAndUpdate(
        { sessionId },
        { status: 'DISCONNECTED', errorMessage: err.message }
      );
      throw err;
    }
  }

  /**
   * Handles incoming message and updates Universal Shared Inbox
   */
  async handleIncomingMessage(sessionId, phone, text, msgId) {
    try {
      const phoneRegex = new RegExp(phone.slice(-10) + '$');
      let lead = await Lead.findOne({ phone: phoneRegex });

      const account = await Account.findOne({ sessionId });
      const accountLabel = account ? account.label : sessionId;

      // Find or create chat thread for this lead and assigned session
      let thread = await ChatThread.findOne({
        leadPhone: phone,
      });

      if (!thread) {
        thread = await ChatThread.create({
          leadId: lead?._id || null,
          leadPhone: phone,
          leadName: lead?.name || '',
          leadCompany: lead?.company || '',
          assignedSessionId: sessionId,
          accountLabel,
          lastMessage: text,
          lastMessageAt: new Date(),
          unreadCount: 1,
          status: 'active',
        });
      } else {
        thread.lastMessage = text;
        thread.lastMessageAt = new Date();
        thread.unreadCount += 1;
        // Keep assignedSessionId mapped to the session where lead responded or contacted
        if (!thread.assignedSessionId) {
          thread.assignedSessionId = sessionId;
        }
        await thread.save();
      }

      // Save inbound message
      const savedMsg = await Message.create({
        threadId: thread._id,
        leadId: lead?._id || null,
        sessionId,
        whatsappMessageId: msgId,
        from: phone,
        to: account?.phone || sessionId,
        direction: 'inbound',
        text,
        status: 'delivered',
        timestamp: new Date(),
      });

      // Update lead status
      if (lead) {
        lead.status = 'replied';
        await lead.save();

        if (lead.campaignId) {
          await Campaign.findByIdAndUpdate(lead.campaignId, {
            $inc: { 'stats.repliedCount': 1 },
          });
        }
      }

      broadcastEvent('inbox:new_message', {
        thread,
        message: savedMsg,
        sessionId,
      }, true);

      broadcastEvent('thread:updated', { thread });
      if (lead) broadcastEvent('lead:updated', { lead });
    } catch (err) {
      console.error('[SessionManager] Error in handleIncomingMessage:', err);
    }
  }

  /**
   * Auto-Blacklist / Opt-Out Engine
   */
  async handleOptOut(sessionId, phone, matchedText) {
    try {
      console.warn(`[Anti-Ban Engine] Opt-out on session [${sessionId}] from ${phone}: "${matchedText}"`);

      const phoneRegex = new RegExp(phone.slice(-10) + '$');
      const leads = await Lead.find({ phone: phoneRegex });

      for (const lead of leads) {
        lead.status = 'blacklisted';
        lead.blacklistedAt = new Date();
        lead.blacklistReason = `Opt-out keyword detected: "${matchedText}"`;
        await lead.save();

        if (lead.campaignId) {
          await Campaign.findByIdAndUpdate(lead.campaignId, {
            $inc: { 'stats.blacklistedCount': 1 },
          });
        }
        broadcastEvent('lead:updated', { lead });
      }

      await ChatThread.updateMany(
        { leadPhone: phone },
        { status: 'blacklisted', lastMessage: `[Blacklisted: ${matchedText}]` }
      );

      broadcastEvent('whatsapp:optout', {
        sessionId,
        phone,
        message: matchedText,
        blacklistedCount: leads.length,
      }, true);
    } catch (err) {
      console.error('[SessionManager] Error in handleOptOut:', err);
    }
  }

  /**
   * Formats phone to WhatsApp JID
   */
  formatToJid(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (!clean) return null;
    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Sends a message through a specified session
   */
  async sendMessage(sessionId, phone, text, leadId = null) {
    const sock = this.sessions.get(sessionId);
    if (!sock) {
      throw new Error(`WhatsApp session [${sessionId}] is not currently connected.`);
    }

    const jid = this.formatToJid(phone);
    if (!jid) throw new Error(`Invalid phone number: ${phone}`);

    const [exists] = await sock.onWhatsApp(jid);
    const targetJid = exists?.exists ? exists.jid : jid;

    // Send via Baileys socket
    const response = await sock.sendMessage(targetJid, { text });
    const msgId = response?.key?.id;

    // Increment account sentToday counter
    await Account.findOneAndUpdate(
      { sessionId },
      { $inc: { sentToday: 1 }, lastActiveAt: new Date() }
    );

    // Update or create ChatThread
    const account = await Account.findOne({ sessionId });
    let thread = await ChatThread.findOne({ leadPhone: phone });

    if (!thread) {
      let lead = leadId ? await Lead.findById(leadId) : await Lead.findOne({ phone: new RegExp(phone.slice(-10) + '$') });
      thread = await ChatThread.create({
        leadId: lead?._id || null,
        leadPhone: phone,
        leadName: lead?.name || '',
        leadCompany: lead?.company || '',
        assignedSessionId: sessionId,
        accountLabel: account?.label || sessionId,
        lastMessage: text,
        lastMessageAt: new Date(),
        unreadCount: 0,
        status: 'active',
      });
    } else {
      thread.lastMessage = text;
      thread.lastMessageAt = new Date();
      thread.assignedSessionId = sessionId;
      thread.accountLabel = account?.label || sessionId;
      await thread.save();
    }

    // Save outbound message
    const savedMsg = await Message.create({
      threadId: thread._id,
      leadId: leadId || thread.leadId || null,
      sessionId,
      whatsappMessageId: msgId,
      from: account?.phone || sessionId,
      to: phone,
      direction: 'outbound',
      text,
      status: 'sent',
      timestamp: new Date(),
    });

    broadcastEvent('inbox:new_message', {
      thread,
      message: savedMsg,
      sessionId,
    });
    broadcastEvent('thread:updated', { thread });

    return {
      messageId: msgId,
      jid: targetJid,
      sessionId,
      threadId: thread._id,
    };
  }

  /**
   * Retrieves active, connected sessions that have not exceeded their daily limit
   */
  async getActiveSessions() {
    const accounts = await Account.find({ status: 'CONNECTED' });
    const eligible = [];

    for (const acc of accounts) {
      acc.checkAndResetDailyQuota();
      await acc.save();

      const sock = this.sessions.get(acc.sessionId);
      if (sock && acc.sentToday < acc.dailyLimit) {
        eligible.push(acc);
      }
    }

    return eligible;
  }

  /**
   * Terminates and optionally deletes session storage
   */
  async terminateSession(sessionId, purgeAuth = false) {
    if (this.reconnectTimers.has(sessionId)) {
      clearTimeout(this.reconnectTimers.get(sessionId));
      this.reconnectTimers.delete(sessionId);
    }

    const sock = this.sessions.get(sessionId);
    if (sock) {
      try {
        await sock.logout();
        sock.end(undefined);
      } catch (e) {
        console.warn(`[SessionManager] Logout error for ${sessionId}:`, e.message);
      }
      this.sessions.delete(sessionId);
    }

    this.qrCodes.delete(sessionId);

    if (purgeAuth) {
      const sessionDir = path.join(SESSIONS_BASE_DIR, `session_${sessionId}`);
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (rmErr) {
        console.error(`[SessionManager] Failed to remove dir for ${sessionId}:`, rmErr);
      }
    }

    await Account.findOneAndUpdate(
      { sessionId },
      { status: 'DISCONNECTED', errorMessage: 'Terminated by operator' }
    );

    broadcastEvent('session:status', {
      sessionId,
      status: 'DISCONNECTED',
      message: `Session ${sessionId} terminated`,
    });
  }

  /**
   * Returns consolidated status of all sessions
   */
  async getAllSessions() {
    const accounts = await Account.find().sort({ createdAt: 1 });
    return accounts.map((acc) => {
      acc.checkAndResetDailyQuota();
      const hasQr = this.qrCodes.has(acc.sessionId);
      const isSocketActive = this.sessions.has(acc.sessionId);

      return {
        ...acc.toObject(),
        hasQr,
        qrCodeDataUrl: this.qrCodes.get(acc.sessionId) || null,
        isSocketActive,
      };
    });
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
