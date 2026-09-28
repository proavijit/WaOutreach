import express from 'express';
import ChatThread from '../models/ChatThread.js';
import Message from '../models/Message.js';
import Lead from '../models/Lead.js';
import { sessionManager } from '../services/sessionManager.js';
import { broadcastEvent } from '../socket.js';

const router = express.Router();

// GET all chat threads with filtering and pagination
router.get('/threads', async (req, res) => {
  try {
    const { sessionId, search, unreadOnly, page = 1, limit = 50 } = req.query;
    const query = {};

    if (sessionId && sessionId !== 'all') {
      query.assignedSessionId = sessionId;
    }

    if (unreadOnly === 'true') {
      query.unreadCount = { $gt: 0 };
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { leadPhone: searchRegex },
        { leadName: searchRegex },
        { leadCompany: searchRegex },
        { lastMessage: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [threads, total, totalUnread] = await Promise.all([
      ChatThread.find(query).sort({ lastMessageAt: -1 }).skip(skip).limit(parseInt(limit)).populate('leadId'),
      ChatThread.countDocuments(query),
      ChatThread.countDocuments({ unreadCount: { $gt: 0 } }),
    ]);

    res.json({
      success: true,
      data: {
        threads,
        total,
        totalUnread,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET message history for a specific thread
router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const [messagesDocs, thread] = await Promise.all([
      Message.find({ threadId }).sort({ timestamp: 1 }).lean(),
      ChatThread.findById(threadId).populate('leadId').lean(),
    ]);

    // Mark thread read
    await ChatThread.findByIdAndUpdate(threadId, { unreadCount: 0 });

    // Identify the initial cold outreach message
    let initialOutreachMsg = messagesDocs.find(
      (m) => m.isOutreach === true || m.metadata?.isOutreach === true
    );

    // Fallback detection for existing or legacy messages
    if (!initialOutreachMsg) {
      if (thread?.initialOutreachMessage?.text) {
        initialOutreachMsg = messagesDocs.find(
          (m) => m.direction === 'outbound' && m.text === thread.initialOutreachMessage.text
        );
      }
      if (!initialOutreachMsg && thread?.leadId?.sentContent) {
        initialOutreachMsg = messagesDocs.find(
          (m) => m.direction === 'outbound' && m.text === thread.leadId.sentContent
        );
      }
      if (!initialOutreachMsg) {
        initialOutreachMsg = messagesDocs.find((m) => m.direction === 'outbound');
      }
    }

    const outreachIdStr = initialOutreachMsg ? String(initialOutreachMsg._id) : null;

    // Enriched messages with explicit boolean isOutreach
    const enrichedMessages = messagesDocs.map((m) => ({
      ...m,
      isOutreach: Boolean(
        m.isOutreach ||
        m.metadata?.isOutreach ||
        (outreachIdStr && String(m._id) === outreachIdStr)
      ),
    }));

    // Build structured outreachMessage object
    const outreachMessage = initialOutreachMsg
      ? {
          _id: initialOutreachMsg._id,
          text: initialOutreachMsg.text,
          timestamp: initialOutreachMsg.timestamp,
          sessionId: initialOutreachMsg.sessionId,
          accountLabel: thread?.accountLabel || initialOutreachMsg.sessionId,
          status: initialOutreachMsg.status,
          isOutreach: true,
        }
      : thread?.initialOutreachMessage?.text
      ? {
          text: thread.initialOutreachMessage.text,
          timestamp: thread.initialOutreachMessage.sentAt || thread.createdAt,
          sessionId: thread.initialOutreachMessage.sessionId || thread.assignedSessionId,
          accountLabel: thread.initialOutreachMessage.accountLabel || thread.accountLabel,
          status: 'sent',
          isOutreach: true,
        }
      : thread?.leadId?.sentContent
      ? {
          text: thread.leadId.sentContent,
          timestamp: thread.leadId.lastMessageSentAt || thread.createdAt,
          sessionId: thread.assignedSessionId,
          accountLabel: thread.accountLabel || thread.assignedSessionId,
          status: 'sent',
          isOutreach: true,
        }
      : null;

    res.json({
      success: true,
      data: enrichedMessages,
      outreachMessage,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reply to a thread from its assignedSessionId
router.post('/threads/:threadId/reply', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Reply text cannot be empty' });
    }

    const thread = await ChatThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ success: false, error: 'Chat thread not found' });
    }

    if (thread.status === 'blacklisted') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reply to a blacklisted / opted-out recipient.',
      });
    }

    // Dispatch message through the exact assignedSessionId
    const result = await sessionManager.sendMessage(
      thread.assignedSessionId,
      thread.leadPhone,
      text.trim(),
      thread.leadId
    );

    res.json({
      success: true,
      message: 'Reply dispatched successfully',
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT mark thread as read
router.put('/threads/:threadId/read', async (req, res) => {
  try {
    const thread = await ChatThread.findByIdAndUpdate(
      req.params.threadId,
      { unreadCount: 0 },
      { new: true }
    );
    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT toggle lead blacklist from inbox
router.put('/threads/:threadId/blacklist', async (req, res) => {
  try {
    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread not found' });

    const willBeBlacklisted = thread.status !== 'blacklisted';
    thread.status = willBeBlacklisted ? 'blacklisted' : 'active';
    await thread.save();

    // Update all leads matching this phone
    const phoneRegex = new RegExp(thread.leadPhone.slice(-10) + '$');
    await Lead.updateMany(
      { phone: phoneRegex },
      {
        status: willBeBlacklisted ? 'blacklisted' : 'pending',
        blacklistedAt: willBeBlacklisted ? new Date() : null,
        blacklistReason: willBeBlacklisted ? 'Blacklisted from Universal Inbox' : '',
      }
    );

    broadcastEvent('thread:updated', { thread });
    broadcastEvent('whatsapp:optout', {
      phone: thread.leadPhone,
      message: 'Manual blacklist from Inbox',
      blacklistedCount: 1,
    });

    res.json({
      success: true,
      message: willBeBlacklisted ? 'Lead blacklisted' : 'Lead un-blacklisted',
      data: thread,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST simulate incoming message (for demo & testing)
router.post('/simulate', async (req, res) => {
  try {
    const { sessionId, phone, text, name, company } = req.body;
    if (!phone || !text) {
      return res.status(400).json({ success: false, error: 'Phone and text are required' });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const firstAcc = await Account.findOne();
      activeSessionId = firstAcc?.sessionId || 'default';
    }

    // Ensure lead exists
    let lead = await Lead.findOne({ phone: new RegExp(cleanPhone.slice(-10) + '$') });
    if (!lead) {
      lead = await Lead.create({
        phone: cleanPhone,
        name: name || 'Demo Prospect',
        company: company || 'Acme Global',
        assignedSessionId: activeSessionId,
        status: 'pending',
      });
    }

    const optOutRegex = /^(stop|unsubscribe|remove|no)$/i;
    const optOutKeywordRegex = /\b(stop|unsubscribe|remove|don'?t text|cancel|leave me alone)\b/i;

    if (optOutRegex.test(text.trim()) || optOutKeywordRegex.test(text)) {
      await sessionManager.handleOptOut(activeSessionId, cleanPhone, text);
    } else {
      await sessionManager.handleIncomingMessage(activeSessionId, cleanPhone, text, `sim_${Date.now()}`);
    }

    res.json({
      success: true,
      message: 'Simulated incoming message processed successfully.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
