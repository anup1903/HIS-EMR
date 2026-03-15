/**
 * Dashboard Page
 */

registerPage('dashboard', async function renderDashboard() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="renderDashboard()">⟳ Refresh</button>
  `;

    content.innerHTML = `
    <div class="stats-grid" id="stats-grid">
      <div class="stat-card primary">
        <div class="stat-card-icon">📨</div>
        <div class="stat-card-value" id="stat-total">—</div>
        <div class="stat-card-label">Total Messages</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-card-icon">📊</div>
        <div class="stat-card-value" id="stat-today">—</div>
        <div class="stat-card-label">Messages Today</div>
      </div>
      <div class="stat-card success">
        <div class="stat-card-icon">🔀</div>
        <div class="stat-card-value" id="stat-channels">—</div>
        <div class="stat-card-label">Channels</div>
      </div>
      <div class="stat-card error">
        <div class="stat-card-icon">⚠️</div>
        <div class="stat-card-value" id="stat-errors">—</div>
        <div class="stat-card-label">Errors</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-card-icon">⏱️</div>
        <div class="stat-card-value" id="stat-uptime">—</div>
        <div class="stat-card-label">Uptime</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>📈 Message Throughput (24h)</h3>
        </div>
        <div class="card-body">
          <div class="chart-container" id="throughput-chart"></div>
          <div style="display:flex; justify-content:space-between; padding-top:24px;">
            <span style="font-size:11px;color:var(--text-muted)">00:00</span>
            <span style="font-size:11px;color:var(--text-muted)">06:00</span>
            <span style="font-size:11px;color:var(--text-muted)">12:00</span>
            <span style="font-size:11px;color:var(--text-muted)">18:00</span>
            <span style="font-size:11px;color:var(--text-muted)">23:00</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>🔀 Channel Overview</h3>
        </div>
        <div class="card-body" id="channel-overview" style="max-height:360px;overflow-y:auto;">
          <div class="empty-state">
            <div class="spinner" style="margin:0 auto"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <h3>📋 Recent Activity</h3>
      </div>
      <div class="card-body" id="activity-feed-container" style="max-height:400px;overflow-y:auto;">
        <div class="empty-state">
          <div class="spinner" style="margin:0 auto"></div>
        </div>
      </div>
    </div>
  `;

    // Fetch dashboard data
    try {
        const res = await API.get('/api/dashboard/stats');
        if (!res.success) throw new Error(res.error);
        const d = res.data;

        document.getElementById('stat-total').textContent = d.totalMessages.toLocaleString();
        document.getElementById('stat-today').textContent = d.todayMessages.toLocaleString();
        document.getElementById('stat-channels').textContent = d.channelCount;
        document.getElementById('stat-errors').textContent = d.errorMessages.toLocaleString();
        document.getElementById('stat-uptime').textContent = formatUptime(d.uptime);

        // Throughput chart
        renderThroughputChart(d.hourlyVolume);

        // Channel overview
        renderChannelOverview(d.channelStats);

        // Activity feed
        renderActivityFeed(d.recentActivity);

    } catch (err) {
        showToast('Failed to load dashboard: ' + err.message, 'error');
    }
});

function renderThroughputChart(hourlyData) {
    const container = document.getElementById('throughput-chart');
    if (!container) return;

    // Fill all 24 hours
    const hours = {};
    for (let i = 0; i < 24; i++) {
        hours[String(i).padStart(2, '0')] = 0;
    }
    (hourlyData || []).forEach(h => { hours[h.hour] = h.count; });

    const max = Math.max(...Object.values(hours), 1);

    container.innerHTML = Object.entries(hours).map(([hour, count]) => {
        const height = Math.max((count / max) * 160, 4);
        return `<div class="chart-bar" style="height:${height}px" title="${hour}:00 — ${count} messages"></div>`;
    }).join('');
}

function renderChannelOverview(channelStats) {
    const container = document.getElementById('channel-overview');
    if (!container) return;

    if (!channelStats || channelStats.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔀</div>
        <h3>No Channels Yet</h3>
        <p>Create your first integration channel to start routing messages.</p>
        <button class="btn btn-primary" onclick="navigateTo('channels')">Create Channel</button>
      </div>
    `;
        return;
    }

    container.innerHTML = channelStats.map(ch => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="channel-status-dot ${ch.status}"></span>
        <div>
          <div style="font-size:14px;font-weight:600;">${escapeHTML(ch.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${ch.messageCount || 0} messages · ${ch.errorCount || 0} errors</div>
        </div>
      </div>
      ${statusBadge(ch.status)}
    </div>
  `).join('');
}

function renderActivityFeed(activities) {
    const container = document.getElementById('activity-feed-container');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No Activity Yet</h3>
        <p>Activity will appear here when messages are processed.</p>
      </div>
    `;
        return;
    }

    const stageIcons = {
        received: '📥', sent: '📤', filtered: '🔍',
        error: '❌', transformed: '🔄'
    };

    container.innerHTML = `<div class="activity-feed">
    ${activities.slice(0, 30).map(a => `
      <div class="activity-item">
        <div class="activity-icon ${a.stage || ''}">${stageIcons[a.stage] || '📌'}</div>
        <div class="activity-content">
          <div class="activity-text">${escapeHTML(a.details || '')}</div>
          <div class="activity-meta">${a.channel_name ? escapeHTML(a.channel_name) + ' · ' : ''}${timeAgo(a.created_at)}</div>
        </div>
      </div>
    `).join('')}
  </div>`;
}
