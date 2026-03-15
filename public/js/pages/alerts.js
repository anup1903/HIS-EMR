/**
 * Alerts Page
 */

registerPage('alerts', async function renderAlerts() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = `
    <button class="btn btn-primary" onclick="showCreateAlertModal()">+ New Alert</button>
    <button class="btn btn-ghost btn-sm" onclick="renderAlerts()">⟳ Refresh</button>
  `;

    content.innerHTML = `
    <div id="alerts-list">
      <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
    </div>
  `;

    try {
        const res = await API.get('/api/alerts');
        if (!res.success) throw new Error(res.error);
        renderAlertList(res.data);
    } catch (err) {
        showToast('Failed to load alerts: ' + err.message, 'error');
    }
});

function renderAlertList(alerts) {
    const container = document.getElementById('alerts-list');

    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <h3>No Alerts Configured</h3>
        <p>Set up alerts to get notified when specific conditions occur, such as high error rates or channel failures.</p>
        <button class="btn btn-primary btn-lg" onclick="showCreateAlertModal()">+ Create Alert</button>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Alert Name</th>
            <th>Trigger</th>
            <th>Action</th>
            <th>Enabled</th>
            <th>Last Triggered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${alerts.map(alert => `
            <tr>
              <td>
                <div style="font-weight:600;">${escapeHTML(alert.name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${escapeHTML(alert.description || '')}</div>
              </td>
              <td><span class="badge badge-primary">${alert.trigger_type}</span></td>
              <td><span class="badge badge-info">${alert.action_type}</span></td>
              <td>
                ${alert.enabled ?
            '<span class="badge badge-success"><span class="badge-dot"></span>Active</span>' :
            '<span class="badge badge-muted"><span class="badge-dot"></span>Disabled</span>'
        }
              </td>
              <td style="font-size:13px;color:var(--text-muted);">${alert.last_triggered_at ? timeAgo(alert.last_triggered_at) : 'Never'}</td>
              <td>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="toggleAlert('${alert.id}', ${!alert.enabled})">${alert.enabled ? '⏸ Disable' : '▶ Enable'}</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteAlert('${alert.id}')">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showCreateAlertModal() {
    const body = `
    <div class="form-group">
      <label class="form-label">Alert Name</label>
      <input class="form-control" id="alert-name" placeholder="e.g. High Error Rate Alert">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-control" id="alert-desc" placeholder="What conditions does this alert monitor?">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Trigger Type</label>
        <select class="form-control" id="alert-trigger-type">
          <option value="error_count">Error Count Threshold</option>
          <option value="channel_status">Channel Status Change</option>
          <option value="message_type">Message Type Match</option>
          <option value="custom">Custom Rule</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Action Type</label>
        <select class="form-control" id="alert-action-type">
          <option value="log">Log to System</option>
          <option value="email">Send Email</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>
    </div>
  `;

    const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="createAlert()">Create Alert</button>
  `;

    openModal('Create Alert', body, footer);
}

async function createAlert() {
    const name = document.getElementById('alert-name').value.trim();
    if (!name) { showToast('Alert name is required', 'warning'); return; }

    try {
        const res = await API.post('/api/alerts', {
            name,
            description: document.getElementById('alert-desc').value.trim(),
            triggerType: document.getElementById('alert-trigger-type').value,
            actionType: document.getElementById('alert-action-type').value
        });
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Alert created!', 'success');
        renderAlerts();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function toggleAlert(id, enabled) {
    try {
        const res = await API.put(`/api/alerts/${id}`, { enabled });
        if (!res.success) throw new Error(res.error);
        showToast(enabled ? 'Alert enabled' : 'Alert disabled', 'success');
        renderAlerts();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function deleteAlert(id) {
    if (!confirm('Delete this alert?')) return;
    try {
        const res = await API.del(`/api/alerts/${id}`);
        if (!res.success) throw new Error(res.error);
        showToast('Alert deleted', 'success');
        renderAlerts();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}
