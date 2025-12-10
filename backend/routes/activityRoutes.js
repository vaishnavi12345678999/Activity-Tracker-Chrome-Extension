// backend/activityRoutes.js
const express = require('express');
const Activity = require('../models/Activity');
const verifyToken = require('../middleware/authMiddleware');

const router = express.Router();

// Helper: normalize to Date object (accepts ISO or Date)
function parseDate(d) {
  if (!d) return new Date();
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function extractDomainFromName(name) {
  try {
    return new URL(name).hostname;
  } catch {
    return name;
  }
}

// sanitize & normalize a single incoming payload into Activity fields
function normalizePayload(p, userId) {
  // accept old `name` for backward compat
  const name = p.name;
  const domain = p.domain || (name ? extractDomainFromName(name) : null);
  const url = p.url || (domain ? `https://${domain}/` : (name ? `https://${extractDomainFromName(name)}/` : null));
  const title = p.title || p.name || '';
  const duration = Number(p.duration || 0);
  const date = parseDate(p.date);

  return { domain, url, title, duration, date, user: userId, name: p.name || domain };
}

// --------------------------------------------
// POST /api/activity/track
// Accepts:
// 1) Single record: { name/domain/url/title/duration/date }
// 2) Batch: { records: [{ ... }] }
// --------------------------------------------
router.post('/track', verifyToken, async (req, res) => {
  try {
    // Batch case
    if (Array.isArray(req.body.records)) {
      const raw = req.body.records;
      if (raw.length === 0) return res.status(400).json({ message: 'No records provided' });

      const docs = raw.map(r => normalizePayload(r, req.user.id))
        .filter(d => d.domain && d.url && d.duration && d.duration > 0);

      if (docs.length === 0) {
        return res.status(400).json({ message: 'No valid records to insert' });
      }

      // insertMany is fine for append-only activity logs
      const inserted = await Activity.insertMany(docs);
      return res.status(201).json({ message: 'Batch logged', inserted: inserted.length });
    }

    // Single-record case (old or new shape)
    const { name, domain, url, title, duration, date } = req.body;
    const payload = normalizePayload({ name, domain, url, title, duration, date }, req.user.id);

    if (!payload.domain || !payload.url || !payload.duration || payload.duration <= 0) {
      return res.status(400).json({ message: 'Missing domain/url or invalid duration' });
    }

    const activity = new Activity(payload);
    await activity.save();

    return res.status(201).json({ message: 'Activity logged', activity });
  } catch (err) {
    console.error('❌ Logging error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// --------------------------------------------
// GET /api/activity/me — Return all user logs
// --------------------------------------------
router.get('/me', verifyToken, async (req, res) => {
  try {
    const logs = await Activity.find({ user: req.user.id }).sort({ date: -1 });
    res.json({ activities: logs });
  } catch (err) {
    console.error('❌ Fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
