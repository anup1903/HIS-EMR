"""Tests for agent models — sessions, state machine, events."""

import pytest

from aegisforge.agent.models import (
    AgentSession,
    ApprovalRequest,
    EventType,
    ExecutionEvent,
    ExecutionState,
    FailureStrategy,
)
from aegisforge.planner.models import Goal


def _make_goal(title: str = "Test Goal") -> Goal:
    return Goal(title=title, description="A test goal")


class TestExecutionState:
    def test_valid_transitions_from_planning(self):
        session = AgentSession(goal=_make_goal())
        assert session.state == ExecutionState.PLANNING
        session.transition_to(ExecutionState.EXECUTING)
        assert session.state == ExecutionState.EXECUTING

    def test_valid_transition_to_awaiting_approval(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.AWAITING_PLAN_APPROVAL)
        assert session.state == ExecutionState.AWAITING_PLAN_APPROVAL

    def test_invalid_transition_raises(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.COMPLETED)
        with pytest.raises(ValueError, match="Invalid state transition"):
            session.transition_to(ExecutionState.EXECUTING)

    def test_terminal_states_have_no_transitions(self):
        # COMPLETED (via EXECUTING)
        s1 = AgentSession(goal=_make_goal())
        s1.transition_to(ExecutionState.EXECUTING)
        s1.transition_to(ExecutionState.COMPLETED)
        assert s1.is_terminal

        # FAILED (via PLANNING)
        s2 = AgentSession(goal=_make_goal())
        s2.transition_to(ExecutionState.FAILED)
        assert s2.is_terminal

        # CANCELLED (via PLANNING)
        s3 = AgentSession(goal=_make_goal())
        s3.transition_to(ExecutionState.CANCELLED)
        assert s3.is_terminal

    def test_completed_at_set_on_terminal(self):
        session = AgentSession(goal=_make_goal())
        assert session.completed_at is None
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.COMPLETED)
        assert session.completed_at is not None

    def test_executing_to_paused(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.PAUSED)
        assert session.state == ExecutionState.PAUSED

    def test_paused_to_executing(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.PAUSED)
        session.transition_to(ExecutionState.EXECUTING)
        assert session.state == ExecutionState.EXECUTING

    def test_executing_to_rolling_back(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.ROLLING_BACK)
        assert session.state == ExecutionState.ROLLING_BACK

    def test_rolling_back_only_goes_to_failed(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        session.transition_to(ExecutionState.ROLLING_BACK)
        with pytest.raises(ValueError):
            session.transition_to(ExecutionState.COMPLETED)
        session.transition_to(ExecutionState.FAILED)
        assert session.state == ExecutionState.FAILED


class TestAgentSession:
    def test_emit_event(self):
        session = AgentSession(goal=_make_goal())
        event = session.emit(EventType.GOAL_SUBMITTED, message="Test")
        assert event.event_type == EventType.GOAL_SUBMITTED
        assert event.session_id == session.session_id
        assert len(session.execution_log) == 1

    def test_progress_pct_no_plan(self):
        session = AgentSession(goal=_make_goal())
        assert session.progress_pct == 0.0

    def test_failure_strategy(self):
        session = AgentSession(goal=_make_goal())
        assert session.get_failure_strategy("low") == FailureStrategy.CONTINUE
        assert session.get_failure_strategy("medium") == FailureStrategy.CONTINUE
        assert session.get_failure_strategy("high") == FailureStrategy.FAIL_FAST
        assert session.get_failure_strategy("critical") == FailureStrategy.ROLLBACK

    def test_is_terminal_false_for_executing(self):
        session = AgentSession(goal=_make_goal())
        session.transition_to(ExecutionState.EXECUTING)
        assert not session.is_terminal


class TestApprovalRequest:
    def test_default_values(self):
        req = ApprovalRequest(
            session_id=AgentSession(goal=_make_goal()).session_id,
            requested_by="user@test.com",
        )
        assert req.status == "pending"
        assert req.resolved_by is None
        assert req.risk_level == "medium"


class TestExecutionEvent:
    def test_event_has_defaults(self):
        event = ExecutionEvent(
            event_type=EventType.GOAL_SUBMITTED,
            session_id=AgentSession(goal=_make_goal()).session_id,
        )
        assert event.event_id is not None
        assert event.timestamp is not None
        assert event.data == {}
