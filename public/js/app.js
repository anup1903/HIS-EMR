/**
 * MedBridge Connect — SPA Core
 * Router, API client, WebSocket manager, shared utilities
 */

// ── API Client ──
const API = {
    async get(url) {
        const res = await fetch(url);
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async del(url) {
        const res = await fetch(url, { method: 'DELETE' });
        return res.json();
    }
};

// ── WebSocket Manager ──
class WSManager {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectTimer = null;
        this.connected = false;
    }

    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${location.host}/ws`);

        this.ws.onopen = () => {
            this.connected = true;
            console.log('[WS] Connected');
            this._emit('ws:connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._emit(msg.event, msg.data);
            } catch (e) { /* ignore */ }
        };

        this.ws.onclose = () => {
            this.connected = false;
            console.log('[WS] Disconnected, reconnecting in 3s...');
            this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = () => {
            this.ws.close();
        };
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
    }

    _emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        cbs.forEach(cb => cb(data));
    }
}

const ws = new WSManager();

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 300ms forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── Modal ──
function openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ── Router ──
const pages = {};
let currentPage = 'dashboard';

function registerPage(name, renderFn) {
    pages[name] = renderFn;
}

function navigateTo(page) {
    if (!pages[page]) return;

    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        channels: 'Channels',
        messages: 'Messages',
        alerts: 'Alerts',
        settings: 'Settings',
        'ai-ops': 'AI Operations'
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Render page
    pages[page]();
}

// Nav click handlers
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        navigateTo(item.dataset.page);
    });
});

// ── Utility Functions ──
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function statusBadge(status) {
    const map = {
        started: 'success', deployed: 'info', stopped: 'warning',
        undeployed: 'muted', received: 'info', sent: 'success',
        error: 'error', filtered: 'warning', transformed: 'primary', queued: 'info'
    };
    return `<span class="badge badge-${map[status] || 'muted'}"><span class="badge-dot"></span>${status}</span>`;
}

function connectorTypeIcon(type) {
    const icons = { http: '🌐', tcp: '🔌', file: '📁', database: '🗄️' };
    return icons[type] || '📡';
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
    ws.connect();

    // WebSocket event handlers for real-time toasts
    ws.on('message:received', (data) => {
        showToast(`Message received on channel`, 'info', 3000);
    });
    ws.on('message:error', (data) => {
        showToast(`Message error: ${data?.error || 'Unknown'}`, 'error');
    });
    ws.on('channel:started', (data) => {
        showToast(`Channel "${data?.name}" started`, 'success');
    });
    ws.on('channel:stopped', (data) => {
        showToast(`Channel stopped`, 'warning');
    });

    // Start on dashboard after a brief delay for page scripts to register
    setTimeout(() => navigateTo('dashboard'), 100);
});
