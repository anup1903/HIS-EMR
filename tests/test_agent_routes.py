"""Tests for agent API routes."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from aegisforge.agent.models import AgentSession, ExecutionState
from aegisforge.agent.orchestrator import AgentOrchestrator
from aegisforge.agent.routes import router, set_orchestrator
from aegisforge.agent.stream import EventStream
from aegisforge.planner.models import Goal, Plan, TaskNode, TaskType


@pytest.fixture
def mock_orchestrator():
    orch = MagicMock(spec=AgentOrchestrator)
    orch.event_stream = EventStream()
    return orch


@pytest.fixture
def client(mock_orchestrator):
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router)
    set_orchestrator(mock_orchestrator)
    return TestClient(app)


class TestGoalEndpoint:
    def test_submit_goal(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Test goal")
        session = AgentSession(goal=goal, actor_id="test")

        mock_orchestrator.submit_goal = AsyncMock(return_value=session)

        response = client.post(
            "/api/v1/agent/goals",
            json={
                "title": "Fix auth bug",
                "description": "Auth timeout after 30s",
                "priority": 3,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["state"] == "planning"

    def test_submit_goal_minimal(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Minimal")
        session = AgentSession(goal=goal)
        mock_orchestrator.submit_goal = AsyncMock(return_value=session)

        response = client.post(
            "/api/v1/agent/goals",
            json={"title": "Quick fix", "description": "Fix it"},
        )
        assert response.status_code == 201


class TestSessionEndpoint:
    def test_get_session(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Test")
        session = AgentSession(goal=goal)
        mock_orchestrator.get_session = MagicMock(return_value=session)

        response = client.get(f"/api/v1/agent/sessions/{session.session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["state"] == "planning"

    def test_get_session_not_found(self, client, mock_orchestrator):
        mock_orchestrator.get_session = MagicMock(return_value=None)
        response = client.get(f"/api/v1/agent/sessions/{uuid4()}")
        assert response.status_code == 404

    def test_list_sessions(self, client, mock_orchestrator):
        sessions = [
            AgentSession(goal=Goal(title=f"Goal {i}", description="test"))
            for i in range(3)
        ]
        mock_orchestrator.list_sessions = MagicMock(return_value=sessions)

        response = client.get("/api/v1/agent/sessions")
        assert response.status_code == 200
        assert len(response.json()) == 3


class TestCancelEndpoint:
    def test_cancel_session(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Test")
        session = AgentSession(goal=goal)
        session.transition_to(ExecutionState.CANCELLED)
        mock_orchestrator.cancel_session = AsyncMock(return_value=session)

        response = client.post(
            f"/api/v1/agent/sessions/{session.session_id}/cancel"
        )
        assert response.status_code == 200
        assert response.json()["state"] == "cancelled"

    def test_cancel_terminal_session(self, client, mock_orchestrator):
        mock_orchestrator.cancel_session = AsyncMock(
            side_effect=ValueError("already completed")
        )
        response = client.post(f"/api/v1/agent/sessions/{uuid4()}/cancel")
        assert response.status_code == 400


class TestApprovalEndpoints:
    def test_approve_plan(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Test")
        session = AgentSession(goal=goal)
        session.transition_to(ExecutionState.EXECUTING)
        mock_orchestrator.approve_plan = AsyncMock(return_value=session)
        mock_orchestrator.list_sessions = MagicMock(return_value=[session])

        # We need a plan on the session to find it
        plan = Plan(goal=goal, tasks=[])
        session.plan = plan

        response = client.post(
            f"/api/v1/agent/plans/{plan.plan_id}/approve",
            json={"approved_by": "admin@test.com", "comments": "LGTM"},
        )
        assert response.status_code == 200

    def test_approve_task(self, client, mock_orchestrator):
        goal = Goal(title="Test", description="Test")
        task = TaskNode(name="T", description="T", task_type=TaskType.ANALYSIS)
        plan = Plan(goal=goal, tasks=[task])
        session = AgentSession(goal=goal, plan=plan)
        session.transition_to(ExecutionState.EXECUTING)
        mock_orchestrator.approve_task = AsyncMock(return_value=session)
        mock_orchestrator.list_sessions = MagicMock(return_value=[session])

        response = client.post(
            f"/api/v1/agent/tasks/{task.task_id}/approve",
            json={"approved_by": "admin@test.com"},
        )
        assert response.status_code == 200
