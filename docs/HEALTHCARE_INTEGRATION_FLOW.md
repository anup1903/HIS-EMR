# Healthcare Integration Flow: HIS + AegisForge + EMR/EHR + n8n

> Full architecture and step-by-step flows for healthcare automation

---

## System Roles

| System | Role | What It Does |
|--------|------|-------------|
| **HIS** (Hospital Information System) | Source of truth | Patient admissions, billing, scheduling, pharmacy, lab orders |
| **EMR/EHR** (Electronic Medical/Health Records) | Clinical data | Patient charts, diagnoses, prescriptions, clinical notes, vitals |
| **n8n** (Workflow Automation) | Event router & glue | Listens for events, triggers webhooks, moves data between systems |
| **AegisForge** (AI Agent) | Intelligent automation | Receives goals, decomposes into task DAGs, executes with LLM + RAG |

---

## Master Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HEALTHCARE AUTOMATION STACK                            │
│                                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                    │
│  │              │     │              │     │              │                    │
│  │     HIS      │     │   EMR/EHR    │     │  External    │                    │
│  │              │     │              │     │  (Labs,Rx,   │                    │
│  │ • Admissions │     │ • Charts     │     │   Imaging)   │                    │
│  │ • Billing    │     │ • Diagnoses  │     │              │                    │
│  │ • Scheduling │     │ • Vitals     │     └──────┬───────┘                    │
│  │ • Pharmacy   │     │ • Orders     │            │                            │
│  │ • Lab Orders │     │ • Notes      │            │                            │
│  └──────┬───────┘     └──────┬───────┘            │                            │
│         │  HL7/FHIR          │  FHIR R4           │  HL7v2/API                 │
│         │                    │                    │                            │
│  ┌──────▼────────────────────▼────────────────────▼───────┐                    │
│  │                                                         │                    │
│  │                    n8n (Event Router)                    │                    │
│  │                                                         │                    │
│  │  • Webhook listeners (HL7, FHIR, REST)                  │                    │
│  │  • Event filtering & transformation                     │                    │
│  │  • HIPAA-safe data routing (PII stripped before agent)   │                    │
│  │  • Retry & dead-letter queue                            │                    │
│  │  • Cron triggers (scheduled audits, reports)            │                    │
│  │                                                         │                    │
│  └────────────────────────┬────────────────────────────────┘                    │
│                           │                                                     │
│                           │  REST / Webhook                                     │
│                           │  POST /api/v1/agent/goals                           │
│                           │                                                     │
│  ┌────────────────────────▼────────────────────────────────────────────────┐    │
│  │                                                                         │    │
│  │                      AegisForge (AI Agent)                              │    │
│  │                                                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │    │
│  │  │                    API Gateway (FastAPI)                         │   │    │
│  │  │  POST /goals  GET /sessions  POST /approve  GET /stream (SSE)   │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │                  Lead Orchestrator                               │   │    │
│  │  │  ┌────────────┐ ┌──────────────┐ ┌───────────────────────────┐ │   │    │
│  │  │  │ Episodic   │ │ Rule Engine  │ │ Adaptive Context Manager  │ │   │    │
│  │  │  │ Memory     │ │ (learned     │ │ (token-aware allocation)  │ │   │    │
│  │  │  │ (pgvector) │ │  patterns)   │ │                           │ │   │    │
│  │  │  └────────────┘ └──────────────┘ └───────────────────────────┘ │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │               PlanDecomposer (DeepSeek-R1)                      │   │    │
│  │  │  Goal + RAG Context + Past Experience → Validated Task DAG      │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │               Agent Coordinator (Multi-Agent)                   │   │    │
│  │  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────────┐  │   │    │
│  │  │  │ Code   │ │ Security │ │ Test   │ │ Architecture Agent   │  │   │    │
│  │  │  │ Agent  │ │ Agent    │ │ Agent  │ │ (HIPAA compliance)   │  │   │    │
│  │  │  └────────┘ └──────────┘ └────────┘ └──────────────────────┘  │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │               Validation Pipeline                               │   │    │
│  │  │  Syntax → Lint → Type Check → HIPAA Check → Self-Review        │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │               Executor + Connectors                             │   │    │
│  │  │  GitHub │ Jira │ Slack │ PagerDuty │ Shell │ HIS API │ EHR API │   │    │
│  │  └──────────────────────────┬──────────────────────────────────────┘   │    │
│  │                             │                                          │    │
│  │  ┌──────────────────────────▼──────────────────────────────────────┐   │    │
│  │  │  Audit Log │ PII Redactor │ Metrics │ Feedback Collector        │   │    │
│  │  └────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Data Layer                                                              │   │
│  │  PostgreSQL (pgvector) │ Redis │ S3 (audit archive)                      │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Automated Clinical Documentation Compliance

