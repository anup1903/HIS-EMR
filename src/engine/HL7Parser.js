/**
 * HL7 v2.x Parser
 * Parses HL7 pipe-delimited messages into structured objects
 * and serializes them back to HL7 format.
 */

const SEGMENT_DELIMITER = '\r';
const FIELD_DELIMITER = '|';
const COMPONENT_DELIMITER = '^';
const REPETITION_DELIMITER = '~';
const ESCAPE_CHAR = '\\';
const SUB_COMPONENT_DELIMITER = '&';

// Common HL7 segment field names
const SEGMENT_FIELDS = {
    MSH: ['fieldSeparator', 'encodingCharacters', 'sendingApplication', 'sendingFacility', 'receivingApplication', 'receivingFacility', 'dateTimeOfMessage', 'security', 'messageType', 'messageControlId', 'processingId', 'versionId', 'sequenceNumber', 'continuationPointer', 'acceptAckType', 'applicationAckType', 'countryCode', 'characterSet', 'principalLanguage'],
    PID: ['setId', 'patientId', 'patientIdentifierList', 'alternatePatientId', 'patientName', 'mothersMaidenName', 'dateOfBirth', 'administrativeSex', 'patientAlias', 'race', 'patientAddress', 'countyCode', 'phoneNumberHome', 'phoneNumberBusiness', 'primaryLanguage', 'maritalStatus', 'religion', 'patientAccountNumber', 'ssnNumber', 'driversLicenseNumber', 'mothersIdentifier', 'ethnicGroup', 'birthPlace', 'multipleBirthIndicator', 'birthOrder', 'citizenship', 'veteransMilitaryStatus', 'nationality', 'patientDeathDateAndTime', 'patientDeathIndicator'],
    PV1: ['setId', 'patientClass', 'assignedPatientLocation', 'admissionType', 'preadmitNumber', 'priorPatientLocation', 'attendingDoctor', 'referringDoctor', 'consultingDoctor', 'hospitalService', 'temporaryLocation', 'preadmitTestIndicator', 'reAdmissionIndicator', 'admitSource', 'ambulatoryStatus', 'vipIndicator', 'admittingDoctor', 'patientType', 'visitNumber', 'financialClass'],
    OBR: ['setId', 'placerOrderNumber', 'fillerOrderNumber', 'universalServiceId', 'priority', 'requestedDateTime', 'observationDateTime', 'observationEndDateTime', 'collectionVolume', 'collectorIdentifier', 'specimenActionCode', 'dangerCode', 'relevantClinicalInfo', 'specimenReceivedDateTime', 'specimenSource', 'orderingProvider', 'orderCallbackPhoneNumber', 'placerField1', 'placerField2', 'fillerField1', 'fillerField2', 'resultsRptStatusChngDateTime', 'chargeToPractice', 'diagnosticServSectId', 'resultStatus'],
    OBX: ['setId', 'valueType', 'observationIdentifier', 'observationSubId', 'observationValue', 'units', 'referenceRange', 'abnormalFlags', 'probability', 'natureOfAbnormalTest', 'observationResultStatus', 'dateLastObsNormalValues', 'userDefinedAccessChecks', 'dateTimeOfObservation', 'producersId', 'responsibleObserver', 'observationMethod'],
    NK1: ['setId', 'name', 'relationship', 'address', 'phoneNumber', 'businessPhoneNumber', 'contactRole', 'startDate', 'endDate', 'nextOfKinAssociatedPartiesJobTitle', 'nextOfKinAssociatedPartiesJobCode', 'nextOfKinAssociatedPartiesEmployeeNumber', 'organizationName'],
    IN1: ['setId', 'insurancePlanId', 'insuranceCompanyId', 'insuranceCompanyName', 'insuranceCompanyAddress', 'insuranceCompanyContactPerson', 'insuranceCompanyPhoneNumber', 'groupNumber', 'groupName', 'insuredGroupEmpId', 'insuredGroupEmpName', 'planEffectiveDate', 'planExpirationDate', 'authorizationInfo', 'planType', 'nameOfInsured'],
    DG1: ['setId', 'diagnosisCodingMethod', 'diagnosisCode', 'diagnosisDescription', 'diagnosisDateTime', 'diagnosisType', 'majorDiagnosticCategory', 'diagnosticRelatedGroup', 'drgApprovalIndicator', 'drgGrouperReviewCode', 'outlierType', 'outlierDays', 'outlierCost'],
    EVN: ['eventTypeCode', 'recordedDateTime', 'dateTimePlannedEvent', 'eventReasonCode', 'operatorId', 'eventOccurred']
};

