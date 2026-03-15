/**
 * Prior Authorization & Denial Appeals Engine
 * Automates the full prior-auth lifecycle:
 *  1. Eligibility verification (EDI 270/271)
 *  2. Prior-auth submission (EDI 278)
 *  3. Status tracking & payer response parsing
 *  4. Denial appeal generation with clinical evidence
 *  5. Metrics: time-to-authorize, denial overturn rate
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const EDIParser = require('../engine/EDIParser');

class PriorAuthEngine {
    /**
     * Initiate a prior-authorization workflow
     */
    static async initiate(params) {
        const db = getDb();
        const id = uuidv4();
        const {
            patient_id, encounter_id, payer_id, provider_npi,
            procedure_code, procedure_description, diagnosis_codes = [],
            urgency = 'standard', agent_session_id
        } = params;

        // 1. Generate EDI 278 request
        const ediRequest = EDIParser.generate278Request({
            patientLastName: params.patient_last_name || 'Patient',
            patientFirstName: params.patient_first_name || '',
            patientDob: params.patient_dob || '',
            memberId: params.member_id || '',
            providerNpi: provider_npi,
            providerName: params.provider_name || '',
            procedureCode: procedure_code,
            procedureDescription: procedure_description,
            diagnosisCodes: diagnosis_codes,
            urgency,
            receiverId: payer_id
        });

        // 2. Log EDI transaction
        const ediTxId = uuidv4();
        db.prepare(`
            INSERT INTO edi_transactions (id, transaction_type, direction, sender_id, receiver_id, patient_id, raw_content, status)
            VALUES (?, '278', 'outbound', 'MEDBRIDGE', ?, ?, ?, 'sent')
        `).run(ediTxId, payer_id, patient_id, ediRequest);

        // 3. Create prior-auth record
        db.prepare(`
            INSERT INTO prior_auth_requests (id, patient_id, encounter_id, payer_id, provider_npi,
                procedure_code, procedure_description, diagnosis_codes, status, urgency,
                edi_transaction_id, edi_request, agent_session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
        `).run(id, patient_id, encounter_id || null, payer_id, provider_npi,
            procedure_code, procedure_description || '', JSON.stringify(diagnosis_codes),
            urgency, ediTxId, ediRequest, agent_session_id || null);

        // 4. Log PHI access
        this._auditLog('create', 'prior_auth', id, agent_session_id || 'system',
            'Prior authorization initiated', ['patient_id', 'diagnosis_codes', 'procedure_code']);

        // 5. Simulate payer response (in production, this would come async via EDI channel)
        const decision = this._simulatePayerDecision(procedure_code, urgency);
        const ediResponse = EDIParser.generate278Response({
            approved: decision.approved,
            authNumber: decision.authNumber,
            denialReason: decision.denialReason,
            approvedUnits: decision.approvedUnits
        });

        // Update with response
        const newStatus = decision.approved ? 'approved' : 'denied';
        db.prepare(`
            UPDATE prior_auth_requests SET status = ?, edi_response = ?,
                auth_number = ?, denial_reason = ?, approved_units = ?,
                resolved_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?
        `).run(newStatus, ediResponse, decision.authNumber || null,
            decision.denialReason || null, decision.approvedUnits || null, id);

        return {
            auth_id: id,
            status: newStatus,
            auth_number: decision.authNumber,
            denial_reason: decision.denialReason,
            edi_transaction_id: ediTxId,
            approved_units: decision.approvedUnits,
            procedure_code,
            patient_id
        };
    }

    /**
     * Check status of an existing prior-auth
     */
    static getStatus(authId) {
        const db = getDb();
        const auth = db.prepare('SELECT * FROM prior_auth_requests WHERE id = ?').get(authId);
        if (!auth) return null;
        auth.diagnosis_codes = JSON.parse(auth.diagnosis_codes || '[]');
        return auth;
    }

    /**
     * File a denial appeal
     */
    static async appeal(params) {
        const db = getDb();
        const { auth_id, appeal_reason, supporting_docs, agent_session_id } = params;

        const auth = db.prepare('SELECT * FROM prior_auth_requests WHERE id = ?').get(auth_id);
        if (!auth) throw new Error(`Prior auth ${auth_id} not found`);
        if (auth.status !== 'denied' && auth.status !== 'appeal_denied') {
            throw new Error(`Cannot appeal: current status is ${auth.status}`);
        }

        const newAppealCount = (auth.appeal_count || 0) + 1;

        // Simulate appeal decision (in production: EDI 278 resubmission)
        const appealDecision = this._simulateAppealDecision(newAppealCount, appeal_reason);

        const newStatus = appealDecision.approved ? 'appeal_approved' : 'appeal_denied';

        db.prepare(`
            UPDATE prior_auth_requests SET status = ?, appeal_count = ?,
                auth_number = COALESCE(?, auth_number),
                denial_reason = ?, updated_at = datetime('now'),
                resolved_at = datetime('now'), agent_session_id = COALESCE(?, agent_session_id)
            WHERE id = ?
        `).run(newStatus, newAppealCount,
            appealDecision.authNumber || null,
            appealDecision.denialReason || null,
            agent_session_id || null, auth_id);

        this._auditLog('update', 'prior_auth', auth_id, agent_session_id || 'system',
            `Denial appeal #${newAppealCount}: ${newStatus}`, ['denial_reason', 'appeal_reason']);

        return {
            auth_id,
            status: newStatus,
            appeal_count: newAppealCount,
            auth_number: appealDecision.authNumber,
            denial_reason: appealDecision.denialReason,
            appeal_reason
        };
    }

    /**
     * Get aggregate metrics
     */
    static getMetrics() {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM prior_auth_requests').get().count;
        const approved = db.prepare("SELECT COUNT(*) as count FROM prior_auth_requests WHERE status IN ('approved', 'appeal_approved')").get().count;
        const denied = db.prepare("SELECT COUNT(*) as count FROM prior_auth_requests WHERE status IN ('denied', 'appeal_denied')").get().count;
        const pending = db.prepare("SELECT COUNT(*) as count FROM prior_auth_requests WHERE status IN ('pending', 'submitted')").get().count;
        const appealed = db.prepare("SELECT COUNT(*) as count FROM prior_auth_requests WHERE appeal_count > 0").get().count;
        const appealOverturned = db.prepare("SELECT COUNT(*) as count FROM prior_auth_requests WHERE status = 'appeal_approved'").get().count;

        return {
            total,
            approved,
            denied,
            pending,
            appealed,
            appeal_overturned: appealOverturned,
            approval_rate: total > 0 ? ((approved / total) * 100).toFixed(1) + '%' : '0%',
            denial_overturn_rate: appealed > 0 ? ((appealOverturned / appealed) * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * List prior-auth requests with filters
     */
    static list(filters = {}) {
        const db = getDb();
        const where = [];
        const params = [];

        if (filters.status) { where.push('status = ?'); params.push(filters.status); }
        if (filters.patient_id) { where.push('patient_id = ?'); params.push(filters.patient_id); }
        if (filters.payer_id) { where.push('payer_id = ?'); params.push(filters.payer_id); }

        const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const limit = filters.limit || 50;

        return db.prepare(`SELECT * FROM prior_auth_requests ${clause} ORDER BY created_at DESC LIMIT ?`).all(...params, limit);
    }

    // ── Simulation helpers (replace with real payer integration) ───

    static _simulatePayerDecision(procedureCode, urgency) {
        // Simulate approval logic based on procedure code
        const autoApprove = ['99213', '99214', '99215', '71046', '80053', '85025'];
        const highDenialRisk = ['27447', '63030', '22551', '27130']; // Major surgeries

        if (autoApprove.includes(procedureCode) || urgency === 'urgent') {
            return {
                approved: true,
                authNumber: `AUTH${Date.now().toString().slice(-8)}`,
                approvedUnits: 1
            };
        }

        if (highDenialRisk.includes(procedureCode)) {
            return {
                approved: false,
                denialReason: 'Medical necessity not established. Clinical documentation insufficient.',
                approvedUnits: 0
            };
        }

        // ~70% approval rate for other procedures
        const approved = Math.random() > 0.3;
        return {
            approved,
            authNumber: approved ? `AUTH${Date.now().toString().slice(-8)}` : null,
            denialReason: approved ? null : 'Additional clinical documentation required.',
            approvedUnits: approved ? 1 : 0
        };
    }

    static _simulateAppealDecision(appealCount, reason) {
        // First appeal has ~40% overturn, second ~25%, third ~10%
        const overtutnChance = appealCount === 1 ? 0.4 : appealCount === 2 ? 0.25 : 0.1;
        const approved = Math.random() < overtutnChance;

        return {
            approved,
            authNumber: approved ? `AUTH${Date.now().toString().slice(-8)}` : null,
            denialReason: approved ? null : `Appeal #${appealCount} denied. ${appealCount >= 3 ? 'External review recommended.' : 'Submit additional clinical evidence.'}`
        };
    }

    static _auditLog(action, resourceType, resourceId, actor, justification, phiFields = []) {
        const db = getDb();
        db.prepare(`
            INSERT INTO phi_audit_log (action, resource_type, resource_id, actor, justification, phi_fields_accessed)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(action, resourceType, resourceId, actor, justification, JSON.stringify(phiFields));
    }
}

module.exports = PriorAuthEngine;
