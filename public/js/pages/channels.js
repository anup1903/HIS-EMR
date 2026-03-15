/**
 * Channels Page
 */

registerPage('channels', async function renderChannels() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = `
    <button class="btn btn-primary" onclick="showCreateChannelModal()">+ New Channel</button>
    <button class="btn btn-ghost btn-sm" onclick="renderChannels()">⟳ Refresh</button>
  `;

    content.innerHTML = `
    <div id="channels-list">
      <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
    </div>
  `;

    try {
        const res = await API.get('/api/channels');
        if (!res.success) throw new Error(res.error);
        renderChannelList(res.data);
    } catch (err) {
        showToast('Failed to load channels: ' + err.message, 'error');
    }
});

function renderChannelList(channels) {
    const container = document.getElementById('channels-list');

    if (!channels || channels.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔀</div>
        <h3>No Integration Channels</h3>
        <p>Create a channel to define how messages flow between systems.</p>
        <button class="btn btn-primary btn-lg" onclick="showCreateChannelModal()">+ Create Your First Channel</button>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Channel Name</th>
            <th>Source</th>
            <th>Destinations</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${channels.map(ch => `
            <tr>
              <td>
                <div style="font-weight:600;">${escapeHTML(ch.name)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${escapeHTML(ch.description || 'No description')}</div>
              </td>
              <td>
                <span style="display:flex;align-items:center;gap:6px;">
                  ${connectorTypeIcon(ch.sourceConnectorType)}
                  ${ch.sourceConnectorType.toUpperCase()}
                </span>
              </td>
              <td>${(ch.destinationConnectors || []).length} destination(s)</td>
              <td>
                <div class="channel-status">
                  <span class="channel-status-dot ${ch.status}"></span>
                  ${statusBadge(ch.status)}
                </div>
              </td>
              <td style="font-size:13px;color:var(--text-secondary);">${formatDate(ch.createdAt)}</td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${ch.status === 'undeployed' || ch.status === 'stopped' ? `
                    <button class="btn btn-success btn-sm" onclick="deployAndStartChannel('${ch.id}')">▶ Start</button>
                  ` : ''}
                  ${ch.status === 'started' ? `
                    <button class="btn btn-warning btn-sm" onclick="stopChannel('${ch.id}')">⏹ Stop</button>
                  ` : ''}
                  ${ch.status === 'deployed' ? `
                    <button class="btn btn-success btn-sm" onclick="startChannel('${ch.id}')">▶ Start</button>
                    <button class="btn btn-ghost btn-sm" onclick="undeployChannel('${ch.id}')">Undeploy</button>
                  ` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="showEditChannelModal('${ch.id}')">✏️ Edit</button>
                  <button class="btn btn-ghost btn-sm" onclick="showChannelDetail('${ch.id}')">👁️ View</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteChannel('${ch.id}')">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function deployAndStartChannel(id) {
    try {
        showToast('Deploying channel...', 'info', 2000);
        let res = await API.post(`/api/channels/${id}/deploy`);
        if (!res.success) throw new Error(res.error);
        res = await API.post(`/api/channels/${id}/start`);
        if (!res.success) throw new Error(res.error);
        showToast('Channel deployed and started!', 'success');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function startChannel(id) {
    try {
        const res = await API.post(`/api/channels/${id}/start`);
        if (!res.success) throw new Error(res.error);
        showToast('Channel started!', 'success');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function stopChannel(id) {
    try {
        const res = await API.post(`/api/channels/${id}/stop`);
        if (!res.success) throw new Error(res.error);
        showToast('Channel stopped', 'warning');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function undeployChannel(id) {
    try {
        const res = await API.post(`/api/channels/${id}/undeploy`);
        if (!res.success) throw new Error(res.error);
        showToast('Channel undeployed', 'info');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function deleteChannel(id) {
    if (!confirm('Are you sure you want to delete this channel? This action cannot be undone.')) return;
    try {
        const res = await API.del(`/api/channels/${id}`);
        if (!res.success) throw new Error(res.error);
        showToast('Channel deleted', 'success');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

function showCreateChannelModal() {
    const body = `
    <div class="form-group">
      <label class="form-label">Channel Name</label>
      <input class="form-control" id="ch-name" placeholder="e.g. ADT Patient Admit Feed" required>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-control" id="ch-desc" placeholder="Brief description of this channel">
    </div>

    <div style="border-top:1px solid var(--border);padding-top:18px;margin-top:18px;">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:14px;">Source Connector</h4>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="ch-source-type" onchange="updateSourceConfig()">
            <option value="http">🌐 HTTP Listener</option>
            <option value="tcp">🔌 TCP/MLLP</option>
            <option value="file">📁 File Reader</option>
            <option value="database">🗄️ Database Reader</option>
          </select>
        </div>
        <div class="form-group" id="source-config-port">
          <label class="form-label">Port</label>
          <input class="form-control" id="ch-source-port" type="number" value="8080" placeholder="8080">
        </div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:18px;margin-top:18px;">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:14px;">Destination Connector</h4>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="ch-dest-type">
            <option value="file">📁 File Writer</option>
            <option value="http">🌐 HTTP Sender</option>
            <option value="tcp">🔌 TCP/MLLP</option>
            <option value="database">🗄️ Database Writer</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Destination Name</label>
          <input class="form-control" id="ch-dest-name" value="Primary Destination">
        </div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:18px;margin-top:18px;">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:14px;">Pipeline</h4>
      <div class="pipeline">
        <div class="pipeline-step active">
          <div class="pipeline-step-icon">📥</div>
          <div class="pipeline-step-label">Source</div>
        </div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-step active">
          <div class="pipeline-step-icon">🔍</div>
          <div class="pipeline-step-label">Filter</div>
        </div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-step active">
          <div class="pipeline-step-icon">🔄</div>
          <div class="pipeline-step-label">Transform</div>
        </div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-step active">
          <div class="pipeline-step-icon">📤</div>
          <div class="pipeline-step-label">Destination</div>
        </div>
      </div>
    </div>
  `;

    const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="createChannel()">Create Channel</button>
  `;

    openModal('Create New Channel', body, footer);
}

function updateSourceConfig() {
    const type = document.getElementById('ch-source-type').value;
    const portGroup = document.getElementById('source-config-port');
    const portInput = document.getElementById('ch-source-port');

    if (type === 'http') {
        portGroup.style.display = 'block';
        portInput.value = '8080';
    } else if (type === 'tcp') {
        portGroup.style.display = 'block';
        portInput.value = '6661';
    } else {
        portGroup.style.display = 'none';
    }
}

async function createChannel() {
    const name = document.getElementById('ch-name').value.trim();
    if (!name) { showToast('Channel name is required', 'warning'); return; }

    const sourceType = document.getElementById('ch-source-type').value;
    const destType = document.getElementById('ch-dest-type').value;
    const destName = document.getElementById('ch-dest-name').value.trim() || 'Destination';

    const sourceConfig = {};
    if (sourceType === 'http' || sourceType === 'tcp') {
        sourceConfig.port = parseInt(document.getElementById('ch-source-port').value) || 8080;
    }

    try {
        const res = await API.post('/api/channels', {
            name,
            description: document.getElementById('ch-desc').value.trim(),
            sourceConnectorType: sourceType,
            sourceConfig,
            destinationConnectors: [{
                name: destName,
                type: destType,
                config: {}
            }]
        });

        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Channel created!', 'success');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function showEditChannelModal(id) {
    try {
        const res = await API.get(`/api/channels/${id}`);
        if (!res.success) throw new Error(res.error);
        const ch = res.data;

        const body = `
      <div class="form-group">
        <label class="form-label">Channel Name</label>
        <input class="form-control" id="edit-ch-name" value="${escapeHTML(ch.name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-control" id="edit-ch-desc" value="${escapeHTML(ch.description || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Source Type</label>
        <select class="form-control" id="edit-ch-source-type">
          ${['http', 'tcp', 'file', 'database'].map(t =>
            `<option value="${t}" ${t === ch.sourceConnectorType ? 'selected' : ''}>${connectorTypeIcon(t)} ${t.toUpperCase()}</option>`
        ).join('')}
        </select>
      </div>
    `;

        const footer = `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateChannel('${id}')">Save Changes</button>
    `;

        openModal('Edit Channel', body, footer);
    } catch (err) {
        showToast('Failed to load channel: ' + err.message, 'error');
    }
}

async function updateChannel(id) {
    try {
        const res = await API.put(`/api/channels/${id}`, {
            name: document.getElementById('edit-ch-name').value.trim(),
            description: document.getElementById('edit-ch-desc').value.trim(),
            sourceConnectorType: document.getElementById('edit-ch-source-type').value
        });
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Channel updated!', 'success');
        renderChannels();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function showChannelDetail(id) {
    try {
        const res = await API.get(`/api/channels/${id}`);
        if (!res.success) throw new Error(res.error);
        const ch = res.data;

        const body = `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Status</div>
        <div>${statusBadge(ch.status)}</div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Processing Pipeline</div>
        <div class="pipeline">
          <div class="pipeline-step active">
            <div class="pipeline-step-icon">${connectorTypeIcon(ch.sourceConnectorType)}</div>
            <div class="pipeline-step-label">${ch.sourceConnectorType.toUpperCase()} Source</div>
          </div>
          <div class="pipeline-arrow">→</div>
          <div class="pipeline-step ${ch.filters.length > 0 ? 'active' : ''}">
            <div class="pipeline-step-icon">🔍</div>
            <div class="pipeline-step-label">${ch.filters.length} Filter(s)</div>
          </div>
          <div class="pipeline-arrow">→</div>
          <div class="pipeline-step ${ch.transformers.length > 0 ? 'active' : ''}">
            <div class="pipeline-step-icon">🔄</div>
            <div class="pipeline-step-label">${ch.transformers.length} Transform(s)</div>
          </div>
          <div class="pipeline-arrow">→</div>
          <div class="pipeline-step ${ch.destinationConnectors.length > 0 ? 'active' : ''}">
            <div class="pipeline-step-icon">📤</div>
            <div class="pipeline-step-label">${ch.destinationConnectors.length} Dest(s)</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:8px;">Source Config</div>
        <div class="code-viewer">${JSON.stringify(ch.sourceConfig, null, 2)}</div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:8px;">Destination Connectors</div>
        <div class="code-viewer">${JSON.stringify(ch.destinationConnectors, null, 2)}</div>
      </div>

      <div style="font-size:12px;color:var(--text-muted);">
        Created: ${formatDate(ch.createdAt)} · Updated: ${formatDate(ch.updatedAt)}
      </div>
    `;

        openModal(ch.name, body, `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`);
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}