// Common HL7 message types
const MESSAGE_TYPES = {
    'ADT^A01': 'Patient Admit',
    'ADT^A02': 'Patient Transfer',
    'ADT^A03': 'Patient Discharge',
    'ADT^A04': 'Patient Registration',
    'ADT^A08': 'Patient Update',
    'ADT^A11': 'Cancel Admit',
    'ADT^A12': 'Cancel Transfer',
    'ADT^A13': 'Cancel Discharge',
    'ORM^O01': 'Order Entry',
    'ORU^R01': 'Observation Result',
    'SIU^S12': 'Schedule New Appointment',
    'SIU^S14': 'Schedule Modification',
    'SIU^S15': 'Schedule Cancellation',
    'MDM^T02': 'Document Status Change',
    'DFT^P03': 'Post Detail Financial Transaction',
    'BAR^P01': 'Add Patient Account',
    'RDE^O11': 'Pharmacy/Treatment Encoded Order',
    'VXU^V04': 'Vaccination Update'
};

class HL7Parser {
    /**
     * Parse an HL7 v2.x message string into a structured object
     */
    static parse(rawMessage) {
        if (!rawMessage || typeof rawMessage !== 'string') {
            throw new Error('Invalid HL7 message: input must be a non-empty string');
        }

        // Normalize line endings
        const normalized = rawMessage.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
        const segmentStrings = normalized.split(SEGMENT_DELIMITER).filter(s => s.trim());

        if (segmentStrings.length === 0) {
            throw new Error('Invalid HL7 message: no segments found');
        }

        // Validate MSH segment
        const firstSegment = segmentStrings[0];
        if (!firstSegment.startsWith('MSH')) {
            throw new Error('Invalid HL7 message: must start with MSH segment');
        }

        const segments = [];
        let messageType = '';
        let messageControlId = '';
        let sendingApp = '';
        let sendingFacility = '';
        let receivingApp = '';
        let receivingFacility = '';
        let dateTime = '';
        let version = '';

        for (const segStr of segmentStrings) {
            const segment = this.parseSegment(segStr);
            segments.push(segment);

            if (segment.name === 'MSH') {
                messageType = segment.fields.messageType || '';
                messageControlId = segment.fields.messageControlId || '';
                sendingApp = segment.fields.sendingApplication || '';
                sendingFacility = segment.fields.sendingFacility || '';
                receivingApp = segment.fields.receivingApplication || '';
                receivingFacility = segment.fields.receivingFacility || '';
                dateTime = segment.fields.dateTimeOfMessage || '';
                version = segment.fields.versionId || '';
            }
        }

        const messageTypeStr = typeof messageType === 'object' ?
            (messageType.components ? messageType.components.join('^') : String(messageType)) :
            String(messageType);

        return {
            raw: rawMessage,
            messageType: messageTypeStr,
            messageTypeName: MESSAGE_TYPES[messageTypeStr] || 'Unknown',
            messageControlId: typeof messageControlId === 'object' ?
                (messageControlId.components ? messageControlId.components[0] : String(messageControlId)) :
                String(messageControlId),
            sendingApplication: typeof sendingApp === 'object' ?
                (sendingApp.components ? sendingApp.components[0] : String(sendingApp)) : String(sendingApp),
            sendingFacility: typeof sendingFacility === 'object' ?
                (sendingFacility.components ? sendingFacility.components[0] : String(sendingFacility)) : String(sendingFacility),
            receivingApplication: typeof receivingApp === 'object' ?
                (receivingApp.components ? receivingApp.components[0] : String(receivingApp)) : String(receivingApp),
            receivingFacility: typeof receivingFacility === 'object' ?
                (receivingFacility.components ? receivingFacility.components[0] : String(receivingFacility)) : String(receivingFacility),
            dateTime: typeof dateTime === 'object' ?
                (dateTime.components ? dateTime.components[0] : String(dateTime)) : String(dateTime),
            version: typeof version === 'object' ?
                (version.components ? version.components[0] : String(version)) : String(version),
            segments,
            segmentCount: segments.length,
            segmentNames: segments.map(s => s.name)
        };
    }

