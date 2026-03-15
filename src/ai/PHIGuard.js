/**
 * PHI Safety Guard
 * Blocks consumer AI usage on Protected Health Information.
 * Routes all AI requests through the compliant AegisForge agent.
 *
 * Enforces:
 *  - HIPAA minimum necessary principle
 *  - PII/PHI redaction before external model calls
 *  - Full audit trail for every PHI access
 *  - Blocks unauthorized AI tools from accessing patient data
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

// PHI field patterns for detection/redaction
const PHI_PATTERNS = {
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    mrn: /\b(?:MRN|PAT)\d{3,10}\b/gi,
    phone: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    dob: /\b(?:19|20)\d{2}[-/]?\d{2}[-/]?\d{2}\b/g,
    address: /\b\d{1,5}\s\w+\s(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Way|Ct|Court)\b/gi,
    name_in_hl7: /PID\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|([^|]+)/g,
};

// Allowed AI systems (whitelist)
const ALLOWED_AI_SYSTEMS = new Set([
    'aegisforge',          // Our agent
    'medbridge-internal',  // Internal processing
    'n8n-workflow',        // Approved n8n workflows
    'his-system',          // HIS system internal
]);

// Blocked consumer AI services
const BLOCKED_AI_SERVICES = new Set([
    'chatgpt', 'openai', 'claude-consumer', 'bard', 'gemini-consumer',
    'copilot-consumer', 'perplexity', 'character-ai'
]);

class PHIGuard {
    /**
     * Validate an AI request — block or allow
     */
    static validateRequest(params) {
        const { source_system, action, data, actor, justification } = params;
        const db = getDb();

        // 1. Check if source system is allowed
        if (BLOCKED_AI_SERVICES.has(source_system?.toLowerCase())) {
            this._auditLog('blocked', 'ai_request', null, actor || 'unknown',
                `Blocked consumer AI "${source_system}" from accessing PHI`, [], false);

            return {
                allowed: false,
                reason: `Consumer AI service "${source_system}" is not authorized to access PHI. ` +
                    'Use the compliant MedBridge AI agent or AegisForge instead.',
                redirect_to: 'aegisforge',
                compliance: 'HIPAA 45 CFR 164.502(b) — Minimum Necessary Standard'
            };
        }

        // 2. Validate justification for PHI access
        if (!justification && this._containsPHI(JSON.stringify(data || ''))) {
            return {
                allowed: false,
                reason: 'PHI access requires a justification (HIPAA minimum necessary principle).',
                requires: ['justification']
            };
        }

        // 3. Allow authorized systems
        if (ALLOWED_AI_SYSTEMS.has(source_system?.toLowerCase())) {
            this._auditLog('ai_inference', 'ai_request', null, actor || source_system,
                justification || `AI operation: ${action}`,
                this._detectPHIFields(JSON.stringify(data || '')), false);

            return { allowed: true, source_system, redacted: false };
        }

        // 4. Unknown system — require explicit approval
        return {
            allowed: false,
            reason: `AI system "${source_system}" is not in the approved list. Contact IT to register.`,
            approved_systems: Array.from(ALLOWED_AI_SYSTEMS)
        };
    }

    /**
     * Redact PHI from a string before sending to external systems
     */
    static redactPHI(text) {
        if (!text || typeof text !== 'string') return { redacted: text, fieldsRedacted: [] };

        let redacted = text;
        const fieldsRedacted = [];

        for (const [fieldName, pattern] of Object.entries(PHI_PATTERNS)) {
            const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
            if (globalPattern.test(redacted)) {
                fieldsRedacted.push(fieldName);
                redacted = redacted.replace(globalPattern, `[REDACTED_${fieldName.toUpperCase()}]`);
            }
        }

        return { redacted, fieldsRedacted, wasRedacted: fieldsRedacted.length > 0 };
    }

    /**
     * Check if text contains PHI
     */
    static _containsPHI(text) {
        if (!text) return false;
        for (const pattern of Object.values(PHI_PATTERNS)) {
            const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
            if (globalPattern.test(text)) return true;
        }
        return false;
    }

    /**
     * Detect which PHI fields are present
     */
    static _detectPHIFields(text) {
        if (!text) return [];
        const fields = [];
        for (const [name, pattern] of Object.entries(PHI_PATTERNS)) {
            const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
            if (globalPattern.test(text)) fields.push(name);
        }
        return fields;
    }

    /**
     * Wrap a message for safe AI processing (redact + audit + restore)
     */
    static safeAIProcess(message, actor, justification) {
        const { redacted, fieldsRedacted, wasRedacted } = this.redactPHI(message);

        this._auditLog(
            wasRedacted ? 'ai_inference' : 'query',
            'message', null, actor,
            justification || 'AI processing with PHI guard',
            fieldsRedacted, wasRedacted
        );

        return {
            safe_message: redacted,
            original_length: message.length,
            redacted_length: redacted.length,
            fields_redacted: fieldsRedacted,
            was_redacted: wasRedacted,
            audit_logged: true
        };
    }

    /**
     * Get PHI audit trail
     */
    static getAuditTrail(filters = {}) {
        const db = getDb();
        const where = [];
        const params = [];

        if (filters.actor) { where.push('actor = ?'); params.push(filters.actor); }
        if (filters.action) { where.push('action = ?'); params.push(filters.action); }
        if (filters.resource_type) { where.push('resource_type = ?'); params.push(filters.resource_type); }

        const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const limit = filters.limit || 100;

        return db.prepare(`SELECT * FROM phi_audit_log ${clause} ORDER BY created_at DESC LIMIT ?`).all(...params, limit);
    }

    /**
     * Get compliance metrics
     */
    static getComplianceMetrics() {
        const db = getDb();
        const total = db.prepare('SELECT COUNT(*) as count FROM phi_audit_log').get().count;
        const blocked = db.prepare("SELECT COUNT(*) as count FROM phi_audit_log WHERE action = 'blocked'").get().count;
        const aiInferences = db.prepare("SELECT COUNT(*) as count FROM phi_audit_log WHERE action = 'ai_inference'").get().count;
        const redacted = db.prepare('SELECT COUNT(*) as count FROM phi_audit_log WHERE redacted = 1').get().count;

        return {
            total_phi_accesses: total,
            blocked_requests: blocked,
            ai_inferences: aiInferences,
            redacted_operations: redacted,
            compliance_score: total > 0 ? Math.round(((total - blocked) / total) * 100) : 100
        };
    }

    static _auditLog(action, resourceType, resourceId, actor, justification, phiFields = [], redacted = false) {
        const db = getDb();
        db.prepare(`
            INSERT INTO phi_audit_log (action, resource_type, resource_id, actor, justification, phi_fields_accessed, redacted)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(action, resourceType, resourceId || null, actor, justification,
            JSON.stringify(phiFields), redacted ? 1 : 0);
    }
}

module.exports = PHIGuard;