**Trigger:** EHR detects incomplete clinical notes for discharged patients

```
Step 1  [EMR/EHR]     Patient discharged, clinical note flagged as incomplete
           │
           │  FHIR DocumentReference event
           ▼
Step 2  [n8n]          Webhook receives FHIR event
           │           → Filters: only "incomplete" + "discharged" status
           │           → Strips PHI (keeps encounter_id, note_type, department)
           │           → POST /api/v1/agent/goals
           ▼
Step 3  [AegisForge]   Goal received: "Complete clinical documentation for encounter E-4821"
           │
           ▼
Step 4  [Orchestrator]  State → PLANNING
           │            PlanDecomposer (DeepSeek-R1) + RAG over:
           │              • Hospital documentation templates
           │              • Department-specific requirements
           │              • Past similar encounters from episodic memory
           ▼
Step 5  [Plan Created]  DAG with 5 tasks:
           │
           │   T1: Analyze encounter data (ANALYSIS)
           │     └→ T2: Identify missing required fields (ANALYSIS)
           │           └→ T3: Generate documentation suggestions (CODE_GENERATION)
           │                 └→ T4: Validate against compliance rules (CODE_REVIEW)
           │                       └→ T5: Submit to physician for review (NOTIFICATION)
           ▼
Step 6  [Approval Gate]  State → AWAITING_APPROVAL
           │             Slack notification to clinical informatics team
           │             "Plan ready: 5 tasks to complete documentation for E-4821"
           ▼
Step 7  [Human Approves] Clinical lead approves via Slack button or UI
           │             State → EXECUTING
           ▼
Step 8  [Executor]      T1: Retrieves encounter context via FHIR API (through n8n proxy)
           │            T2: LLM analyzes gaps vs required fields
           │            T3: Generates suggested text for missing sections
           │            T4: Security Agent validates no PHI leakage in logs
           │            T5: Sends draft to physician via EHR notification
           ▼
Step 9  [Feedback]      Records outcome to episodic memory
           │            Extracts rule: "Cardiology notes require ejection fraction"
           ▼
Step 10 [n8n]          Receives completion webhook from AegisForge
                        → Updates EHR note status to "pending_physician_review"
                        → Logs compliance event to HIS audit system
```

---

## Flow 2: Automated Lab Result Processing & Alert Escalation

**Trigger:** Critical lab result arrives from external lab system

```
Step 1  [External Lab]  HL7v2 ORU message: Critical potassium level (6.8 mEq/L)
           │
           │  HL7v2 message
           ▼
Step 2  [n8n]          HL7 parser node receives message
           │           → Extracts: test_code, result_value, reference_range, patient_mrn
           │           → Evaluates: result > critical_threshold?
           │           → YES → Strips PHI, creates goal payload
           │           → POST /api/v1/agent/goals
           ▼
Step 3  [AegisForge]   Goal: "Process critical lab alert: abnormal result detected for MRN-XXXX"
           │
           ▼
Step 4  [Orchestrator]  PlanDecomposer creates DAG:
           │
           │   T1: Retrieve patient context from EHR (ANALYSIS) ─────────────┐
           │   T2: Check current medications (ANALYSIS) ─────────────────────┤
           │                                                                  ▼
           │   T3: Analyze clinical significance (ANALYSIS, depends T1+T2)
           │     └→ T4: Generate alert with clinical context (CODE_GENERATION)
           │           ├→ T5: Page attending physician (NOTIFICATION, PagerDuty)
           │           ├→ T6: Update EHR with flag (API_CALL)
           │           └→ T7: Create follow-up order suggestion (ANALYSIS)
           ▼
Step 5  [Executor]      T1+T2 run IN PARALLEL (independent tasks)
           │            T3 waits for both, then analyzes with RAG over:
           │              • Drug interaction databases (ingested to knowledge base)
           │              • Clinical protocols for the department
           │              • Past similar critical alerts from episodic memory
           │            T4: Generates structured alert with recommendations
           │            T5: Pages physician via PagerDuty connector
           │            T6: FHIR Flag resource created on patient via n8n proxy
           │            T7: Suggests follow-up orders based on protocol
           ▼
Step 6  [n8n]          Receives results webhook
           │           → Posts structured alert to EHR (FHIR Communication resource)
           │           → Updates HIS lab tracking module
           │           → Sends Slack summary to nursing station channel
           ▼
Step 7  [Feedback]     Episodic memory records:
                        "Critical K+ 6.8 → paged cardiology, repeat ordered, resolved in 2hr"
                        Rule extracted: "K+ > 6.5 always requires immediate paging"
```

