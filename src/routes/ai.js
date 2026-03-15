/**
 * AI Operational Layer API Routes
 * Unified endpoints for the healthcare AI orchestration system:
 *  - Prior Authorization & Appeals
 *  - Discharge Orchestration
 *  - Task Routing
 *  - EDI Transactions
 *  - PHI Safety Guard
 *  - Agent Bridge (AegisForge + HIS + n8n)
 *  - SMART-on-FHIR / CDS Hooks
 *  - n8n Webhooks
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const PriorAuthEngine = require('../ai/PriorAuthEngine');
const DischargeOrchestrator = require('../ai/DischargeOrchestrator');
const TaskRouter = require('../ai/TaskRouter');
const PHIGuard = require('../ai/PHIGuard');
const AgentBridge = require('../ai/AgentBridge');
const EDIParser = require('../engine/EDIParser');

// ═══════════════════════════════════════════════════════════════════
// PRIOR AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/prior-auth/initiate — Start a prior-auth workflow
router.post('/prior-auth/initiate', async (req, res) => {
    try {
        const result = await PriorAuthEngine.initiate(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/prior-auth/appeal — File a denial appeal
router.post('/prior-auth/appeal', async (req, res) => {
    try {
        const result = await PriorAuthEngine.appeal(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/ai/prior-auth — List prior-auth requests
router.get('/prior-auth', (req, res) => {
    try {
        const list = PriorAuthEngine.list(req.query);
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/prior-auth/metrics/summary — Metrics (must be before :id route)
router.get('/prior-auth/metrics/summary', (req, res) => {
    try {
        res.json({ success: true, data: PriorAuthEngine.getMetrics() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/prior-auth/:id — Get prior-auth status (after static routes)
router.get('/prior-auth/:id', (req, res) => {
    try {
        const auth = PriorAuthEngine.getStatus(req.params.id);
        if (!auth) return res.status(404).json({ success: false, error: 'Prior auth not found' });
        res.json({ success: true, data: auth });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// DISCHARGE ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/discharge/initiate — Create discharge plan
router.post('/discharge/initiate', (req, res) => {
    try {
        const result = DischargeOrchestrator.initiate(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/discharge/readiness — Check discharge readiness
router.post('/discharge/readiness', (req, res) => {
    try {
        const result = DischargeOrchestrator.checkReadiness(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/ai/discharge/:id/checklist — Update checklist item
router.put('/discharge/:id/checklist', (req, res) => {
    try {
        const result = DischargeOrchestrator.updateChecklist(req.params.id, req.body.item, req.body.value);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/ai/discharge/:id/barrier — Add barrier
router.post('/discharge/:id/barrier', (req, res) => {
    try {
        const result = DischargeOrchestrator.addBarrier(req.params.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/ai/discharge/schedule-followup — Schedule follow-up
router.post('/discharge/schedule-followup', (req, res) => {
    try {
        const result = DischargeOrchestrator.scheduleFollowup(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/ai/discharge/metrics/summary — Metrics (must be before :id route)
router.get('/discharge/metrics/summary', (req, res) => {
    try {
        res.json({ success: true, data: DischargeOrchestrator.getMetrics() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/discharge/:id — Get discharge plan (after static routes)
router.get('/discharge/:id', (req, res) => {
    try {
        const plan = DischargeOrchestrator.getPlan(req.params.id);
        if (!plan) return res.status(404).json({ success: false, error: 'Discharge plan not found' });
        res.json({ success: true, data: plan });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// TASK ROUTER
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/tasks/route — Route a new task
router.post('/tasks/route', (req, res) => {
    try {
        const result = TaskRouter.route(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/tasks — List tasks
router.get('/tasks', (req, res) => {
    try {
        const tasks = TaskRouter.list(req.query);
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/tasks/metrics/summary — Task metrics (must be before :id routes)
router.get('/tasks/metrics/summary', (req, res) => {
    try {
        res.json({ success: true, data: TaskRouter.getMetrics() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/ai/tasks/:id/status — Update task status
router.put('/tasks/:id/status', (req, res) => {
    try {
        const result = TaskRouter.updateStatus(req.params.id, req.body.status, req.body.assigned_to);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/ai/tasks/:id/escalate — Escalate a task
router.post('/tasks/:id/escalate', (req, res) => {
    try {
        const result = TaskRouter.escalate(req.params.id, req.body.reason);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EDI TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/edi/parse — Parse raw EDI
router.post('/edi/parse', (req, res) => {
    try {
        const parsed = EDIParser.parse(req.body.raw_edi || req.body.message);
        res.json({ success: true, data: parsed });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// POST /api/ai/edi/eligibility — Generate & submit EDI 270
router.post('/edi/eligibility', (req, res) => {
    try {
        const edi270 = EDIParser.generate270(req.body);
        const mockResponse = EDIParser.generate271({
            patientLastName: req.body.patientLastName,
            patientFirstName: req.body.patientFirstName,
            memberId: req.body.memberId,
            eligible: true
        });
        const parsed = EDIParser.parse(mockResponse);
        const eligibility = EDIParser.extractEligibility(parsed);

        const { getDb } = require('../database/db');
        const { v4: uuidv4 } = require('uuid');
        const db = getDb();
        const txId = uuidv4();
        db.prepare(`
            INSERT INTO edi_transactions (id, transaction_type, direction, sender_id, receiver_id, patient_id, raw_content, parsed_content, status)
            VALUES (?, '270', 'outbound', 'MEDBRIDGE', ?, ?, ?, ?, 'acknowledged')
        `).run(txId, req.body.receiverId || 'PAYER001', req.body.patient_id || null,
            edi270, JSON.stringify(eligibility));

        res.json({ success: true, data: { transaction_id: txId, request_edi: edi270, eligibility } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/edi/prior-auth — Generate EDI 278
router.post('/edi/prior-auth', (req, res) => {
    try {
        const edi278 = EDIParser.generate278Request(req.body);
        res.json({ success: true, data: { edi_278: edi278 } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/edi/claim — Generate EDI 837P
router.post('/edi/claim', (req, res) => {
    try {
        const edi837 = EDIParser.generate837P(req.body);

        const { getDb } = require('../database/db');
        const { v4: uuidv4 } = require('uuid');
        const db = getDb();
        const txId = uuidv4();
        db.prepare(`
            INSERT INTO edi_transactions (id, transaction_type, direction, sender_id, receiver_id, patient_id, raw_content, status)
            VALUES (?, '837', 'outbound', 'MEDBRIDGE', ?, ?, ?, 'sent')
        `).run(txId, req.body.receiverId || 'PAYER001', req.body.patient_id || null, edi837);

        res.json({ success: true, data: { transaction_id: txId, edi_837: edi837 } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// PHI SAFETY GUARD
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/phi/validate — Validate AI request for PHI compliance
router.post('/phi/validate', (req, res) => {
    try {
        const result = PHIGuard.validateRequest(req.body);
        const status = result.allowed ? 200 : 403;
        res.status(status).json({ success: result.allowed, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/phi/redact — Redact PHI from text
router.post('/phi/redact', (req, res) => {
    try {
        const result = PHIGuard.redactPHI(req.body.text || req.body.message);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/phi/audit — PHI audit trail
router.get('/phi/audit', (req, res) => {
    try {
        const trail = PHIGuard.getAuditTrail(req.query);
        res.json({ success: true, data: trail });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/phi/compliance — Compliance metrics
router.get('/phi/compliance', (req, res) => {
    try {
        res.json({ success: true, data: PHIGuard.getComplianceMetrics() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// AGENT BRIDGE (AegisForge + HIS + n8n)
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/agent/goal — Submit goal to AegisForge
router.post('/agent/goal', async (req, res) => {
    try {
        const result = await AgentBridge.submitGoal(req.body.goal, req.body.context || {});
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/agent/session/:id — Get agent session status
router.get('/agent/session/:id', async (req, res) => {
    try {
        const session = await AgentBridge.getSessionStatus(req.params.id);
        if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
        res.json({ success: true, data: session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/agent/health — Check all connected systems
router.get('/agent/health', async (req, res) => {
    try {
        const health = await AgentBridge.checkSystemHealth();
        res.json({ success: true, data: health });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/agent/orchestrate/prior-auth — Full prior-auth orchestration
router.post('/agent/orchestrate/prior-auth', async (req, res) => {
    try {
        const result = await AgentBridge.orchestratePriorAuth(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/agent/orchestrate/discharge — Full discharge orchestration
router.post('/agent/orchestrate/discharge', async (req, res) => {
    try {
        const result = await AgentBridge.orchestrateDischarge(req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── HIS System Proxy Routes ──

router.get('/his/patient/:id', async (req, res) => {
    try {
        const data = await AgentBridge.getPatientFromHIS(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: `HIS unreachable: ${err.message}` });
    }
});

router.get('/his/patient/:id/labs', async (req, res) => {
    try {
        const data = await AgentBridge.getLabResultsHIS(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: `HIS unreachable: ${err.message}` });
    }
});

router.get('/his/patient/:id/billing', async (req, res) => {
    try {
        const data = await AgentBridge.getBillingHIS(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(502).json({ success: false, error: `HIS unreachable: ${err.message}` });
    }
});

// ═══════════════════════════════════════════════════════════════════
// N8N WEBHOOKS
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/webhooks — Register n8n webhook
router.post('/webhooks', (req, res) => {
    try {
        const result = AgentBridge.registerWebhook(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/webhooks — List webhooks
router.get('/webhooks', (req, res) => {
    try {
        res.json({ success: true, data: AgentBridge.listWebhooks() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/webhooks/:id/trigger — Manually trigger a webhook
router.post('/webhooks/:id/trigger', async (req, res) => {
    try {
        const result = await AgentBridge.triggerN8nWebhook(req.params.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/ai/webhooks/:id — Delete webhook
router.delete('/webhooks/:id', (req, res) => {
    try {
        AgentBridge.deleteWebhook(req.params.id);
        res.json({ success: true, message: 'Webhook deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// SMART-on-FHIR / CDS HOOKS
// ═══════════════════════════════════════════════════════════════════

// GET /api/ai/cds-services — CDS Hooks discovery endpoint
router.get('/cds-services', (req, res) => {
    res.json({
        services: [
            {
                id: 'prior-auth-check',
                hook: 'order-sign',
                title: 'Prior Authorization Check',
                description: 'Checks if the ordered procedure requires prior authorization and initiates the workflow',
                prefetch: {
                    patient: 'Patient/{{context.patientId}}',
                    coverage: 'Coverage?patient={{context.patientId}}&status=active'
                }
            },
            {
                id: 'discharge-readiness',
                hook: 'patient-view',
                title: 'Discharge Readiness Assessment',
                description: 'Evaluates patient readiness for discharge with checklist scoring',
                prefetch: {
                    patient: 'Patient/{{context.patientId}}',
                    encounter: 'Encounter/{{context.encounterId}}'
                }
            },
            {
                id: 'phi-guard',
                hook: 'patient-view',
                title: 'PHI Safety Guard',
                description: 'Ensures AI operations on patient data comply with HIPAA minimum necessary standards',
                prefetch: {
                    patient: 'Patient/{{context.patientId}}'
                }
            }
        ]
    });
});

// POST /api/ai/cds-services/prior-auth-check — CDS Hook: prior-auth check on order-sign
router.post('/cds-services/prior-auth-check', async (req, res) => {
    try {
        const { context, prefetch } = req.body;
        const patientId = context?.patientId || '';
        const orders = context?.draftOrders?.entry || [];

        const cards = [];

        for (const order of orders) {
            const resource = order.resource || {};
            if (resource.resourceType === 'ServiceRequest') {
                const code = resource.code?.coding?.[0]?.code || '';
                const display = resource.code?.coding?.[0]?.display || code;

                // Check if prior-auth needed (in practice, check payer rules)
                const needsAuth = !['99213', '99214', '80053', '85025'].includes(code);

                if (needsAuth) {
                    cards.push({
                        uuid: uuidv4(),
                        summary: `Prior Authorization Required: ${display}`,
                        detail: `Procedure ${code} (${display}) requires prior authorization from the patient's insurance plan.`,
                        indicator: 'warning',
                        source: { label: 'MedBridge AI', url: '', icon: '' },
                        suggestions: [
                            {
                                label: 'Initiate Prior Auth',
                                uuid: uuidv4(),
                                actions: [{
                                    type: 'create',
                                    description: 'Submit prior authorization request',
                                    resource: {
                                        resourceType: 'Task',
                                        status: 'requested',
                                        intent: 'order',
                                        code: { text: `Prior Auth: ${code}` },
                                        for: { reference: `Patient/${patientId}` }
                                    }
                                }]
                            }
                        ],
                        links: [{
                            label: 'Open MedBridge Prior Auth',
                            url: `/ai-ops?tab=prior-auth&patient=${patientId}&procedure=${code}`,
                            type: 'smart'
                        }]
                    });
                }
            }
        }

        res.json({ cards });
    } catch (err) {
        res.status(500).json({ cards: [] });
    }
});

// POST /api/ai/cds-services/discharge-readiness — CDS Hook: discharge readiness on patient-view
router.post('/cds-services/discharge-readiness', (req, res) => {
    try {
        const { context } = req.body;
        const patientId = context?.patientId || '';
        const encounterId = context?.encounterId || '';

        const readiness = DischargeOrchestrator.checkReadiness({ patient_id: patientId, encounter_id: encounterId });

        const cards = [];
        if (readiness.discharge_plan_id) {
            cards.push({
                uuid: uuidv4(),
                summary: `Discharge Readiness: ${readiness.score}%`,
                detail: readiness.message,
                indicator: readiness.ready ? 'info' : 'warning',
                source: { label: 'MedBridge AI' },
                links: [{
                    label: 'View Discharge Plan',
                    url: `/ai-ops?tab=discharge&plan=${readiness.discharge_plan_id}`,
                    type: 'smart'
                }]
            });
        }

        res.json({ cards });
    } catch (err) {
        res.status(500).json({ cards: [] });
    }
});

// ═══════════════════════════════════════════════════════════════════
// AI OPS DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════════

// GET /api/ai/ops/summary — Aggregate metrics for the AI ops console
router.get('/ops/summary', async (req, res) => {
    try {
        const priorAuth = PriorAuthEngine.getMetrics();
        const discharge = DischargeOrchestrator.getMetrics();
        const tasks = TaskRouter.getMetrics();
        const compliance = PHIGuard.getComplianceMetrics();

        let systemHealth;
        try { systemHealth = await AgentBridge.checkSystemHealth(); }
        catch { systemHealth = { aegisforge: { status: 'unknown' }, his: { status: 'unknown' }, n8n: { status: 'unknown' } }; }

        res.json({
            success: true,
            data: {
                prior_auth: priorAuth,
                discharge,
                tasks,
                compliance,
                system_health: systemHealth,
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
