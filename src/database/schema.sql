-- MedBridge Connect Database Schema

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'undeployed', -- undeployed, deployed, started, stopped
  source_connector_type TEXT NOT NULL, -- http, tcp, file, database
  source_config TEXT DEFAULT '{}', -- JSON config
  destination_connectors TEXT DEFAULT '[]', -- JSON array of destination configs
  filters TEXT DEFAULT '[]', -- JSON array of filter rules
  transformers TEXT DEFAULT '[]', -- JSON array of transform rules
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  source_type TEXT DEFAULT 'inbound', -- inbound, outbound
  status TEXT DEFAULT 'received', -- received, filtered, transformed, sent, error, queued
  raw_content TEXT,
  transformed_content TEXT,
  content_type TEXT DEFAULT 'hl7', -- hl7, fhir, xml, json, text
  error_message TEXT,
  connector_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  log_level TEXT DEFAULT 'info', -- debug, info, warn, error
  stage TEXT, -- received, filtered, transformed, sent, error
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  trigger_type TEXT NOT NULL, -- error_count, message_type, channel_status, custom
  trigger_config TEXT DEFAULT '{}', -- JSON config for trigger conditions
  action_type TEXT DEFAULT 'log', -- log, email, webhook
  action_config TEXT DEFAULT '{}', -- JSON config for action
  last_triggered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  channel_id TEXT,
  message TEXT,
  triggered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_message_id ON message_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel_id ON message_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);

-- ═══════════════════════════════════════════════════════════
-- AI Operational Layer Tables
-- ═══════════════════════════════════════════════════════════

-- Prior Authorization Requests
CREATE TABLE IF NOT EXISTS prior_auth_requests (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT,
  payer_id TEXT NOT NULL,
  provider_npi TEXT NOT NULL,
  procedure_code TEXT NOT NULL,
  procedure_description TEXT,
  diagnosis_codes TEXT DEFAULT '[]', -- JSON array
  status TEXT DEFAULT 'pending', -- pending, submitted, approved, denied, appealed, appeal_approved, appeal_denied, expired
  urgency TEXT DEFAULT 'standard', -- urgent, standard
  edi_transaction_id TEXT,
  edi_request TEXT,   -- raw EDI 278 request
  edi_response TEXT,  -- raw EDI 278 response
  auth_number TEXT,   -- payer-assigned authorization number
  denial_reason TEXT,
  appeal_count INTEGER DEFAULT 0,
  approved_units INTEGER,
  approved_from TEXT,
  approved_to TEXT,
  agent_session_id TEXT, -- AegisForge session that processed this
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Discharge Plans
CREATE TABLE IF NOT EXISTS discharge_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  encounter_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, pending_review, approved, in_progress, completed, cancelled
  discharge_disposition TEXT, -- home, snf, rehab, hospice, ama, expired
  planned_date TEXT,
  actual_date TEXT,
  readiness_score REAL DEFAULT 0,  -- 0-100
  checklist TEXT DEFAULT '{}',     -- JSON: medication_reconciliation, patient_education, transport, follow_up_scheduled, dme_ordered
  follow_up_appointments TEXT DEFAULT '[]', -- JSON array
  barriers TEXT DEFAULT '[]',      -- JSON array of discharge barriers
  agent_session_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Care Team Task Queue
CREATE TABLE IF NOT EXISTS care_tasks (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  encounter_id TEXT,
  task_type TEXT NOT NULL, -- prior_auth, discharge, referral, order, lab, imaging, consult, follow_up, documentation
  priority TEXT DEFAULT 'normal', -- critical, high, normal, low
  status TEXT DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled, escalated
  title TEXT NOT NULL,
  description TEXT,
  assignee_role TEXT, -- nurse, physician, case_manager, billing, scheduler, pharmacist
  assigned_to TEXT,
  source_system TEXT, -- ehr, agent, manual, n8n
  due_at TEXT,
  completed_at TEXT,
  metadata TEXT DEFAULT '{}', -- JSON: any extra context
  agent_session_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- EDI Transactions Log
CREATE TABLE IF NOT EXISTS edi_transactions (
  id TEXT PRIMARY KEY,
  transaction_type TEXT NOT NULL, -- 270, 271, 278, 837, 835, 999
  direction TEXT DEFAULT 'outbound', -- inbound, outbound
  sender_id TEXT,
  receiver_id TEXT,
  patient_id TEXT,
  raw_content TEXT,
  parsed_content TEXT, -- JSON parsed representation
  status TEXT DEFAULT 'sent', -- draft, sent, acknowledged, accepted, rejected, error
  related_auth_id TEXT, -- FK to prior_auth_requests
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- PHI Audit Log (compliance trail for AI operations)
CREATE TABLE IF NOT EXISTS phi_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- query, view, create, update, export, ai_inference
  resource_type TEXT, -- patient, encounter, observation, prior_auth, etc.
  resource_id TEXT,
  actor TEXT NOT NULL, -- user_id or 'agent:session_id'
  justification TEXT, -- why this PHI was accessed (minimum necessary)
  phi_fields_accessed TEXT DEFAULT '[]', -- JSON array of field names
  redacted INTEGER DEFAULT 0, -- 1 if PHI was redacted before AI processing
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agent Sessions (tracks AegisForge agent work)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, failed, cancelled
  session_type TEXT, -- prior_auth, discharge, task_routing, query, workflow
  patient_id TEXT,
  encounter_id TEXT,
  plan TEXT DEFAULT '{}', -- JSON: the decomposed plan
  result TEXT DEFAULT '{}', -- JSON: final result
  human_approved INTEGER DEFAULT 0,
  n8n_webhook_id TEXT, -- associated n8n workflow
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- n8n Workflow Hooks
CREATE TABLE IF NOT EXISTS n8n_webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  webhook_url TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- prior_auth_denied, discharge_ready, task_escalated, message_error, custom
  enabled INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for AI layer tables
CREATE INDEX IF NOT EXISTS idx_prior_auth_patient ON prior_auth_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_status ON prior_auth_requests(status);
CREATE INDEX IF NOT EXISTS idx_discharge_patient ON discharge_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_discharge_status ON discharge_plans(status);
CREATE INDEX IF NOT EXISTS idx_care_tasks_status ON care_tasks(status);
CREATE INDEX IF NOT EXISTS idx_care_tasks_assignee ON care_tasks(assignee_role);
CREATE INDEX IF NOT EXISTS idx_care_tasks_priority ON care_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_edi_transactions_type ON edi_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_phi_audit_action ON phi_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_phi_audit_actor ON phi_audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

-- Default system settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('server_port', '3000');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('log_level', 'info');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_retry_count', '3');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('retry_interval_ms', '5000');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('message_retention_days', '30');