---

## Flow 3: HIPAA Compliance Audit Automation

**Trigger:** Scheduled (weekly via n8n cron) or on-demand

```
Step 1  [n8n]          Cron trigger: every Monday 2:00 AM
           │           → POST /api/v1/agent/goals
           │           → Body: "Run weekly HIPAA compliance audit on all active APIs"
           ▼
Step 2  [AegisForge]   Goal received, PlanDecomposer creates DAG:
           │
           │   T1: Scan API endpoints for PHI exposure (ANALYSIS) ─────┐
           │   T2: Audit access logs for anomalies (ANALYSIS) ─────────┤
           │   T3: Check encryption at rest status (ANALYSIS) ─────────┤
           │                                                            ▼
           │   T4: Cross-reference findings (ANALYSIS, depends T1+T2+T3)
           │     └→ T5: Generate compliance report (DOCUMENTATION)
           │           └→ T6: Create Jira tickets for violations (API_CALL)
           │                 └→ T7: Notify compliance officer (NOTIFICATION)
           ▼
Step 3  [Executor - T1] RAG pipeline queries ingested codebase:
           │            → Finds all routes handling patient data
           │            → LLM (ADVANCED tier) reviews each for PII exposure
           │            → Flags: "/api/patient/search returns raw SSN"
           ▼
Step 4  [Executor - T2] Queries PostgreSQL audit_events table:
           │            → Detects: "User X accessed 200 patient records in 5 min"
           │            → Flags: anomalous access pattern
           ▼
Step 5  [Executor - T3] Checks database encryption, S3 bucket policies
           │            → Confirms: pgvector columns encrypted at rest
           │            → Flags: one S3 bucket missing server-side encryption
           ▼
Step 6  [Executor - T4] LLM cross-references all findings:
           │            → 3 CRITICAL: PHI in API response, anomalous access, unencrypted bucket
           │            → 2 WARNING: deprecated TLS on internal endpoint, missing audit on batch job
           ▼
Step 7  [Executor - T5] Generates PDF-ready compliance report:
           │            → Executive summary, finding details, remediation steps
           │            → Pushed to GitHub repo: compliance-reports/2026-W11.md
           ▼
Step 8  [Executor - T6] Creates Jira tickets via connector:
           │            → HIPAA-001: "PHI exposed in /api/patient/search" (Critical)
           │            → HIPAA-002: "Anomalous access pattern - User X" (Critical)
           │            → HIPAA-003: "S3 bucket missing encryption" (Critical)
           ▼
Step 9  [Executor - T7] Slack notification to #compliance channel:
           │            → "Weekly HIPAA audit complete: 3 Critical, 2 Warning findings"
           │            → Links to report and Jira tickets
           ▼
Step 10 [n8n]          Receives completion webhook
           │           → Archives report to HIS compliance module
           │           → Emails compliance officer with summary
           │           → Updates compliance dashboard
           ▼
Step 11 [Feedback]     Memory records:
                        Rule: "S3 buckets created after 2026-01 require SSE-S3 minimum"
                        Rule: ">100 patient record accesses in 10 min = anomaly threshold"
```

---

## Flow 4: Automated Incident Response (System Outage)

**Trigger:** PagerDuty alert or monitoring system detects EHR API degradation

