"""Data models for the agent orchestrator — sessions, events, state machine."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from aegisforge.planner.models import Goal, Plan, TaskStatus


class ExecutionState(str, Enum):
    """Agent session lifecycle states."""

    PLANNING = "planning"
    AWAITING_PLAN_APPROVAL = "awaiting_plan_approval"
    EXECUTING = "executing"
    PAUSED = "paused"
    ROLLING_BACK = "rolling_back"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Valid state transitions
_VALID_TRANSITIONS: dict[ExecutionState, set[ExecutionState]] = {
    ExecutionState.PLANNING: {
        ExecutionState.AWAITING_PLAN_APPROVAL,
        ExecutionState.EXECUTING,
        ExecutionState.FAILED,
        ExecutionState.CANCELLED,
    },
    ExecutionState.AWAITING_PLAN_APPROVAL: {
        ExecutionState.EXECUTING,
        ExecutionState.CANCELLED,
    },
    ExecutionState.EXECUTING: {
        ExecutionState.PAUSED,
        ExecutionState.COMPLETED,
        ExecutionState.FAILED,
        ExecutionState.ROLLING_BACK,
        ExecutionState.CANCELLED,
    },
    ExecutionState.PAUSED: {
        ExecutionState.EXECUTING,
        ExecutionState.CANCELLED,
        ExecutionState.FAILED,
    },
    ExecutionState.ROLLING_BACK: {
        ExecutionState.FAILED,
    },
    ExecutionState.COMPLETED: set(),
    ExecutionState.FAILED: set(),
    ExecutionState.CANCELLED: set(),
}


class FailureStrategy(str, Enum):
    """How to handle task failures based on risk level."""

    RETRY = "retry"
    CONTINUE = "continue"
    FAIL_FAST = "fail_fast"
    ROLLBACK = "rollback"


class EventType(str, Enum):
    """Types of execution events emitted during agent sessions."""

    GOAL_SUBMITTED = "goal_submitted"
    PLAN_CREATED = "plan_created"
    PLAN_APPROVAL_REQUESTED = "plan_approval_requested"
    PLAN_APPROVED = "plan_approved"
    PLAN_REJECTED = "plan_rejected"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_SKIPPED = "task_skipped"
    TASK_RETRYING = "task_retrying"
    TASK_APPROVAL_REQUESTED = "task_approval_requested"
    TASK_APPROVED = "task_approved"
    TASK_REJECTED = "task_rejected"
    ROLLBACK_STARTED = "rollback_started"
    ROLLBACK_COMPLETED = "rollback_completed"
    SESSION_COMPLETED = "session_completed"
    SESSION_FAILED = "session_failed"
    SESSION_CANCELLED = "session_cancelled"
    ERROR = "error"


class ExecutionEvent(BaseModel):
    """A single event in the execution timeline."""

    event_id: UUID = Field(default_factory=uuid4)
    event_type: EventType
    session_id: UUID
    task_id: UUID | None = None
    plan_id: UUID | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: dict[str, Any] = Field(default_factory=dict)
    message: str = ""


class ApprovalRequest(BaseModel):
    """A pending approval — either plan-level or task-level."""

    approval_id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    plan_id: UUID | None = None
    task_id: UUID | None = None
    requested_by: str
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str = ""
    risk_level: str = "medium"
    status: str = "pending"  # pending / approved / rejected
    resolved_by: str | None = None
    resolved_at: datetime | None = None
    comments: str | None = None


class AgentSession(BaseModel):
    """Tracks the full lifecycle of a goal from intake to completion."""

    session_id: UUID = Field(default_factory=uuid4)
    goal: Goal
    plan: Plan | None = None
    state: ExecutionState = ExecutionState.PLANNING
    actor_id: str = ""
    actor_role: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None

    # Execution tracking
    execution_log: list[ExecutionEvent] = Field(default_factory=list)
    pending_approvals: list[ApprovalRequest] = Field(default_factory=list)
    error: str | None = None

    def transition_to(self, new_state: ExecutionState) -> None:
        """Transition to a new state, validating the transition is legal."""
        valid = _VALID_TRANSITIONS.get(self.state, set())
        if new_state not in valid:
            raise ValueError(
                f"Invalid state transition: {self.state.value} -> {new_state.value}. "
                f"Valid transitions: {[s.value for s in valid]}"
            )
        self.state = new_state
        self.updated_at = datetime.now(timezone.utc)
        if new_state in (
            ExecutionState.COMPLETED,
            ExecutionState.FAILED,
            ExecutionState.CANCELLED,
        ):
            self.completed_at = datetime.now(timezone.utc)

    def add_event(self, event: ExecutionEvent) -> None:
        """Append an event to the execution log."""
        self.execution_log.append(event)

    def emit(
        self,
        event_type: EventType,
        message: str = "",
        task_id: UUID | None = None,
        data: dict[str, Any] | None = None,
    ) -> ExecutionEvent:
        """Create and record an execution event."""
        event = ExecutionEvent(
            event_type=event_type,
            session_id=self.session_id,
            task_id=task_id,
            plan_id=self.plan.plan_id if self.plan else None,
            message=message,
            data=data or {},
        )
        self.add_event(event)
        return event

    @property
    def progress_pct(self) -> float:
        if self.plan:
            return self.plan.progress_pct
        return 0.0

    @property
    def is_terminal(self) -> bool:
        return self.state in (
            ExecutionState.COMPLETED,
            ExecutionState.FAILED,
            ExecutionState.CANCELLED,
        )

    def get_failure_strategy(self, risk_level: str) -> FailureStrategy:
        """Determine failure strategy based on task risk level."""
        strategies = {
            "low": FailureStrategy.CONTINUE,
            "medium": FailureStrategy.CONTINUE,
            "high": FailureStrategy.FAIL_FAST,
            "critical": FailureStrategy.ROLLBACK,
        }
        return strategies.get(risk_level, FailureStrategy.FAIL_FAST)
