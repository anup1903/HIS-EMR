# AegisForge Agent Specification & Implementation Blueprint

> **Version:** 1.0 | **Date:** 2026-03-08 | **Status:** Draft

---

## 1. Agent Overview

AegisForge Agent is an **autonomous software delivery agent** that receives high-level goals (e.g., "fix the auth timeout bug in PR #412"), decomposes them into executable DAGs via LLM reasoning, and executes each task through typed connectors — all under RBAC enforcement, approval gates, and immutable audit logging.

### Core Loop

```
Goal → PlanDecomposer (REASONING tier + RAG)
     → Plan (validated DAG of TaskNodes)
     → Executor (Celery workers)
         → Connector Hub (GitHub, Jira, Slack, ...)
         → Tool Execution (code gen, tests, migrations, ...)
     → Audit + Observability
     → Result / Rollback
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Human-in-the-loop** | Approval gates for HIGH/CRITICAL risk tasks; plan review before execution |
| **Grounded decisions** | RAG context from codebase, docs, tickets, runbooks — never hallucinate blind |
| **Least privilege** | RBAC roles gate which actions the agent can take per environment |
| **Full auditability** | Every action → immutable AuditEvent with PII redaction |
| **Safe rollback** | Each TaskNode carries `rollback_action`; executor can unwind on failure |
| **Self-hosted LLMs** | No data leaves the cluster; vLLM-served open-source models |

---

## 2. Architecture

### 2.1 Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (FastAPI)                     │
│  POST /api/v1/agent/goals     — Submit goal                     │
│  POST /api/v1/agent/plans/:id/approve — Approve plan            │
│  GET  /api/v1/agent/plans/:id — Plan status + progress          │
│  POST /api/v1/agent/tasks/:id/approve — Approve task            │
│  POST /api/v1/agent/plans/:id/cancel  — Cancel execution        │
│  GET  /api/v1/agent/tasks/:id/logs    — Task execution logs     │
└───────┬─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐     ┌──────────────────────────┐
│     Agent Orchestrator       │────▶│    PlanDecomposer        │
│  (src/aegisforge/agent/)     │     │  (existing: planner/)    │
│                              │     │  REASONING tier + RAG    │
│  • Goal intake & validation  │◀────│  → validated DAG         │
│  • Plan lifecycle management │     └──────────────────────────┘
│  • DAG scheduler             │
│  • Approval gate controller  │     ┌──────────────────────────┐
│  • Failure / rollback logic  │────▶│    Connector Hub         │
│  • Progress streaming (SSE)  │     │  (src/aegisforge/        │
└───────┬─────────────────────┘      │   connectors/)           │
        │                            │  • GitHub   • Jira       │
        ▼                            │  • Slack    • PagerDuty  │
┌─────────────────────────────┐      │  • ServiceNow            │
│     Executor Workers         │────▶│  • Shell (sandboxed)     │
│  (src/aegisforge/executor/)  │     └──────────────────────────┘
│  Celery tasks on Redis       │
│  • TaskRunner per TaskType   │     ┌──────────────────────────┐
│  • Timeout enforcement       │────▶│  LLM Client (existing)   │
│  • Retry with backoff        │     │  Code gen / analysis     │
│  • Rollback on failure       │     └──────────────────────────┘
└─────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Cross-cutting: AuditLogger | Metrics | SLI | RBAC           │
│  (all existing and production-ready)                         │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 New Modules to Build

| Module | Path | Purpose |
|--------|------|---------|
| **Agent Orchestrator** | `src/aegisforge/agent/orchestrator.py` | Goal lifecycle, DAG scheduling, approval gates |
| **Agent Models** | `src/aegisforge/agent/models.py` | AgentSession, ExecutionState, ApprovalRequest |
| **Agent API** | `src/aegisforge/agent/routes.py` | REST endpoints + SSE progress stream |
| **Executor Worker** | `src/aegisforge/executor/worker.py` | Celery app & task definitions |
| **Task Runner** | `src/aegisforge/executor/runner.py` | TaskType → handler dispatch, sandboxing |
| **Rollback Engine** | `src/aegisforge/executor/rollback.py` | Undo completed tasks on plan failure |
| **Connector Hub** | `src/aegisforge/connectors/hub.py` | Registry + circuit breaker wrapper |
| **GitHub Connector** | `src/aegisforge/connectors/github.py` | PR, branch, file, review operations |
| **Jira Connector** | `src/aegisforge/connectors/jira.py` | Issue CRUD, transitions, comments |
| **Slack Connector** | `src/aegisforge/connectors/slack.py` | Notifications, approval prompts |
| **PagerDuty Connector** | `src/aegisforge/connectors/pagerduty.py` | Incident creation, acknowledgment |
| **Shell Connector** | `src/aegisforge/connectors/shell.py` | Sandboxed command execution (tests, builds) |
| **Workflow Engine** | `src/aegisforge/workflows/engine.py` | Pre-built workflow templates |

---

## 3. Agent Orchestrator Specification

### 3.1 AgentSession Model

```python
class ExecutionState(str, Enum):
    PLANNING = "planning"              # Goal received, decomposing
    AWAITING_PLAN_APPROVAL = "awaiting_plan_approval"
    EXECUTING = "executing"            # Running tasks
    PAUSED = "paused"                  # Waiting on task approval
    ROLLING_BACK = "rolling_back"      # Undoing completed tasks
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class AgentSession(BaseModel):
    session_id: UUID
    goal: Goal
    plan: Plan | None
    state: ExecutionState
    actor_id: str                       # Who submitted the goal
    actor_role: Role                    # RBAC role
    created_at: datetime
    completed_at: datetime | None
    execution_log: list[ExecutionEvent] # Ordered event stream