```
Step 1  [Monitoring]    EHR API response time > 5s for 3 consecutive minutes
           │
           │  Alert webhook
           ▼
Step 2  [n8n]          Receives PagerDuty/Prometheus alert
           │           → Enriches with: service name, error rate, affected endpoints
           │           → POST /api/v1/agent/goals
           │           → Body: "Investigate and fix EHR API degradation on /api/v1/patient/*"
           ▼
Step 3  [AegisForge]   Orchestrator creates session
           │           PlanDecomposer + RAG over:
           │             • Runbooks (ingested from docs/)
           │             • Past incident resolutions from episodic memory
           │             • Current deployment manifest
           ▼
Step 4  [Plan - Incident Workflow Template]
           │
           │   T1: Triage - analyze error logs and metrics (ANALYSIS)
           │     └→ T2: Identify root cause (ANALYSIS)
           │           ├→ T3: Apply fix or workaround (CODE_MODIFICATION) [APPROVAL GATE]
           │           │     └→ T5: Run smoke tests (TEST_EXECUTION)
           │           │           └→ T6: Validate metrics recovered (ANALYSIS)
           │           └→ T4: Update status page (NOTIFICATION)
           │                 └→ T7: Resolve PagerDuty incident (API_CALL)
           │                       └→ T8: Post-mortem draft (DOCUMENTATION)
           ▼
Step 5  [Executor - T1] LLM analyzes log patterns:
           │            → "Connection pool exhaustion on PostgreSQL"
           │            → "Query SELECT * FROM patient_encounters running 8s avg"
           ▼
Step 6  [Executor - T2] RAG retrieves similar past incidents:
           │            → Memory: "Last time pool exhaustion → missing index on encounter_date"
           │            → Rule: "Always check slow query log before restarting services"
           │            → Root cause: "Missing index on patient_encounters.updated_at"
           ▼
Step 7  [Approval Gate - T3] HIGH risk task → pauses for human approval
           │                  Slack: "Proposed fix: CREATE INDEX on patient_encounters.updated_at"
           │                  On-call engineer approves
           ▼
Step 8  [Executor - T3] Generates Alembic migration:
           │            → Creates index with CONCURRENTLY (no table lock)
           │            → Applies to staging first, validates, then production
           ▼
Step 9  [Executor - T5→T6] Runs smoke tests, monitors metrics for 5 min
           │               → Response time drops from 5s to 120ms
           │               → Error rate returns to baseline
           ▼
Step 10 [Executor - T7→T8] Resolves PagerDuty, drafts post-mortem:
           │               → "Root cause: missing index. Resolution: added index. MTTR: 18 min"
           ▼
Step 11 [n8n]          Receives completion webhook
           │           → Updates HIS system status dashboard
           │           → Archives incident timeline to compliance log
           │           → Sends recovery notification to clinical staff
           ▼
Step 12 [Feedback]     Memory records entire incident chain
                        Rule: "patient_encounters queries > 2s → check indexes first"
                        Rule: "Always use CREATE INDEX CONCURRENTLY on clinical tables"
```

---

## Flow 5: Medication Interaction Checking Pipeline

**Trigger:** New medication order entered in HIS pharmacy module

```
Step 1  [HIS]          Physician enters new prescription order
           │
           │  HL7 ORM message / FHIR MedicationRequest
           ▼
Step 2  [n8n]          Receives order event
           │           → Extracts: medication_code, dose, route, patient_mrn
           │           → Queries EHR for current medication list (FHIR API)
           │           → POST /api/v1/agent/goals
           │           → Body: "Check drug interactions for new order [MED-CODE] against
           │                    current medications [list] for patient context [age, conditions]"
           ▼
Step 3  [AegisForge]   PlanDecomposer + RAG over:
           │             • Drug interaction knowledge base (FDA, DrugBank, ingested)
           │             • Hospital formulary rules
           │             • Patient allergy records
           │             • Past interaction checks from episodic memory
           ▼
Step 4  [Plan DAG]
           │
           │   T1: Retrieve full medication profile (ANALYSIS) ──────────────┐
           │   T2: Query drug interaction database (ANALYSIS) ───────────────┤
           │   T3: Check allergy cross-reactivity (ANALYSIS) ────────────────┤
           │                                                                  ▼
           │   T4: Synthesize interaction report (ANALYSIS, depends T1+T2+T3)
           │     ├→ T5: If CRITICAL interaction → Alert prescriber (NOTIFICATION)
           │     └→ T6: Update EHR with interaction check result (API_CALL)
           ▼
Step 5  [Executor]     T1+T2+T3 run IN PARALLEL:
           │           T1: Patient on warfarin, metoprolol, lisinopril
           │           T2: New drug (amiodarone) has MAJOR interaction with warfarin
           │           T3: No allergy cross-reactivity found
           ▼
Step 6  [Executor - T4] LLM (REASONING tier) synthesizes:
           │            → "CRITICAL: Amiodarone + Warfarin = increased bleeding risk"
           │            → "Recommendation: Reduce warfarin dose by 30-50%, monitor INR"
           │            → Confidence: 0.97 (grounded in FDA label + clinical guidelines)
           ▼
Step 7  [Executor - T5] CRITICAL finding → immediate notification:
           │            → PagerDuty: pages prescribing physician
           │            → Slack: alerts pharmacy team
           │            → EHR: creates clinical decision support alert
           ▼
Step 8  [n8n]          Receives result
           │           → FHIR DetectedIssue resource created in EHR
           │           → HIS pharmacy module flags order as "pending interaction review"
           │           → If no critical interactions: auto-approves order in HIS
           ▼
Step 9  [Feedback]     Memory records:
                        "Amiodarone + Warfarin flagged, physician adjusted dose"
                        Rule: "All amiodarone orders require warfarin interaction check"
```

