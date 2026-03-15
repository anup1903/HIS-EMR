# AegisForge Agent Robustness Blueprint

> Phases 6-8: Making the agent handle complex, real-world problems reliably.

---

## Phase 6: Output Validation & Self-Reflection Layer

### Problem
Generated code is pushed to GitHub without any validation. Broken Python, missing imports,
or hallucinated APIs go straight into PRs.

### Solution: Validation Pipeline

```
LLM generates code
        │
        ▼
┌──────────────────────────────────────────────────┐
│             Validation Pipeline                   │
│                                                   │
│  1. Syntax Check      python -m py_compile file   │
│  2. Lint               ruff check --select E,F    │
│  3. Type Check         mypy --ignore-missing      │
│  4. Import Validation  verify imports resolve      │
│  5. Test Execution     pytest on generated tests   │
│  6. Self-Review        LLM reviews its own output  │
│                                                   │
│  Pass all? → Push to GitHub                       │
│  Fail?     → Re-generate with error feedback      │
│             (up to 3 iterations)                  │
└──────────────────────────────────────────────────┘
```

### Files to Build

```
src/aegisforge/validation/
├── __init__.py
├── pipeline.py          — ValidationPipeline: chains validators, iterates on failure
├── syntax.py            — Syntax checker (py_compile, ast.parse)
├── lint.py              — Ruff integration (subprocess, parse JSON output)
├── imports.py           — Import resolver (check if modules exist)
├── schema.py            — JSON/dict schema validation for LLM structured output
└── self_review.py       — LLM self-review: send output back for critique

tests/test_validation.py
```

### Validation Pipeline Spec

```python
class ValidationPipeline:
    """Validates LLM output before committing to external systems.

    Supports iterative refinement: if validation fails, feeds errors back
    to LLM for self-correction (up to max_iterations).
    """

    async def validate_code(
        self,
        code: str,
        language: str = "python",
        context: str = "",
    ) -> ValidationResult:
        """Run all code validators. Returns pass/fail with error details."""

    async def validate_and_fix(
        self,
        code: str,
        llm_client: LLMClient,
        max_iterations: int = 3,
    ) -> ValidationResult:
        """Validate code, and if it fails, ask LLM to fix based on errors.
        Iterates until validation passes or max_iterations reached."""

    async def self_review(
        self,
        output: str,
        task_description: str,
        llm_client: LLMClient,
    ) -> SelfReviewResult:
        """Have the LLM review its own output for correctness and completeness.
        Uses a different model tier (STANDARD reviews ADVANCED's output)."""

class ValidationResult(BaseModel):
    passed: bool
    errors: list[ValidationError]
    warnings: list[ValidationWarning]
    iteration: int
    fixed_code: str | None  # Corrected version if auto-fixed

class SelfReviewResult(BaseModel):
    approved: bool
    confidence: float  # 0.0-1.0
    issues: list[str]
    suggestions: list[str]
```

### Integration Points
- Inject between LLM output and GitHub push in `executor/handlers/code.py`
- Add `validate_and_fix()` call in `handle_code_generation()` and `handle_code_modification()`
- Self-review for `handle_code_review()` — review the review before posting

---

## Phase 7: Agent Memory & Feedback Loop

### Problem
1. All session state lives in Python dicts — lost on restart
2. Agent never learns from past failures or successes
3. Same mistake repeated across sessions because there's no memory

### Solution: Three-Layer Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Memory System                       │
│                                                             │
│  Layer 1: Session Persistence (PostgreSQL)                  │
│  ├── AgentSession ORM → agent_sessions table                │
│  ├── TaskExecution ORM → task_executions table              │
│  └── ApprovalRequest ORM → approval_requests table          │
│                                                             │
│  Layer 2: Episodic Memory (pgvector)                        │
│  ├── Past task outcomes embedded and stored                  │
│  ├── "What worked before for similar goals?"                 │
│  ├── Failure patterns with root causes                      │
│  └── Collection: "agent_memory"                             │
│                                                             │
│  Layer 3: Learned Rules (Redis + PostgreSQL)                │
│  ├── Extracted patterns from outcomes                        │
│  ├── "Always run tests before DB migrations"                │
│  ├── "Connector X fails 40% — prefer Y"                    │
│  └── Injected into planner prompts as context               │
└─────────────────────────────────────────────────────────────┘
```

### Files to Build

```
src/aegisforge/memory/
├── __init__.py
├── models.py            — ORM models for sessions, task outcomes, learned rules
├── persistence.py       — SessionStore: save/load/query agent sessions from DB
├── episodic.py          — EpisodicMemory: embed & store task outcomes in pgvector
├── rules.py             — RuleEngine: extract, store, query learned rules
└── feedback.py          — FeedbackCollector: analyze outcomes → update memory

