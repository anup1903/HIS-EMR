/**
 * Messages Page
 */

registerPage('messages', async function renderMessages() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = `
    <button class="btn btn-accent" onclick="showSendTestMessageModal()">📨 Send Test Message</button>
    <button class="btn btn-ghost btn-sm" onclick="renderMessages()">⟳ Refresh</button>
  `;

    content.innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-body" style="padding:14px 22px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <input class="form-control" id="msg-search" placeholder="Search messages..." style="max-width:250px;flex:1;" onkeyup="if(event.key==='Enter')filterMessages()">
          <select class="form-control" id="msg-status-filter" style="max-width:160px;" onchange="filterMessages()">
            <option value="">All Statuses</option>
            <option value="received">Received</option>
            <option value="filtered">Filtered</option>
            <option value="transformed">Transformed</option>
            <option value="sent">Sent</option>
            <option value="error">Error</option>
            <option value="queued">Queued</option>
          </select>
          <select class="form-control" id="msg-type-filter" style="max-width:140px;" onchange="filterMessages()">
            <option value="">All Types</option>
            <option value="hl7">HL7</option>
            <option value="fhir">FHIR</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
            <option value="text">Text</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="filterMessages()">🔍 Search</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body" id="messages-table-container">
        <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
      </div>
      <div class="card-footer" id="messages-pagination"></div>
    </div>
  `;

    await filterMessages();
});

async function filterMessages(page = 1) {
    const search = document.getElementById('msg-search')?.value || '';
    const status = document.getElementById('msg-status-filter')?.value || '';
    const contentType = document.getElementById('msg-type-filter')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (contentType) params.append('content_type', contentType);
    params.append('page', page);
    params.append('limit', 25);

    try {
        const res = await API.get(`/api/messages?${params.toString()}`);
        if (!res.success) throw new Error(res.error);

        renderMessagesTable(res.data, res.pagination);
    } catch (err) {
        showToast('Failed to load messages: ' + err.message, 'error');
    }
}

function renderMessagesTable(messages, pagination) {
    const container = document.getElementById('messages-table-container');
    const pagContainer = document.getElementById('messages-pagination');

    if (!messages || messages.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📨</div>
        <h3>No Messages Found</h3>
        <p>Messages will appear here when processed through channels. Try sending a test message.</p>
        <button class="btn btn-accent" onclick="showSendTestMessageModal()">Send Test Message</button>
      </div>
    `;
        pagContainer.innerHTML = '';
        return;
    }

    container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Channel</th>
            <th>Type</th>
            <th>Status</th>
            <th>Preview</th>
            <th>Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${messages.map(msg => {
        const preview = (msg.raw_content || '').substring(0, 60).replace(/[\r\n]/g, ' ');
        return `
              <tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-muted);">
                  ${msg.id.substring(0, 8)}
                </td>
                <td>${escapeHTML(msg.channel_name || '—')}</td>
                <td><span class="badge badge-primary">${msg.content_type || 'text'}</span></td>
                <td>${statusBadge(msg.status)}</td>
                <td style="font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escapeHTML(preview)}
                </td>
                <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${timeAgo(msg.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-ghost btn-sm" onclick="showMessageDetail('${msg.id}')">👁️ View</button>
                    ${msg.status === 'error' ? `<button class="btn btn-warning btn-sm" onclick="reprocessMessage('${msg.id}')">⟳ Retry</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>
  `;

    // Pagination
    if (pagination && pagination.pages > 1) {
        let pagHTML = '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">';
        for (let i = 1; i <= pagination.pages; i++) {
            pagHTML += `<button class="btn ${i === pagination.page ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="filterMessages(${i})">${i}</button>`;
        }
        pagHTML += `<span style="font-size:12px;color:var(--text-muted);margin-left:12px;">${pagination.total} total</span></div>`;
        pagContainer.innerHTML = pagHTML;
    } else {
        pagContainer.innerHTML = '';
    }
}