```

### 3.2 Orchestrator Flow

```
1. GOAL INTAKE
   ├─ Validate goal fields
   ├─ Check RBAC: actor has `trigger_task` permission
   ├─ Audit: GOAL_SUBMITTED
   └─ State → PLANNING

2. PLAN DECOMPOSITION
   ├─ PlanDecomposer.decompose(goal) → Plan
   ├─ Validate DAG (cycle detection, dependency resolution)
   ├─ Auto-flag HIGH/CRITICAL risk tasks for approval
   ├─ If plan has approval_required tasks → State → AWAITING_PLAN_APPROVAL
   └─ Else → State → EXECUTING

3. PLAN APPROVAL (if required)
   ├─ Notify via Slack/email with plan summary
   ├─ Wait for POST /plans/:id/approve from authorized user
   ├─ Audit: PLAN_APPROVED (with approved_by)
   └─ State → EXECUTING

4. DAG EXECUTION
   ├─ Compute ready tasks (dependencies met)
   ├─ For each ready task:
   │   ├─ If task.requires_approval → State → PAUSED, notify, wait
   │   ├─ Dispatch to Celery worker
   │   ├─ Worker: ConnectorHub.execute(task) or LLM generate
   │   ├─ On success: mark COMPLETED, audit, check for newly ready tasks
   │   └─ On failure:
   │       ├─ Retry up to task.max_retries with exponential backoff
   │       ├─ If exhausted → evaluate failure strategy
   │       └─ FAIL_FAST (critical) or CONTINUE (non-critical) or ROLLBACK
   ├─ Parallel execution: independent tasks run concurrently
   └─ Loop until all tasks COMPLETED or terminal state reached

5. COMPLETION / FAILURE
   ├─ All tasks done → State → COMPLETED, audit PLAN_COMPLETED
   ├─ Critical failure → State → ROLLING_BACK
   │   ├─ Execute rollback_action for each completed task (reverse order)
   │   └─ State → FAILED
   └─ Notify stakeholders via Slack
