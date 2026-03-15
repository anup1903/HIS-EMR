-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Agent sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal          JSONB NOT NULL,
    plan          JSONB,
    state         VARCHAR(32) NOT NULL DEFAULT 'planning',
    actor_id      VARCHAR(255) NOT NULL DEFAULT '',
    actor_role    VARCHAR(32) NOT NULL DEFAULT '',
    error         TEXT,
    execution_log JSONB DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON agent_sessions(state);
CREATE INDEX IF NOT EXISTS idx_sessions_actor ON agent_sessions(actor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON agent_sessions(created_at DESC);

-- Task executions
CREATE TABLE IF NOT EXISTS task_executions (
    execution_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES agent_sessions(session_id),
    task_id       UUID NOT NULL,
    task_type     VARCHAR(32) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'pending',
    connector     VARCHAR(64),
    input         JSONB,
    output        JSONB,
    error         TEXT,
    retry_count   INT DEFAULT 0,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    duration_ms   FLOAT
);
CREATE INDEX IF NOT EXISTS idx_executions_session ON task_executions(session_id);

-- Approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES agent_sessions(session_id),
    task_id       UUID,
    plan_id       UUID,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_by  VARCHAR(255) NOT NULL,
    approved_by   VARCHAR(255),
    approved_at   TIMESTAMPTZ,
    rejected_by   VARCHAR(255),
    rejected_at   TIMESTAMPTZ,
    comments      TEXT,
    risk_level    VARCHAR(16) DEFAULT 'medium',
    status        VARCHAR(16) NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests(status) WHERE status = 'pending';

-- Session records (memory persistence layer)
CREATE TABLE IF NOT EXISTS session_records (
    id            SERIAL PRIMARY KEY,
    session_id    UUID UNIQUE NOT NULL,
    goal          JSONB NOT NULL,
    plan          JSONB,
    state         VARCHAR(32) NOT NULL,
    actor_id      VARCHAR(255) DEFAULT '',
    actor_role    VARCHAR(32) DEFAULT '',
    error         TEXT,
    execution_log JSONB DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_session_records_state ON session_records(state);

-- Task outcomes (episodic memory with pgvector embeddings)
CREATE TABLE IF NOT EXISTS task_outcomes (
    outcome_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID,
    task_id          UUID NOT NULL,
    task_type        VARCHAR(32) NOT NULL,
    status           VARCHAR(32) NOT NULL,
    goal_summary     TEXT NOT NULL,
    task_description TEXT DEFAULT '',
    approach         TEXT,
    error_summary    TEXT,
    lessons          TEXT,
    duration_ms      FLOAT DEFAULT 0.0,
    embedding        vector(1024),
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_type_status ON task_outcomes(task_type, status);

-- Learned rules
CREATE TABLE IF NOT EXISTS learned_rules (
    rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type       VARCHAR(16) NOT NULL,
    description     TEXT NOT NULL,
    confidence      FLOAT DEFAULT 0.5,
    task_types      JSONB DEFAULT '[]',
    source_sessions JSONB DEFAULT '[]',
    times_confirmed INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_confirmed  TIMESTAMPTZ,
    active          BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_rules_active ON learned_rules(active) WHERE active = true;
