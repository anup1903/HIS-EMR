/**
 * Agent Bridge
 * Connects MedBridge to AegisForge agent + HIS System + n8n workflows.
 * Acts as the orchestration hub that ties all systems together.
 *
 * External Systems:
 *  - AegisForge Agent: http://localhost:8000 (FastAPI)
 *  - HIS System:       http://localhost:9003 (Next.js)
 *  - n8n Workflows:    http://localhost:5678 (n8n)
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const http = require('http');
const https = require('https');

// External service endpoints (configurable via env)
const AEGISFORGE_URL = process.env.AEGISFORGE_URL || 'http://localhost:8000';
const HIS_URL = process.env.HIS_URL || 'http://localhost:9003';
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';

class AgentBridge {
    // ── AegisForge Agent Integration ────────────────────────────────

    /**
     * Submit a goal to AegisForge agent
     */
    static async submitGoal(goal, context = {}) {
        const db = getDb();
        const sessionId = uuidv4();

        // Log the session locally
        db.prepare(`
            INSERT INTO agent_sessions (id, goal, status, session_type, patient_id, encounter_id, plan)
            VALUES (?, ?, 'active', ?, ?, ?, '{}')
        `).run(sessionId, goal, context.session_type || 'query',
            context.patient_id || null, context.encounter_id || null);

        try {
            const result = await this._httpPost(`${AEGISFORGE_URL}/api/v1/agent/goals`, {
                goal,
                context: {
                    medbridge_session_id: sessionId,
                    ...context
                }
            });

            // Update with aegisforge session info
            if (result.session_id) {
                db.prepare('UPDATE agent_sessions SET plan = ? WHERE id = ?')
                    .run(JSON.stringify({ aegisforge_session_id: result.session_id }), sessionId);
            }

            return {
                local_session_id: sessionId,
                aegisforge_session_id: result.session_id || null,
                status: 'submitted',
                goal
            };
        } catch (err) {
            // Agent unreachable — still log the session for manual processing
            db.prepare("UPDATE agent_sessions SET status = 'failed', result = ? WHERE id = ?")
                .run(JSON.stringify({ error: err.message }), sessionId);

            return {
                local_session_id: sessionId,
                status: 'agent_unreachable',
                error: err.message,
                message: 'AegisForge agent not available. Task logged for manual processing.'
            };
        }
    }

    /**
     * Get agent session status
     */
    static async getSessionStatus(sessionId) {
        const db = getDb();
        const local = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(sessionId);
        if (!local) return null;

        local.plan = JSON.parse(local.plan || '{}');
        local.result = JSON.parse(local.result || '{}');

        // Try to get remote status from AegisForge
        if (local.plan.aegisforge_session_id) {
            try {
                const remote = await this._httpGet(
                    `${AEGISFORGE_URL}/api/v1/agent/sessions/${local.plan.aegisforge_session_id}`
                );
                local.aegisforge_status = remote;
            } catch {
                local.aegisforge_status = null;
            }
        }

        return local;
    }

    // ── HIS System Integration ──────────────────────────────────────

    /**
     * Fetch patient from HIS system
     */
    static async getPatientFromHIS(patientId) {
        return this._httpGet(`${HIS_URL}/api/patients/${patientId}`);
    }

    /**
     * Search patients in HIS
     */
    static async searchPatientsHIS(query) {
        return this._httpGet(`${HIS_URL}/api/patients/search?q=${encodeURIComponent(query)}`);
    }

    /**
     * Get encounters/admissions from HIS
     */
    static async getAdmissionsHIS(patientId) {
        return this._httpGet(`${HIS_URL}/api/ipd/admissions?patientId=${patientId}`);
    }

    /**
     * Get billing info from HIS
     */
    static async getBillingHIS(patientId) {
        return this._httpGet(`${HIS_URL}/api/billing/invoices?patientId=${patientId}`);
    }

    /**
     * Get insurance info from HIS
     */
    static async getInsuranceHIS(patientId) {
        return this._httpGet(`${HIS_URL}/api/insurance/policies?patientId=${patientId}`);
    }

    /**
     * Get lab results from HIS
     */
    static async getLabResultsHIS(patientId) {
        return this._httpGet(`${HIS_URL}/api/laboratory/orders?patientId=${patientId}`);
    }

    /**
     * Check insurance pre-authorization via HIS
     */
    static async checkPreAuthHIS(params) {
        return this._httpPost(`${HIS_URL}/api/insurance/claims`, params);
    }

    // ── n8n Workflow Integration ────────────────────────────────────

    /**
     * Trigger an n8n webhook
     */
    static async triggerN8nWebhook(webhookId, data = {}) {
        const db = getDb();

        // Look up registered webhook
        const webhook = db.prepare('SELECT * FROM n8n_webhooks WHERE id = ? AND enabled = 1').get(webhookId);

        const url = webhook ? webhook.webhook_url : `${N8N_URL}/webhook/${webhookId}`;

        try {
            const result = await this._httpPost(url, data);

            if (webhook) {
                db.prepare("UPDATE n8n_webhooks SET last_triggered_at = datetime('now') WHERE id = ?")
                    .run(webhookId);
            }

            return { success: true, webhook_id: webhookId, result };
        } catch (err) {
            return { success: false, webhook_id: webhookId, error: err.message };
        }
    }

    /**
     * Trigger n8n webhook by event name
     */
    static async triggerByEvent(eventName, data = {}) {
        const db = getDb();
        const webhooks = db.prepare(
            'SELECT * FROM n8n_webhooks WHERE trigger_event = ? AND enabled = 1'
        ).all(eventName);

        const results = [];
        for (const wh of webhooks) {
            const result = await this.triggerN8nWebhook(wh.id, {
                event: eventName,
                timestamp: new Date().toISOString(),
                ...data
            });
            results.push(result);
        }

        return { event: eventName, webhooks_triggered: results.length, results };
    }

    /**
     * Register an n8n webhook
     */
    static registerWebhook(params) {
        const db = getDb();
        const id = uuidv4();

        db.prepare(`
            INSERT INTO n8n_webhooks (id, name, description, webhook_url, trigger_event, enabled)
            VALUES (?, ?, ?, ?, ?, 1)
        `).run(id, params.name, params.description || '', params.webhook_url, params.trigger_event);

        return { id, ...params };
    }

    /**
     * List registered webhooks
     */
    static listWebhooks() {
        return getDb().prepare('SELECT * FROM n8n_webhooks ORDER BY created_at DESC').all();
    }

    /**
     * Delete a webhook
     */
    static deleteWebhook(id) {
        getDb().prepare('DELETE FROM n8n_webhooks WHERE id = ?').run(id);
    }

    // ── Cross-System Orchestration ──────────────────────────────────

    /**
     * Full prior-auth workflow with HIS data enrichment
     * 1. Pull patient + insurance data from HIS
     * 2. Run prior-auth through MedBridge AI
     * 3. Notify n8n on denial for appeal workflow
     */
    static async orchestratePriorAuth(params) {
        const results = { steps: [] };

        // Step 1: Enrich from HIS if patient_id available
        if (params.patient_id) {
            try {
                const patient = await this.getPatientFromHIS(params.patient_id);
                results.steps.push({ step: 'his_patient_fetch', success: true, data: patient });
            } catch (e) {
                results.steps.push({ step: 'his_patient_fetch', success: false, error: e.message });
            }
        }

        // Step 2: Submit to AegisForge for intelligent processing
        const agentResult = await this.submitGoal(
            `Process prior authorization for procedure ${params.procedure_code} for patient ${params.patient_id}`,
            { session_type: 'prior_auth', patient_id: params.patient_id }
        );
        results.steps.push({ step: 'agent_submission', ...agentResult });

        // Step 3: Trigger n8n workflow for tracking
        const n8nResult = await this.triggerByEvent('prior_auth_submitted', {
            patient_id: params.patient_id,
            procedure_code: params.procedure_code,
            agent_session: agentResult.local_session_id
        });
        results.steps.push({ step: 'n8n_notification', ...n8nResult });

        return results;
    }

    /**
     * Full discharge orchestration with HIS + n8n
     */
    static async orchestrateDischarge(params) {
        const results = { steps: [] };

        // Pull admission info from HIS
        if (params.patient_id) {
            try {
                const admissions = await this.getAdmissionsHIS(params.patient_id);
                results.steps.push({ step: 'his_admission_fetch', success: true });
            } catch (e) {
                results.steps.push({ step: 'his_admission_fetch', success: false, error: e.message });
            }
        }

        // Submit agent goal
        const agentResult = await this.submitGoal(
            `Orchestrate discharge for patient ${params.patient_id}, encounter ${params.encounter_id}`,
            { session_type: 'discharge', patient_id: params.patient_id, encounter_id: params.encounter_id }
        );
        results.steps.push({ step: 'agent_submission', ...agentResult });

        // Trigger n8n workflow
        const n8nResult = await this.triggerByEvent('discharge_initiated', {
            patient_id: params.patient_id,
            encounter_id: params.encounter_id,
            agent_session: agentResult.local_session_id
        });
        results.steps.push({ step: 'n8n_notification', ...n8nResult });

        return results;
    }

    // ── System Health ───────────────────────────────────────────────

    static async checkSystemHealth() {
        const systems = {};

        // Check AegisForge
        try {
            await this._httpGet(`${AEGISFORGE_URL}/healthz`);
            systems.aegisforge = { status: 'healthy', url: AEGISFORGE_URL };
        } catch {
            systems.aegisforge = { status: 'unreachable', url: AEGISFORGE_URL };
        }

        // Check HIS
        try {
            await this._httpGet(`${HIS_URL}/api/analytics/dashboard`);
            systems.his = { status: 'healthy', url: HIS_URL };
        } catch {
            systems.his = { status: 'unreachable', url: HIS_URL };
        }

        // Check n8n
        try {
            await this._httpGet(`${N8N_URL}/healthz`);
            systems.n8n = { status: 'healthy', url: N8N_URL };
        } catch {
            systems.n8n = { status: 'unreachable', url: N8N_URL };
        }

        systems.medbridge = { status: 'healthy', url: 'local' };

        return systems;
    }

    // ── HTTP helpers ────────────────────────────────────────────────

    static _httpGet(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { timeout: 10000 }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch { resolve(body); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        });
    }

    static _httpPost(url, data) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const client = parsed.protocol === 'https:' ? https : http;
            const payload = JSON.stringify(data);

            const req = client.request({
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch { resolve(body); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
            req.write(payload);
            req.end();
        });
    }
}

module.exports = AgentBridge;
