/**
 * Message API Routes
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const engine = require('../engine/MessageEngine');
const HL7Parser = require('../engine/HL7Parser');
const FHIRHandler = require('../engine/FHIRHandler');

// GET /api/messages — List messages with filtering/pagination
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { channel_id, status, content_type, search, page = 1, limit = 50 } = req.query;

        let where = [];
        let params = [];

        if (channel_id) { where.push('m.channel_id = ?'); params.push(channel_id); }
        if (status) { where.push('m.status = ?'); params.push(status); }
        if (content_type) { where.push('m.content_type = ?'); params.push(content_type); }
        if (search) { where.push('(m.raw_content LIKE ? OR m.transformed_content LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const total = db.prepare(`SELECT COUNT(*) as count FROM messages m ${whereClause}`).get(...params).count;

        const messages = db.prepare(`
      SELECT m.*, c.name as channel_name
      FROM messages m
      LEFT JOIN channels c ON m.channel_id = c.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

        res.json({
            success: true,
            data: messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/messages/:id — Get message detail with logs
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const message = db.prepare(`
      SELECT m.*, c.name as channel_name
      FROM messages m
      LEFT JOIN channels c ON m.channel_id = c.id
      WHERE m.id = ?
    `).get(req.params.id);

        if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

        // Parse content if possible
        let parsedContent = null;
        if (message.content_type === 'hl7' && message.raw_content) {
            try { parsedContent = HL7Parser.parse(message.raw_content); } catch (e) { /* ignore */ }
        } else if (message.content_type === 'fhir' && message.raw_content) {
            try { parsedContent = FHIRHandler.parse(message.raw_content); } catch (e) { /* ignore */ }
        }

        const logs = db.prepare('SELECT * FROM message_logs WHERE message_id = ? ORDER BY created_at ASC').all(req.params.id);

        res.json({
            success: true,
            data: { ...message, parsedContent, logs }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/messages/:id/reprocess — Reprocess a message
router.post('/:id/reprocess', async (req, res) => {
    try {
        const db = getDb();
        const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);

        if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

        // Reset status
        db.prepare("UPDATE messages SET status = 'queued', error_message = NULL WHERE id = ?").run(req.params.id);

        // Reprocess through the engine
        await engine.sendTestMessage(message.channel_id, message.raw_content, message.content_type);

        res.json({ success: true, message: 'Message queued for reprocessing' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/messages/send — Send a test message to a channel
router.post('/send', async (req, res) => {
    try {
        const { channelId, message, contentType = 'hl7' } = req.body;

        if (!channelId) return res.status(400).json({ success: false, error: 'channelId is required' });
        if (!message) return res.status(400).json({ success: false, error: 'message is required' });

        await engine.sendTestMessage(channelId, message, contentType);

        res.json({ success: true, message: 'Test message sent' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/messages/parse — Parse a message (utility endpoint)
router.post('/parse', (req, res) => {
    try {
        const { message, contentType = 'hl7' } = req.body;

        if (!message) return res.status(400).json({ success: false, error: 'message is required' });

        let parsed;
        if (contentType === 'hl7') {
            parsed = HL7Parser.parse(message);
        } else if (contentType === 'fhir') {
            parsed = FHIRHandler.parse(message);
        } else {
            parsed = { raw: message, contentType };
        }

        res.json({ success: true, data: parsed });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/messages/samples/hl7 — Get sample HL7 messages
router.get('/samples/hl7', (req, res) => {
    res.json({
        success: true,
        data: {
            adt_a01: HL7Parser.generateSampleADT(),
            oru_r01: HL7Parser.generateSampleORU()
        }
    });
});

// GET /api/messages/samples/fhir — Get sample FHIR resources
router.get('/samples/fhir', (req, res) => {
    res.json({
        success: true,
        data: {
            patient: FHIRHandler.generateSamplePatient(),
            bundle: FHIRHandler.generateSampleBundle()
        }
    });
});

module.exports = router;
