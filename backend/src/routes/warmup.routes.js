import express from 'express';
import { warmupService } from '../services/warmup.service.js';
import Account from '../models/Account.js';

const router = express.Router();

// GET warmup status & stats
router.get('/status', async (req, res) => {
  try {
    const status = warmupService.getStatus();
    const accounts = await Account.find().select('sessionId label phone status healthScore warmupDays warmupMessagesCount warmupActive');

    res.json({
      success: true,
      data: {
        ...status,
        accounts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST toggle automated warmup scheduler
router.post('/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    warmupService.isEnabled = enabled !== undefined ? !!enabled : !warmupService.isEnabled;

    if (warmupService.isEnabled) {
      warmupService.startScheduler();
    } else {
      warmupService.stopScheduler();
    }

    res.json({
      success: true,
      message: `Warmup scheduler ${warmupService.isEnabled ? 'enabled' : 'paused'}`,
      data: warmupService.getStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger manual P2P warmup round
router.post('/trigger', async (req, res) => {
  try {
    const { sessionAId, sessionBId, fastMode = true } = req.body;
    const result = await warmupService.triggerManual(sessionAId, sessionBId, fastMode);

    res.json({
      success: true,
      message: result.message || 'Peer-to-peer warmup round executed successfully',
      data: result.data || result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
