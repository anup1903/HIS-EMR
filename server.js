/**
 * MedBridge Connect — EMR/EHR Middleware Integration Engine
 * Server Entry Point
 */

const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const { getDb, closeDb } = require('./src/database/db');
const engine = require('./src/engine/MessageEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'text/*', limit: '10mb' }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/channels', require('./src/routes/channels'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/alerts', require('./src/routes/alerts'));
app.use('/api/ai', require('./src/routes/ai'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        name: 'MedBridge Connect',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Initialize database
getDb();
console.log('✅ Database initialized');

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   🏥  MedBridge Connect v1.0.0                          ║
  ║   EMR/EHR Middleware Integration Engine                  ║
  ║                                                          ║
  ║   Dashboard:  http://localhost:${PORT}                     ║
  ║   API:        http://localhost:${PORT}/api                 ║
  ║   Health:     http://localhost:${PORT}/api/health           ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ event: 'connected', data: { message: 'Connected to MedBridge Connect' } }));

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});

engine.setWebSocketServer(wss);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MedBridge Connect...');
    closeDb();
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    closeDb();
    server.close(() => process.exit(0));
});