---

## Flow 6: Patient Discharge & Care Transition Automation

**Trigger:** HIS records patient discharge order

```
Step 1  [HIS]          Discharge order entered by physician
           │
           │  ADT A03 (HL7) / FHIR Encounter.status = "finished"
           ▼
Step 2  [n8n]          Receives discharge event
           │           → Collects: encounter_id, diagnoses, procedures, department
           │           → Checks: all discharge requirements met?
           │           → POST /api/v1/agent/goals
           ▼
Step 3  [AegisForge]   Goal: "Process discharge for encounter E-7291,
           │                   ensure all transition-of-care requirements complete"
           ▼
Step 4  [Plan DAG - 8 tasks]
           │
           │   T1: Verify discharge summary complete (ANALYSIS)
           │   T2: Check pending lab results (ANALYSIS)
           │   T3: Verify medication reconciliation done (ANALYSIS)
           │   ──── all three parallel ──────────────────────────┐
           │                                                      ▼
           │   T4: Generate discharge instructions (CODE_GENERATION, depends T1+T2+T3)
           │     └→ T5: Create follow-up appointments in HIS (API_CALL)
           │           └→ T6: Send referral letters (DOCUMENTATION)
           │                 └→ T7: Notify primary care physician (NOTIFICATION)
           │                       └→ T8: Update care coordination dashboard (API_CALL)
           ▼
Step 5  [Executor - T1-T3] Parallel analysis:
           │  T1: Discharge summary has gaps → flags "missing procedure notes"
           │  T2: Pending CBC result due in 2 hours → flags for follow-up
           │  T3: Medication reconciliation complete, 2 new medications added
           ▼
Step 6  [Executor - T4] LLM generates patient-friendly discharge instructions:
           │            → Medication schedule with plain-language descriptions
           │            → Warning signs to watch for
           │            → Follow-up appointment reminders
           │            → Dietary restrictions based on diagnoses
           ▼
Step 7  [Executor - T5-T8] Sequential execution:
           │  T5: Books follow-up appointments via HIS scheduling API
           │  T6: Generates and sends referral to cardiologist
           │  T7: Sends structured summary to PCP via Direct messaging / FHIR
           │  T8: Updates care coordination dashboard with transition status
           ▼
Step 8  [n8n]          Receives completion webhook
           │           → Pushes discharge packet to EHR (FHIR DocumentReference)
           │           → Triggers HIS billing module for final coding
           │           → Sends patient portal notification with instructions
           │           → Schedules 48-hour post-discharge check-in call
           ▼
Step 9  [Feedback]     Memory records:
                        "Discharge E-7291: gap in procedure notes delayed discharge by 1hr"
                        Rule: "Always verify procedure notes before generating instructions"
```

---

## n8n Workflow Patterns (How n8n Connects Everything)

### Pattern A: Event-Driven (Real-time)

