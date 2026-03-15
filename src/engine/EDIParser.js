/**
 * EDI Transaction Parser
 * Parses and generates HIPAA X12 EDI transactions:
 *  - 270/271: Eligibility Inquiry / Response
 *  - 278: Prior Authorization Request / Response
 *  - 837P: Professional Claim Submission
 *  - 835: Payment/Remittance
 *
 * EDI format: Segments separated by ~ (tilde), elements by * (asterisk),
 * sub-elements by : (colon)
 */

const SEGMENT_TERMINATOR = '~';
const ELEMENT_SEPARATOR = '*';
const SUB_ELEMENT_SEPARATOR = ':';

class EDIParser {
    // ── Parse raw EDI into structured object ───────────────────────

    static parse(rawEdi) {
        if (!rawEdi || typeof rawEdi !== 'string') {
            throw new Error('Invalid EDI: input must be a non-empty string');
        }

        const cleaned = rawEdi.replace(/\r\n/g, '').replace(/\n/g, '').trim();
        const segments = cleaned.split(SEGMENT_TERMINATOR).filter(s => s.trim());

        if (segments.length === 0) {
            throw new Error('Invalid EDI: no segments found');
        }

        const parsed = {
            raw: rawEdi,
            segments: [],
            transactionType: null,
            sender: null,
            receiver: null,
            controlNumber: null,
            date: null,
            metadata: {}
        };

        for (const segStr of segments) {
            const elements = segStr.trim().split(ELEMENT_SEPARATOR);
            const segId = elements[0];

            const segment = {
                id: segId,
                elements: elements.slice(1),
                raw: segStr.trim()
            };
            parsed.segments.push(segment);

            // Extract metadata from envelope segments
            if (segId === 'ISA') {
                parsed.sender = (elements[6] || '').trim();
                parsed.receiver = (elements[8] || '').trim();
                parsed.controlNumber = (elements[13] || '').trim();
                parsed.date = (elements[9] || '').trim();
            }
            if (segId === 'ST') {
                parsed.transactionType = elements[1] || '';
            }
        }

        // Identify transaction kind
        const typeMap = {
            '270': 'Eligibility Inquiry',
            '271': 'Eligibility Response',
            '278': 'Prior Authorization',
            '837': 'Claim Submission',
            '835': 'Payment/Remittance',
            '999': 'Acknowledgment'
        };
        parsed.transactionTypeName = typeMap[parsed.transactionType] || 'Unknown';

        return parsed;
    }

    // ── Generate EDI 270 — Eligibility Inquiry ─────────────────────

    static generate270(params) {
        const {
            senderId = 'MEDBRIDGE',
            receiverId = 'PAYER001',
            patientLastName = 'Doe',
            patientFirstName = 'John',
            patientDob = '19850315',
            patientGender = 'M',
            memberId = '',
            serviceType = '30', // 30 = Health Benefit Plan Coverage
            providerNpi = '',
            providerName = '',
            payerName = ''
        } = params;

        const controlNum = String(Date.now()).slice(-9).padStart(9, '0');
        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
        const hhmm = date.toISOString().slice(11, 16).replace(/:/g, '');

        const segments = [
            `ISA*00*          *00*          *ZZ*${senderId.padEnd(15)}*ZZ*${receiverId.padEnd(15)}*${yymmdd}*${hhmm}*^*00501*${controlNum}*0*P*:`,
            `GS*HS*${senderId}*${receiverId}*${yymmdd}*${hhmm}*${controlNum}*X*005010X279A1`,
            `ST*270*${controlNum}*005010X279A1`,
            `BHT*0022*13*${controlNum}*${yymmdd}*${hhmm}`,
            // Information Source (Payer)
            `HL*1**20*1`,
            `NM1*PR*2*${payerName || receiverId}*****PI*${receiverId}`,
            // Information Receiver (Provider)
            `HL*2*1*21*1`,
            `NM1*1P*1*${providerName || 'Provider'}*****XX*${providerNpi || '1234567890'}`,
            // Subscriber
            `HL*3*2*22*0`,
            `NM1*IL*1*${patientLastName}*${patientFirstName}****MI*${memberId || 'MEM001'}`,
            `DMG*D8*${patientDob}*${patientGender}`,
            // Eligibility inquiry
            `EQ*${serviceType}`,
            `SE*12*${controlNum}`,
            `GE*1*${controlNum}`,
            `IEA*1*${controlNum}`
        ];

        return segments.join(SEGMENT_TERMINATOR) + SEGMENT_TERMINATOR;
    }

    // ── Generate EDI 271 — Eligibility Response (mock) ─────────────