tests/test_memory.py
```

### How It Works

#### Layer 1: Session Persistence
```python
class SessionStore:
    """Persists agent sessions to PostgreSQL.

    Replaces the in-memory dict in orchestrator.py.
    """

    async def save(self, session: AgentSession) -> None:
        """Persist session state (called on every state transition)."""

    async def load(self, session_id: UUID) -> AgentSession | None:
        """Load session from database."""

    async def list_sessions(
        self, state: ExecutionState | None = None,
        actor_id: str | None = None,
        limit: int = 50,
    ) -> list[AgentSession]:
        """Query sessions with filtering."""

    async def get_recent_similar(
        self, goal_title: str, limit: int = 5,
    ) -> list[AgentSession]:
        """Find past sessions with similar goals (for memory injection)."""
```

#### Layer 2: Episodic Memory
```python
class EpisodicMemory:
    """Stores task outcomes as embeddings in pgvector for semantic retrieval.

    When the agent faces a new task, it retrieves similar past outcomes
    to learn from successes and avoid repeating failures.
    """

    async def record_outcome(
        self, task: TaskNode, result: TaskResult, session: AgentSession,
    ) -> None:
        """Embed and store a task outcome.

        Creates a natural language summary:
        'Task: Generate auth middleware fix. Type: code_modification.
         Result: COMPLETED. Duration: 8.3s. Approach: Modified JWT validation
         to handle expired tokens gracefully. PR #415 merged.'

        Embeds this and stores in collection='agent_memory'.
        """

    async def recall(
        self, task_description: str, limit: int = 5,
    ) -> list[PastOutcome]:
        """Retrieve similar past outcomes for context injection.

        Used by PlanDecomposer to ground plans in past experience:
        'In the past, similar tasks succeeded by doing X and failed when Y.'
        """

    async def recall_failures(
        self, task_type: TaskType, limit: int = 5,
    ) -> list[PastOutcome]:
        """Specifically retrieve past failures for a task type.
        Used to add warnings and constraints to the plan."""

class PastOutcome(BaseModel):
    task_name: str
    task_type: TaskType
    status: TaskStatus
    duration_ms: float
    approach_summary: str
    error_summary: str | None
    lessons_learned: str
    similarity_score: float
    session_goal: str
    timestamp: datetime
```

#### Layer 3: Learned Rules
```python
class RuleEngine:
    """Extracts and manages learned rules from task outcomes.

    Rules are injected into the PlanDecomposer's system prompt to guide
    future planning decisions.
    """

    async def extract_rules(
        self, session: AgentSession,
    ) -> list[LearnedRule]:
        """After session completion, analyze outcomes and extract rules.

        Uses STANDARD tier LLM to analyze:
        - What worked well? → Positive rules
        - What failed and why? → Negative rules (avoid patterns)
        - What took longer than expected? → Estimation rules

        Example rules:
        - 'Always run existing tests before generating new ones'
        - 'GitHub API rate limits hit after 20 rapid calls — add 1s delay'
        - 'DB migrations for table X require approval from DBA team'
        """

    async def get_relevant_rules(
        self, goal: Goal, limit: int = 10,
    ) -> list[LearnedRule]:
        """Retrieve rules relevant to a new goal.
        Injected into PlanDecomposer prompt."""

class LearnedRule(BaseModel):
    rule_id: UUID
    rule_type: str  # "positive", "negative", "estimation", "constraint"
    description: str
    confidence: float  # 0.0-1.0, increases with repeated confirmation
    source_session_ids: list[UUID]
    task_types: list[TaskType]
    created_at: datetime
    last_confirmed: datetime
    times_confirmed: int
```

### Integration with Existing Code

```python
# In PlanDecomposer.decompose():
async def decompose(self, goal: Goal) -> Plan:
    # EXISTING: RAG context from codebase
    rag_context = await self._rag.query(goal.description, collection="codebase")

    # NEW: Retrieve past experience
    past_outcomes = await self._memory.recall(goal.description, limit=5)
    past_failures = await self._memory.recall_failures(limit=3)
    learned_rules = await self._rules.get_relevant_rules(goal, limit=10)

    # NEW: Build memory context
    memory_context = self._format_memory(past_outcomes, past_failures, learned_rules)

    # EXISTING: LLM decomposition (now with memory injected)
    plan = await self._llm.reason(
        prompt=self._build_prompt(goal, rag_context, memory_context),
        ...
    )

