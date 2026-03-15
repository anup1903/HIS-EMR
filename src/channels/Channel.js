/**
 * Channel Model
 * Manages channel lifecycle: create, deploy, undeploy, start, stop
 * Orchestrates source/destination connectors, filters, and transformers.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

class Channel {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.name = data.name || 'Unnamed Channel';
        this.description = data.description || '';
        this.status = data.status || 'undeployed'; // undeployed, deployed, started, stopped
        this.sourceConnectorType = data.source_connector_type || data.sourceConnectorType || 'http';
        this.sourceConfig = typeof data.source_config === 'string' ? JSON.parse(data.source_config || '{}') : (data.sourceConfig || {});
        this.destinationConnectors = typeof data.destination_connectors === 'string' ? JSON.parse(data.destination_connectors || '[]') : (data.destinationConnectors || []);
        this.filters = typeof data.filters === 'string' ? JSON.parse(data.filters || '[]') : (data.filters || []);
        this.transformers = typeof data.transformers === 'string' ? JSON.parse(data.transformers || '[]') : (data.transformers || []);
        this.createdAt = data.created_at || data.createdAt || new Date().toISOString();
        this.updatedAt = data.updated_at || data.updatedAt || new Date().toISOString();

        // Runtime state (not persisted)
        this.sourceConnector = null;
        this.destConnectorInstances = [];
        this.stats = { received: 0, filtered: 0, transformed: 0, sent: 0, errors: 0 };
    }

    // --- Database operations ---

    static findAll() {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
        return rows.map(row => new Channel(row));
    }

    static findById(id) {
        const db = getDb();
        const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
        return row ? new Channel(row) : null;
    }

    save() {
        const db = getDb();
        this.updatedAt = new Date().toISOString();

        const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get(this.id);

        if (existing) {
            db.prepare(`
        UPDATE channels SET
          name = ?, description = ?, status = ?,
          source_connector_type = ?, source_config = ?,
          destination_connectors = ?, filters = ?, transformers = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
                this.name, this.description, this.status,
                this.sourceConnectorType, JSON.stringify(this.sourceConfig),
                JSON.stringify(this.destinationConnectors), JSON.stringify(this.filters),
                JSON.stringify(this.transformers), this.updatedAt, this.id
            );
        } else {
            db.prepare(`
        INSERT INTO channels (id, name, description, status, source_connector_type,
          source_config, destination_connectors, filters, transformers, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                this.id, this.name, this.description, this.status,
                this.sourceConnectorType, JSON.stringify(this.sourceConfig),
                JSON.stringify(this.destinationConnectors), JSON.stringify(this.filters),
                JSON.stringify(this.transformers), this.createdAt, this.updatedAt
            );
        }

        return this;
    }

    static delete(id) {
        const db = getDb();
        db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.status,
            sourceConnectorType: this.sourceConnectorType,
            sourceConfig: this.sourceConfig,
            destinationConnectors: this.destinationConnectors,
            filters: this.filters,
            transformers: this.transformers,
            stats: this.stats,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Channel;
