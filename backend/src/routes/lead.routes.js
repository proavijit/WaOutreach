import express from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';
import { broadcastEvent } from '../socket.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Normalizes phone numbers to pure numeric digits
 */
function cleanPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).trim().replace(/[^0-9]/g, '');
  return cleaned;
}

// Get leads with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { status, campaignId, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (campaignId && campaignId !== 'all') {
      query.campaignId = campaignId;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { phone: searchRegex }, { company: searchRegex }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Lead.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create single lead
router.post('/', async (req, res) => {
  try {
    const { phone, name, company, customFields, campaignId } = req.body;
    const cleanedPhone = cleanPhoneNumber(phone);

    if (!cleanedPhone || cleanedPhone.length < 8) {
      return res.status(400).json({ success: false, error: 'A valid international phone number is required' });
    }

    // Check if phone already globally blacklisted
    const isBlacklisted = await Lead.exists({ phone: cleanedPhone, status: 'blacklisted' });

    const lead = await Lead.create({
      phone: cleanedPhone,
      name: name || '',
      company: company || '',
      customFields: customFields || {},
      campaignId: campaignId || null,
      status: isBlacklisted ? 'blacklisted' : 'pending',
      blacklistReason: isBlacklisted ? 'Previously blacklisted' : '',
    });

    if (campaignId) {
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.totalLeads': 1 } });
    }

    broadcastEvent('lead:created', { lead });

    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Lead with this phone already exists in this campaign' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Import leads via CSV file
router.post('/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required' });
    }

    const campaignId = req.body.campaignId || null;
    const records = [];

    const stream = Readable.from(req.file.buffer).pipe(
      csvParser({
        mapHeaders: ({ header }) => header.trim().toLowerCase(),
      })
    );

    for await (const row of stream) {
      // Intelligently identify phone column
      const phoneKey = Object.keys(row).find((k) =>
        ['phone', 'mobile', 'whatsapp', 'number', 'tel', 'phone_number', 'contact'].includes(k)
      ) || Object.keys(row)[0];

      // Identify name column
      const nameKey = Object.keys(row).find((k) =>
        ['name', 'full_name', 'fullname', 'first_name', 'lead_name', 'contact_name'].includes(k)
      );

      // Identify company column
      const companyKey = Object.keys(row).find((k) =>
        ['company', 'organization', 'business', 'company_name', 'org'].includes(k)
      );

      const rawPhone = row[phoneKey];
      const cleanedPhone = cleanPhoneNumber(rawPhone);

      if (cleanedPhone && cleanedPhone.length >= 8) {
        // Collect custom fields from remaining keys
        const customFields = {};
        for (const [key, value] of Object.entries(row)) {
          if (key !== phoneKey && key !== nameKey && key !== companyKey) {
            customFields[key] = value;
          }
        }

        records.push({
          phone: cleanedPhone,
          name: nameKey ? row[nameKey] : '',
          company: companyKey ? row[companyKey] : '',
          customFields,
          campaignId: campaignId || null,
          status: 'pending',
        });
      }
    }

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers found in CSV. Please verify column headers.',
      });
    }

    // Check existing blacklisted numbers to preserve safety
    const blacklistedList = await Lead.find({ status: 'blacklisted' }).select('phone');
    const blacklistedSet = new Set(blacklistedList.map((l) => l.phone));

    let importedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      try {
        if (blacklistedSet.has(record.phone)) {
          record.status = 'blacklisted';
          record.blacklistReason = 'Previously blacklisted phone';
        }

        await Lead.findOneAndUpdate(
          { phone: record.phone, campaignId: record.campaignId },
          { $set: record },
          { upsert: true, new: true }
        );
        importedCount++;
      } catch (e) {
        skippedCount++;
      }
    }

    if (campaignId) {
      const totalCampaignLeads = await Lead.countDocuments({ campaignId });
      await Campaign.findByIdAndUpdate(campaignId, { 'stats.totalLeads': totalCampaignLeads });
    }

    broadcastEvent('leads:imported', {
      totalFound: records.length,
      importedCount,
      skippedCount,
      campaignId,
    }, true);

    res.json({
      success: true,
      message: `Successfully processed ${records.length} records. (${importedCount} saved, ${skippedCount} duplicates/skipped)`,
      data: {
        totalParsed: records.length,
        importedCount,
        skippedCount,
      },
    });
  } catch (err) {
    console.error('[CSV Import Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle or update lead blacklist status
router.put('/:id/blacklist', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const willBeBlacklisted = lead.status !== 'blacklisted';
    lead.status = willBeBlacklisted ? 'blacklisted' : 'pending';
    lead.blacklistedAt = willBeBlacklisted ? new Date() : null;
    lead.blacklistReason = willBeBlacklisted ? (req.body.reason || 'Manually blacklisted by operator') : '';
    await lead.save();

    broadcastEvent('lead:updated', { lead }, true);

    res.json({
      success: true,
      message: willBeBlacklisted ? 'Lead blacklisted' : 'Lead removed from blacklist',
      data: lead,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    if (lead.campaignId) {
      await Campaign.findByIdAndUpdate(lead.campaignId, { $inc: { 'stats.totalLeads': -1 } });
    }

    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk clear leads
router.delete('/', async (req, res) => {
  try {
    const { campaignId, status } = req.query;
    const query = {};
    if (campaignId) query.campaignId = campaignId;
    if (status && status !== 'all') query.status = status;

    const result = await Lead.deleteMany(query);
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} leads`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