```
┌────────────┐    HL7/FHIR     ┌──────────┐    REST      ┌──────────────┐
│ HIS / EHR  │ ───────────────▶│   n8n    │ ────────────▶│  AegisForge  │
│ (event)    │                  │          │              │  /goals      │
└────────────┘                  │ • Parse  │              └──────┬───────┘
                                │ • Filter │                     │
                                │ • Strip  │              ┌──────▼───────┐
                                │   PHI    │              │  Process &   │
                                │ • Route  │              │  Execute     │
                                └────┬─────┘              └──────┬───────┘
                                     │                           │
                                     │    Webhook callback       │
                                     │◀──────────────────────────┘
                                     │
                                     ▼
                                ┌──────────┐
                                │ Update   │
                                │ HIS/EHR  │
                                │ via API  │
                                └──────────┘
```

### Pattern B: Scheduled (Cron)

```
┌──────────┐   Cron: 0 2 * * 1     ┌──────────────┐     ┌──────────┐
│   n8n    │ ──────────────────────▶│  AegisForge  │────▶│ Results  │
│ (timer)  │   POST /goals          │  (audit,     │     │ → Jira   │
└──────────┘                        │   report)    │     │ → Slack  │
                                    └──────────────┘     │ → Email  │
                                                         └──────────┘
```

### Pattern C: Bidirectional (Agent calls back to systems)

```
┌──────────────┐                ┌──────────┐                ┌──────────┐
│  AegisForge  │  needs data   │   n8n    │  FHIR query   │ EMR/EHR  │
│  Executor    │ ─────────────▶│ (proxy)  │ ─────────────▶│          │
│              │◀──────────────│          │◀──────────────│          │
│              │  returns data │          │  FHIR Bundle  │          │
└──────────────┘                └──────────┘                └──────────┘
```

---

## Data Flow Security (HIPAA Compliance at Every Step)

```
Step  Component        What Happens to PHI
────  ─────────        ─────────────────────────────────────────────────
 1    HIS/EHR          PHI exists in source system (encrypted at rest)
 2    n8n              PHI stripped before reaching AegisForge:
                         • SSN → removed
                         • Name → hashed patient_ref
                         • DOB → age bracket only
                         • MRN → opaque encounter_id
                         • Only clinical codes (ICD-10, RxNorm) passed through
 3    AegisForge       Receives de-identified payload only
                         • PII Redactor scrubs any residual PHI in logs
                         • All LLMs self-hosted (no data leaves cluster)
                         • Audit log captures every action (PII-redacted)
 4    AegisForge→n8n   Results contain opaque IDs only
 5    n8n→HIS/EHR      n8n re-associates with patient record using stored mapping
                         • Mapping table encrypted, access-controlled
 6    Audit Trail      Immutable audit log at every step:
                         • Who triggered
                         • What was accessed
                         • When and from where
                         • All PII redacted before storage
```

---

## Benefits Summary

| Area | Without AegisForge | With AegisForge + n8n |
|------|-------------------|----------------------|
| **Compliance Audit** | Manual review, days per audit | Automated weekly, findings in minutes |
| **Incident Response** | MTTR: 45-90 min | MTTR: 10-20 min (agent + approval) |
| **Lab Alerts** | Manual review, delays | Instant triage + clinical context |
| **Drug Interactions** | Basic lookup, no context | RAG-powered with patient-specific analysis |
| **Discharge Process** | 2-4 hours manual coordination | 15-30 min automated with parallel tasks |
| **Documentation** | Physicians spend 2hr/day on notes | Agent suggests completions, physician reviews |
| **Learning** | Same mistakes repeated | Episodic memory prevents recurrence |
| **Audit Trail** | Scattered across systems | Unified immutable log, always HIPAA-ready |

---

## Quick Start: Testing Locally

Your stack is running. Test this flow now:

```bash
# 1. Submit a healthcare goal (simulates n8n webhook)
curl -X POST http://localhost:3000/api/v1/agent/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "HIPAA audit: scan patient API endpoints",
    "description": "Audit all /api/patient/* endpoints for PHI exposure, check PII redaction, verify encryption, generate compliance report"
  }'

# 2. Check session status (replace SESSION_ID)
curl http://localhost:3000/api/v1/agent/sessions/{SESSION_ID}

# 3. List all sessions
curl http://localhost:3000/api/v1/agent/sessions
```

Or use the Agent Orchestrator panel at `http://localhost:3000`.
