import express from 'express';
import Account from '../models/Account.js';
import { sessionManager } from '../services/sessionManager.js';

const router = express.Router();

// GET all accounts with live session status and QR codes
router.get('/', async (req, res) => {
  try {
    const accounts = await sessionManager.getAllSessions();
    res.json({
      success: true,
      data: accounts,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST spawn new account session
router.post('/', async (req, res) => {
  try {
    const { label, dailyLimit, sessionId: reqSessionId } = req.body;
    const count = await Account.countDocuments();

    if (count >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Account limit reached (Maximum 10 accounts allowed).',
      });
    }

    // Generate unique sessionId (e.g. session_1729000000 or user-defined)
    const sessionId = (reqSessionId && String(reqSessionId).trim()) || `session_${Date.now()}`;

    // Verify uniqueness in MongoDB
    const existing = await Account.findOne({ sessionId });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Account with sessionId '${sessionId}' already exists.`,
      });
    }

    // Immediately persist account record into MongoDB
    const newAccount = await Account.create({
      sessionId,
      label: (label && label.trim()) || `WhatsApp Account ${count + 1}`,
      dailyLimit: Number(dailyLimit) || 20,
      status: 'CONNECTING',
      sentToday: 0,
      warmupActive: true,
      healthScore: 65,
    });

    // Broadcast updated account roster to frontend
    await sessionManager.broadcastAccounts();

    // Spawn Baileys session asynchronously
    sessionManager.spawnSession(sessionId).catch((e) => {
      console.error(`[AccountsRoute] Error spawning session ${sessionId}:`, e.message);
    });

    res.status(201).json({
      success: true,
      message: 'Account created. Initializing QR code...',
      data: newAccount,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update account settings (label, dailyLimit)
router.put('/:sessionId', async (req, res) => {
  try {
    const { label, dailyLimit } = req.body;
    const updateFields = {};
    if (label !== undefined) updateFields.label = label.trim();
    if (dailyLimit !== undefined) updateFields.dailyLimit = Number(dailyLimit) || 20;

    const account = await Account.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: updateFields },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    await sessionManager.broadcastAccounts();
    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reconnect an account
router.post('/:sessionId/reconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.terminateSession(sessionId, false);
    setTimeout(() => {
      sessionManager.spawnSession(sessionId).catch(console.error);
    }, 1000);

    res.json({
      success: true,
      message: `Reconnection initiated for ${sessionId}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST disconnect / logout an account (retains auth credentials on disk)
router.post('/:sessionId/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Disconnect active socket without wiping disk credentials
    await sessionManager.terminateSession(sessionId, false);
    await sessionManager.broadcastAccounts();

    res.json({
      success: true,
      message: `Session ${sessionId} disconnected. Credentials retained.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE delete account entirely (explicit user action: purges disk auth credentials & DB record)
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.terminateSession(sessionId, true);
    await Account.findOneAndDelete({ sessionId });
    await sessionManager.broadcastAccounts();

    res.json({
      success: true,
      message: `Account ${sessionId} deleted and auth credentials purged.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
