/**
 * AI Operations Console
 * Supervisor dashboard for the healthcare AI operational layer:
 *  - Prior Authorization queue & metrics
 *  - Discharge Orchestration status
 *  - Task Router queue
 *  - PHI Compliance dashboard
 *  - System Health (AegisForge, HIS, n8n)
 *  - n8n Webhook management
 */

registerPage('ai-ops', async function renderAIOps() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = `
    <button class="btn btn-accent" onclick="showNewPriorAuthModal()">+ Prior Auth</button>
    <button class="btn btn-ghost btn-sm" onclick="renderAIOps()">⟳ Refresh</button>
  `;

    content.innerHTML = `
    <div class="tabs" id="ai-ops-tabs" style="margin-bottom:24px;">
      <div class="tab active" onclick="switchAIOpsTab('overview')">Overview</div>
      <div class="tab" onclick="switchAIOpsTab('prior-auth')">Prior Auth</div>
      <div class="tab" onclick="switchAIOpsTab('discharge')">Discharge</div>
      <div class="tab" onclick="switchAIOpsTab('tasks')">Task Queue</div>
      <div class="tab" onclick="switchAIOpsTab('compliance')">PHI Compliance</div>
      <div class="tab" onclick="switchAIOpsTab('webhooks')">n8n Webhooks</div>
    </div>

    <div id="ai-ops-tab-overview"></div>
    <div id="ai-ops-tab-prior-auth" style="display:none;"></div>
    <div id="ai-ops-tab-discharge" style="display:none;"></div>
    <div id="ai-ops-tab-tasks" style="display:none;"></div>
    <div id="ai-ops-tab-compliance" style="display:none;"></div>
    <div id="ai-ops-tab-webhooks" style="display:none;"></div>
  `;

    await loadAIOpsOverview();
});

