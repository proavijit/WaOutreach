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
    const { label, dailyLimit } = req.body;
    const count = await Account.countDocuments();

    if (count >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Account limit reached (Maximum 10 accounts allowed).',
      });
    }

    const sessionId = `session_${Date.now().toString(36)}`;
    const newAccount = await Account.create({
      sessionId,
      label: label || `WhatsApp Account ${count + 1}`,
      dailyLimit: Number(dailyLimit) || 20,
      status: 'CONNECTING',
    });

    // Spawn session asynchronously
    sessionManager.spawnSession(sessionId).catch((e) => {
      console.error(`Error spawning new session ${sessionId}:`, e);
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
    const account = await Account.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { label, dailyLimit: Number(dailyLimit) || 20 } },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

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

// POST disconnect / logout an account
router.post('/:sessionId/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.terminateSession(sessionId, true);

    res.json({
      success: true,
      message: `Session ${sessionId} disconnected and credentials purged.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE delete account entirely
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.terminateSession(sessionId, true);
    await Account.findOneAndDelete({ sessionId });

    res.json({
      success: true,
      message: `Account ${sessionId} deleted.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
