/**
 * Message Filter
 * Rule-based message filtering to accept/reject messages
 * before they reach destination connectors.
 */

class Filter {
    /**
     * Evaluate a message against a list of filter rules
     * @param {string} message - Raw message content
     * @param {Array} rules - Array of filter rule objects
     * @param {string} contentType - 'hl7', 'fhir', 'json', 'text'
     * @returns {{ accepted: boolean, matchedRule: object|null, reason: string }}
     */
    static evaluate(message, rules, contentType = 'text') {
        if (!rules || rules.length === 0) {
            return { accepted: true, matchedRule: null, reason: 'No filters configured' };
        }

        for (const rule of rules) {
            const result = this.evaluateRule(message, rule, contentType);
            if (result.matched) {
                const accepted = rule.action === 'accept';
                return {
                    accepted,
                    matchedRule: rule,
                    reason: `${accepted ? 'Accepted' : 'Rejected'} by rule: ${rule.name || rule.field}`
                };
            }
        }

        // Default: accept if no rule matched (pass-through)
        return { accepted: true, matchedRule: null, reason: 'No matching filter rules — default accept' };
    }

    /**
     * Evaluate a single filter rule
     */
    static evaluateRule(message, rule, contentType) {
        let fieldValue = '';

        // Extract field value based on content type
        if (contentType === 'hl7' && rule.field) {
            fieldValue = this._getHL7Field(message, rule.field);
        } else if ((contentType === 'json' || contentType === 'fhir') && rule.field) {
            fieldValue = this._getJSONField(message, rule.field);
        } else {
            fieldValue = message;
        }

        // Evaluate operator
        switch (rule.operator) {
            case 'equals':
                return { matched: fieldValue === rule.value };
            case 'not_equals':
                return { matched: fieldValue !== rule.value };
            case 'contains':
                return { matched: fieldValue.includes(rule.value) };
            case 'not_contains':
                return { matched: !fieldValue.includes(rule.value) };
            case 'starts_with':
                return { matched: fieldValue.startsWith(rule.value) };
            case 'ends_with':
                return { matched: fieldValue.endsWith(rule.value) };
            case 'regex':
                try {
                    const regex = new RegExp(rule.value);
                    return { matched: regex.test(fieldValue) };
                } catch (e) {
                    return { matched: false };
                }
            case 'exists':
                return { matched: fieldValue !== '' && fieldValue !== null && fieldValue !== undefined };
            case 'not_exists':
                return { matched: fieldValue === '' || fieldValue === null || fieldValue === undefined };
            case 'greater_than':
                return { matched: parseFloat(fieldValue) > parseFloat(rule.value) };
            case 'less_than':
                return { matched: parseFloat(fieldValue) < parseFloat(rule.value) };
            default:
                return { matched: false };
        }
    }

    /**
     * Extract a field value from an HL7 message
     * Field format: "SEGMENT.FIELD_INDEX" e.g. "MSH.9", "PID.5"
     */
    static _getHL7Field(message, fieldPath) {
        const parts = fieldPath.split('.');
        if (parts.length < 2) return '';

        const [segmentName, fieldIdx] = parts;
        const idx = parseInt(fieldIdx, 10);

        const lines = message.replace(/\r\n/g, '\r').replace(/\n/g, '\r').split('\r');
        for (const line of lines) {
            if (line.startsWith(segmentName + '|')) {
                const fields = line.split('|');
                if (idx >= 0 && idx < fields.length) {
                    let value = fields[idx];
                    // If component sub-field specified (e.g. PID.5.1)
                    if (parts.length > 2) {
                        const compIdx = parseInt(parts[2], 10);
                        const components = value.split('^');
                        return components[compIdx - 1] || '';
                    }
                    return value;
                }
            }
        }
        return '';
    }

    /**
     * Extract a field value from a JSON message
     * Field format: dot notation e.g. "resourceType", "name.0.family"
     */
    static _getJSONField(message, fieldPath) {
        try {
            const obj = typeof message === 'string' ? JSON.parse(message) : message;
            return String(fieldPath.split('.').reduce((acc, key) => {
                if (acc === null || acc === undefined) return '';
                const idx = parseInt(key, 10);
                return isNaN(idx) ? acc[key] : acc[idx];
            }, obj) || '');
        } catch (e) {
            return '';
        }
    }
}

module.exports = Filter;
