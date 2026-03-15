/**
 * File Connector
 * Source: polls a directory for new files
 * Destination: writes messages to files in a directory
 */

const fs = require('fs');
const path = require('path');

class FileConnector {
    constructor(config = {}) {
        this.type = 'file';
        this.config = {
            sourceDirectory: config.sourceDirectory || path.join(process.cwd(), 'data', 'inbound'),
            destinationDirectory: config.destinationDirectory || path.join(process.cwd(), 'data', 'outbound'),
            pollIntervalMs: config.pollIntervalMs || 5000,
            filePattern: config.filePattern || '*',
            moveToProcessed: config.moveToProcessed !== false,
            processedDirectory: config.processedDirectory || path.join(process.cwd(), 'data', 'processed'),
            fileExtension: config.fileExtension || '.hl7',
            ...config
        };
        this.running = false;
        this.pollTimer = null;
        this.processedFiles = new Set();
        this.onMessage = null;
    }

    /**
     * Start as a source connector — poll directory
     */
    startSource(messageHandler) {
        return new Promise((resolve) => {
            this.onMessage = messageHandler;

            // Ensure directories exist
            [this.config.sourceDirectory, this.config.processedDirectory].forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });

            this.running = true;
            this._poll();
            this.pollTimer = setInterval(() => this._poll(), this.config.pollIntervalMs);

            console.log(`[File Source] Polling ${this.config.sourceDirectory} every ${this.config.pollIntervalMs}ms`);
            resolve();
        });
    }

    _poll() {
        if (!this.running) return;

        try {
            const files = fs.readdirSync(this.config.sourceDirectory);

            for (const file of files) {
                if (this.processedFiles.has(file)) continue;

                const filePath = path.join(this.config.sourceDirectory, file);
                const stat = fs.statSync(filePath);

                if (!stat.isFile()) continue;

                // Check file pattern
                if (this.config.filePattern !== '*') {
                    const pattern = this.config.filePattern.replace('*', '.*');
                    if (!new RegExp(pattern).test(file)) continue;
                }

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this.processedFiles.add(file);

                    if (this.onMessage) {
                        this.onMessage(content, {
                            filename: file,
                            path: filePath,
                            size: stat.size,
                            modified: stat.mtime
                        });
                    }

                    // Move to processed directory
                    if (this.config.moveToProcessed) {
                        const processedPath = path.join(this.config.processedDirectory, file);
                        fs.renameSync(filePath, processedPath);
                    }
                } catch (err) {
                    console.error(`[File Source] Error processing ${file}: ${err.message}`);
                }
            }
        } catch (err) {
            console.error(`[File Source] Error polling directory: ${err.message}`);
        }
    }

    /**
     * Write a message to the destination directory
     */
    sendToDestination(message, metadata = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(this.config.destinationDirectory)) {
                    fs.mkdirSync(this.config.destinationDirectory, { recursive: true });
                }

                const filename = metadata.filename || `msg_${Date.now()}${this.config.fileExtension}`;
                const filePath = path.join(this.config.destinationDirectory, filename);

                fs.writeFileSync(filePath, message, 'utf8');

                resolve({
                    filename,
                    path: filePath,
                    size: Buffer.byteLength(message)
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
            console.log(`[File Source] Stopped polling ${this.config.sourceDirectory}`);
            resolve();
        });
    }

    getStatus() {
        return {
            type: this.type,
            running: this.running,
            processedCount: this.processedFiles.size,
            config: {
                sourceDirectory: this.config.sourceDirectory,
                destinationDirectory: this.config.destinationDirectory,
                pollIntervalMs: this.config.pollIntervalMs
            }
        };
    }
}

module.exports = FileConnector;
