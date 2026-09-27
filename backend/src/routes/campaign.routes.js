import express from 'express';
import Campaign from '../models/Campaign.js';
import Lead from '../models/Lead.js';
import { parseSpintax, generateVariations } from '../utils/spintax.js';

const router = express.Router();

// List all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new campaign
router.post('/', async (req, res) => {
  try {
    const { name, messageTemplate, config } = req.body;
    if (!name || !messageTemplate) {
      return res.status(400).json({ success: false, error: 'Name and messageTemplate are required' });
    }

    const campaign = await Campaign.create({
      name,
      messageTemplate,
      config: config || {},
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get campaign by ID
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const leadStats = await Lead.aggregate([
      { $match: { campaignId: campaign._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        campaign,
        leadStats: Object.fromEntries(leadStats.map((s) => [s._id, s.count])),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { name, messageTemplate, config, status } = req.body;
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { $set: { name, messageTemplate, config, status } },
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // Detach campaign from associated leads
    await Lead.updateMany({ campaignId: req.params.id }, { $set: { campaignId: null } });

    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preview & test spintax variations live
router.post('/preview-spintax', (req, res) => {
  try {
    const { template, sampleLead, count } = req.body;
    if (!template) {
      return res.status(400).json({ success: false, error: 'Template is required' });
    }

    const sample = sampleLead || {
      name: 'Alex Johnson',
      company: 'TechFlow Solutions',
      role: 'Growth Director',
    };

    const variations = generateVariations(template, sample, count || 5);
    const singlePreview = parseSpintax(template, sample);

    res.json({
      success: true,
      data: {
        singlePreview,
        variations,
        variablesUsed: sample,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
