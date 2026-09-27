import express from 'express';
import { queueService } from '../services/queue.service.js';
import Lead from '../models/Lead.js';

const router = express.Router();

// Get queue status and countdown state
router.get('/status', async (req, res) => {
  try {
    const queueStatus = queueService.getQueueStatus();
    const sentLast24Hours = await queueService.getMessagesSentLast24Hours();
    const queuedCount = await Lead.countDocuments({ status: { $in: ['pending', 'queued'] } });

    res.json({
      success: true,
      data: {
        ...queueStatus,
        sentLast24Hours,
        queuedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start or resume queue processing
router.post('/start', async (req, res) => {
  try {
    const { campaignId, testMode } = req.body;
    await queueService.startQueue(campaignId, testMode);

    res.json({
      success: true,
      message: 'Queue processing started',
      data: queueService.getQueueStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pause queue
router.post('/pause', async (req, res) => {
  try {
    await queueService.pauseQueue();
    res.json({
      success: true,
      message: 'Queue paused',
      data: queueService.getQueueStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stop queue
router.post('/stop', async (req, res) => {
  try {
    await queueService.stopQueue();
    res.json({
      success: true,
      message: 'Queue stopped',
      data: queueService.getQueueStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset leads with failed or queued status back to pending
router.post('/reset-pending', async (req, res) => {
  try {
    const { campaignId, resetFailedOnly } = req.body;
    const query = {
      status: resetFailedOnly ? 'failed' : { $in: ['failed', 'queued'] },
    };
    if (campaignId) query.campaignId = campaignId;

    const result = await Lead.updateMany(query, {
      $set: { status: 'pending', errorMessage: '' },
    });

    res.json({
      success: true,
      message: `Reset ${result.modifiedCount} leads to pending state`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
