/**
 * Dashboard API Routes
 */

const express = require('express');
const router = express.Router();
const engine = require('../engine/MessageEngine');
const { getDb } = require('../database/db');

// GET /api/dashboard/stats — Aggregate stats
router.get('/stats', (req, res) => {
    try {
        const stats = engine.getDashboardStats();
        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/dashboard/activity — Recent activity feed
router.get('/activity', (req, res) => {
    try {
        const db = getDb();
        const limit = parseInt(req.query.limit) || 50;

        const activity = db.prepare(`
      SELECT ml.*, c.name as channel_name
      FROM message_logs ml
      LEFT JOIN channels c ON ml.channel_id = c.id
      ORDER BY ml.created_at DESC
      LIMIT ?
    `).all(limit);

        res.json({ success: true, data: activity });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/dashboard/channels — Active channel statuses
router.get('/channels', (req, res) => {
    try {
        const statuses = engine.getChannelStatuses();
        res.json({ success: true, data: statuses });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