    static generate271(params) {
        const {
            controlNum = String(Date.now()).slice(-9),
            patientLastName = 'Doe',
            patientFirstName = 'John',
            memberId = 'MEM001',
            eligible = true,
            planName = 'Gold PPO Plan',
            copay = '25.00',
            deductible = '1500.00',
            deductibleMet = '750.00',
            coinsurance = '20'
        } = params;

        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');

        const segments = [
            `ISA*00*          *00*          *ZZ*PAYER001       *ZZ*MEDBRIDGE      *${yymmdd}*0000*^*00501*${controlNum}*0*P*:`,
            `GS*HB*PAYER001*MEDBRIDGE*${yymmdd}*0000*${controlNum}*X*005010X279A1`,
            `ST*271*${controlNum}*005010X279A1`,
            `BHT*0022*11*${controlNum}*${yymmdd}*0000`,
            `HL*1**20*1`,
            `NM1*PR*2*BlueCross BlueShield*****PI*BCBS001`,
            `HL*2*1*21*1`,
            `NM1*1P*1*Provider*****XX*1234567890`,
            `HL*3*2*22*0`,
            `NM1*IL*1*${patientLastName}*${patientFirstName}****MI*${memberId}`,
            // Eligibility status
            `EB*${eligible ? '1' : '6'}*IND*30**${planName}`,
            eligible ? `EB*C*IND*30*****${copay}` : '',
            eligible ? `EB*D*IND*30*****${deductible}` : '',
            `SE*12*${controlNum}`,
            `GE*1*${controlNum}`,
            `IEA*1*${controlNum}`
        ].filter(Boolean);

        return segments.join(SEGMENT_TERMINATOR) + SEGMENT_TERMINATOR;
    }

    // ── Generate EDI 278 — Prior Authorization Request ─────────────

    static generate278Request(params) {
        const {
            senderId = 'MEDBRIDGE',
            receiverId = 'PAYER001',
            patientLastName = 'Doe',
            patientFirstName = 'John',
            patientDob = '19850315',
            memberId = 'MEM001',
            providerNpi = '1234567890',
            providerName = 'Dr. Smith',
            procedureCode = '',
            procedureDescription = '',
            diagnosisCodes = [],
            urgency = 'standard', // standard, urgent
            requestedUnits = 1,
            serviceFromDate = '',
            serviceToDate = ''
        } = params;

        const controlNum = String(Date.now()).slice(-9).padStart(9, '0');
        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
        const hhmm = date.toISOString().slice(11, 16).replace(/:/g, '');
        const fromDate = serviceFromDate || yymmdd;
        const toDate = serviceToDate || yymmdd;

        const segments = [
            `ISA*00*          *00*          *ZZ*${senderId.padEnd(15)}*ZZ*${receiverId.padEnd(15)}*${yymmdd}*${hhmm}*^*00501*${controlNum}*0*P*:`,
            `GS*HI*${senderId}*${receiverId}*${yymmdd}*${hhmm}*${controlNum}*X*005010X217`,
            `ST*278*${controlNum}*005010X217`,
            `BHT*0007*11*${controlNum}*${yymmdd}*${hhmm}`,
            // Requester (Provider)
            `HL*1**20*1`,
            `NM1*1P*1*${providerName}*****XX*${providerNpi}`,
            // Subscriber
            `HL*2*1*22*1`,
            `NM1*IL*1*${patientLastName}*${patientFirstName}****MI*${memberId}`,
            `DMG*D8*${patientDob}`,
            // Service details
            `HL*3*2*SS*0`,
            `UM*${urgency === 'urgent' ? 'UR' : 'SC'}*I*1`,
            diagnosisCodes.length > 0 ? `HI*${diagnosisCodes.map(c => `ABK:${c}`).join('*')}` : '',
            `SV1*HC:${procedureCode}*${procedureDescription || ''}*${requestedUnits}*UN`,
            `DTP*472*RD8*${fromDate}-${toDate}`,
            `SE*${12 + (diagnosisCodes.length > 0 ? 1 : 0)}*${controlNum}`,
            `GE*1*${controlNum}`,
            `IEA*1*${controlNum}`
        ].filter(Boolean);

        return segments.join(SEGMENT_TERMINATOR) + SEGMENT_TERMINATOR;
    }

    // ── Generate EDI 278 Response (mock) ───────────────────────────

    static generate278Response(params) {
        const {
            controlNum = String(Date.now()).slice(-9),
            approved = true,
            authNumber = `AUTH${Date.now().toString().slice(-6)}`,
            denialReason = '',
            approvedUnits = 1,
            approvedFrom = '',
            approvedTo = ''
        } = params;

        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
        const status = approved ? 'A1' : 'A3'; // A1=Certified, A3=Not Certified (Denied)

        const segments = [
            `ISA*00*          *00*          *ZZ*PAYER001       *ZZ*MEDBRIDGE      *${yymmdd}*0000*^*00501*${controlNum}*0*P*:`,
            `GS*HI*PAYER001*MEDBRIDGE*${yymmdd}*0000*${controlNum}*X*005010X217`,
            `ST*278*${controlNum}*005010X217`,
            `BHT*0007*15*${controlNum}*${yymmdd}`,
            `HL*1**20*1`,
            `NM1*PR*2*BlueCross*****PI*BCBS001`,
            `HL*2*1*22*0`,
            `HCR*${status}*${authNumber}${denialReason ? `*${denialReason}` : ''}`,
            approved ? `UM*SC*I*1***${approvedUnits}` : '',
            approved && approvedFrom ? `DTP*472*RD8*${approvedFrom}-${approvedTo || approvedFrom}` : '',
            `SE*8*${controlNum}`,
            `GE*1*${controlNum}`,
            `IEA*1*${controlNum}`
        ].filter(Boolean);

        return segments.join(SEGMENT_TERMINATOR) + SEGMENT_TERMINATOR;
    }

