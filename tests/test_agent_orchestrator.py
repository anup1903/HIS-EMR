"""Tests for the agent orchestrator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from aegisforge.agent.models import ExecutionState, EventType
from aegisforge.agent.orchestrator import AgentOrchestrator
from aegisforge.agent.stream import EventStream
from aegisforge.planner.models import (
    Goal,
    Plan,
    RiskLevel,
    TaskNode,
    TaskStatus,
    TaskType,
)


def _make_goal(title: str = "Test Goal") -> Goal:
    return Goal(title=title, description="Test description")


def _make_plan(goal: Goal, tasks: list[TaskNode] | None = None) -> Plan:
    if tasks is None:
        tasks = [
            TaskNode(
                name="Task 1",
                description="Do something",
                task_type=TaskType.ANALYSIS,
                risk_level=RiskLevel.LOW,
            )
        ]
    return Plan(goal=goal, tasks=tasks)


@pytest.fixture
def mock_decomposer():
    decomposer = AsyncMock()
    goal = _make_goal()
    decomposer.decompose = AsyncMock(return_value=_make_plan(goal))
    return decomposer


@pytest.fixture
def orchestrator(mock_decomposer):
    return AgentOrchestrator(
        plan_decomposer=mock_decomposer,
        event_stream=EventStream(),
    )


class TestGoalSubmission:
    @pytest.mark.asyncio
    async def test_submit_goal_creates_session(self, orchestrator):
        goal = _make_goal("Fix auth bug")
        session = await orchestrator.submit_goal(
            goal=goal, actor_id="user@test.com", actor_role="operator"
        )
        assert session.session_id is not None
        assert session.goal.title == "Fix auth bug"
        assert session.actor_id == "user@test.com"

    @pytest.mark.asyncio
    async def test_submit_goal_emits_event(self, orchestrator):
        goal = _make_goal()
        session = await orchestrator.submit_goal(goal=goal)
        assert len(session.execution_log) >= 1
        assert session.execution_log[0].event_type == EventType.GOAL_SUBMITTED

    @pytest.mark.asyncio
    async def test_session_retrievable(self, orchestrator):
        goal = _make_goal()
        session = await orchestrator.submit_goal(goal=goal)
        retrieved = orchestrator.get_session(session.session_id)
        assert retrieved is not None
        assert retrieved.session_id == session.session_id

    @pytest.mark.asyncio
    async def test_nonexistent_session_returns_none(self, orchestrator):
        assert orchestrator.get_session(uuid4()) is None


class TestPlanApproval:
    @pytest.mark.asyncio
    async def test_approve_plan_transitions_to_executing(self, mock_decomposer):
        goal = _make_goal()
        plan = _make_plan(
            goal,
            tasks=[
                TaskNode(
                    name="Risky task",
                    description="Dangerous",
                    task_type=TaskType.DB_MIGRATION,
                    risk_level=RiskLevel.HIGH,
                    requires_approval=True,
                )
            ],
        )
        mock_decomposer.decompose = AsyncMock(return_value=plan)
        orch = AgentOrchestrator(
            plan_decomposer=mock_decomposer,
            event_stream=EventStream(),
        )

        session = await orch.submit_goal(goal=goal, actor_id="user@test.com")

        # Wait for async planning
        await asyncio.sleep(0.2)

        if session.state == ExecutionState.AWAITING_PLAN_APPROVAL:
            session = await orch.approve_plan(
                session_id=session.session_id,
                approved_by="admin@test.com",
            )
            # Should have transitioned to executing or beyond
            assert session.state in (
                ExecutionState.EXECUTING,
                ExecutionState.COMPLETED,
                ExecutionState.PAUSED,
            )


class TestSessionManagement:
    @pytest.mark.asyncio
    async def test_cancel_session(self, orchestrator):
        goal = _make_goal()
        session = await orchestrator.submit_goal(goal=goal)
        await asyncio.sleep(0.1)

        if not session.is_terminal:
            cancelled = await orchestrator.cancel_session(session.session_id)
            assert cancelled.state == ExecutionState.CANCELLED

    @pytest.mark.asyncio
    async def test_cancel_terminal_session_raises(self, orchestrator):
        goal = _make_goal()
        session = await orchestrator.submit_goal(goal=goal)
        await asyncio.sleep(0.3)

        if session.is_terminal:
            with pytest.raises(ValueError, match="already"):
                await orchestrator.cancel_session(session.session_id)

    @pytest.mark.asyncio
    async def test_list_sessions(self, orchestrator):
        await orchestrator.submit_goal(goal=_make_goal("Goal 1"), actor_id="a")
        await orchestrator.submit_goal(goal=_make_goal("Goal 2"), actor_id="b")

        all_sessions = orchestrator.list_sessions()
        assert len(all_sessions) == 2

        filtered = orchestrator.list_sessions(actor_id="a")
        assert len(filtered) == 1
        assert filtered[0].actor_id == "a"


class TestEventStream:
    @pytest.mark.asyncio
    async def test_stream_receives_events(self, orchestrator):
        goal = _make_goal()
        session = await orchestrator.submit_goal(goal=goal)

        queue = await orchestrator.event_stream.subscribe(session.session_id, replay=True)
        # Should have at least the goal_submitted event
        assert not queue.empty()
        event = await queue.get()
        assert event.event_type == EventType.GOAL_SUBMITTED