# In Orchestrator, after session completes:
async def _on_session_complete(self, session: AgentSession):
    # Persist final state
    await self._session_store.save(session)

    # Record outcomes for all tasks
    for task in session.plan.tasks:
        await self._memory.record_outcome(task, ...)

    # Extract and store learned rules
    rules = await self._rules.extract_rules(session)
    for rule in rules:
        await self._rules.save(rule)
```

---

## Phase 8: Multi-Agent Coordination & Adaptive Context

### Problem
1. Single orchestrator can't effectively handle problems requiring different expertise
2. Hard-coded context window limits lead to truncated or missing context
3. No dynamic prioritization of what information matters for each task

### Solution: Specialized Sub-Agents + Smart Context Manager

### 8A: Sub-Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Lead Orchestrator Agent                         │
│  Receives goal, decomposes into sub-problems,                   │
│  delegates to specialized agents, synthesizes results            │
└────┬────────────┬────────────┬────────────┬────────────────────┘
     │            │            │            │
┌────▼───┐  ┌────▼───┐  ┌────▼───┐  ┌────▼────────┐
│ Code   │  │Security│  │ Test   │  │Architecture │
│ Agent  │  │ Agent  │  │ Agent  │  │   Agent     │
│        │  │        │  │        │  │             │
│ADVANCED│  │ADVANCED│  │STANDARD│  │ REASONING   │
│ tier   │  │ tier   │  │ tier   │  │   tier      │
│        │  │        │  │        │  │             │
│Writes  │  │Reviews │  │Creates │  │Designs      │
│code    │  │for     │  │& runs  │  │patterns,    │
│        │  │vulns   │  │tests   │  │decomposes   │
└────────┘  └────────┘  └────────┘  └─────────────┘
```

### Files to Build

```
src/aegisforge/agents/
├── __init__.py
├── base.py              — BaseSubAgent: shared interface for all sub-agents
├── coordinator.py       — AgentCoordinator: routes sub-tasks to specialists
├── code_agent.py        — CodeAgent: code generation, modification, refactoring
├── security_agent.py    — SecurityAgent: vulnerability scanning, secure code review
├── test_agent.py        — TestAgent: test generation, coverage analysis
├── architecture_agent.py — ArchAgent: system design, decomposition, trade-off analysis
└── context_manager.py   — AdaptiveContextManager: smart context window allocation

tests/test_multi_agent.py
```

### Sub-Agent Spec

```python
class BaseSubAgent(ABC):
    """Specialized sub-agent with domain expertise."""

    agent_name: str
    model_tier: ModelTier          # Which LLM tier this agent uses
    system_prompt: str             # Domain-specific instructions
    rag_collections: list[str]     # Which knowledge collections to query

    async def execute(
        self, task: SubTask, context: AgentContext,
    ) -> SubAgentResult:
        """Execute a sub-task with domain-specific expertise."""

    async def can_handle(self, task: SubTask) -> float:
        """Return confidence score (0-1) that this agent can handle the task."""


class AgentCoordinator:
    """Routes sub-tasks to the most capable sub-agent.

    For complex problems:
    1. Architecture Agent decomposes into sub-problems
    2. Code Agent implements each component
    3. Security Agent reviews for vulnerabilities
    4. Test Agent creates and runs tests
    5. Results synthesized by Lead Orchestrator
    """

    async def route(self, task: SubTask) -> BaseSubAgent:
        """Select the best agent for a task based on confidence scores."""

    async def execute_with_review(
        self, task: SubTask,
    ) -> SubAgentResult:
        """Execute task with primary agent, then cross-review with another.

        Example: Code Agent writes code → Security Agent reviews it
        """

    async def parallel_execute(
        self, tasks: list[SubTask],
    ) -> list[SubAgentResult]:
        """Execute independent sub-tasks across multiple agents in parallel."""
```

### 8B: Adaptive Context Manager