```

### 3.3 Failure Strategies

| Strategy | When | Behavior |
|----------|------|----------|
| `RETRY` | Transient errors (timeout, rate limit) | Exponential backoff, up to `max_retries` |
| `CONTINUE` | Non-critical task fails (notification, docs) | Skip task, mark SKIPPED, continue DAG |
| `FAIL_FAST` | Critical task fails (migration, deploy) | Stop execution immediately |
| `ROLLBACK` | Destructive task fails mid-execution | Unwind completed tasks via `rollback_action` |

Failure strategy is determined by `TaskNode.risk_level`:
- `LOW/MEDIUM` → `CONTINUE`
- `HIGH` → `FAIL_FAST`
- `CRITICAL` → `ROLLBACK`

---

## 4. Executor Specification

### 4.1 Celery Worker

```python
# src/aegisforge/executor/worker.py
celery_app = Celery("aegisforge", broker=redis_url)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def execute_task(self, session_id: str, task_id: str) -> dict:
    """Execute a single TaskNode within an AgentSession."""
    # 1. Load session + task from state store
    # 2. Validate task is READY
    # 3. Set task.status = IN_PROGRESS, task.started_at = now()
    # 4. Dispatch to TaskRunner based on task.task_type
    # 5. Capture output or error
    # 6. Audit log the result
    # 7. Return result dict for orchestrator callback
```

### 4.2 Task Runner Dispatch

Each `TaskType` maps to a handler function:

| TaskType | Handler | Connectors Used |
|----------|---------|-----------------|
| `CODE_GENERATION` | LLM ADVANCED tier → generate code → GitHub PR | LLM, GitHub |
| `CODE_MODIFICATION` | LLM + RAG context → patch file → push commit | LLM, RAG, GitHub |
| `CODE_REVIEW` | LLM ADVANCED → review diff → post comments | LLM, GitHub |
| `TEST_CREATION` | LLM → generate tests → push → run CI | LLM, GitHub, Shell |
| `TEST_EXECUTION` | Shell connector → `pytest` / `npm test` | Shell |
| `CI_CD_TRIGGER` | GitHub Actions API → trigger workflow | GitHub |
| `DB_MIGRATION` | Generate Alembic migration → review → apply | LLM, Shell |
| `API_CALL` | Generic HTTP call via connector | ConnectorHub |
| `INFRASTRUCTURE` | Terraform/K8s commands (sandboxed) | Shell |
| `DOCUMENTATION` | LLM → generate docs → commit | LLM, GitHub |
| `APPROVAL_GATE` | Pause, notify, wait for human | Slack |
| `ANALYSIS` | LLM REASONING → deep analysis → return findings | LLM, RAG |
| `NOTIFICATION` | Post to Slack/PagerDuty/email | Slack, PagerDuty |

### 4.3 Sandboxing

Code execution and shell commands run in isolated environments:

```
┌─────────────────────────────────────┐
│  Sandboxed Execution Environment     │
│  • Ephemeral container (EKS pod)     │
│  • Read-only base filesystem         │
│  • Writable /workspace mount         │
│  • Network restricted (no egress)    │
│  • Resource limits (CPU, memory)     │
│  • Timeout enforcement               │
│  • No secrets in env (injected JIT)  │
└─────────────────────────────────────┘
```

---

## 5. Connector Hub Specification

### 5.1 Base Connector Interface

```python
class BaseConnector(ABC):
    """All external system adapters implement this interface."""

    connector_name: str

    @abstractmethod
    async def health_check(self) -> bool: ...

    @abstractmethod
    async def execute(self, action: str, params: dict) -> ConnectorResult: ...

    async def close(self) -> None: ...
```

### 5.2 Connector Hub (Registry + Resilience)

```python
class ConnectorHub:
    """Central registry for all external connectors.

    Wraps every call with:
    - Circuit breaker (pybreaker) — trip after 5 failures, reset after 60s
    - Retry with exponential backoff (tenacity) — 3 attempts
    - Timeout enforcement — per-connector configurable
    - Metrics emission — connector_requests_total, duration, circuit state
    - Audit logging — every external call recorded
    """

    def register(self, connector: BaseConnector) -> None: ...
    async def execute(self, connector_name: str, action: str, params: dict) -> ConnectorResult: ...
    async def health_check_all(self) -> dict[str, bool]: ...
