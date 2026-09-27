import express from 'express';
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';
import ActivityLog from '../models/ActivityLog.js';
import Account from '../models/Account.js';
import ChatThread from '../models/ChatThread.js';
import { queueService } from '../services/queue.service.js';

const router = express.Router();

// Get real-time stats overview
router.get('/overview', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      pendingCount,
      queuedCount,
      sentTotal,
      sentToday,
      deliveredCount,
      repliedCount,
      blacklistedCount,
      failedCount,
      totalCampaigns,
      totalAccounts,
      connectedAccounts,
      unreadInboxCount,
      accountsList,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'pending' }),
      Lead.countDocuments({ status: 'queued' }),
      Lead.countDocuments({ status: { $in: ['sent', 'delivered', 'read', 'replied'] } }),
      Lead.countDocuments({
        status: { $in: ['sent', 'delivered', 'read', 'replied'] },
        lastMessageSentAt: { $gte: twentyFourHoursAgo },
      }),
      Lead.countDocuments({ status: { $in: ['delivered', 'read'] } }),
      Lead.countDocuments({ status: 'replied' }),
      Lead.countDocuments({ status: 'blacklisted' }),
      Lead.countDocuments({ status: 'failed' }),
      Campaign.countDocuments(),
      Account.countDocuments(),
      Account.countDocuments({ status: 'CONNECTED' }),
      ChatThread.countDocuments({ unreadCount: { $gt: 0 } }),
      Account.find(),
    ]);

    const clusterDailyLimit = accountsList
      .filter((a) => a.status === 'CONNECTED')
      .reduce((sum, a) => sum + (a.dailyLimit || 20), 0);

    const queueStatus = queueService.getQueueStatus();

    res.json({
      success: true,
      data: {
        totalLeads,
        pendingCount,
        queuedCount,
        sentTotal,
        sentToday,
        deliveredCount,
        repliedCount,
        blacklistedCount,
        failedCount,
        totalCampaigns,
        totalAccounts,
        connectedAccounts,
        clusterDailyLimit: clusterDailyLimit || 100,
        unreadInboxCount,
        dailyCap: clusterDailyLimit || 100,
        queueStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get recent activity logs
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 40;
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear activity logs
router.delete('/logs', async (req, res) => {
  try {
    await ActivityLog.deleteMany({});
    res.json({ success: true, message: 'Activity logs cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
