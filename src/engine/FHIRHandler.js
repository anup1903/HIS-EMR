/**
 * FHIR R4 Handler
 * Parse, validate, and transform FHIR JSON resources.
 * Supports conversion between HL7 v2 and FHIR.
 */

// Supported FHIR R4 resource types
const RESOURCE_TYPES = [
    'Patient', 'Practitioner', 'Organization', 'Encounter', 'Observation',
    'Condition', 'Procedure', 'MedicationRequest', 'DiagnosticReport',
    'AllergyIntolerance', 'Immunization', 'Coverage', 'Claim',
    'Appointment', 'Schedule', 'DocumentReference', 'Bundle'
];

// Required fields per resource type
const REQUIRED_FIELDS = {
    Patient: ['resourceType'],
    Observation: ['resourceType', 'status', 'code'],
    Encounter: ['resourceType', 'status', 'class'],
    Condition: ['resourceType', 'subject'],
    Procedure: ['resourceType', 'status', 'subject'],
    MedicationRequest: ['resourceType', 'status', 'intent', 'medication', 'subject'],
    DiagnosticReport: ['resourceType', 'status', 'code'],
    Bundle: ['resourceType', 'type']
};

class FHIRHandler {
    /**
     * Parse a FHIR JSON string into a resource object
     */
    static parse(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error('Invalid FHIR input: must be a non-empty JSON string');
        }

        let resource;
        try {
            resource = JSON.parse(jsonString);
        } catch (e) {
            throw new Error(`Invalid FHIR JSON: ${e.message}`);
        }

        if (!resource.resourceType) {
            throw new Error('Invalid FHIR resource: missing resourceType');
        }

        if (!RESOURCE_TYPES.includes(resource.resourceType)) {
            throw new Error(`Unsupported FHIR resource type: ${resource.resourceType}`);
        }

