/**
 * Alert API Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

// GET /api/alerts — List all alerts
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all();
        alerts.forEach(a => {
            a.trigger_config = JSON.parse(a.trigger_config || '{}');
            a.action_config = JSON.parse(a.action_config || '{}');
        });
        res.json({ success: true, data: alerts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/alerts — Create an alert
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();

        db.prepare(`
      INSERT INTO alerts (id, name, description, enabled, trigger_type, trigger_config, action_type, action_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            req.body.name || 'New Alert',
            req.body.description || '',
            req.body.enabled !== false ? 1 : 0,
            req.body.triggerType || 'error_count',
            JSON.stringify(req.body.triggerConfig || {}),
            req.body.actionType || 'log',
            JSON.stringify(req.body.actionConfig || {})
        );

        const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
        alert.trigger_config = JSON.parse(alert.trigger_config || '{}');
        alert.action_config = JSON.parse(alert.action_config || '{}');

        res.status(201).json({ success: true, data: alert });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/alerts/:id — Update an alert
router.put('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, error: 'Alert not found' });

        db.prepare(`
      UPDATE alerts SET name = ?, description = ?, enabled = ?, trigger_type = ?,
        trigger_config = ?, action_type = ?, action_config = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
            req.body.name || existing.name,
            req.body.description || existing.description,
            req.body.enabled !== undefined ? (req.body.enabled ? 1 : 0) : existing.enabled,
            req.body.triggerType || existing.trigger_type,
            JSON.stringify(req.body.triggerConfig || JSON.parse(existing.trigger_config)),
            req.body.actionType || existing.action_type,
            JSON.stringify(req.body.actionConfig || JSON.parse(existing.action_config)),
            req.params.id
        );

        const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
        alert.trigger_config = JSON.parse(alert.trigger_config || '{}');
        alert.action_config = JSON.parse(alert.action_config || '{}');

        res.json({ success: true, data: alert });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/alerts/:id — Delete an alert
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Alert deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/alerts/:id/history — Get alert history
router.get('/:id/history', (req, res) => {
    try {
        const db = getDb();
        const history = db.prepare(
            'SELECT * FROM alert_history WHERE alert_id = ? ORDER BY triggered_at DESC LIMIT 100'
        ).all(req.params.id);
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
