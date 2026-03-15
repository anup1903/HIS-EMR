/**
 * Database Connector
 * Source: polls a database table for new rows
 * Destination: inserts message data into a database table
 *
 * Uses the application's SQLite database with configurable tables.
 */

const { getDb } = require('../database/db');

class DatabaseConnector {
    constructor(config = {}) {
        this.type = 'database';
        this.config = {
            sourceTable: config.sourceTable || 'incoming_messages',
            sourceQuery: config.sourceQuery || '',
            destinationTable: config.destinationTable || 'outgoing_messages',
            pollIntervalMs: config.pollIntervalMs || 5000,
            processedColumn: config.processedColumn || 'processed',
            messageColumn: config.messageColumn || 'content',
            ...config
        };
        this.running = false;
        this.pollTimer = null;
        this.onMessage = null;
    }

    /**
     * Start as a source connector — poll database table
     */
    startSource(messageHandler) {
        return new Promise((resolve) => {
            this.onMessage = messageHandler;

            // Ensure source table exists
            const db = getDb();
            db.exec(`CREATE TABLE IF NOT EXISTS ${this.config.sourceTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        processed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`);

            this.running = true;
            this._poll();
            this.pollTimer = setInterval(() => this._poll(), this.config.pollIntervalMs);

            console.log(`[DB Source] Polling table '${this.config.sourceTable}' every ${this.config.pollIntervalMs}ms`);
            resolve();
        });
    }

    _poll() {
        if (!this.running) return;

        try {
            const db = getDb();
            const query = this.config.sourceQuery ||
                `SELECT * FROM ${this.config.sourceTable} WHERE ${this.config.processedColumn} = 0 ORDER BY id ASC LIMIT 10`;

            const rows = db.prepare(query).all();

            for (const row of rows) {
                const message = row[this.config.messageColumn] || row.content || JSON.stringify(row);

                if (this.onMessage) {
                    this.onMessage(message, {
                        rowId: row.id,
                        table: this.config.sourceTable,
                        row
                    });
                }

                // Mark as processed
                db.prepare(`UPDATE ${this.config.sourceTable} SET ${this.config.processedColumn} = 1 WHERE id = ?`).run(row.id);
            }
        } catch (err) {
            console.error(`[DB Source] Error polling: ${err.message}`);
        }
    }

    /**
     * Write a message to the destination table
     */
    sendToDestination(message, metadata = {}) {
        return new Promise((resolve, reject) => {
            try {
                const db = getDb();

                // Ensure destination table exists
                db.exec(`CREATE TABLE IF NOT EXISTS ${this.config.destinationTable} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          channel_id TEXT,
          source_message_id TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`);

                const stmt = db.prepare(
                    `INSERT INTO ${this.config.destinationTable} (content, channel_id, source_message_id) VALUES (?, ?, ?)`
                );
                const result = stmt.run(message, metadata.channelId || '', metadata.messageId || '');

                resolve({
                    table: this.config.destinationTable,
                    rowId: result.lastInsertRowid
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Stop the source connector
     */
    stop() {
        return new Promise((resolve) => {
            this.running = false;
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
            console.log(`[DB Source] Stopped polling table '${this.config.sourceTable}'`);
            resolve();
        });
    }

    getStatus() {
        return {
            type: this.type,
            running: this.running,
            config: {
                sourceTable: this.config.sourceTable,
                destinationTable: this.config.destinationTable,
                pollIntervalMs: this.config.pollIntervalMs
            }
        };
    }
}

module.exports = DatabaseConnector;
