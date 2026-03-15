/**
 * HTTP Connector
 * Source: listens on an HTTP endpoint for incoming messages
 * Destination: sends HTTP POST/PUT to downstream systems
 */

const http = require('http');

class HTTPConnector {
    constructor(config = {}) {
        this.type = 'http';
        this.config = {
            host: config.host || '0.0.0.0',
            port: config.port || 8080,
            path: config.path || '/receive',
            method: config.method || 'POST',
            url: config.url || '',
            headers: config.headers || { 'Content-Type': 'text/plain' },
            timeout: config.timeout || 30000,
            ...config
        };
        this.server = null;
        this.running = false;
        this.onMessage = null;
    }

    /**
     * Start as a source connector — listen for incoming messages
     */
    startSource(messageHandler) {
        return new Promise((resolve, reject) => {
            this.onMessage = messageHandler;

            this.server = http.createServer((req, res) => {
                if (req.method === 'POST' || req.method === 'PUT') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            if (this.onMessage) {
                                this.onMessage(body, {
                                    method: req.method,
                                    path: req.url,
                                    headers: req.headers,
                                    remoteAddress: req.socket.remoteAddress
                                });
                            }
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'accepted', timestamp: new Date().toISOString() }));
                        } catch (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'error', message: err.message }));
                        }
                    });
                } else if (req.method === 'GET' && req.url === '/health') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', connector: 'http-source', port: this.config.port }));
                } else {
                    res.writeHead(405, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Method not allowed. Use POST or PUT.' }));
                }
            });

            this.server.listen(this.config.port, this.config.host, () => {
                this.running = true;
                console.log(`[HTTP Source] Listening on ${this.config.host}:${this.config.port}${this.config.path}`);
                resolve();
            });

            this.server.on('error', (err) => {
                this.running = false;
                reject(err);
            });
        });
    }

    /**
     * Send a message to a destination
     */
    sendToDestination(message) {
        return new Promise((resolve, reject) => {
            if (!this.config.url) {
                return reject(new Error('HTTP destination URL not configured'));
            }

            const url = new URL(this.config.url);
            const options = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: this.config.method || 'POST',
                headers: {
                    'Content-Type': this.config.headers['Content-Type'] || 'text/plain',
                    'Content-Length': Buffer.byteLength(message)
                },
                timeout: this.config.timeout
            };

            const req = http.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => { responseBody += chunk.toString(); });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: responseBody
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTP request timed out'));
            });

            req.write(message);
            req.end();
        });
    }

    /**
     * Stop the source connector
     */
    stop() {
        return new Promise((resolve) => {
            this.running = false;
            if (this.server) {
                this.server.close(() => {
                    console.log(`[HTTP Source] Stopped on port ${this.config.port}`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    getStatus() {
        return {
            type: this.type,
            running: this.running,
            config: { host: this.config.host, port: this.config.port, path: this.config.path }
        };
    }
}

module.exports = HTTPConnector;