    // ── Generate EDI 837P — Professional Claim ─────────────────────

    static generate837P(params) {
        const {
            senderId = 'MEDBRIDGE',
            receiverId = 'PAYER001',
            patientLastName = 'Doe',
            patientFirstName = 'John',
            patientDob = '19850315',
            patientGender = 'M',
            memberId = 'MEM001',
            providerNpi = '1234567890',
            providerName = 'Dr. Smith',
            providerTaxId = '123456789',
            diagnosisCodes = [],
            procedures = [], // [{code, description, charge, units, serviceDate}]
            totalCharge = '0'
        } = params;

        const controlNum = String(Date.now()).slice(-9).padStart(9, '0');
        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
        const hhmm = date.toISOString().slice(11, 16).replace(/:/g, '');

        const claimId = `CLM${Date.now().toString().slice(-8)}`;
        const calcTotal = totalCharge || procedures.reduce((sum, p) => sum + parseFloat(p.charge || 0), 0).toFixed(2);

        const segments = [
            `ISA*00*          *00*          *ZZ*${senderId.padEnd(15)}*ZZ*${receiverId.padEnd(15)}*${yymmdd}*${hhmm}*^*00501*${controlNum}*0*P*:`,
            `GS*HC*${senderId}*${receiverId}*${yymmdd}*${hhmm}*${controlNum}*X*005010X222A1`,
            `ST*837*${controlNum}*005010X222A1`,
            `BHT*0019*00*${controlNum}*${yymmdd}*${hhmm}*CH`,
            // Billing Provider
            `NM1*85*1*${providerName}*****XX*${providerNpi}`,
            `REF*EI*${providerTaxId}`,
            // Subscriber
            `HL*1**20*1`,
            `NM1*IL*1*${patientLastName}*${patientFirstName}****MI*${memberId}`,
            `DMG*D8*${patientDob}*${patientGender}`,
            // Payer
            `NM1*PR*2*${receiverId}*****PI*${receiverId}`,
            // Claim
            `CLM*${claimId}*${calcTotal}***11:B:1*Y*A*Y*Y`,
            // Diagnosis
            ...(diagnosisCodes.length > 0 ? [`HI*${diagnosisCodes.map((c, i) => `${i === 0 ? 'ABK' : 'ABF'}:${c}`).join('*')}`] : []),
            // Service lines
            ...procedures.map((proc, idx) =>
                `SV1*HC:${proc.code}*${proc.charge || '0'}*UN*${proc.units || 1}***${diagnosisCodes.length > 0 ? '1' : ''}~DTP*472*D8*${proc.serviceDate || yymmdd}`
            ),
            `SE*${10 + procedures.length * 2 + (diagnosisCodes.length > 0 ? 1 : 0)}*${controlNum}`,
            `GE*1*${controlNum}`,
            `IEA*1*${controlNum}`
        ];

        return segments.join(SEGMENT_TERMINATOR) + SEGMENT_TERMINATOR;
    }

    // ── Extract specific data from parsed EDI ──────────────────────

    static getSegment(parsed, segId) {
        return parsed.segments.find(s => s.id === segId);
    }

    static getSegments(parsed, segId) {
        return parsed.segments.filter(s => s.id === segId);
    }

    static getElement(segment, index) {
        if (!segment || !segment.elements) return '';
        return segment.elements[index] || '';
    }

    // ── Extract eligibility info from 271 ──────────────────────────

    static extractEligibility(parsed271) {
        const ebSegments = this.getSegments(parsed271, 'EB');
        const result = {
            eligible: false,
            planName: '',
            benefits: []
        };

        for (const eb of ebSegments) {
            const code = this.getElement(eb, 0);
            if (code === '1') {
                result.eligible = true;
                result.planName = this.getElement(eb, 4) || '';
            }
            if (code === '6') result.eligible = false;

            result.benefits.push({
                infoCode: code,
                coverageLevel: this.getElement(eb, 1),
                serviceType: this.getElement(eb, 2),
                amount: this.getElement(eb, 7) || null
            });
        }

        return result;
    }

    // ── Extract auth decision from 278 response ────────────────────

    static extractAuthDecision(parsed278) {
        const hcr = this.getSegment(parsed278, 'HCR');
        if (!hcr) return { decided: false };

        const actionCode = this.getElement(hcr, 0);
        return {
            decided: true,
            approved: actionCode === 'A1',
            denied: actionCode === 'A3',
            pending: actionCode === 'A4',
            authNumber: this.getElement(hcr, 1) || '',
            denialReason: this.getElement(hcr, 2) || '',
            actionCode
        };
    }
}

module.exports = EDIParser;
