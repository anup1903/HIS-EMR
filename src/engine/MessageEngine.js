/**
 * Message Engine
 * Central message broker that orchestrates:
 *  - Channel lifecycle management (deploy, undeploy, start, stop)
 *  - Message reception, filtering, transformation, and routing
 *  - Logging and error handling
 *  - Real-time event emission via WebSocket
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const Channel = require('../channels/Channel');
const HL7Parser = require('./HL7Parser');
const FHIRHandler = require('./FHIRHandler');
const Filter = require('./Filter');
const Transformer = require('./Transformer');

// Connector imports
const HTTPConnector = require('../connectors/HTTPConnector');
const TCPConnector = require('../connectors/TCPConnector');
const FileConnector = require('../connectors/FileConnector');
const DatabaseConnector = require('../connectors/DatabaseConnector');

class MessageEngine {
    constructor() {
        this.channels = new Map(); // id -> { channel, sourceConnector, destConnectors }
        this.wss = null; // WebSocket server reference
        this.startTime = Date.now();
        this.globalStats = {
            totalReceived: 0,
            totalSent: 0,
            totalFiltered: 0,
            totalErrors: 0,
            totalTransformed: 0
        };
    }

    /**
     * Set WebSocket server for real-time updates
     */
    setWebSocketServer(wss) {
        this.wss = wss;
    }

    /**
     * Broadcast event to all connected WebSocket clients
     */
    broadcast(event, data) {
        if (!this.wss) return;
        const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }

    /**
     * Deploy a channel — instantiate connectors but don't start listening
     */
    async deployChannel(channelId) {
        const channel = Channel.findById(channelId);
        if (!channel) throw new Error(`Channel ${channelId} not found`);

        if (this.channels.has(channelId)) {
            await this.undeployChannel(channelId);
        }

        // Create source connector
        const sourceConnector = this._createConnector(channel.sourceConnectorType, channel.sourceConfig);

        // Create destination connectors
        const destConnectors = channel.destinationConnectors.map(dest => ({
            name: dest.name || 'Destination',
            connector: this._createConnector(dest.type, dest.config || dest),
            config: dest
        }));

        this.channels.set(channelId, {
            channel,
            sourceConnector,
            destConnectors,
            stats: { received: 0, filtered: 0, transformed: 0, sent: 0, errors: 0 }
        });

        channel.status = 'deployed';
        channel.save();

        this.broadcast('channel:deployed', { channelId, name: channel.name });
        console.log(`[Engine] Channel "${channel.name}" deployed`);
    }

    /**
     * Undeploy a channel — stop and remove connectors
     */
    async undeployChannel(channelId) {
        const entry = this.channels.get(channelId);
        if (!entry) return;

        await this.stopChannel(channelId);
        this.channels.delete(channelId);

        const channel = Channel.findById(channelId);
        if (channel) {
            channel.status = 'undeployed';
            channel.save();
        }

        this.broadcast('channel:undeployed', { channelId });
        console.log(`[Engine] Channel undeployed: ${channelId}`);
    }

    /**
     * Start a channel — begin listening for messages
     */
    async startChannel(channelId) {
        const entry = this.channels.get(channelId);
        if (!entry) throw new Error(`Channel ${channelId} not deployed`);

        const { channel, sourceConnector } = entry;

        // Start source connector with message handler
        await sourceConnector.startSource((message, metadata) => {
            this._processMessage(channelId, message, metadata);
        });

        channel.status = 'started';
        channel.save();

        this.broadcast('channel:started', { channelId, name: channel.name });
        console.log(`[Engine] Channel "${channel.name}" started`);
    }

    /**
     * Stop a channel — stop listening
     */
    async stopChannel(channelId) {
        const entry = this.channels.get(channelId);
        if (!entry) return;

        const { channel, sourceConnector, destConnectors } = entry;

        await sourceConnector.stop();
        for (const dest of destConnectors) {
            if (dest.connector.stop) await dest.connector.stop();
        }

        const ch = Channel.findById(channelId);
        if (ch) {
            ch.status = 'stopped';
            ch.save();
        }

        this.broadcast('channel:stopped', { channelId });
        console.log(`[Engine] Channel stopped: ${channelId}`);
    }

    /**
     * Process an incoming message through the channel pipeline
     */
    async _processMessage(channelId, rawMessage, metadata = {}) {
        const entry = this.channels.get(channelId);
        if (!entry) return;

        const { channel, destConnectors, stats } = entry;
        const messageId = uuidv4();
        const db = getDb();

        // Detect content type
        const contentType = this._detectContentType(rawMessage);

        // 1. Log received message
        stats.received++;
        this.globalStats.totalReceived++;

        db.prepare(`
      INSERT INTO messages (id, channel_id, source_type, status, raw_content, content_type, created_at)
      VALUES (?, ?, 'inbound', 'received', ?, ?, datetime('now'))
    `).run(messageId, channelId, rawMessage, contentType);

        this._log(messageId, channelId, 'info', 'received', `Message received via ${channel.sourceConnectorType}`);
        this.broadcast('message:received', { messageId, channelId, contentType });

        try {
            // 2. Apply filters
            const filterResult = Filter.evaluate(rawMessage, channel.filters, contentType);

            if (!filterResult.accepted) {
                stats.filtered++;
                this.globalStats.totalFiltered++;
                db.prepare('UPDATE messages SET status = ? WHERE id = ?').run('filtered', messageId);
                this._log(messageId, channelId, 'info', 'filtered', filterResult.reason);
                this.broadcast('message:filtered', { messageId, channelId, reason: filterResult.reason });
                return;
            }

            // 3. Apply transformers
            let transformedMessage = rawMessage;
            if (channel.transformers.length > 0) {
                transformedMessage = Transformer.transform(rawMessage, channel.transformers, contentType);
                stats.transformed++;
                this.globalStats.totalTransformed++;
                db.prepare('UPDATE messages SET transformed_content = ?, status = ? WHERE id = ?')
                    .run(transformedMessage, 'transformed', messageId);
                this._log(messageId, channelId, 'info', 'transformed', 'Message transformed successfully');
            }

            // 4. Send to destination connectors
            for (const dest of destConnectors) {
                try {
                    await dest.connector.sendToDestination(transformedMessage, { channelId, messageId });
                    stats.sent++;
                    this.globalStats.totalSent++;
                    this._log(messageId, channelId, 'info', 'sent', `Sent to ${dest.name}`);
                } catch (destErr) {
                    stats.errors++;
                    this.globalStats.totalErrors++;
                    this._log(messageId, channelId, 'error', 'error', `Failed to send to ${dest.name}: ${destErr.message}`);
                }
            }

            // If no destinations, still mark as sent (processed)
            if (destConnectors.length === 0) {
                stats.sent++;
                this.globalStats.totalSent++;
            }

            db.prepare('UPDATE messages SET status = ?, processed_at = datetime(\'now\') WHERE id = ?')
                .run('sent', messageId);

            this.broadcast('message:sent', { messageId, channelId });

        } catch (err) {
            stats.errors++;
            this.globalStats.totalErrors++;
            db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
                .run('error', err.message, messageId);
            this._log(messageId, channelId, 'error', 'error', err.message);
            this.broadcast('message:error', { messageId, channelId, error: err.message });
        }
    }

    /**
     * Send a test message to a channel (manual inject)
     */
    async sendTestMessage(channelId, message, contentType = 'hl7') {
        await this._processMessage(channelId, message, { source: 'manual', contentType });
    }

    /**
     * Detect the content type of a message
     */
    _detectContentType(message) {
        if (!message) return 'text';
        const trimmed = message.trim();

        if (trimmed.startsWith('MSH|')) return 'hl7';
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.resourceType) return 'fhir';
                return 'json';
            } catch (e) {
                return 'text';
            }
        }
        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';
        return 'text';
    }

    /**
     * Create a connector instance by type
     */
    _createConnector(type, config) {
        switch (type) {
            case 'http': return new HTTPConnector(config);
            case 'tcp': return new TCPConnector(config);
            case 'file': return new FileConnector(config);
            case 'database': return new DatabaseConnector(config);
            default: throw new Error(`Unknown connector type: ${type}`);
        }
    }

    /**
     * Log a message processing event
     */
    _log(messageId, channelId, level, stage, details) {
        const db = getDb();
        db.prepare(`
      INSERT INTO message_logs (message_id, channel_id, log_level, stage, details, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(messageId, channelId, level, stage, details);
    }

    /**
     * Get dashboard statistics
     */
    getDashboardStats() {
        const db = getDb();

        const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
        const errorMessages = db.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'error'").get().count;
        const todayMessages = db.prepare(
            "SELECT COUNT(*) as count FROM messages WHERE created_at >= datetime('now', '-1 day')"
        ).get().count;
        const channelCount = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;

        const channelStats = db.prepare(`
      SELECT c.id, c.name, c.status,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) as messageCount,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.status = 'error') as errorCount
      FROM channels c ORDER BY c.name
    `).all();

        const recentActivity = db.prepare(`
      SELECT ml.*, m.channel_id, c.name as channel_name
      FROM message_logs ml
      LEFT JOIN messages m ON ml.message_id = m.id
      LEFT JOIN channels c ON ml.channel_id = c.id
      ORDER BY ml.created_at DESC LIMIT 50
    `).all();

        // Message volume by hour (last 24h)
        const hourlyVolume = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM messages
      WHERE created_at >= datetime('now', '-1 day')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all();

        return {
            totalMessages,
            errorMessages,
            todayMessages,
            channelCount,
            uptime: Date.now() - this.startTime,
            globalStats: this.globalStats,
            channelStats,
            recentActivity,
            hourlyVolume
        };
    }

    /**
     * Get all active channel statuses
     */
    getChannelStatuses() {
        const statuses = [];
        for (const [id, entry] of this.channels) {
            statuses.push({
                id,
                name: entry.channel.name,
                status: entry.channel.status,
                stats: entry.stats,
                sourceType: entry.channel.sourceConnectorType,
                sourceStatus: entry.sourceConnector.getStatus()
            });
        }
        return statuses;
    }
}

// Singleton
const engine = new MessageEngine();

module.exports = engine;
