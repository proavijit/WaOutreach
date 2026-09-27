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
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../auth_info_baileys');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'qr_ready'
    this.qrCodeDataUrl = null;
    this.userJid = null;
    this.userName = null;
    this.isInitializing = false;
  }

  /**
   * Initializes or re-initializes Baileys Socket session
   */
  async initWhatsApp() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[WhatsAppService] Using WA version v${version.join('.')}, isLatest: ${isLatest}`);

      this.connectionState = 'connecting';
      broadcastEvent('whatsapp:status', {
        status: this.connectionState,
        message: 'Initializing WhatsApp socket session...',
      });

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      // Handle credentials update
      this.sock.ev.on('creds.update', async () => {
        await saveCreds();
      });

      // Handle connection updates & QR emission
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            this.connectionState = 'qr_ready';
            broadcastEvent('whatsapp:qr', {
              qr,
              qrDataUrl: this.qrCodeDataUrl,
            });
            broadcastEvent('whatsapp:status', {
              status: this.connectionState,
              message: 'Scan the QR code to pair WhatsApp',
            });
            console.log('[WhatsAppService] New QR code generated.');
          } catch (qrErr) {
            console.error('[WhatsAppService] Failed to generate QR data URL:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.connectionState = 'disconnected';
          this.qrCodeDataUrl = null;

          console.warn(`[WhatsAppService] Connection closed. Status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          broadcastEvent('whatsapp:status', {
            status: 'disconnected',
            message: `Disconnected (${statusCode || 'unknown'}). ${shouldReconnect ? 'Reconnecting...' : 'Logged out.'}`,
          }, true);

          if (shouldReconnect) {
            this.isInitializing = false;
            setTimeout(() => this.initWhatsApp(), 3500);
          } else {
            // Clean up credentials if user unlinked / logged out
            try {
              if (fs.existsSync(AUTH_DIR)) {
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
              }
            } catch (cleanupErr) {
              console.error('[WhatsAppService] Auth cleanup error:', cleanupErr);
            }
            this.isInitializing = false;
          }
        } else if (connection === 'open') {
          this.connectionState = 'connected';
          this.qrCodeDataUrl = null;
          this.userJid = this.sock.user?.id || null;
          this.userName = this.sock.user?.name || 'WhatsApp Account';

          console.log(`[WhatsAppService] Connected successfully as: ${this.userName} (${this.userJid})`);

          broadcastEvent('whatsapp:status', {
            status: 'connected',
            user: {
              jid: this.userJid,
              name: this.userName,
            },
            message: `Connected as ${this.userName}`,
          }, true);
        }
      });

      // Handle incoming messages (Opt-out detection & replies)
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!messages || !messages.length) return;

        for (const msg of messages) {
          // Only inspect incoming messages from other parties
          if (msg.key?.fromMe) continue;

          const senderJid = msg.key?.remoteJid;
          if (!senderJid || senderJid.endsWith('@g.us')) continue; // Ignore group messages

          const phone = senderJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          const body =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          if (!body) continue;

          console.log(`[WhatsAppService] Incoming message from ${phone}: "${body}"`);

          // Check Opt-out regex constraint: /stop|unsubscribe|don't text|remove/i
          const optOutRegex = /\b(stop|unsubscribe|don'?t text|remove|cancel|leave me alone)\b/i;
          if (optOutRegex.test(body)) {
            await this.handleOptOut(phone, body);
          } else {
            await this.handleLeadReply(phone, body);
          }
        }
      });

      // Handle message status updates (Delivered, Read acknowledgements)
      this.sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          if (!update.key?.id) continue;
          const msgId = update.key.id;
          const status = update.update?.status;

          // Baileys message status: 3 = DELIVERY_ACK, 4 = READ
          if (status === 3 || status === 4) {
            const newStatus = status === 4 ? 'read' : 'delivered';
            try {
              const lead = await Lead.findOneAndUpdate(
                { whatsappMessageId: msgId, status: { $in: ['sent', 'delivered'] } },
                { status: newStatus },
                { new: true }
              );
              if (lead) {
                broadcastEvent('lead:updated', { lead });
                if (newStatus === 'delivered' && lead.campaignId) {
                  await Campaign.findByIdAndUpdate(lead.campaignId, { $inc: { 'stats.deliveredCount': 1 } });
                }
              }
            } catch (err) {
              console.error('[WhatsAppService] Error updating delivery receipt:', err);
            }
          }
        }
      });
    } catch (err) {
      console.error('[WhatsAppService] Initialization error:', err);
      this.connectionState = 'disconnected';
      broadcastEvent('whatsapp:status', {
        status: 'error',
        message: `Socket init error: ${err.message}`,
      });
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Auto-Blacklist & Opt-Out Handler
   */
  async handleOptOut(phone, matchedText) {
    try {
      console.warn(`[Anti-Ban Engine] Opt-out triggered by ${phone}: "${matchedText}"`);

      // Find all leads with matching phone (with or without international prefix variants)
      const phoneRegex = new RegExp(phone.slice(-10) + '$'); // Match last 10 digits
      const leads = await Lead.find({ phone: phoneRegex, status: { $ne: 'blacklisted' } });

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

      broadcastEvent('whatsapp:optout', {
        phone,
        message: matchedText,
        blacklistedCount: leads.length,
      }, true);

      console.log(`[Anti-Ban Engine] Phone ${phone} successfully blacklisted.`);
    } catch (err) {
      console.error('[WhatsAppService] Error in handleOptOut:', err);
    }
  }

  /**
   * Handle regular replies from leads
   */
  async handleLeadReply(phone, text) {
    try {
      const phoneRegex = new RegExp(phone.slice(-10) + '$');
      const lead = await Lead.findOne({
        phone: phoneRegex,
        status: { $in: ['sent', 'delivered', 'read'] },
      });

      if (lead) {
        lead.status = 'replied';
        await lead.save();

        if (lead.campaignId) {
          await Campaign.findByIdAndUpdate(lead.campaignId, {
            $inc: { 'stats.repliedCount': 1 },
          });
        }

        broadcastEvent('lead:replied', {
          lead,
          replyText: text,
        }, true);
      }
    } catch (err) {
      console.error('[WhatsAppService] Error in handleLeadReply:', err);
    }
  }

  /**
   * Formats raw phone number into standard WhatsApp JID
   */
  formatToJid(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (!clean) return null;
    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Validates if a number is registered on WhatsApp
   */
  async verifyNumber(phone) {
    if (!this.sock || this.connectionState !== 'connected') {
      throw new Error('WhatsApp socket is not connected');
    }

    const jid = this.formatToJid(phone);
    if (!jid) throw new Error(`Invalid phone number: ${phone}`);

    const [result] = await this.sock.onWhatsApp(jid);
    return result?.exists ? result.jid : null;
  }

  /**
   * Sends a personalized message to a specific recipient
   */
  async sendMessage(phone, messageText) {
    if (!this.sock || this.connectionState !== 'connected') {
      throw new Error('WhatsApp socket is not connected. Please scan QR first.');
    }

    const targetJid = await this.verifyNumber(phone);
    if (!targetJid) {
      throw new Error(`Phone number ${phone} is not registered on WhatsApp`);
    }

    // Baileys send message
    const response = await this.sock.sendMessage(targetJid, {
      text: messageText,
    });

    return {
      messageId: response?.key?.id,
      jid: targetJid,
      timestamp: response?.messageTimestamp,
    };
  }

  /**
   * Disconnects and logs out the current WhatsApp session
   */
  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end(undefined);
      }
    } catch (err) {
      console.warn('[WhatsAppService] Logout warning:', err.message);
    }

    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[WhatsAppService] Failed removing auth directory:', err);
    }

    this.connectionState = 'disconnected';
    this.qrCodeDataUrl = null;
    this.userJid = null;
    this.userName = null;

    broadcastEvent('whatsapp:status', {
      status: 'disconnected',
      message: 'Logged out. Scan QR again to re-link.',
    }, true);

    // Re-initialize a fresh session ready to show a new QR code
    setTimeout(() => this.initWhatsApp(), 1500);
  }

  getStatus() {
    return {
      connectionState: this.connectionState,
      userJid: this.userJid,
      userName: this.userName,
      hasQr: !!this.qrCodeDataUrl,
      qrCodeDataUrl: this.qrCodeDataUrl,
    };
  }
}

export const whatsAppService = new WhatsAppService();
export default whatsAppService;
