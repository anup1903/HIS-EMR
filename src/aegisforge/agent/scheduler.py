"""DAG task scheduler — computes ready tasks and manages execution order."""

from __future__ import annotations

from uuid import UUID

import structlog

from aegisforge.planner.models import Plan, TaskNode, TaskStatus

logger = structlog.get_logger()


class DAGScheduler:
    """Computes which tasks are ready to execute based on dependency resolution.

    Uses the Plan's DAG structure to determine which tasks can run in parallel
    and which must wait for dependencies.
    """

    def __init__(self, plan: Plan) -> None:
        self._plan = plan
        self._task_map: dict[UUID, TaskNode] = {t.task_id: t for t in plan.tasks}

    def get_ready_tasks(self) -> list[TaskNode]:
        """Return tasks whose dependencies are all satisfied and are ready to run."""
        completed_ids = {
            t.task_id
            for t in self._plan.tasks
            if t.status in (TaskStatus.COMPLETED, TaskStatus.SKIPPED)
        }
        ready = []
        for task in self._plan.tasks:
            if task.status not in (TaskStatus.PENDING, TaskStatus.READY):
                continue
            if all(dep in completed_ids for dep in task.depends_on):
                ready.append(task)

        if ready:
            logger.info(
                "scheduler.ready_tasks",
                count=len(ready),
                task_names=[t.name for t in ready],
            )
        return ready

    def mark_task_started(self, task_id: UUID) -> None:
        """Mark a task as in-progress."""
        task = self._task_map.get(task_id)
        if task:
            task.status = TaskStatus.IN_PROGRESS

    def mark_task_completed(self, task_id: UUID, output: any = None) -> None:
        """Mark a task as completed with optional output."""
        task = self._task_map.get(task_id)
        if task:
            task.status = TaskStatus.COMPLETED
            task.output = output
            logger.info("scheduler.task_completed", task_id=str(task_id), name=task.name)

    def mark_task_failed(self, task_id: UUID, error: str) -> None:
        """Mark a task as failed."""
        task = self._task_map.get(task_id)
        if task:
            task.status = TaskStatus.FAILED
            task.error = error
            logger.warning("scheduler.task_failed", task_id=str(task_id), error=error)

    def mark_task_skipped(self, task_id: UUID, reason: str = "") -> None:
        """Mark a task as skipped (non-critical failure or dependency skip)."""
        task = self._task_map.get(task_id)
        if task:
            task.status = TaskStatus.SKIPPED
            task.error = reason
            logger.info("scheduler.task_skipped", task_id=str(task_id), reason=reason)

    def mark_task_awaiting_approval(self, task_id: UUID) -> None:
        """Mark a task as waiting for human approval."""
        task = self._task_map.get(task_id)
        if task:
            task.status = TaskStatus.AWAITING_APPROVAL

    def get_blocked_dependents(self, failed_task_id: UUID) -> list[TaskNode]:
        """Find all tasks that depend (directly or transitively) on a failed task."""
        blocked: list[TaskNode] = []
        to_check = {failed_task_id}
        checked: set[UUID] = set()

        while to_check:
            current = to_check.pop()
            checked.add(current)
            for task in self._plan.tasks:
                if current in task.depends_on and task.task_id not in checked:
                    blocked.append(task)
                    to_check.add(task.task_id)

        return blocked

    def skip_blocked_dependents(self, failed_task_id: UUID) -> list[TaskNode]:
        """Skip all tasks that transitively depend on a failed task."""
        dependents = self.get_blocked_dependents(failed_task_id)
        for task in dependents:
            self.mark_task_skipped(
                task.task_id,
                reason=f"Skipped: dependency {failed_task_id} failed",
            )
        return dependents

    @property
    def all_terminal(self) -> bool:
        """Check if all tasks have reached a terminal state."""
        terminal_states = {
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.SKIPPED,
            TaskStatus.ROLLED_BACK,
        }
        return all(t.status in terminal_states for t in self._plan.tasks)

    @property
    def has_failures(self) -> bool:
        return any(t.status == TaskStatus.FAILED for t in self._plan.tasks)

    @property
    def in_progress_count(self) -> int:
        return sum(1 for t in self._plan.tasks if t.status == TaskStatus.IN_PROGRESS)

    @property
    def pending_approvals(self) -> list[TaskNode]:
        return [t for t in self._plan.tasks if t.status == TaskStatus.AWAITING_APPROVAL]