        return resource;
    }

    /**
     * Validate a FHIR resource
     */
    static validate(resource) {
        const errors = [];

        if (!resource || typeof resource !== 'object') {
            return { valid: false, errors: ['Resource must be a non-null object'] };
        }

        if (!resource.resourceType) {
            errors.push('Missing required field: resourceType');
            return { valid: false, errors };
        }

        const required = REQUIRED_FIELDS[resource.resourceType] || ['resourceType'];
        for (const field of required) {
            if (!resource[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Convert an HL7 v2.x parsed message to FHIR Bundle
     */
    static hl7ToFHIR(parsedHL7) {
        const bundle = {
            resourceType: 'Bundle',
            type: 'message',
            timestamp: new Date().toISOString(),
            entry: []
        };

        // Extract Patient from PID segment
        const pidSegment = parsedHL7.segments.find(s => s.name === 'PID');
        if (pidSegment) {
            const patient = this._pidToPatient(pidSegment);
            bundle.entry.push({ resource: patient, fullUrl: `urn:uuid:patient-${patient.id || '001'}` });
        }

        // Extract Encounter from PV1 segment
        const pv1Segment = parsedHL7.segments.find(s => s.name === 'PV1');
        if (pv1Segment) {
            const encounter = this._pv1ToEncounter(pv1Segment);
            bundle.entry.push({ resource: encounter, fullUrl: `urn:uuid:encounter-${encounter.id || '001'}` });
        }

        // Extract Observations from OBX segments
        const obxSegments = parsedHL7.segments.filter(s => s.name === 'OBX');
        obxSegments.forEach((obx, idx) => {
            const observation = this._obxToObservation(obx, idx);
            bundle.entry.push({ resource: observation, fullUrl: `urn:uuid:observation-${idx + 1}` });
        });

        // Extract Conditions from DG1 segments
        const dg1Segments = parsedHL7.segments.filter(s => s.name === 'DG1');
        dg1Segments.forEach((dg1, idx) => {
            const condition = this._dg1ToCondition(dg1, idx);
            bundle.entry.push({ resource: condition, fullUrl: `urn:uuid:condition-${idx + 1}` });
        });

        return bundle;
    }

    /**
     * Convert PID segment to FHIR Patient resource
     */
    static _pidToPatient(pidSegment) {
        const f = pidSegment.fields;
        const patient = {
            resourceType: 'Patient',
            id: _extractValue(f.patientIdentifierList) || _extractValue(f.patientId),
            active: true
        };

        // Name
        const nameVal = f.patientName;
        if (nameVal) {
            const parts = typeof nameVal === 'object' && nameVal.components ? nameVal.components : [nameVal];
            patient.name = [{
                use: 'official',
                family: parts[0] || '',
                given: parts.slice(1).filter(Boolean)
            }];
        }

        // Date of Birth
        const dob = _extractValue(f.dateOfBirth);
        if (dob) {
            patient.birthDate = _hl7DateToFHIR(dob);
        }

        // Gender
        const sex = _extractValue(f.administrativeSex);
        if (sex) {
            const genderMap = { 'M': 'male', 'F': 'female', 'O': 'other', 'U': 'unknown' };
            patient.gender = genderMap[sex.toUpperCase()] || 'unknown';
        }

        // Address
        const addr = f.patientAddress;
        if (addr) {
            const parts = typeof addr === 'object' && addr.components ? addr.components : [addr];
            patient.address = [{
                use: 'home',
                line: [parts[0] || ''],
                city: parts[2] || '',
                state: parts[3] || '',
                postalCode: parts[4] || '',
                country: parts[5] || ''
            }];
        }

        // Phone
        const phone = _extractValue(f.phoneNumberHome);
        if (phone) {
            patient.telecom = [{ system: 'phone', value: phone, use: 'home' }];
        }

        return patient;
    }

    /**
     * Convert PV1 segment to FHIR Encounter resource
     */
    static _pv1ToEncounter(pv1Segment) {
        const f = pv1Segment.fields;
        const classMap = { 'I': 'IMP', 'O': 'AMB', 'E': 'EMER', 'R': 'AMB' };
        const patientClass = _extractValue(f.patientClass) || 'I';

        return {
            resourceType: 'Encounter',
            id: _extractValue(f.visitNumber) || 'enc-001',
            status: 'in-progress',
            class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: classMap[patientClass] || 'IMP',
                display: patientClass === 'I' ? 'Inpatient' : patientClass === 'O' ? 'Outpatient' : 'Other'
            },
            location: f.assignedPatientLocation ? [{
                location: { display: _extractValue(f.assignedPatientLocation) }
            }] : undefined
        };
    }

    /**
     * Convert OBX segment to FHIR Observation resource
     */
    static _obxToObservation(obxSegment, index) {
        const f = obxSegment.fields;
        const obsId = f.observationIdentifier;
        const obsIdParts = typeof obsId === 'object' && obsId.components ? obsId.components : [obsId || ''];

        const observation = {
            resourceType: 'Observation',
            id: `obs-${index + 1}`,
            status: 'final',
            code: {
                coding: [{
                    code: obsIdParts[0] || '',
                    display: obsIdParts[1] || ''
                }]
            }
        };

        // Value
        const valueType = _extractValue(f.valueType);
        const value = _extractValue(f.observationValue);
        const units = f.units;
        const unitParts = typeof units === 'object' && units.components ? units.components : [units || ''];

        if (valueType === 'NM' && value) {
            observation.valueQuantity = {
                value: parseFloat(value),
                unit: unitParts[0] || '',
                system: 'http://unitsofmeasure.org'
            };
        } else if (value) {
            observation.valueString = value;
        }

        // Reference Range
        const refRange = _extractValue(f.referenceRange);
        if (refRange) {
            const rangeParts = refRange.split('-');
            if (rangeParts.length === 2) {
                observation.referenceRange = [{
                    low: { value: parseFloat(rangeParts[0]), unit: unitParts[0] || '' },
                    high: { value: parseFloat(rangeParts[1]), unit: unitParts[0] || '' }
                }];
            }
        }

        return observation;
    }

    /**
     * Convert DG1 segment to FHIR Condition resource
     */
    static _dg1ToCondition(dg1Segment, index) {
        const f = dg1Segment.fields;
        const diagCode = f.diagnosisCode;
        const diagParts = typeof diagCode === 'object' && diagCode.components ? diagCode.components : [diagCode || ''];

        return {
            resourceType: 'Condition',
            id: `cond-${index + 1}`,
            code: {
                coding: [{
                    system: 'http://hl7.org/fhir/sid/icd-10-cm',
                    code: diagParts[0] || '',
                    display: diagParts[1] || _extractValue(f.diagnosisDescription) || ''
                }]
            },
            subject: { reference: 'Patient/PAT001' }
        };
    }

    /**
     * Generate a sample FHIR Patient resource
     */
    static generateSamplePatient() {
        return {
            resourceType: 'Patient',
            id: 'patient-001',
            active: true,
            name: [{
                use: 'official',
                family: 'Doe',
                given: ['John', 'Andrew']
            }],
            telecom: [
                { system: 'phone', value: '(555) 123-4567', use: 'home' },
                { system: 'email', value: 'john.doe@email.com', use: 'home' }
            ],
            gender: 'male',
            birthDate: '1985-03-15',
            address: [{
                use: 'home',
                line: ['123 Main Street'],
                city: 'Springfield',
                state: 'IL',
                postalCode: '62704',
                country: 'US'
            }],
            identifier: [{
                system: 'http://hospital.example.org/mrn',
                value: 'PAT001'
            }]
        };
    }

    /**
     * Generate a sample FHIR Bundle
     */
    static generateSampleBundle() {
        return {
            resourceType: 'Bundle',
            type: 'collection',
            timestamp: new Date().toISOString(),
            entry: [
                { resource: this.generateSamplePatient() },
                {
                    resource: {
                        resourceType: 'Observation',
                        id: 'obs-bp-001',
                        status: 'final',
                        code: {
                            coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood Pressure' }]
                        },
                        subject: { reference: 'Patient/patient-001' },
                        valueQuantity: { value: 120, unit: 'mmHg', system: 'http://unitsofmeasure.org' }
                    }
                }
            ]
        };
    }
}

// Helper: extract simple value from a field (which may be string or object)
function _extractValue(field) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (field.components) return field.components[0] || '';
    if (field.value) return field.value;
    return String(field);
}

// Helper: convert HL7 date (YYYYMMDD) to FHIR date (YYYY-MM-DD)
function _hl7DateToFHIR(hl7Date) {
    if (!hl7Date || hl7Date.length < 8) return hl7Date;
    return `${hl7Date.slice(0, 4)}-${hl7Date.slice(4, 6)}-${hl7Date.slice(6, 8)}`;
}

module.exports = FHIRHandler;
