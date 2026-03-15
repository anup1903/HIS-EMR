"""Agent API routes — goal submission, approval, status, SSE streaming."""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from aegisforge.agent.models import ExecutionState
from aegisforge.agent.orchestrator import AgentOrchestrator
from aegisforge.agent.stream import format_sse
from aegisforge.planner.models import Goal

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])


# ── Request / Response Models ────────────────────────────────────────────


class GoalRequest(BaseModel):
    title: str
    description: str
    context: str = ""
    constraints: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    priority: int = 5


class ApprovalAction(BaseModel):
    approved_by: str
    comments: str | None = None


class SessionSummary(BaseModel):
    session_id: UUID
    state: str
    goal_title: str
    progress_pct: float
    task_count: int
    completed_count: int
    created_at: str
    error: str | None = None


class SessionDetail(BaseModel):
    session_id: UUID
    state: str
    goal: dict[str, Any]
    plan: dict[str, Any] | None
    progress_pct: float
    execution_log: list[dict[str, Any]]
    pending_approvals: list[dict[str, Any]]
    created_at: str
    completed_at: str | None
    error: str | None


# ── Dependency ───────────────────────────────────────────────────────────

_orchestrator: AgentOrchestrator | None = None


def get_orchestrator() -> AgentOrchestrator:
    """Get the global orchestrator instance. Set via set_orchestrator() at startup."""
    if _orchestrator is None:
        raise RuntimeError("AgentOrchestrator not initialized")
    return _orchestrator


def set_orchestrator(orch: AgentOrchestrator) -> None:
    global _orchestrator
    _orchestrator = orch


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post("/goals", status_code=201)
async def submit_goal(body: GoalRequest, request: Request) -> dict[str, Any]:
    """Submit a new goal for the agent to plan and execute."""
    orch = get_orchestrator()

    actor_id = getattr(request.state, "user_id", "anonymous")
    actor_role = getattr(request.state, "user_role", "operator")

    goal = Goal(
        title=body.title,
        description=body.description,
        context=body.context,
        constraints=body.constraints,
        acceptance_criteria=body.acceptance_criteria,
        priority=body.priority,
    )

    session = await orch.submit_goal(
        goal=goal,
        actor_id=actor_id,
        actor_role=actor_role,
    )

    return {
        "session_id": str(session.session_id),
        "state": session.state.value,
        "goal_id": str(goal.goal_id),
        "message": "Goal submitted, planning in progress",
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: UUID) -> SessionDetail:
    """Get detailed status of an agent session."""
    orch = get_orchestrator()
    session = orch.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionDetail(
        session_id=session.session_id,
        state=session.state.value,
        goal=session.goal.model_dump(mode="json"),
        plan=session.plan.model_dump(mode="json") if session.plan else None,
        progress_pct=session.progress_pct,
        execution_log=[e.model_dump(mode="json") for e in session.execution_log[-50:]],
        pending_approvals=[
            a.model_dump(mode="json")
            for a in session.pending_approvals
            if a.status == "pending"
        ],
        created_at=session.created_at.isoformat(),
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
        error=session.error,
    )


@router.get("/sessions")
async def list_sessions(
    state: str | None = None,
    actor_id: str | None = None,
) -> list[SessionSummary]:
    """List agent sessions with optional filtering."""
    orch = get_orchestrator()
    filter_state = ExecutionState(state) if state else None
    sessions = orch.list_sessions(state=filter_state, actor_id=actor_id)

    return [
        SessionSummary(
            session_id=s.session_id,
            state=s.state.value,
            goal_title=s.goal.title,
            progress_pct=s.progress_pct,
            task_count=s.plan.task_count if s.plan else 0,
            completed_count=s.plan.completed_count if s.plan else 0,
            created_at=s.created_at.isoformat(),
            error=s.error,
        )
        for s in sessions
    ]


@router.post("/plans/{plan_id}/approve")
async def approve_plan(plan_id: UUID, body: ApprovalAction) -> dict[str, Any]:
    """Approve a plan to begin execution."""
    orch = get_orchestrator()

    # Find session by plan_id
    session = _find_session_by_plan(orch, plan_id)
    if not session:
        raise HTTPException(status_code=404, detail="Plan not found")

    try:
        session = await orch.approve_plan(
            session_id=session.session_id,
            approved_by=body.approved_by,
            comments=body.comments,
        )
        return {
            "session_id": str(session.session_id),
            "state": session.state.value,
            "message": "Plan approved, execution started",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/tasks/{task_id}/approve")
async def approve_task(
    task_id: UUID, body: ApprovalAction, request: Request
) -> dict[str, Any]:
    """Approve a specific task within an executing plan."""
    orch = get_orchestrator()

    session = _find_session_by_task(orch, task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task not found")

    try:
        session = await orch.approve_task(
            session_id=session.session_id,
            task_id=task_id,
            approved_by=body.approved_by,
            comments=body.comments,
        )
        return {
            "session_id": str(session.session_id),
            "state": session.state.value,
            "message": "Task approved",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: UUID) -> dict[str, Any]:
    """Cancel an in-progress session."""
    orch = get_orchestrator()
    try:
        session = await orch.cancel_session(session_id)
        return {
            "session_id": str(session.session_id),
            "state": session.state.value,
            "message": "Session cancelled",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/sessions/{session_id}/stream")
async def stream_events(session_id: UUID) -> StreamingResponse:
    """SSE stream of real-time execution events for a session."""
    orch = get_orchestrator()
    session = orch.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    queue = await orch.event_stream.subscribe(session_id, replay=True)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\n\n"
                    continue

                if event is None:
                    # Stream ended
                    yield "event: stream_end\ndata: {}\n\n"
                    break

                yield format_sse(event)
        finally:
            await orch.event_stream.unsubscribe(session_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Helpers ──────────────────────────────────────────────────────────────


def _find_session_by_plan(orch: AgentOrchestrator, plan_id: UUID):
    for session in orch.list_sessions():
        if session.plan and session.plan.plan_id == plan_id:
            return session
    return None


def _find_session_by_task(orch: AgentOrchestrator, task_id: UUID):
    for session in orch.list_sessions():
        if session.plan:
            for task in session.plan.tasks:
                if task.task_id == task_id:
                    return session
    return None
