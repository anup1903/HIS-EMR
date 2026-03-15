/**
 * Discharge Orchestration Engine
 * Manages the discharge lifecycle:
 *  1. Readiness assessment (checklist scoring)
 *  2. Barrier identification and resolution tracking
 *  3. Follow-up appointment scheduling
 *  4. Care team task generation
 *  5. Metrics: LOS reduction, readmission risk
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const DEFAULT_CHECKLIST = {
    medication_reconciliation: false,
    patient_education: false,
    transport_arranged: false,
    follow_up_scheduled: false,
    dme_ordered: false,
    insurance_verified: false,
    discharge_summary_complete: false,
    caregiver_notified: false
};

class DischargeOrchestrator {
    /**
     * Create a new discharge plan
     */
    static initiate(params) {
        const db = getDb();
        const id = uuidv4();
        const {
            patient_id, encounter_id, discharge_disposition = 'home',
            planned_date, agent_session_id
        } = params;

        const checklist = { ...DEFAULT_CHECKLIST };

        db.prepare(`
            INSERT INTO discharge_plans (id, patient_id, encounter_id, status, discharge_disposition,
                planned_date, checklist, agent_session_id)
            VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
        `).run(id, patient_id, encounter_id, discharge_disposition,
            planned_date || null, JSON.stringify(checklist), agent_session_id || null);

        // Auto-create care tasks for the discharge
        this._createDischargeTasks(id, patient_id, encounter_id, discharge_disposition);

        this._auditLog('create', 'discharge_plan', id, agent_session_id || 'system',
            'Discharge plan initiated');

        return {
            discharge_plan_id: id,
            status: 'draft',
            checklist,
            readiness_score: 0,
            discharge_disposition,
            patient_id,
            encounter_id
        };
    }

    /**
     * Assess discharge readiness (returns score 0-100)
     */
    static checkReadiness(params) {
        const db = getDb();
        const { patient_id, encounter_id } = params;

        const plan = db.prepare(
            'SELECT * FROM discharge_plans WHERE patient_id = ? AND encounter_id = ? ORDER BY created_at DESC LIMIT 1'
        ).get(patient_id, encounter_id);

        if (!plan) {
            return { ready: false, score: 0, message: 'No discharge plan found', barriers: ['No discharge plan created'] };
        }

        const checklist = JSON.parse(plan.checklist || '{}');
        const barriers = JSON.parse(plan.barriers || '[]');

        // Calculate readiness score
        const items = Object.entries(checklist);
        const completed = items.filter(([, v]) => v === true).length;
        const score = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

        // Check for unresolved barriers
        const unresolvedBarriers = barriers.filter(b => !b.resolved);

        // Determine readiness
        const criticalItems = ['medication_reconciliation', 'discharge_summary_complete'];
        const criticalComplete = criticalItems.every(item => checklist[item] === true);

        const ready = score >= 75 && criticalComplete && unresolvedBarriers.length === 0;

        // Update score in DB
        db.prepare('UPDATE discharge_plans SET readiness_score = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(score, plan.id);

        return {
            discharge_plan_id: plan.id,
            ready,
            score,
            checklist,
            completed_items: completed,
            total_items: items.length,
            unresolved_barriers: unresolvedBarriers,
            planned_date: plan.planned_date,
            disposition: plan.discharge_disposition,
            message: ready ? 'Patient ready for discharge' : `${items.length - completed} checklist items remaining, ${unresolvedBarriers.length} barriers`
        };
    }

    /**
     * Update discharge checklist item
     */
    static updateChecklist(planId, item, value) {
        const db = getDb();
        const plan = db.prepare('SELECT * FROM discharge_plans WHERE id = ?').get(planId);
        if (!plan) throw new Error(`Discharge plan ${planId} not found`);

        const checklist = JSON.parse(plan.checklist || '{}');
        checklist[item] = value;

        const items = Object.entries(checklist);
        const completed = items.filter(([, v]) => v === true).length;
        const score = Math.round((completed / items.length) * 100);

        db.prepare('UPDATE discharge_plans SET checklist = ?, readiness_score = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(JSON.stringify(checklist), score, planId);

        // If score >= 75, move status to pending_review
        if (score >= 75 && plan.status === 'draft') {
            db.prepare("UPDATE discharge_plans SET status = 'pending_review' WHERE id = ?").run(planId);
        }

        return { checklist, score, status: score >= 75 ? 'pending_review' : plan.status };
    }

    /**
     * Add a discharge barrier
     */
    static addBarrier(planId, barrier) {
        const db = getDb();
        const plan = db.prepare('SELECT * FROM discharge_plans WHERE id = ?').get(planId);
        if (!plan) throw new Error(`Discharge plan ${planId} not found`);

        const barriers = JSON.parse(plan.barriers || '[]');
        barriers.push({
            id: uuidv4(),
            description: barrier.description,
            category: barrier.category || 'clinical', // clinical, social, financial, logistical
            severity: barrier.severity || 'medium',   // low, medium, high
            resolved: false,
            created_at: new Date().toISOString()
        });

        db.prepare('UPDATE discharge_plans SET barriers = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(JSON.stringify(barriers), planId);

        return { barriers };
    }

    /**
     * Schedule follow-up appointment
     */
    static scheduleFollowup(params) {
        const db = getDb();
        const {
            patient_id, provider_id, appointment_type = 'follow_up',
            preferred_date, notes, agent_session_id
        } = params;

        // Find the active discharge plan
        const plan = db.prepare(
            "SELECT * FROM discharge_plans WHERE patient_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC LIMIT 1"
        ).get(patient_id);

        const appointmentId = uuidv4();
        const appointment = {
            id: appointmentId,
            provider_id: provider_id || '',
            type: appointment_type,
            date: preferred_date || null,
            status: 'scheduled',
            notes: notes || '',
            created_at: new Date().toISOString()
        };

        if (plan) {
            const followups = JSON.parse(plan.follow_up_appointments || '[]');
            followups.push(appointment);
            db.prepare('UPDATE discharge_plans SET follow_up_appointments = ?, updated_at = datetime(\'now\') WHERE id = ?')
                .run(JSON.stringify(followups), plan.id);

            // Mark checklist item
            this.updateChecklist(plan.id, 'follow_up_scheduled', true);
        }

        // Create a task for the scheduler
        db.prepare(`
            INSERT INTO care_tasks (id, patient_id, task_type, priority, status, title, description, assignee_role, source_system, agent_session_id)
            VALUES (?, ?, 'follow_up', 'normal', 'completed', ?, ?, 'scheduler', 'agent', ?)
        `).run(uuidv4(), patient_id,
            `Follow-up ${appointment_type} scheduled`,
            `Provider: ${provider_id}, Date: ${preferred_date}, Notes: ${notes || 'None'}`,
            agent_session_id || null);

        return {
            appointment,
            discharge_plan_id: plan?.id,
            message: 'Follow-up appointment scheduled'
        };
    }

    /**
     * Get discharge plan by ID or patient
     */
    static getPlan(idOrPatient) {
        const db = getDb();
        let plan = db.prepare('SELECT * FROM discharge_plans WHERE id = ?').get(idOrPatient);
        if (!plan) {
            plan = db.prepare('SELECT * FROM discharge_plans WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1').get(idOrPatient);
        }
        if (!plan) return null;

        plan.checklist = JSON.parse(plan.checklist || '{}');
        plan.follow_up_appointments = JSON.parse(plan.follow_up_appointments || '[]');
        plan.barriers = JSON.parse(plan.barriers || '[]');
        return plan;
    }

    /**
     * Get aggregate metrics
     */
    static getMetrics() {
        const db = getDb();
        const total = db.prepare('SELECT COUNT(*) as count FROM discharge_plans').get().count;
        const completed = db.prepare("SELECT COUNT(*) as count FROM discharge_plans WHERE status = 'completed'").get().count;
        const active = db.prepare("SELECT COUNT(*) as count FROM discharge_plans WHERE status NOT IN ('completed', 'cancelled')").get().count;
        const avgScore = db.prepare('SELECT AVG(readiness_score) as avg FROM discharge_plans').get().avg || 0;

        return {
            total,
            completed,
            active,
            average_readiness_score: Math.round(avgScore),
            completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%'
        };
    }

    // ── Internal helpers ────────────────────────────────────────────

    static _createDischargeTasks(planId, patientId, encounterId, disposition) {
        const db = getDb();

        const tasks = [
            { type: 'documentation', role: 'physician', title: 'Complete discharge summary', priority: 'high' },
            { type: 'documentation', role: 'nurse', title: 'Medication reconciliation', priority: 'high' },
            { type: 'documentation', role: 'nurse', title: 'Patient/caregiver education', priority: 'normal' },
            { type: 'follow_up', role: 'scheduler', title: 'Schedule follow-up appointment', priority: 'normal' },
        ];

        if (disposition === 'snf' || disposition === 'rehab') {
            tasks.push({ type: 'referral', role: 'case_manager', title: 'Arrange SNF/Rehab placement', priority: 'high' });
            tasks.push({ type: 'prior_auth', role: 'billing', title: 'Verify insurance for post-acute care', priority: 'high' });
        }

        if (disposition === 'home') {
            tasks.push({ type: 'order', role: 'nurse', title: 'Arrange home health services if needed', priority: 'normal' });
            tasks.push({ type: 'order', role: 'nurse', title: 'Order DME if needed', priority: 'low' });
        }

        for (const task of tasks) {
            db.prepare(`
                INSERT INTO care_tasks (id, patient_id, encounter_id, task_type, priority, status, title, assignee_role, source_system, metadata)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 'agent', ?)
            `).run(uuidv4(), patientId, encounterId, task.type, task.priority, task.title, task.role,
                JSON.stringify({ discharge_plan_id: planId }));
        }
    }

    static _auditLog(action, resourceType, resourceId, actor, justification) {
        const db = getDb();
        db.prepare(`
            INSERT INTO phi_audit_log (action, resource_type, resource_id, actor, justification, phi_fields_accessed)
            VALUES (?, ?, ?, ?, ?, '[]')
        `).run(action, resourceType, resourceId, actor, justification);
    }
}

module.exports = DischargeOrchestrator;
