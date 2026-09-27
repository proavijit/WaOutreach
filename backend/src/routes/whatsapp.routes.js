import express from 'express';
import { whatsAppService } from '../services/whatsapp.service.js';

const router = express.Router();

// Get current WhatsApp connection status & QR
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: whatsAppService.getStatus(),
  });
});

// Trigger a reconnect / restart
router.post('/reconnect', async (req, res) => {
  try {
    await whatsAppService.initWhatsApp();
    res.json({
      success: true,
      message: 'Reconnection triggered',
      data: whatsAppService.getStatus(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logout and unlink session
router.post('/logout', async (req, res) => {
  try {
    await whatsAppService.logout();
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send single test message directly
router.post('/test-send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    const result = await whatsAppService.sendMessage(phone, message);
    res.json({
      success: true,
      message: 'Message dispatched successfully',
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