    /**
     * Parse a single HL7 segment string
     */
    static parseSegment(segmentStr) {
        const fields = segmentStr.split(FIELD_DELIMITER);
        const segmentName = fields[0];
        const fieldDefs = SEGMENT_FIELDS[segmentName] || [];

        const parsedFields = {};
        const rawFields = [];

        // MSH is special: MSH.1 is the field separator '|' itself (consumed by split),
        // so fields[1] = MSH.2 (encoding chars). Use fieldIndex = i for MSH to account for this.
        const startIndex = 1;

        for (let i = startIndex; i < fields.length; i++) {
            const fieldValue = fields[i];
            const fieldIndex = segmentName === 'MSH' ? i : i - 1;
            const fieldName = fieldDefs[fieldIndex] || `field${i}`;

            let parsedValue;
            if (fieldValue.includes(COMPONENT_DELIMITER)) {
                const components = fieldValue.split(COMPONENT_DELIMITER);
                parsedValue = { value: fieldValue, components };
            } else if (fieldValue.includes(REPETITION_DELIMITER)) {
                const repetitions = fieldValue.split(REPETITION_DELIMITER);
                parsedValue = { value: fieldValue, repetitions };
            } else {
                parsedValue = fieldValue;
            }

            parsedFields[fieldName] = parsedValue;
            rawFields.push({ index: i, name: fieldName, value: fieldValue, parsed: parsedValue });
        }

        return {
            name: segmentName,
            raw: segmentStr,
            fields: parsedFields,
            rawFields,
            fieldCount: fields.length - 1
        };
    }

    /**
     * Serialize a parsed HL7 message back to pipe-delimited format
     */
    static serialize(parsedMessage) {
        return parsedMessage.segments
            .map(segment => segment.raw)
            .join(SEGMENT_DELIMITER);
    }

    /**
     * Get a specific field value by segment and field path
     * e.g., getField(parsed, 'PID', 'patientName') or getField(parsed, 'PID', 4)
     */
    static getField(parsedMessage, segmentName, fieldNameOrIndex) {
        const segment = parsedMessage.segments.find(s => s.name === segmentName);
        if (!segment) return null;

        if (typeof fieldNameOrIndex === 'number') {
            const field = segment.rawFields.find(f => f.index === fieldNameOrIndex);
            return field ? field.parsed : null;
        }

        return segment.fields[fieldNameOrIndex] || null;
    }

    /**
     * Set a field value on the parsed message
     */
    static setField(parsedMessage, segmentName, fieldNameOrIndex, value) {
        const segment = parsedMessage.segments.find(s => s.name === segmentName);
        if (!segment) return false;

        if (typeof fieldNameOrIndex === 'string') {
            segment.fields[fieldNameOrIndex] = value;
        }

        // Rebuild raw segment string
        const fields = [segment.name];
        for (const rf of segment.rawFields) {
            if (rf.name === fieldNameOrIndex || rf.index === fieldNameOrIndex) {
                fields.push(typeof value === 'object' ? value.value || '' : String(value));
            } else {
                fields.push(rf.value);
            }
        }
        segment.raw = fields.join(FIELD_DELIMITER);

        return true;
    }

