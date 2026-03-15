/**
 * Channel API Routes
 */

const express = require('express');
const router = express.Router();
const Channel = require('../channels/Channel');
const engine = require('../engine/MessageEngine');

// GET /api/channels — List all channels
router.get('/', (req, res) => {
    try {
        const channels = Channel.findAll();
        res.json({ success: true, data: channels.map(c => c.toJSON()) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/channels/:id — Get a channel
router.get('/:id', (req, res) => {
    try {
        const channel = Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });
        res.json({ success: true, data: channel.toJSON() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/channels — Create a channel
router.post('/', (req, res) => {
    try {
        const channel = new Channel({
            name: req.body.name,
            description: req.body.description,
            sourceConnectorType: req.body.sourceConnectorType || 'http',
            sourceConfig: req.body.sourceConfig || {},
            destinationConnectors: req.body.destinationConnectors || [],
            filters: req.body.filters || [],
            transformers: req.body.transformers || []
        });
        channel.save();
        res.status(201).json({ success: true, data: channel.toJSON() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/channels/:id — Update a channel
router.put('/:id', (req, res) => {
    try {
        const channel = Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

        if (req.body.name !== undefined) channel.name = req.body.name;
        if (req.body.description !== undefined) channel.description = req.body.description;
        if (req.body.sourceConnectorType !== undefined) channel.sourceConnectorType = req.body.sourceConnectorType;
        if (req.body.sourceConfig !== undefined) channel.sourceConfig = req.body.sourceConfig;
        if (req.body.destinationConnectors !== undefined) channel.destinationConnectors = req.body.destinationConnectors;
        if (req.body.filters !== undefined) channel.filters = req.body.filters;
        if (req.body.transformers !== undefined) channel.transformers = req.body.transformers;

        channel.save();
        res.json({ success: true, data: channel.toJSON() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/channels/:id — Delete a channel
router.delete('/:id', async (req, res) => {
    try {
        const channel = Channel.findById(req.params.id);
        if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

        // Undeploy if running
        try { await engine.undeployChannel(req.params.id); } catch (e) { /* ignore */ }

        Channel.delete(req.params.id);
        res.json({ success: true, message: 'Channel deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/channels/:id/deploy — Deploy a channel
router.post('/:id/deploy', async (req, res) => {
    try {
        await engine.deployChannel(req.params.id);
        res.json({ success: true, message: 'Channel deployed' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/channels/:id/undeploy — Undeploy a channel
router.post('/:id/undeploy', async (req, res) => {
    try {
        await engine.undeployChannel(req.params.id);
        res.json({ success: true, message: 'Channel undeployed' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/channels/:id/start — Start a channel
router.post('/:id/start', async (req, res) => {
    try {
        await engine.startChannel(req.params.id);
        res.json({ success: true, message: 'Channel started' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/channels/:id/stop — Stop a channel
router.post('/:id/stop', async (req, res) => {
    try {
        await engine.stopChannel(req.params.id);
        res.json({ success: true, message: 'Channel stopped' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
