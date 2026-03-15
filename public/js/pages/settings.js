/**
 * Settings Page
 */

registerPage('settings', async function renderSettings() {
    const content = document.getElementById('page-content');
    const headerActions = document.getElementById('header-actions');

    headerActions.innerHTML = '';

    // Fetch health info
    let healthData = {};
    try {
        const res = await API.get('/api/health');
        healthData = res;
    } catch (e) { /* ignore */ }

    content.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>🏥 System Information</h3></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Application</div>
              <div style="font-size:18px;font-weight:700;">MedBridge Connect</div>
              <div style="font-size:13px;color:var(--text-secondary);">EMR/EHR Middleware Integration Engine</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Version</div>
              <div style="font-size:16px;font-weight:600;">${healthData.version || '1.0.0'}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Uptime</div>
              <div style="font-size:16px;font-weight:600;">${formatUptime((healthData.uptime || 0) * 1000)}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:4px;">Status</div>
              <span class="badge badge-success"><span class="badge-dot"></span>Healthy</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>⚙️ Engine Configuration</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Server Port</label>
            <input class="form-control" id="setting-port" value="3000" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Log Level</label>
            <select class="form-control" id="setting-log-level">
              <option value="debug">Debug</option>
              <option value="info" selected>Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Max Retry Count</label>
            <input class="form-control" id="setting-retry" type="number" value="3">
          </div>
          <div class="form-group">
            <label class="form-label">Retry Interval (ms)</label>
            <input class="form-control" id="setting-retry-interval" type="number" value="5000">
          </div>
          <div class="form-group">
            <label class="form-label">Message Retention (days)</label>
            <input class="form-control" id="setting-retention" type="number" value="30">
          </div>
          <button class="btn btn-primary" onclick="showToast('Settings saved (demo mode)', 'success')">💾 Save Settings</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><h3>🔧 Supported Standards & Protocols</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">📋</div>
            <div style="font-weight:600;margin-bottom:4px;">HL7 v2.x</div>
            <div style="font-size:12px;color:var(--text-muted);">ADT, ORM, ORU, SIU, MDM, DFT, BAR, RDE, VXU message types</div>
          </div>
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">🔥</div>
            <div style="font-weight:600;margin-bottom:4px;">FHIR R4</div>
            <div style="font-size:12px;color:var(--text-muted);">Patient, Observation, Encounter, Condition, Bundle resources</div>
          </div>
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">🌐</div>
            <div style="font-weight:600;margin-bottom:4px;">HTTP/REST</div>
            <div style="font-size:12px;color:var(--text-muted);">RESTful endpoints for incoming and outgoing messages</div>
          </div>
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">🔌</div>
            <div style="font-weight:600;margin-bottom:4px;">TCP/MLLP</div>
            <div style="font-size:12px;color:var(--text-muted);">Minimal Lower Layer Protocol for HL7 v2 over TCP</div>
          </div>
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">📁</div>
            <div style="font-weight:600;margin-bottom:4px;">File System</div>
            <div style="font-size:12px;color:var(--text-muted);">Directory polling for inbound, file writing for outbound</div>
          </div>
          <div style="padding:16px;border-radius:var(--radius-md);background:var(--bg-surface);border:1px solid var(--border);">
            <div style="font-size:20px;margin-bottom:8px;">🗄️</div>
            <div style="font-weight:600;margin-bottom:4px;">Database</div>
            <div style="font-size:12px;color:var(--text-muted);">Poll tables for new rows, insert transformed data</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><h3>📖 About MedBridge Connect</h3></div>
      <div class="card-body">
        <div style="line-height:1.8;color:var(--text-secondary);font-size:14px;">
          <p><strong>MedBridge Connect</strong> is a healthcare integration engine inspired by
          <a href="https://www.nextgen.com/products-and-services/integration-engine" target="_blank" style="color:var(--primary-light);">Mirth Connect / NextGen Connect</a>.
          It provides channel-based message routing for EMR/EHR systems with support for HL7 v2.x, FHIR R4, and multiple transport protocols.</p>

          <p style="margin-top:12px;">Key capabilities:</p>
          <ul style="margin-left:20px;margin-top:4px;">
            <li>Channel-based message routing with configurable pipelines</li>
            <li>HL7 v2.x message parsing, validation, and ACK generation</li>
            <li>FHIR R4 resource handling and HL7-to-FHIR conversion</li>
            <li>Message filtering with field-level rule evaluation</li>
            <li>Flexible message transformation (field mapping, regex, JavaScript)</li>
            <li>Multiple connector types: HTTP, TCP/MLLP, File, Database</li>
            <li>Real-time monitoring via WebSocket dashboard</li>
            <li>Message audit trail with full processing logs</li>
          </ul>
        </div>
      </div>
    </div>
  `;
});
