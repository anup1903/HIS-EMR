/**
 * TCP/MLLP Connector
 * Source: TCP server with MLLP (Minimal Lower Layer Protocol) framing for HL7
 * Destination: TCP client with MLLP framing
 *
 * MLLP framing:
 *   Start Block: 0x0B (VT)
 *   End Block:   0x1C (FS) + 0x0D (CR)
 */

const net = require('net');

const MLLP_START = Buffer.from([0x0B]);
const MLLP_END = Buffer.from([0x1C, 0x0D]);

class TCPConnector {
    constructor(config = {}) {
        this.type = 'tcp';
        this.config = {
            host: config.host || '0.0.0.0',
            port: config.port || 6661,
            useMllp: config.useMllp !== false,
            destinationHost: config.destinationHost || '',
            destinationPort: config.destinationPort || 6662,
            timeout: config.timeout || 30000,
            ...config
        };
        this.server = null;
        this.running = false;
        this.onMessage = null;
        this.connections = new Set();
    }

    /**
     * Start as a source connector — TCP/MLLP listener
     */
    startSource(messageHandler) {
        return new Promise((resolve, reject) => {
            this.onMessage = messageHandler;

            this.server = net.createServer((socket) => {
                this.connections.add(socket);
                let buffer = Buffer.alloc(0);

                socket.on('data', (data) => {
                    buffer = Buffer.concat([buffer, data]);

                    if (this.config.useMllp) {
                        // Process MLLP frames
                        while (true) {
                            const startIdx = buffer.indexOf(MLLP_START);
                            const endIdx = buffer.indexOf(MLLP_END);

                            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) break;

                            const message = buffer.slice(startIdx + 1, endIdx).toString('utf8');
                            buffer = buffer.slice(endIdx + 2);

                            if (this.onMessage) {
                                const result = this.onMessage(message, {
                                    remoteAddress: socket.remoteAddress,
                                    remotePort: socket.remotePort,
                                    protocol: 'mllp'
                                });

                                // Send ACK back
                                if (result && result.ack) {
                                    const ackFrame = Buffer.concat([MLLP_START, Buffer.from(result.ack), MLLP_END]);
                                    socket.write(ackFrame);
                                }
                            }
                        }
                    } else {
                        // Raw TCP — treat each data event as a message
                        const message = buffer.toString('utf8');
                        buffer = Buffer.alloc(0);

                        if (this.onMessage) {
                            this.onMessage(message, {
                                remoteAddress: socket.remoteAddress,
                                remotePort: socket.remotePort,
                                protocol: 'tcp'
                            });
                        }
                    }
                });

                socket.on('close', () => {
                    this.connections.delete(socket);
                });

                socket.on('error', (err) => {
                    console.error(`[TCP Source] Socket error: ${err.message}`);
                    this.connections.delete(socket);
                });
            });

            this.server.listen(this.config.port, this.config.host, () => {
                this.running = true;
                console.log(`[TCP Source] Listening on ${this.config.host}:${this.config.port} (MLLP: ${this.config.useMllp})`);
                resolve();
            });

            this.server.on('error', (err) => {
                this.running = false;
                reject(err);
            });
        });
    }

    /**
     * Send a message to a TCP/MLLP destination
     */
    sendToDestination(message) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(this.config.timeout);

            socket.connect(this.config.destinationPort, this.config.destinationHost, () => {
                let data;
                if (this.config.useMllp) {
                    data = Buffer.concat([MLLP_START, Buffer.from(message), MLLP_END]);
                } else {
                    data = Buffer.from(message);
                }
                socket.write(data);
            });

            let responseBuffer = Buffer.alloc(0);

            socket.on('data', (data) => {
                responseBuffer = Buffer.concat([responseBuffer, data]);
            });

            socket.on('end', () => {
                let response = responseBuffer.toString('utf8');
                // Strip MLLP framing from response
                if (this.config.useMllp) {
                    response = response.replace(/[\x0B\x1C\x0D]/g, '');
                }
                resolve({ response });
                socket.destroy();
            });

            socket.on('error', (err) => {
                reject(err);
                socket.destroy();
            });

            socket.on('timeout', () => {
                reject(new Error('TCP connection timed out'));
                socket.destroy();
            });
        });
    }

    /**
     * Stop the source connector
     */
    stop() {
        return new Promise((resolve) => {
            this.running = false;
            // Close all active connections
            for (const socket of this.connections) {
                socket.destroy();
            }
            this.connections.clear();

            if (this.server) {
                this.server.close(() => {
                    console.log(`[TCP Source] Stopped on port ${this.config.port}`);
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
            connections: this.connections.size,
            config: { host: this.config.host, port: this.config.port, useMllp: this.config.useMllp }
        };
    }
}

module.exports = TCPConnector;