function switchAIOpsTab(tab) {
    ['overview', 'prior-auth', 'discharge', 'tasks', 'compliance', 'webhooks'].forEach(t => {
        const el = document.getElementById(`ai-ops-tab-${t}`);
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('#ai-ops-tabs .tab').forEach((el, i) => {
        const tabs = ['overview', 'prior-auth', 'discharge', 'tasks', 'compliance', 'webhooks'];
        el.classList.toggle('active', tabs[i] === tab);
    });

    // Load tab data
    if (tab === 'overview') loadAIOpsOverview();
    else if (tab === 'prior-auth') loadPriorAuthTab();
    else if (tab === 'discharge') loadDischargeTab();
    else if (tab === 'tasks') loadTasksTab();
    else if (tab === 'compliance') loadComplianceTab();
    else if (tab === 'webhooks') loadWebhooksTab();
}

// ── OVERVIEW TAB ────────────────────────────────────────────────

async function loadAIOpsOverview() {
    const container = document.getElementById('ai-ops-tab-overview');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    try {
        const res = await API.get('/api/ai/ops/summary');
        if (!res.success) throw new Error(res.error);
        const d = res.data;

        container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-card-icon">📋</div>
          <div class="stat-card-value">${d.prior_auth.total}</div>
          <div class="stat-card-label">Prior Authorizations</div>
        </div>
        <div class="stat-card success">
          <div class="stat-card-icon">✅</div>
          <div class="stat-card-value">${d.prior_auth.approval_rate}</div>
          <div class="stat-card-label">Approval Rate</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-card-icon">🏥</div>
          <div class="stat-card-value">${d.discharge.active}</div>
          <div class="stat-card-label">Active Discharges</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-card-icon">📌</div>
          <div class="stat-card-value">${d.tasks.pending}</div>
          <div class="stat-card-label">Pending Tasks</div>
        </div>
        <div class="stat-card error">
          <div class="stat-card-icon">🚨</div>
          <div class="stat-card-value">${d.tasks.escalated}</div>
          <div class="stat-card-label">Escalated</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>🔗 Connected Systems</h3></div>
          <div class="card-body">
            ${Object.entries(d.system_health).map(([name, info]) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="channel-status-dot ${info.status === 'healthy' ? 'started' : 'stopped'}"></span>
                  <div>
                    <div style="font-weight:600;text-transform:capitalize;">${name.replace(/_/g, ' ')}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${info.url || ''}</div>
                  </div>
                </div>
                ${statusBadge(info.status === 'healthy' ? 'started' : 'stopped')}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>🛡️ PHI Compliance</h3></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">Total PHI Accesses</span>
                <span style="font-weight:600;">${d.compliance.total_phi_accesses}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">Blocked Requests</span>
                <span style="font-weight:600;color:var(--error);">${d.compliance.blocked_requests}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">AI Inferences</span>
                <span style="font-weight:600;">${d.compliance.ai_inferences}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">Redacted Operations</span>
                <span style="font-weight:600;">${d.compliance.redacted_operations}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);">
                <span style="font-weight:600;">Compliance Score</span>
                <span style="font-size:24px;font-weight:800;color:var(--success);">${d.compliance.compliance_score}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;">
        <div class="card-header">
          <h3>📌 Task Queue by Role</h3>
        </div>
        <div class="card-body">
          ${d.tasks.by_role.length > 0 ? `
            <div style="display:flex;gap:16px;flex-wrap:wrap;">
              ${d.tasks.by_role.map(r => `
                <div style="padding:12px 20px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;">
                  <div style="font-size:24px;font-weight:800;">${r.count}</div>
                  <div style="font-size:12px;color:var(--text-muted);text-transform:capitalize;">${r.assignee_role || 'Unassigned'}</div>
                </div>
              `).join('')}
            </div>
          ` : '<div style="color:var(--text-muted);">No active tasks</div>'}
        </div>
      </div>
    `;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${err.message}</p></div>`;
    }
}

// ── PRIOR AUTH TAB ──────────────────────────────────────────────

async function loadPriorAuthTab() {
    const container = document.getElementById('ai-ops-tab-prior-auth');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    try {
        const res = await API.get('/api/ai/prior-auth');
        if (!res.success) throw new Error(res.error);

        if (!res.data || res.data.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>No Prior Authorizations</h3>
          <p>Submit a prior authorization to get started.</p>
          <button class="btn btn-primary" onclick="showNewPriorAuthModal()">+ New Prior Auth</button>
        </div>`;
            return;
        }

        container.innerHTML = `
      <div class="table-container"><table>
        <thead><tr>
          <th>ID</th><th>Patient</th><th>Procedure</th><th>Payer</th><th>Status</th><th>Auth #</th><th>Appeals</th><th>Created</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${res.data.map(a => `<tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${a.id.substring(0, 8)}</td>
            <td>${escapeHTML(a.patient_id)}</td>
            <td><span class="badge badge-primary">${escapeHTML(a.procedure_code)}</span> ${escapeHTML(a.procedure_description || '')}</td>
            <td>${escapeHTML(a.payer_id)}</td>
            <td>${statusBadge(a.status === 'approved' || a.status === 'appeal_approved' ? 'sent' : a.status === 'denied' || a.status === 'appeal_denied' ? 'error' : 'queued')}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${a.auth_number || '—'}</td>
            <td>${a.appeal_count || 0}</td>
            <td style="font-size:12px;color:var(--text-muted);">${timeAgo(a.created_at)}</td>
            <td>
              ${(a.status === 'denied' || a.status === 'appeal_denied') ? `<button class="btn btn-warning btn-sm" onclick="appealPriorAuth('${a.id}')">Appeal</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ── DISCHARGE TAB ───────────────────────────────────────────────

async function loadDischargeTab() {
    const container = document.getElementById('ai-ops-tab-discharge');
    container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🏥</div>
      <h3>Discharge Orchestration</h3>
      <p>Create discharge plans from the task queue or via the API.</p>
      <button class="btn btn-primary" onclick="showNewDischargeModal()">+ New Discharge Plan</button>
    </div>`;
}

// ── TASKS TAB ───────────────────────────────────────────────────

async function loadTasksTab() {
    const container = document.getElementById('ai-ops-tab-tasks');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    try {
        const res = await API.get('/api/ai/tasks?limit=50');
        if (!res.success) throw new Error(res.error);

        if (!res.data || res.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📌</div><h3>No Tasks</h3><p>Tasks will appear when workflows generate them.</p></div>`;
            return;
        }

        const priorityColors = { critical: 'error', high: 'warning', normal: 'info', low: 'muted' };

        container.innerHTML = `
      <div class="table-container"><table>
        <thead><tr><th>Priority</th><th>Title</th><th>Type</th><th>Assignee</th><th>Patient</th><th>Status</th><th>Source</th><th>Actions</th></tr></thead>
        <tbody>
          ${res.data.map(t => `<tr>
            <td><span class="badge badge-${priorityColors[t.priority] || 'muted'}">${t.priority}</span></td>
            <td style="font-weight:500;">${escapeHTML(t.title)}</td>
            <td><span class="badge badge-primary">${t.task_type}</span></td>
            <td style="text-transform:capitalize;">${t.assignee_role || '—'}</td>
            <td style="font-size:12px;">${t.patient_id || '—'}</td>
            <td>${statusBadge(t.status === 'completed' ? 'sent' : t.status === 'escalated' ? 'error' : 'queued')}</td>
            <td style="font-size:12px;color:var(--text-muted);">${t.source_system}</td>
            <td>
              ${t.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="updateTaskStatus('${t.id}','in_progress')">Start</button>` : ''}
              ${t.status === 'in_progress' ? `<button class="btn btn-accent btn-sm" onclick="updateTaskStatus('${t.id}','completed')">Complete</button>` : ''}
              ${t.status !== 'escalated' && t.status !== 'completed' ? `<button class="btn btn-danger btn-sm" onclick="escalateTask('${t.id}')">Escalate</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ── COMPLIANCE TAB ──────────────────────────────────────────────

async function loadComplianceTab() {
    const container = document.getElementById('ai-ops-tab-compliance');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    try {
        const [compRes, auditRes] = await Promise.all([
            API.get('/api/ai/phi/compliance'),
            API.get('/api/ai/phi/audit?limit=30')
        ]);

        const c = compRes.data;
        const audits = auditRes.data || [];

        container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card success">
          <div class="stat-card-icon">🛡️</div>
          <div class="stat-card-value">${c.compliance_score}%</div>
          <div class="stat-card-label">Compliance Score</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-card-icon">🔍</div>
          <div class="stat-card-value">${c.total_phi_accesses}</div>
          <div class="stat-card-label">PHI Accesses</div>
        </div>
        <div class="stat-card error">
          <div class="stat-card-icon">🚫</div>
          <div class="stat-card-value">${c.blocked_requests}</div>
          <div class="stat-card-label">Blocked</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-card-icon">🔒</div>
          <div class="stat-card-value">${c.redacted_operations}</div>
          <div class="stat-card-label">Redacted</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>📋 Recent PHI Audit Trail</h3></div>
        <div class="card-body" style="max-height:400px;overflow-y:auto;">
          ${audits.length > 0 ? `<div class="activity-feed">
            ${audits.map(a => `
              <div class="activity-item">
                <div class="activity-icon ${a.action === 'blocked' ? 'error' : a.action === 'ai_inference' ? 'transformed' : 'received'}">${a.action === 'blocked' ? '🚫' : a.redacted ? '🔒' : '📋'}</div>
                <div class="activity-content">
                  <div class="activity-text">[${a.action}] ${escapeHTML(a.justification || '')}</div>
                  <div class="activity-meta">${a.actor} · ${a.resource_type || ''} · ${timeAgo(a.created_at)}</div>
                </div>
              </div>
            `).join('')}
          </div>` : '<div style="color:var(--text-muted);">No audit entries yet</div>'}
        </div>
      </div>`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ── WEBHOOKS TAB ────────────────────────────────────────────────

async function loadWebhooksTab() {
    const container = document.getElementById('ai-ops-tab-webhooks');
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';

    try {
        const res = await API.get('/api/ai/webhooks');
        const webhooks = res.data || [];

        container.innerHTML = `
      <div style="margin-bottom:16px;">
        <button class="btn btn-primary" onclick="showNewWebhookModal()">+ Register Webhook</button>
      </div>
      ${webhooks.length > 0 ? `
        <div class="table-container"><table>
          <thead><tr><th>Name</th><th>Event</th><th>URL</th><th>Enabled</th><th>Last Triggered</th><th>Actions</th></tr></thead>
          <tbody>
            ${webhooks.map(w => `<tr>
              <td style="font-weight:500;">${escapeHTML(w.name)}</td>
              <td><span class="badge badge-primary">${w.trigger_event}</span></td>
              <td style="font-size:12px;font-family:'JetBrains Mono',monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(w.webhook_url)}</td>
              <td>${w.enabled ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Disabled</span>'}</td>
              <td style="font-size:12px;">${w.last_triggered_at ? timeAgo(w.last_triggered_at) : 'Never'}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="triggerWebhook('${w.id}')">Test</button>
                <button class="btn btn-danger btn-sm" onclick="deleteWebhook('${w.id}')">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">🔗</div>
          <h3>No Webhooks Registered</h3>
          <p>Register n8n webhooks to automate workflows triggered by AI events.</p>
        </div>
      `}`;
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
    }
}

// ── ACTIONS ─────────────────────────────────────────────────────

function showNewPriorAuthModal() {
    const body = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Patient ID</label>
        <input class="form-control" id="pa-patient-id" placeholder="PAT001">
      </div>
      <div class="form-group">
        <label class="form-label">Payer ID</label>
        <input class="form-control" id="pa-payer-id" placeholder="BCBS001" value="BCBS001">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Procedure Code (CPT)</label>
        <input class="form-control" id="pa-procedure" placeholder="27447">
      </div>
      <div class="form-group">
        <label class="form-label">Procedure Description</label>
        <input class="form-control" id="pa-procedure-desc" placeholder="Total Knee Replacement">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Provider NPI</label>
        <input class="form-control" id="pa-npi" placeholder="1234567890" value="1234567890">
      </div>
      <div class="form-group">
        <label class="form-label">Urgency</label>
        <select class="form-control" id="pa-urgency">
          <option value="standard">Standard</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Diagnosis Codes (comma-separated ICD-10)</label>
      <input class="form-control" id="pa-diagnosis" placeholder="M17.11, Z96.651">
    </div>
  `;

    openModal('New Prior Authorization', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitPriorAuth()">Submit</button>
  `);
}

async function submitPriorAuth() {
    const data = {
        patient_id: document.getElementById('pa-patient-id').value || 'PAT001',
        payer_id: document.getElementById('pa-payer-id').value || 'BCBS001',
        procedure_code: document.getElementById('pa-procedure').value || '27447',
        procedure_description: document.getElementById('pa-procedure-desc').value || '',
        provider_npi: document.getElementById('pa-npi').value || '1234567890',
        urgency: document.getElementById('pa-urgency').value,
        diagnosis_codes: (document.getElementById('pa-diagnosis').value || '').split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
        const res = await API.post('/api/ai/prior-auth/initiate', data);
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast(`Prior Auth ${res.data.status}: ${res.data.auth_number || res.data.denial_reason || ''}`, res.data.status === 'approved' ? 'success' : 'warning');
        loadPriorAuthTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function appealPriorAuth(authId) {
    const reason = prompt('Enter appeal reason / clinical justification:');
    if (!reason) return;

    try {
        const res = await API.post('/api/ai/prior-auth/appeal', { auth_id: authId, appeal_reason: reason });
        if (!res.success) throw new Error(res.error);
        showToast(`Appeal ${res.data.status}`, res.data.status === 'appeal_approved' ? 'success' : 'warning');
        loadPriorAuthTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

function showNewDischargeModal() {
    const body = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Patient ID</label>
        <input class="form-control" id="dc-patient-id" placeholder="PAT001">
      </div>
      <div class="form-group">
        <label class="form-label">Encounter ID</label>
        <input class="form-control" id="dc-encounter-id" placeholder="ENC001">
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Disposition</label>
        <select class="form-control" id="dc-disposition">
          <option value="home">Home</option>
          <option value="snf">Skilled Nursing Facility</option>
          <option value="rehab">Rehabilitation</option>
          <option value="hospice">Hospice</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Planned Date</label>
        <input class="form-control" id="dc-date" type="date">
      </div>
    </div>
  `;

    openModal('New Discharge Plan', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitDischarge()">Create Plan</button>
  `);
}

async function submitDischarge() {
    try {
        const res = await API.post('/api/ai/discharge/initiate', {
            patient_id: document.getElementById('dc-patient-id').value || 'PAT001',
            encounter_id: document.getElementById('dc-encounter-id').value || 'ENC001',
            discharge_disposition: document.getElementById('dc-disposition').value,
            planned_date: document.getElementById('dc-date').value || null
        });
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Discharge plan created with care tasks', 'success');
        switchAIOpsTab('tasks');
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function updateTaskStatus(taskId, status) {
    try {
        const res = await API.put(`/api/ai/tasks/${taskId}/status`, { status });
        if (!res.success) throw new Error(res.error);
        showToast(`Task ${status}`, 'success');
        loadTasksTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function escalateTask(taskId) {
    const reason = prompt('Escalation reason:');
    if (!reason) return;
    try {
        const res = await API.post(`/api/ai/tasks/${taskId}/escalate`, { reason });
        if (!res.success) throw new Error(res.error);
        showToast('Task escalated to critical', 'warning');
        loadTasksTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

function showNewWebhookModal() {
    const body = `
    <div class="form-group">
      <label class="form-label">Webhook Name</label>
      <input class="form-control" id="wh-name" placeholder="e.g. Prior Auth Denial Handler">
    </div>
    <div class="form-group">
      <label class="form-label">n8n Webhook URL</label>
      <input class="form-control" id="wh-url" placeholder="http://localhost:5678/webhook/your-id">
    </div>
    <div class="form-group">
      <label class="form-label">Trigger Event</label>
      <select class="form-control" id="wh-event">
        <option value="prior_auth_denied">Prior Auth Denied</option>
        <option value="prior_auth_submitted">Prior Auth Submitted</option>
        <option value="discharge_ready">Discharge Ready</option>
        <option value="discharge_initiated">Discharge Initiated</option>
        <option value="task_escalated">Task Escalated</option>
        <option value="message_error">Message Error</option>
        <option value="custom">Custom</option>
      </select>
    </div>
  `;

    openModal('Register n8n Webhook', body, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="registerWebhook()">Register</button>
  `);
}

async function registerWebhook() {
    try {
        const res = await API.post('/api/ai/webhooks', {
            name: document.getElementById('wh-name').value,
            webhook_url: document.getElementById('wh-url').value,
            trigger_event: document.getElementById('wh-event').value
        });
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Webhook registered', 'success');
        loadWebhooksTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function triggerWebhook(id) {
    try {
        const res = await API.post(`/api/ai/webhooks/${id}/trigger`, { test: true });
        showToast(res.success ? 'Webhook triggered' : `Failed: ${res.error}`, res.success ? 'success' : 'error');
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function deleteWebhook(id) {
    if (!confirm('Delete this webhook?')) return;
    try {
        await API.del(`/api/ai/webhooks/${id}`);
        showToast('Webhook deleted', 'success');
        loadWebhooksTab();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}
