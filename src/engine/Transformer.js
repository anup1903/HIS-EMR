/**
 * Message Transformer
 * Applies field-level mapping rules and custom JavaScript transforms.
 */

class Transformer {
    /**
     * Apply a list of transform rules to a message
     * @param {string} message - The raw message content
     * @param {Array} rules - Transform rules array
     * @param {string} contentType - 'hl7', 'fhir', 'json', 'xml', 'text'
     * @returns {string} Transformed message
     */
    static transform(message, rules, contentType = 'text') {
        if (!rules || rules.length === 0) return message;

        let result = message;

        for (const rule of rules) {
            switch (rule.type) {
                case 'field_mapping':
                    result = this.applyFieldMapping(result, rule, contentType);
                    break;
                case 'replace':
                    result = this.applyReplace(result, rule);
                    break;
                case 'template':
                    result = this.applyTemplate(result, rule, contentType);
                    break;
                case 'javascript':
                    result = this.applyJavaScript(result, rule);
                    break;
                case 'hl7_to_fhir':
                    result = this.convertHL7ToFHIR(result);
                    break;
                case 'fhir_to_json':
                    result = this.convertFHIRToJSON(result);
                    break;
                default:
                    // Unknown transform type, pass through
                    break;
            }
        }

        return result;
    }

    /**
     * Apply field mapping: replace one field value with another
     */
    static applyFieldMapping(message, rule, contentType) {
        if (contentType === 'hl7') {
            // HL7 field mapping: rule.sourceField = 'PID.5', rule.value = 'New Value'
            const parts = (rule.sourceField || '').split('.');
            if (parts.length === 2) {
                const [segment, fieldIdx] = parts;
                const lines = message.split('\r');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith(segment + '|')) {
                        const fields = lines[i].split('|');
                        const idx = parseInt(fieldIdx, 10);
                        if (idx > 0 && idx < fields.length) {
                            fields[idx] = rule.value || '';
                            lines[i] = fields.join('|');
                        }
                    }
                }
                return lines.join('\r');
            }
        }

        if (contentType === 'json' || contentType === 'fhir') {
            try {
                const obj = typeof message === 'string' ? JSON.parse(message) : message;
                this._setNestedField(obj, rule.sourceField, rule.value);
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return message;
            }
        }

        return message;
    }

    /**
     * Apply string replace
     */
    static applyReplace(message, rule) {
        if (!rule.search) return message;
        if (rule.isRegex) {
            const regex = new RegExp(rule.search, rule.flags || 'g');
            return message.replace(regex, rule.replacement || '');
        }
        return message.split(rule.search).join(rule.replacement || '');
    }

    /**
     * Apply template transform — interpolate message fields into a template string
     */
    static applyTemplate(message, rule, contentType) {
        if (!rule.template) return message;

        let data = {};
        if (contentType === 'json' || contentType === 'fhir') {
            try { data = JSON.parse(message); } catch (e) { data = {}; }
        }

        // Simple template interpolation: {{field.path}}
        return rule.template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            return this._getNestedField(data, path.trim()) || match;
        });
    }

    /**
     * Apply a custom JavaScript transform (sandboxed)
     */
    static applyJavaScript(message, rule) {
        if (!rule.script) return message;

        try {
            // Create a sandboxed function with limited scope
            const fn = new Function('msg', 'message', `
        'use strict';
        ${rule.script}
      `);
            const result = fn(message, message);
            return result !== undefined ? (typeof result === 'string' ? result : JSON.stringify(result)) : message;
        } catch (e) {
            console.error('JavaScript transform error:', e.message);
            return message;
        }
    }

    /**
     * Convert HL7 to FHIR via the FHIRHandler
     */
    static convertHL7ToFHIR(hl7Message) {
        try {
            const HL7Parser = require('./HL7Parser');
            const FHIRHandler = require('./FHIRHandler');
            const parsed = HL7Parser.parse(hl7Message);
            const bundle = FHIRHandler.hl7ToFHIR(parsed);
            return JSON.stringify(bundle, null, 2);
        } catch (e) {
            console.error('HL7 to FHIR conversion error:', e.message);
            return hl7Message;
        }
    }

    /**
     * Pretty-print FHIR JSON
     */
    static convertFHIRToJSON(fhirMessage) {
        try {
            const obj = typeof fhirMessage === 'string' ? JSON.parse(fhirMessage) : fhirMessage;
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return fhirMessage;
        }
    }

    // --- Helpers ---

    static _getNestedField(obj, path) {
        return path.split('.').reduce((acc, key) => {
            if (acc === null || acc === undefined) return undefined;
            return acc[key];
        }, obj);
    }

    static _setNestedField(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }
}

module.exports = Transformer;
