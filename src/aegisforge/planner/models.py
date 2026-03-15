"""Data models for the planning engine — Goals, Tasks, and DAGs."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    BLOCKED = "blocked"          # Waiting on dependencies
    READY = "ready"              # Dependencies met, ready to execute
    IN_PROGRESS = "in_progress"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ROLLED_BACK = "rolled_back"


class TaskType(str, Enum):
    """Categories of tasks the executor can handle."""

    CODE_GENERATION = "code_generation"
    CODE_MODIFICATION = "code_modification"
    CODE_REVIEW = "code_review"
    TEST_CREATION = "test_creation"
    TEST_EXECUTION = "test_execution"
    CI_CD_TRIGGER = "ci_cd_trigger"
    DB_MIGRATION = "db_migration"
    API_CALL = "api_call"
    INFRASTRUCTURE = "infrastructure"
    DOCUMENTATION = "documentation"
    APPROVAL_GATE = "approval_gate"
    ANALYSIS = "analysis"
    NOTIFICATION = "notification"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskNode(BaseModel):
    """A single task in the execution DAG."""

    task_id: UUID = Field(default_factory=uuid4)
    name: str
    description: str
    task_type: TaskType
    status: TaskStatus = TaskStatus.PENDING

    # DAG relationships
    depends_on: list[UUID] = Field(default_factory=list)

    # Execution details
    tool: str | None = None              # Which tool/adapter to use
    tool_input: dict[str, Any] = Field(default_factory=dict)
    success_criteria: str = ""
    rollback_action: str | None = None

    # Safety
    risk_level: RiskLevel = RiskLevel.LOW
    requires_approval: bool = False
    is_destructive: bool = False

    # Results
    output: Any = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    retry_count: int = 0
    max_retries: int = 3

    @property
    def duration_seconds(self) -> float | None:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class Goal(BaseModel):
    """A high-level objective to be decomposed into tasks."""

    goal_id: UUID = Field(default_factory=uuid4)
    title: str
    description: str
    context: str = ""                    # Additional context (e.g., ticket description)
    constraints: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    priority: int = 5                    # 1 (highest) to 10 (lowest)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class Plan(BaseModel):
    """An executable plan — a DAG of tasks derived from a Goal."""

    plan_id: UUID = Field(default_factory=uuid4)
    goal: Goal
    tasks: list[TaskNode] = Field(default_factory=list)

    # Planning metadata
    reasoning: str = ""                  # LLM's chain-of-thought reasoning
    assumptions: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    estimated_total_minutes: float | None = None
    rag_sources_used: list[dict[str, Any]] = Field(default_factory=list)

    # State
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: datetime | None = None
    approved_by: str | None = None

    @property
    def task_count(self) -> int:
        return len(self.tasks)

    @property
    def completed_count(self) -> int:
        return sum(1 for t in self.tasks if t.status == TaskStatus.COMPLETED)

    @property
    def progress_pct(self) -> float:
        if not self.tasks:
            return 0.0
        return (self.completed_count / self.task_count) * 100

    def get_ready_tasks(self) -> list[TaskNode]:
        """Return tasks whose dependencies are all completed."""
        completed_ids = {t.task_id for t in self.tasks if t.status == TaskStatus.COMPLETED}
        return [
            t for t in self.tasks
            if t.status in (TaskStatus.PENDING, TaskStatus.READY)
            and all(dep in completed_ids for dep in t.depends_on)
        ]

    def get_task(self, task_id: UUID) -> TaskNode | None:
        for t in self.tasks:
            if t.task_id == task_id:
                return t
        return None

    def validate_dag(self) -> list[str]:
        """Validate the task DAG for cycles and missing dependencies."""
        errors: list[str] = []
        task_ids = {t.task_id for t in self.tasks}

        for task in self.tasks:
            for dep in task.depends_on:
                if dep not in task_ids:
                    errors.append(f"Task '{task.name}' depends on unknown task ID: {dep}")

        # Cycle detection via topological sort
        visited: set[UUID] = set()
        in_progress: set[UUID] = set()
        task_map = {t.task_id: t for t in self.tasks}

        def has_cycle(tid: UUID) -> bool:
            if tid in in_progress:
                return True
            if tid in visited:
                return False
            in_progress.add(tid)
            task = task_map.get(tid)
            if task:
                for dep in task.depends_on:
                    if has_cycle(dep):
                        return True
            in_progress.discard(tid)
            visited.add(tid)
            return False

        for t in self.tasks:
            if has_cycle(t.task_id):
                errors.append(f"Cycle detected involving task: {t.name}")
                break

        return errors