```python
class AdaptiveContextManager:
    """Intelligently allocates context window budget across information sources.

    Instead of hard-coded limits like rag_context[:6000], this:
    1. Calculates exact token counts (using tiktoken)
    2. Prioritizes information by relevance score
    3. Allocates budget proportionally across:
       - RAG codebase context
       - Past outcome memory
       - Learned rules
       - Task-specific instructions
       - System prompt
    4. Adapts allocation based on task type
    """

    def __init__(self, max_context_tokens: int = 32000):
        self._max_tokens = max_context_tokens
        self._tokenizer = tiktoken.get_encoding("cl100k_base")

    def allocate(
        self, task_type: TaskType, available_context: dict[str, list[ScoredChunk]],
    ) -> ContextAllocation:
        """Allocate token budget across context sources.

        Budget allocation by task type:
        - CODE_GENERATION:  60% codebase, 20% memory, 10% rules, 10% instructions
        - ANALYSIS:         40% codebase, 20% docs, 20% memory, 20% rules
        - DB_MIGRATION:     50% schema, 30% memory, 20% rules
        - CODE_REVIEW:      50% diff, 30% standards, 20% memory
        """

    def build_context(
        self, allocation: ContextAllocation,
    ) -> str:
        """Build the final context string within token budget.

        Each chunk is included in priority order until budget exhausted.
        Never truncates mid-sentence — drops whole chunks instead.
        """

    def count_tokens(self, text: str) -> int:
        """Exact token count using tiktoken."""

class ContextAllocation(BaseModel):
    total_budget: int
    sources: dict[str, ContextBudget]  # source_name -> budget

class ContextBudget(BaseModel):
    allocated_tokens: int
    chunks: list[ScoredChunk]
    used_tokens: int
```

---

## Updated Architecture with Robustness Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Lead Orchestrator Agent                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Memory       │  │ Rule Engine  │  │ Adaptive Context   │ │
│  │ (episodic +  │  │ (learned     │  │ Manager (token-    │ │
│  │  session DB) │  │  patterns)   │  │  aware allocation) │ │
│  └─────────────┘  └──────────────┘  └────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Agent Coordinator                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Code     │ │ Security │ │ Test     │ │ Architecture  │  │
│  │ Agent    │ │ Agent    │ │ Agent    │ │ Agent         │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │
└───────┼─────────────┼───────────┼────────────────┼──────────┘
        │             │           │                │
┌───────▼─────────────▼───────────▼────────────────▼──────────┐
│              Validation Pipeline                             │
│  Syntax → Lint → Type Check → Import Check → Self-Review    │
│  ↻ Auto-fix loop (up to 3 iterations)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Executor + Connectors                           │
│  (existing: Celery workers, ConnectorHub, rollback)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Feedback Collector                               │
│  Records outcomes → Episodic Memory → Extract Rules          │
│  → Injects into future planning prompts                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Order

```
Phase 6 (Validation) ──────┐
                           ├──▶ Phase 8 (Multi-Agent + Context)
Phase 7 (Memory + Rules) ──┘

Phase 6 and 7 are independent — build in parallel.
Phase 8 depends on both (agents use memory + validation).
```

### Estimated Effort
| Phase | Scope | Files |
|-------|-------|-------|
| Phase 6: Validation Pipeline | 6 new files + handler updates | ~800 LOC |
| Phase 7: Memory & Feedback | 6 new files + orchestrator updates | ~1200 LOC |
| Phase 8: Multi-Agent + Context | 8 new files + planner updates | ~1500 LOC |

---

## Database Requirements

### Already Have
- **PostgreSQL** — relational data (sessions, audit, approvals)
- **pgvector** — vector embeddings (RAG chunks, HNSW index)
- **Redis** — Celery broker, caching, SSE streams

### New Tables Needed (Phase 7)

```sql
-- Task outcomes (episodic memory, embedded in pgvector)
CREATE TABLE task_outcomes (
    outcome_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID REFERENCES agent_sessions(session_id),
    task_id       UUID NOT NULL,
    task_type     VARCHAR(32) NOT NULL,
    status        VARCHAR(32) NOT NULL,
    goal_summary  TEXT NOT NULL,
    approach      TEXT,
    error_summary TEXT,
    lessons       TEXT,
    duration_ms   FLOAT,
    embedding     vector(1024),     -- pgvector: BGE-M3 embedding
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_outcomes_embedding ON task_outcomes
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_outcomes_type ON task_outcomes(task_type, status);

-- Learned rules
CREATE TABLE learned_rules (
    rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type       VARCHAR(16) NOT NULL,  -- positive/negative/estimation
    description     TEXT NOT NULL,
    confidence      FLOAT DEFAULT 0.5,
    task_types      JSONB DEFAULT '[]',
    source_sessions JSONB DEFAULT '[]',
    times_confirmed INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_confirmed  TIMESTAMPTZ DEFAULT now(),
    active          BOOLEAN DEFAULT true
);
CREATE INDEX idx_rules_active ON learned_rules(active) WHERE active = true;
```

### No Additional Databases Needed
pgvector inside PostgreSQL handles both relational AND vector storage.
No Pinecone, Weaviate, ChromaDB, or separate vector DB required.