```

### 5.3 Connector Inventory

#### GitHub Connector
```
Actions:
  create_branch       — Create feature branch from base
  read_file           — Read file content at ref
  write_file          — Create/update file with commit
  create_pull_request — Open PR with title, body, reviewers
  get_pull_request    — Fetch PR details, diff, checks
  post_review_comment — Comment on specific lines
  merge_pull_request  — Merge (squash/rebase/merge)
  trigger_workflow    — Dispatch GitHub Actions workflow
  list_checks         — Get CI check status for a ref

Auth: GitHub App (JWT + installation token)
Rate limit: 5000 req/hr (handle via circuit breaker)
```

#### Jira Connector
```
Actions:
  create_issue        — Create bug/story/task with fields
  update_issue        — Modify fields, assignee, priority
  transition_issue    — Move through workflow (e.g., In Progress → Done)
  add_comment         — Post comment with formatting
  search_issues       — JQL search
  link_issues         — Create issue links

Auth: API token or OAuth 2.0
```

#### Slack Connector
```
Actions:
  send_message        — Post to channel (with blocks/attachments)
  send_approval       — Interactive message with Approve/Reject buttons
  send_thread_reply   — Reply in thread (for progress updates)
  upload_file         — Upload logs/artifacts to channel

Auth: Bot token (xoxb-)
```

#### PagerDuty Connector
```
Actions:
  create_incident     — Trigger incident with severity
  acknowledge         — Ack an open incident
  resolve             — Resolve incident with notes

Auth: Events API v2 integration key
```

#### Shell Connector
```
Actions:
  run_command         — Execute shell command in sandbox
  run_tests           — Run test suite, parse results
  run_linter          — Run ruff/mypy, return violations
  run_build           — Build project, capture artifacts

Security: Runs in ephemeral container, no network, resource-limited
```

---

## 6. Agent API Specification

### 6.1 Endpoints

```
POST   /api/v1/agent/goals
  Body: { title, description, context?, constraints?, acceptance_criteria?, priority? }
  Returns: { session_id, state: "planning", goal }
  Auth: require_permission(TRIGGER_TASK)

GET    /api/v1/agent/sessions/:session_id
  Returns: { session_id, state, goal, plan, progress_pct, execution_log }
  Auth: require_permission(VIEW_TASKS)

POST   /api/v1/agent/plans/:plan_id/approve
  Body: { approved_by, comments? }
  Returns: { plan_id, state: "executing" }
  Auth: require_role(OPERATOR+) for staging, require_role(ADMIN+) for prod

POST   /api/v1/agent/tasks/:task_id/approve
  Body: { approved_by, comments? }
  Returns: { task_id, status: "ready" }
  Auth: require_role(ADMIN) for HIGH risk, require_role(SUPER_ADMIN) for CRITICAL

POST   /api/v1/agent/sessions/:session_id/cancel
  Returns: { session_id, state: "cancelled" }
  Auth: require_permission(TRIGGER_TASK)

GET    /api/v1/agent/sessions/:session_id/stream
  Returns: SSE stream of ExecutionEvents (real-time progress)
  Auth: require_permission(VIEW_TASKS)

GET    /api/v1/agent/tasks/:task_id/logs
  Returns: { task_id, stdout, stderr, artifacts }
  Auth: require_permission(VIEW_TASKS)
```

### 6.2 SSE Event Stream

```
event: plan_created
data: {"plan_id": "...", "task_count": 5, "estimated_minutes": 12}

event: task_started
data: {"task_id": "...", "name": "Generate auth fix", "task_type": "code_generation"}

event: task_completed
data: {"task_id": "...", "duration_seconds": 8.3, "output_summary": "Created PR #415"}