    /**
     * Validate an HL7 message
     */
    static validate(rawMessage) {
        const errors = [];

        try {
            const parsed = this.parse(rawMessage);

            if (!parsed.messageType) {
                errors.push('Missing message type in MSH.9');
            }
            if (!parsed.messageControlId) {
                errors.push('Missing message control ID in MSH.10');
            }
            if (!parsed.version) {
                errors.push('Missing version ID in MSH.12');
            }

            return { valid: errors.length === 0, errors, parsed };
        } catch (e) {
            return { valid: false, errors: [e.message], parsed: null };
        }
    }

    /**
     * Generate an ACK message for a given parsed HL7 message
     */
    static generateACK(parsedMessage, ackCode = 'AA', textMessage = '') {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

        const msh = [
            'MSH', '|', '^~\\&',
            parsedMessage.receivingApplication || '',
            parsedMessage.receivingFacility || '',
            parsedMessage.sendingApplication || '',
            parsedMessage.sendingFacility || '',
            timestamp,
            '',
            `ACK^${parsedMessage.messageType.split('^')[1] || 'A01'}`,
            `ACK${Date.now()}`,
            'P',
            parsedMessage.version || '2.5.1'
        ].join('|');

        const msa = [
            'MSA',
            ackCode,
            parsedMessage.messageControlId || '',
            textMessage
        ].join('|');

        return `${msh}\r${msa}`;
    }

    /**
     * Generate a sample HL7 ADT A01 message for testing
     */
    static generateSampleADT() {
        const now = new Date();
        const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

        return [
            `MSH|^~\\&|MedBridge|Hospital1|EMR|Facility1|${ts}||ADT^A01|MSG${Date.now()}|P|2.5.1`,
            `EVN|A01|${ts}`,
            `PID|1||PAT001^^^Hospital1^MR||Doe^John^A||19850315|M|||123 Main St^^Springfield^IL^62704^US|||||||ACC001`,
            `PV1|1|I|ICU^Room201^Bed1^^^Hospital1||||DOC001^Smith^Jane^^^Dr.|||MED||||||||V001^^^Hospital1^VN|||||||||||||||||||||||||${ts}`,
            `NK1|1|Doe^Jane|SPO|456 Oak Ave^^Springfield^IL^62704^US|(555)987-6543`,
            `DG1|1|ICD10|R06.02^Shortness of breath^ICD10|||A`,
            `IN1|1|BCBS001|BlueCross^BlueShield|PO Box 1000^^Chicago^IL^60601|(800)555-1234||GRP001|Employee Plan`
        ].join('\r');
    }

    /**
     * Generate a sample ORU R01 message for testing
     */
    static generateSampleORU() {
        const now = new Date();
        const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

        return [
            `MSH|^~\\&|LAB|LabFacility|EMR|Hospital1|${ts}||ORU^R01|MSG${Date.now()}|P|2.5.1`,
            `PID|1||PAT001^^^Hospital1^MR||Doe^John^A||19850315|M`,
            `OBR|1|ORD001|FIL001|CBC^Complete Blood Count^L|||${ts}|||||||${ts}||DOC001^Smith^Jane^^^Dr.`,
            `OBX|1|NM|WBC^White Blood Cell Count^L||7.5|10*3/uL|4.5-11.0||||F|||${ts}`,
            `OBX|2|NM|RBC^Red Blood Cell Count^L||4.8|10*6/uL|4.2-5.9||||F|||${ts}`,
            `OBX|3|NM|HGB^Hemoglobin^L||14.2|g/dL|12.0-17.5||||F|||${ts}`,
            `OBX|4|NM|HCT^Hematocrit^L||42.1|%|36.0-51.0||||F|||${ts}`,
            `OBX|5|NM|PLT^Platelet Count^L||250|10*3/uL|150-400||||F|||${ts}`
        ].join('\r');
    }
}

module.exports = HL7Parser;