async function showMessageDetail(id) {
    try {
        const res = await API.get(`/api/messages/${id}`);
        if (!res.success) throw new Error(res.error);
        const msg = res.data;

        const body = `
      <div class="tabs" id="msg-detail-tabs">
        <div class="tab active" onclick="switchMsgTab('raw')">Raw Content</div>
        <div class="tab" onclick="switchMsgTab('parsed')">Parsed</div>
        <div class="tab" onclick="switchMsgTab('transformed')">Transformed</div>
        <div class="tab" onclick="switchMsgTab('logs')">Logs (${msg.logs?.length || 0})</div>
      </div>

      <div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">
        ${statusBadge(msg.status)}
        <span class="badge badge-primary">${msg.content_type || 'text'}</span>
        <span style="font-size:12px;color:var(--text-muted);">Channel: ${escapeHTML(msg.channel_name || '—')}</span>
        <span style="font-size:12px;color:var(--text-muted);">${formatDate(msg.created_at)}</span>
      </div>

      ${msg.error_message ? `<div style="background:var(--error-bg);border:1px solid var(--error);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;font-size:13px;color:var(--error);">⚠️ ${escapeHTML(msg.error_message)}</div>` : ''}

      <div id="msg-tab-raw">
        <div class="code-viewer">${formatMessageContent(msg.raw_content, msg.content_type)}</div>
      </div>

      <div id="msg-tab-parsed" style="display:none;">
        ${msg.parsedContent ? `<div class="code-viewer">${escapeHTML(JSON.stringify(msg.parsedContent, null, 2))}</div>` : '<div style="color:var(--text-muted);">No parsed content available</div>'}
      </div>

      <div id="msg-tab-transformed" style="display:none;">
        ${msg.transformed_content ? `<div class="code-viewer">${escapeHTML(msg.transformed_content)}</div>` : '<div style="color:var(--text-muted);">No transformed content</div>'}
      </div>

      <div id="msg-tab-logs" style="display:none;">
        ${msg.logs && msg.logs.length > 0 ? `
          <div class="activity-feed">
            ${msg.logs.map(log => `
              <div class="activity-item">
                <div class="activity-icon ${log.stage || ''}">${log.log_level === 'error' ? '❌' : log.stage === 'sent' ? '📤' : '📌'}</div>
                <div class="activity-content">
                  <div class="activity-text">[${log.log_level}] ${escapeHTML(log.details || '')}</div>
                  <div class="activity-meta">${log.stage} · ${formatDate(log.created_at)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div style="color:var(--text-muted);">No logs available</div>'}
      </div>
    `;

        const footer = `
      ${msg.status === 'error' ? `<button class="btn btn-warning" onclick="reprocessMessage('${id}');closeModal();">⟳ Reprocess</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    `;

        openModal(`Message ${id.substring(0, 8)}...`, body, footer);
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

function switchMsgTab(tab) {
    ['raw', 'parsed', 'transformed', 'logs'].forEach(t => {
        const el = document.getElementById(`msg-tab-${t}`);
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('#msg-detail-tabs .tab').forEach(el => {
        el.classList.toggle('active', el.textContent.toLowerCase().startsWith(tab));
    });
}

function formatMessageContent(content, type) {
    if (!content) return '<span style="color:var(--text-muted);">No content</span>';

    if (type === 'hl7') {
        // Color-code HL7 segments
        return content.split(/[\r\n]/).filter(Boolean).map(line => {
            const parts = line.split('|');
            const segName = `<span class="segment-name">${escapeHTML(parts[0])}</span>`;
            const fields = parts.slice(1).map(f => `<span class="field-value">${escapeHTML(f)}</span>`).join('<span class="field-sep">|</span>');
            return segName + (fields ? '<span class="field-sep">|</span>' + fields : '');
        }).join('\n');
    }

    if (type === 'fhir' || type === 'json') {
        try {
            return escapeHTML(JSON.stringify(JSON.parse(content), null, 2));
        } catch (e) {
            return escapeHTML(content);
        }
    }

    return escapeHTML(content);
}

async function reprocessMessage(id) {
    try {
        const res = await API.post(`/api/messages/${id}/reprocess`);
        if (!res.success) throw new Error(res.error);
        showToast('Message queued for reprocessing', 'success');
        setTimeout(() => filterMessages(), 1000);
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function showSendTestMessageModal() {
    // Fetch channels for the dropdown
    let channels = [];
    try {
        const res = await API.get('/api/channels');
        if (res.success) channels = res.data;
    } catch (e) { /* ignore */ }

    // Fetch sample messages
    let sampleHL7 = '';
    try {
        const res = await API.get('/api/messages/samples/hl7');
        if (res.success) sampleHL7 = res.data.adt_a01;
    } catch (e) { /* ignore */ }

    const body = `
    <div class="form-group">
      <label class="form-label">Target Channel</label>
      <select class="form-control" id="test-channel-id">
        ${channels.length > 0 ?
            channels.map(ch => `<option value="${ch.id}">${escapeHTML(ch.name)}</option>`).join('') :
            '<option value="" disabled>No channels available — create one first</option>'
        }
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Message Type</label>
      <select class="form-control" id="test-content-type" onchange="loadSampleMessage()">
        <option value="hl7">HL7 v2.x</option>
        <option value="fhir">FHIR JSON</option>
        <option value="json">JSON</option>
        <option value="text">Plain Text</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">
        Message Content
        <button class="btn btn-ghost btn-sm" style="float:right;" onclick="loadSampleMessage()">Load Sample</button>
      </label>
      <textarea class="form-control" id="test-message" rows="12" placeholder="Paste your HL7, FHIR, or other message here...">${escapeHTML(sampleHL7)}</textarea>
    </div>
  `;

    const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-accent" onclick="sendTestMessage()">📨 Send Message</button>
  `;

    openModal('Send Test Message', body, footer);
}

async function loadSampleMessage() {
    const type = document.getElementById('test-content-type').value;
    const textarea = document.getElementById('test-message');

    try {
        if (type === 'hl7') {
            const res = await API.get('/api/messages/samples/hl7');
            if (res.success) textarea.value = res.data.adt_a01;
        } else if (type === 'fhir') {
            const res = await API.get('/api/messages/samples/fhir');
            if (res.success) textarea.value = JSON.stringify(res.data.patient, null, 2);
        } else {
            textarea.value = '{"example": "test message", "timestamp": "' + new Date().toISOString() + '"}';
        }
    } catch (e) { /* ignore */ }
}

async function sendTestMessage() {
    const channelId = document.getElementById('test-channel-id')?.value;
    const message = document.getElementById('test-message')?.value;
    const contentType = document.getElementById('test-content-type')?.value;

    if (!channelId) { showToast('Select a channel', 'warning'); return; }
    if (!message) { showToast('Enter a message', 'warning'); return; }

    try {
        const res = await API.post('/api/messages/send', { channelId, message, contentType });
        if (!res.success) throw new Error(res.error);
        closeModal();
        showToast('Test message sent!', 'success');
        setTimeout(() => filterMessages(), 500);
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}
