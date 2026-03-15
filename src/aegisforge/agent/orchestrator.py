"""Agent orchestrator — the brain that drives goal → plan → execute → complete."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog

from aegisforge.agent.approval import ApprovalController
from aegisforge.agent.models import (
    AgentSession,
    EventType,
    ExecutionState,
    FailureStrategy,
)
from aegisforge.agent.scheduler import DAGScheduler
from aegisforge.agent.stream import EventStream
from aegisforge.planner.decomposer import PlanDecomposer
from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskStatus

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aegisforge.memory.feedback import FeedbackCollector
    from aegisforge.memory.persistence import SessionStore

logger = structlog.get_logger()


class AgentOrchestrator:
    """Drives the full agent lifecycle: goal intake → planning → execution → completion.

    Responsibilities:
    - Receive and validate goals
    - Invoke PlanDecomposer for DAG creation
    - Schedule tasks respecting dependencies (parallel when possible)
    - Enforce approval gates for high-risk tasks
    - Handle failures with risk-appropriate strategies
    - Stream real-time progress via SSE
    - Produce immutable audit events for every action
    """

    def __init__(
        self,
        plan_decomposer: PlanDecomposer,
        event_stream: EventStream | None = None,
        approval_controller: ApprovalController | None = None,
        task_dispatcher: Any = None,
        session_store: SessionStore | None = None,
        feedback_collector: FeedbackCollector | None = None,
    ) -> None:
        self._decomposer = plan_decomposer
        self._stream = event_stream or EventStream()
        self._approvals = approval_controller or ApprovalController()
        self._task_dispatcher = task_dispatcher
        self._session_store = session_store
        self._feedback = feedback_collector
        self._sessions: dict[UUID, AgentSession] = {}
        self._schedulers: dict[UUID, DAGScheduler] = {}

    async def _persist_session(self, session: AgentSession) -> None:
        """Write-through: save session to persistent store if configured."""
        if self._session_store:
            try:
                await self._session_store.save(session)
            except Exception:
                logger.exception(
                    "orchestrator.persist_failed",
                    session_id=str(session.session_id),
                )

    async def _collect_feedback(self, session: AgentSession) -> None:
        """Run post-session feedback collection in background."""
        if self._feedback and session.is_terminal:
            try:
                await self._feedback.process_completed_session(session)
            except Exception:
                logger.exception(
                    "orchestrator.feedback_failed",
                    session_id=str(session.session_id),
                )

    # ── Goal Intake ──────────────────────────────────────────────────────

    async def submit_goal(
        self,
        goal: Goal,
        actor_id: str = "",
        actor_role: str = "",
    ) -> AgentSession:
        """Accept a goal and begin the planning phase."""
        session = AgentSession(
            goal=goal,
            actor_id=actor_id,
            actor_role=actor_role,
        )
        self._sessions[session.session_id] = session
        await self._persist_session(session)

        session.emit(
            EventType.GOAL_SUBMITTED,
            message=f"Goal submitted: {goal.title}",
            data={"goal_id": str(goal.goal_id), "title": goal.title},
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

        logger.info(
            "orchestrator.goal_submitted",
            session_id=str(session.session_id),
            goal_title=goal.title,
            actor_id=actor_id,
        )

        # Start async planning
        asyncio.create_task(self._plan_and_execute(session))
        return session

    # ── Planning ─────────────────────────────────────────────────────────

    async def _plan_and_execute(self, session: AgentSession) -> None:
        """Decompose goal into plan, then execute."""
        try:
            plan = await self._decompose_goal(session)
            if plan is None:
                return

            session.plan = plan
            session.emit(
                EventType.PLAN_CREATED,
                message=f"Plan created with {plan.task_count} tasks",
                data={
                    "plan_id": str(plan.plan_id),
                    "task_count": plan.task_count,
                    "tasks": [
                        {
                            "task_id": str(t.task_id),
                            "name": t.name,
                            "task_type": t.task_type.value,
                            "risk_level": t.risk_level.value,
                            "requires_approval": t.requires_approval,
                        }
                        for t in plan.tasks
                    ],
                },
            )
            await self._stream.publish(session.session_id, session.execution_log[-1])

            # Check if plan needs approval
            needs_approval = any(t.requires_approval for t in plan.tasks)
            if needs_approval:
                await self._request_plan_approval(session)
                return  # Will resume when approval comes in

            # No approval needed — execute immediately
            session.transition_to(ExecutionState.EXECUTING)
            await self._execute_plan(session)

        except Exception as exc:
            logger.exception(
                "orchestrator.plan_failed",
                session_id=str(session.session_id),
                error=str(exc),
            )
            session.error = str(exc)
            session.transition_to(ExecutionState.FAILED)
            session.emit(
                EventType.SESSION_FAILED,
                message=f"Planning failed: {exc}",
            )
            await self._stream.publish(session.session_id, session.execution_log[-1])
            await self._stream.end_session(session.session_id)

    async def _decompose_goal(self, session: AgentSession) -> Plan | None:
        """Call PlanDecomposer to create an execution plan."""
        try:
            plan = await self._decomposer.decompose(session.goal)
            errors = plan.validate_dag()
            if errors:
                raise ValueError(f"Invalid plan DAG: {'; '.join(errors)}")
            return plan
        except Exception as exc:
            logger.error(
                "orchestrator.decomposition_failed",
                session_id=str(session.session_id),
                error=str(exc),
            )
            session.error = str(exc)
            session.transition_to(ExecutionState.FAILED)
            session.emit(EventType.SESSION_FAILED, message=str(exc))
            await self._stream.publish(session.session_id, session.execution_log[-1])
            await self._stream.end_session(session.session_id)
            return None

    # ── Approval ─────────────────────────────────────────────────────────

    async def _request_plan_approval(self, session: AgentSession) -> None:
        """Transition to awaiting approval and notify."""
        session.transition_to(ExecutionState.AWAITING_PLAN_APPROVAL)
        plan = session.plan
        if not plan:
            return

        approval = self._approvals.request_plan_approval(
            session_id=session.session_id,
            plan_id=plan.plan_id,
            requested_by=session.actor_id,
            reason="Plan contains high-risk or destructive tasks requiring approval",
        )
        session.pending_approvals.append(approval)

        session.emit(
            EventType.PLAN_APPROVAL_REQUESTED,
            message="Plan requires approval before execution",
            data={
                "approval_id": str(approval.approval_id),
                "plan_id": str(plan.plan_id),
                "high_risk_tasks": [
                    t.name for t in plan.tasks if t.requires_approval
                ],
            },
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

    async def approve_plan(
        self,
        session_id: UUID,
        approved_by: str,
        comments: str | None = None,
    ) -> AgentSession:
        """Approve a plan and resume execution."""
        session = self._get_session(session_id)
        if session.state != ExecutionState.AWAITING_PLAN_APPROVAL:
            raise ValueError(
                f"Session {session_id} is not awaiting plan approval "
                f"(current state: {session.state.value})"
            )

        # Resolve the pending plan approval
        for approval in session.pending_approvals:
            if approval.plan_id and approval.status == "pending":
                self._approvals.approve(
                    approval.approval_id, approved_by, comments
                )

        session.emit(
            EventType.PLAN_APPROVED,
            message=f"Plan approved by {approved_by}",
            data={"approved_by": approved_by, "comments": comments},
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

        session.transition_to(ExecutionState.EXECUTING)
        if session.plan:
            session.plan.approved_at = datetime.now(timezone.utc)
            session.plan.approved_by = approved_by

        asyncio.create_task(self._execute_plan(session))
        return session

    async def approve_task(
        self,
        session_id: UUID,
        task_id: UUID,
        approved_by: str,
        comments: str | None = None,
    ) -> AgentSession:
        """Approve a specific task and resume execution."""
        session = self._get_session(session_id)

        # Resolve the pending task approval
        for approval in session.pending_approvals:
            if approval.task_id == task_id and approval.status == "pending":
                self._approvals.approve(
                    approval.approval_id, approved_by, comments
                )

        scheduler = self._schedulers.get(session.session_id)
        if scheduler:
            task = session.plan.get_task(task_id) if session.plan else None
            if task:
                task.status = TaskStatus.READY

        session.emit(
            EventType.TASK_APPROVED,
            message=f"Task approved by {approved_by}",
            task_id=task_id,
            data={"approved_by": approved_by},
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

        # Resume execution if session was paused
        if session.state == ExecutionState.PAUSED:
            session.transition_to(ExecutionState.EXECUTING)
            asyncio.create_task(self._execute_plan(session))

        return session

    # ── Execution ────────────────────────────────────────────────────────

    async def _execute_plan(self, session: AgentSession) -> None:
        """Execute the plan's DAG — dispatch ready tasks, handle results."""
        plan = session.plan
        if not plan:
            return

        scheduler = DAGScheduler(plan)
        self._schedulers[session.session_id] = scheduler

        logger.info(
            "orchestrator.execution_started",
            session_id=str(session.session_id),
            task_count=plan.task_count,
        )

        try:
            while not scheduler.all_terminal and not session.is_terminal:
                ready_tasks = scheduler.get_ready_tasks()

                if not ready_tasks:
                    # Check if we're waiting on approvals
                    if scheduler.pending_approvals:
                        if session.state != ExecutionState.PAUSED:
                            session.transition_to(ExecutionState.PAUSED)
                        return  # Will resume when approval comes in

                    # Check if tasks are still in progress
                    if scheduler.in_progress_count > 0:
                        await asyncio.sleep(1)
                        continue

                    # No ready tasks, no in-progress, no approvals — we're stuck
                    if not scheduler.all_terminal:
                        logger.error(
                            "orchestrator.deadlock",
                            session_id=str(session.session_id),
                        )
                        session.error = "Execution deadlocked: no runnable tasks"
                        session.transition_to(ExecutionState.FAILED)
                        break

                # Dispatch ready tasks in parallel
                dispatch_tasks = []
                for task in ready_tasks:
                    if task.requires_approval and task.status != TaskStatus.READY:
                        await self._request_task_approval(session, task, scheduler)
                    else:
                        dispatch_tasks.append(task)

                if dispatch_tasks:
                    results = await asyncio.gather(
                        *[
                            self._execute_task(session, task, scheduler)
                            for task in dispatch_tasks
                        ],
                        return_exceptions=True,
                    )

                    for task, result in zip(dispatch_tasks, results):
                        if isinstance(result, Exception):
                            await self._handle_task_failure(
                                session, task, scheduler, str(result)
                            )

                # If paused for approval, stop the loop
                if session.state == ExecutionState.PAUSED:
                    return

            # All tasks terminal
            if session.is_terminal:
                return

            if scheduler.has_failures:
                has_critical = any(
                    t.status == TaskStatus.FAILED
                    and t.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)
                    for t in plan.tasks
                )
                if has_critical:
                    session.transition_to(ExecutionState.FAILED)
                    session.emit(EventType.SESSION_FAILED, message="Critical task(s) failed")
                else:
                    session.transition_to(ExecutionState.COMPLETED)
                    session.emit(
                        EventType.SESSION_COMPLETED,
                        message="Completed with some non-critical failures",
                        data={"progress_pct": session.progress_pct},
                    )
            else:
                session.transition_to(ExecutionState.COMPLETED)
                session.emit(
                    EventType.SESSION_COMPLETED,
                    message="All tasks completed successfully",
                    data={"progress_pct": 100.0},
                )

            await self._stream.publish(session.session_id, session.execution_log[-1])
            await self._stream.end_session(session.session_id)
            await self._persist_session(session)
            asyncio.create_task(self._collect_feedback(session))

            logger.info(
                "orchestrator.execution_completed",
                session_id=str(session.session_id),
                state=session.state.value,
                completed=plan.completed_count,
                total=plan.task_count,
            )

        except Exception as exc:
            logger.exception(
                "orchestrator.execution_error",
                session_id=str(session.session_id),
                error=str(exc),
            )
            session.error = str(exc)
            if not session.is_terminal:
                session.transition_to(ExecutionState.FAILED)
            session.emit(EventType.SESSION_FAILED, message=str(exc))
            await self._stream.publish(session.session_id, session.execution_log[-1])
            await self._stream.end_session(session.session_id)
            await self._persist_session(session)
            asyncio.create_task(self._collect_feedback(session))

    async def _execute_task(
        self,
        session: AgentSession,
        task: TaskNode,
        scheduler: DAGScheduler,
    ) -> dict[str, Any]:
        """Execute a single task via the task dispatcher."""
        scheduler.mark_task_started(task.task_id)
        task.started_at = datetime.now(timezone.utc)

        session.emit(
            EventType.TASK_STARTED,
            message=f"Executing: {task.name}",
            task_id=task.task_id,
            data={
                "task_type": task.task_type.value,
                "risk_level": task.risk_level.value,
            },
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

        start = time.perf_counter()

        try:
            if self._task_dispatcher:
                result = await self._task_dispatcher(
                    str(session.session_id), task.model_dump(mode="json")
                )
            else:
                # No dispatcher configured — mark as completed (for testing)
                result = {
                    "task_id": str(task.task_id),
                    "status": "completed",
                    "output": f"Task '{task.name}' executed (no dispatcher)",
                }

            duration_ms = (time.perf_counter() - start) * 1000
            task.completed_at = datetime.now(timezone.utc)

            if result.get("status") == "completed":
                scheduler.mark_task_completed(task.task_id, result.get("output"))
                session.emit(
                    EventType.TASK_COMPLETED,
                    message=f"Completed: {task.name}",
                    task_id=task.task_id,
                    data={
                        "duration_ms": duration_ms,
                        "output_summary": str(result.get("output", ""))[:200],
                    },
                )
            else:
                error = result.get("error", "Unknown error")
                await self._handle_task_failure(session, task, scheduler, error)

            await self._stream.publish(session.session_id, session.execution_log[-1])
            return result

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            await self._handle_task_failure(session, task, scheduler, str(exc))
            raise

    async def _handle_task_failure(
        self,
        session: AgentSession,
        task: TaskNode,
        scheduler: DAGScheduler,
        error: str,
    ) -> None:
        """Handle a task failure using the appropriate strategy."""
        strategy = session.get_failure_strategy(task.risk_level.value)
        task.retry_count += 1

        logger.warning(
            "orchestrator.task_failed",
            session_id=str(session.session_id),
            task_id=str(task.task_id),
            task_name=task.name,
            error=error,
            strategy=strategy.value,
            retry_count=task.retry_count,
        )

        # Retry if applicable and retries remaining
        if strategy == FailureStrategy.RETRY or task.retry_count < task.max_retries:
            if task.retry_count < task.max_retries:
                session.emit(
                    EventType.TASK_RETRYING,
                    message=f"Retrying {task.name} ({task.retry_count}/{task.max_retries})",
                    task_id=task.task_id,
                    data={"retry_count": task.retry_count, "error": error},
                )
                await self._stream.publish(
                    session.session_id, session.execution_log[-1]
                )
                task.status = TaskStatus.PENDING
                return

        scheduler.mark_task_failed(task.task_id, error)

        session.emit(
            EventType.TASK_FAILED,
            message=f"Failed: {task.name} — {error}",
            task_id=task.task_id,
            data={"error": error, "strategy": strategy.value},
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

        if strategy == FailureStrategy.CONTINUE:
            skipped = scheduler.skip_blocked_dependents(task.task_id)
            for s in skipped:
                session.emit(
                    EventType.TASK_SKIPPED,
                    message=f"Skipped: {s.name} (dependency failed)",
                    task_id=s.task_id,
                )

        elif strategy == FailureStrategy.FAIL_FAST:
            session.error = f"Critical task failed: {task.name} — {error}"
            session.transition_to(ExecutionState.FAILED)

        elif strategy == FailureStrategy.ROLLBACK:
            await self._rollback(session, scheduler)

    async def _request_task_approval(
        self,
        session: AgentSession,
        task: TaskNode,
        scheduler: DAGScheduler,
    ) -> None:
        """Request approval for a specific task."""
        scheduler.mark_task_awaiting_approval(task.task_id)

        approval = self._approvals.request_task_approval(
            session_id=session.session_id,
            task_id=task.task_id,
            requested_by=session.actor_id,
            reason=f"Task '{task.name}' is {task.risk_level.value} risk and requires approval",
            risk_level=task.risk_level.value,
        )
        session.pending_approvals.append(approval)

        session.emit(
            EventType.TASK_APPROVAL_REQUESTED,
            message=f"Approval required: {task.name}",
            task_id=task.task_id,
            data={
                "approval_id": str(approval.approval_id),
                "risk_level": task.risk_level.value,
                "task_type": task.task_type.value,
            },
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])

    # ── Rollback ─────────────────────────────────────────────────────────

    async def _rollback(
        self, session: AgentSession, scheduler: DAGScheduler
    ) -> None:
        """Roll back completed tasks in reverse order."""
        if not session.plan:
            return

        session.transition_to(ExecutionState.ROLLING_BACK)
        session.emit(EventType.ROLLBACK_STARTED, message="Rolling back completed tasks")
        await self._stream.publish(session.session_id, session.execution_log[-1])

        completed = [
            t
            for t in session.plan.tasks
            if t.status == TaskStatus.COMPLETED and t.rollback_action
        ]
        completed.sort(key=lambda t: t.completed_at or datetime.min, reverse=True)

        for task in completed:
            try:
                logger.info(
                    "orchestrator.rolling_back_task",
                    task_id=str(task.task_id),
                    task_name=task.name,
                    rollback_action=task.rollback_action,
                )
                if self._task_dispatcher and task.rollback_action:
                    rollback_node = TaskNode(
                        name=f"Rollback: {task.name}",
                        description=task.rollback_action,
                        task_type=task.task_type,
                        tool=task.tool,
                        tool_input={"rollback_action": task.rollback_action},
                    )
                    await self._task_dispatcher(
                        str(session.session_id),
                        rollback_node.model_dump(mode="json"),
                    )
                task.status = TaskStatus.ROLLED_BACK
            except Exception as exc:
                logger.error(
                    "orchestrator.rollback_failed",
                    task_id=str(task.task_id),
                    error=str(exc),
                )

        session.emit(
            EventType.ROLLBACK_COMPLETED,
            message=f"Rolled back {len(completed)} tasks",
        )
        await self._stream.publish(session.session_id, session.execution_log[-1])
        session.transition_to(ExecutionState.FAILED)

    # ── Session Management ───────────────────────────────────────────────

    async def cancel_session(self, session_id: UUID) -> AgentSession:
        """Cancel an in-progress session."""
        session = self._get_session(session_id)
        if session.is_terminal:
            raise ValueError(f"Session {session_id} is already {session.state.value}")

        session.transition_to(ExecutionState.CANCELLED)
        session.emit(EventType.SESSION_CANCELLED, message="Session cancelled by user")
        await self._stream.publish(session.session_id, session.execution_log[-1])
        await self._stream.end_session(session.session_id)
        await self._persist_session(session)
        asyncio.create_task(self._collect_feedback(session))

        logger.info("orchestrator.session_cancelled", session_id=str(session_id))
        return session

    def get_session(self, session_id: UUID) -> AgentSession | None:
        session = self._sessions.get(session_id)
        if session is None and self._session_store:
            # Note: This is sync context in the route handler.
            # For async fallback, use get_session_async instead.
            return None
        return session

    async def get_session_async(self, session_id: UUID) -> AgentSession | None:
        """Async version that falls back to persistent store."""
        session = self._sessions.get(session_id)
        if session is None and self._session_store:
            session = await self._session_store.load(session_id)
            if session:
                self._sessions[session_id] = session
        return session

    def _get_session(self, session_id: UUID) -> AgentSession:
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        return session

    def list_sessions(
        self,
        state: ExecutionState | None = None,
        actor_id: str | None = None,
    ) -> list[AgentSession]:
        """List sessions with optional filtering."""
        sessions = list(self._sessions.values())
        if state:
            sessions = [s for s in sessions if s.state == state]
        if actor_id:
            sessions = [s for s in sessions if s.actor_id == actor_id]
        return sorted(sessions, key=lambda s: s.created_at, reverse=True)

    async def list_sessions_async(
        self,
        state: ExecutionState | None = None,
        actor_id: str | None = None,
    ) -> list[AgentSession]:
        """Async version that queries persistent store when available."""
        if self._session_store:
            return await self._session_store.list_sessions(
                state=state, actor_id=actor_id
            )
        return self.list_sessions(state=state, actor_id=actor_id)

    @property
    def event_stream(self) -> EventStream:
        return self._stream

    @property
    def approval_controller(self) -> ApprovalController:
        return self._approvals