event: approval_required
data: {"task_id": "...", "name": "Apply DB migration", "risk_level": "high"}

event: task_failed
data: {"task_id": "...", "error": "Tests failed: 3 assertions", "retry_count": 1}

event: plan_completed
data: {"session_id": "...", "total_duration_seconds": 94, "tasks_completed": 5}
```

---

## 7. State Persistence

### 7.1 Storage Strategy

| Data | Store | Reason |
|------|-------|--------|
| AgentSession + Plan | PostgreSQL | Durable, queryable, audit-linked |
| Task execution state | Redis (hash) | Fast read/write during execution |
| Celery task queue | Redis (list) | Broker for async workers |
| Execution logs | PostgreSQL + S3 | Short-term query + long-term archive |
| SSE event buffer | Redis (stream) | Real-time fan-out to connected clients |

### 7.2 New Database Tables

```sql
-- Agent sessions (tracks goal → plan → execution lifecycle)
CREATE TABLE agent_sessions (
    session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal          JSONB NOT NULL,
    plan          JSONB,
    state         VARCHAR(32) NOT NULL DEFAULT 'planning',
    actor_id      VARCHAR(255) NOT NULL,
    actor_role    VARCHAR(32) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ
);

-- Task execution records (one per TaskNode execution attempt)
CREATE TABLE task_executions (
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

-- Approval records
CREATE TABLE approval_requests (
    approval_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES agent_sessions(session_id),
    task_id       UUID,                -- NULL = plan-level approval
    plan_id       UUID,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_by  VARCHAR(255) NOT NULL,
    approved_by   VARCHAR(255),
    approved_at   TIMESTAMPTZ,
    rejected_by   VARCHAR(255),
    rejected_at   TIMESTAMPTZ,
    comments      TEXT,
    status        VARCHAR(16) NOT NULL DEFAULT 'pending'  -- pending/approved/rejected
);

CREATE INDEX idx_sessions_state ON agent_sessions(state);
CREATE INDEX idx_sessions_actor ON agent_sessions(actor_id);
CREATE INDEX idx_executions_session ON task_executions(session_id);
CREATE INDEX idx_approvals_status ON approval_requests(status) WHERE status = 'pending';
```

---

## 8. Implementation Blueprint

### Phase 1: Connector Hub + Core Connectors (Week 1-2)

**Goal:** External system adapters with resilience patterns.

```
Files to create:
  src/aegisforge/connectors/__init__.py
  src/aegisforge/connectors/base.py          — BaseConnector ABC, ConnectorResult
  src/aegisforge/connectors/hub.py           — ConnectorHub with circuit breaker + retry
  src/aegisforge/connectors/github.py        — GitHub App connector (httpx + JWT)
  src/aegisforge/connectors/jira.py          — Jira REST connector
  src/aegisforge/connectors/slack.py         — Slack Web API connector
  src/aegisforge/connectors/pagerduty.py     — PagerDuty Events API v2
  src/aegisforge/connectors/shell.py         — Sandboxed subprocess execution

  tests/test_connectors_hub.py
  tests/test_connector_github.py
  tests/test_connector_slack.py
```

**Key decisions:**
- Use `httpx.AsyncClient` for all HTTP connectors (already a dependency)
- Wrap every call with `pybreaker.CircuitBreaker` (already a dependency)
- Wrap with `tenacity.retry` for transient failures
- Every connector call → `connector_requests_total` metric + audit event
- GitHub auth via JWT (App) → installation token (auto-refreshed)
- Shell connector uses `asyncio.create_subprocess_exec` with timeout

**Acceptance criteria:**
- [ ] All connectors pass unit tests with mocked HTTP (respx)
- [ ] Circuit breaker trips after 5 failures, resets after 60s
- [ ] Retry logic: 3 attempts, exponential backoff (1s, 2s, 4s)
- [ ] Health check endpoint includes connector status
- [ ] No secrets logged (verified via audit redactor)

---

### Phase 2: Executor Workers (Week 2-3)

**Goal:** Celery-based task execution with type-specific handlers.

```
Files to create:
  src/aegisforge/executor/__init__.py
  src/aegisforge/executor/worker.py          — Celery app + task definitions
  src/aegisforge/executor/runner.py          — TaskType → handler dispatch
  src/aegisforge/executor/handlers/
    __init__.py
    code.py                                  — CODE_GENERATION, CODE_MODIFICATION
    review.py                                — CODE_REVIEW
    test.py                                  — TEST_CREATION, TEST_EXECUTION
    cicd.py                                  — CI_CD_TRIGGER
    migration.py                             — DB_MIGRATION
    analysis.py                              — ANALYSIS
    docs.py                                  — DOCUMENTATION
    notification.py                          — NOTIFICATION
    approval.py                              — APPROVAL_GATE
  src/aegisforge/executor/rollback.py        — Rollback engine

  tests/test_executor_worker.py
  tests/test_executor_runner.py
  tests/test_executor_handlers.py
```

**Key decisions:**
- One Celery task per TaskNode execution (granular visibility)
- Handlers receive `TaskNode` + `ConnectorHub` + `LLMClient`
- Code generation: LLM ADVANCED tier + RAG context → output code → GitHub connector
- Timeout: `task_timeout_seconds` from config (default 30 min)
- Results stored in `task_executions` table
- Rollback: reverse-iterate completed tasks, call `rollback_action` for each

**Acceptance criteria:**
- [ ] Worker starts and processes tasks from Redis queue
- [ ] Each TaskType has a working handler with tests
- [ ] Timeout kills long-running tasks
- [ ] Retry works with exponential backoff
- [ ] Rollback engine can undo completed tasks

---

### Phase 3: Agent Orchestrator (Week 3-4)

**Goal:** The brain — goal intake, DAG scheduling, approval gates.

```
Files to create:
  src/aegisforge/agent/__init__.py
  src/aegisforge/agent/models.py             — AgentSession, ExecutionState, ExecutionEvent
  src/aegisforge/agent/orchestrator.py       — Core orchestration logic
  src/aegisforge/agent/scheduler.py          — DAG task scheduler (ready task computation)
  src/aegisforge/agent/approval.py           — Approval gate controller
  src/aegisforge/agent/routes.py             — FastAPI endpoints
  src/aegisforge/agent/stream.py             — SSE event streaming

  tests/test_agent_orchestrator.py
  tests/test_agent_scheduler.py
  tests/test_agent_approval.py
  tests/test_agent_routes.py
```

**Key decisions:**
- Orchestrator is a stateful async class, one instance per session
- DAG scheduler uses `Plan.get_ready_tasks()` (already implemented)
- Parallel execution: dispatch all ready tasks simultaneously via Celery
- Approval notifications via Slack connector (interactive messages)
- State transitions persisted to PostgreSQL on every change
- SSE via Redis Streams → `async for event in stream`
- Orchestrator callbacks registered on Celery task completion signals

**Acceptance criteria:**
- [ ] End-to-end: Goal → Plan → Execute → Complete
- [ ] Approval gates pause execution and resume on approval
- [ ] Parallel tasks execute concurrently
- [ ] Failure triggers correct strategy (continue/fail-fast/rollback)
- [ ] SSE stream delivers real-time updates
- [ ] Full audit trail for every state transition

---

### Phase 4: Workflow Templates (Week 4-5)

**Goal:** Pre-built workflows for common operations.

```
Files to create:
  src/aegisforge/workflows/__init__.py
  src/aegisforge/workflows/engine.py         — Workflow registry + template executor
  src/aegisforge/workflows/templates/
    __init__.py
    bug_fix.py                               — Bug fix workflow
    feature.py                               — New feature workflow
    incident.py                              — Incident response workflow
    deploy.py                                — Deployment workflow (canary/blue-green)
    review.py                                — Code review workflow

  tests/test_workflows.py
```

**Pre-built workflow templates:**

| Workflow | Steps |
|----------|-------|
| **Bug Fix** | Analyze issue → RAG search codebase → generate fix → create tests → open PR → notify |
| **Feature** | Decompose feature → generate code per component → tests → docs → PR → review |
| **Incident** | Triage → RAG search runbooks → apply fix → validate → resolve PagerDuty → post-mortem |
| **Deploy** | Run tests → build → canary deploy (15 min soak) → promote or rollback → notify |
| **Code Review** | Fetch PR diff → LLM analysis → post line comments → approve or request changes |

---

### Phase 5: Hardening & Integration Testing (Week 5-6)

```
Focus areas:
  • End-to-end integration tests (testcontainers: Postgres + Redis + Celery)
  • Load testing: 10 concurrent agent sessions
  • Security audit: sandboxing, secret handling, injection prevention
  • Alembic migrations for new tables
  • Docker Compose update: wire executor worker properly
  • API documentation (OpenAPI/Swagger)
  • Observability dashboards (Grafana templates)
  • Coverage ≥ 90% across all new code
```

---

## 9. Dependency Graph (Build Order)

```
Phase 1: Connectors ─────────────────┐
                                     ├──▶ Phase 3: Orchestrator ──▶ Phase 4: Workflows
Phase 2: Executor ───────────────────┘                                     │
                                                                           ▼
                                                                    Phase 5: Hardening
```

Phases 1 and 2 can be built **in parallel** (no dependencies between them).
Phase 3 depends on both Phase 1 and Phase 2.
Phase 4 depends on Phase 3.
Phase 5 is integration + polish.

---

## 10. Integration Points with Existing Code

| Existing Module | How Agent Uses It |
|-----------------|-------------------|
| `planner/decomposer.py` | Orchestrator calls `PlanDecomposer.decompose(goal)` to create the plan |
| `planner/models.py` | `TaskNode`, `Plan`, `Goal` are the execution primitives |
| `llm/client.py` | Executor handlers use `LLMClient` for code gen, analysis, review |
| `rag/pipeline.py` | Executor handlers use `RAGPipeline.query()` for grounded code gen |
| `auth/rbac.py` | Agent routes use `@require_permission` / `@require_role` decorators |
| `audit/logger.py` | Every orchestrator + executor action → `AuditLogger.log()` |
| `observability/metrics.py` | Task/plan/connector metrics already defined, just need to emit |
| `config.py` | `task_timeout_seconds`, `max_task_retries`, connector credentials |
| `db/session.py` | Session management for new tables |

**No existing code needs modification** — the agent layer is purely additive. The only changes to existing files:
- `main.py`: Add `agent.routes.router` to the FastAPI app
- `health.py`: Add connector health checks to `/readyz`

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM generates incorrect code | High | Medium | RAG grounding + mandatory test execution + human review on PR |
| Runaway execution (infinite loops) | Medium | High | Task timeout (30 min), max plan tasks (50), circuit breakers |
| Secret leakage in LLM prompts | Medium | Critical | PIIRedactor on all inputs, no secrets in tool_input, audit everything |
| Connector outage cascades | Medium | Medium | Circuit breakers, fallback connectors, graceful degradation |
| Approval bottleneck (human slow) | High | Low | Configurable auto-approve for LOW risk, SLA alerts for pending approvals |
| Database contention under load | Low | Medium | Connection pooling (pool_size=20), read replicas for queries |

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Goal → Completed success rate | > 80% | `plan_completed / goals_submitted` |
| Mean time to plan | < 30s | `plan_creation_duration_seconds` |
| Mean time to execute (5-task plan) | < 10 min | `plan_execution_duration_seconds` |
| Approval response time (p90) | < 15 min | `approval_wait_duration_seconds` |
| Rollback success rate | > 95% | `rollbacks_succeeded / rollbacks_attempted` |
| Zero secret leakage | 0 incidents | Audit + security scans |
