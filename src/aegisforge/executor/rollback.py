"""Rollback engine — reverses completed tasks in a plan on failure.

When a plan partially executes and a task fails, the rollback engine
walks backward through completed tasks and executes each one's
``rollback_action``. Rollback actions are dispatched via the ConnectorHub.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.observability.metrics import MetricsRegistry, get_metrics
from aegisforge.planner.models import Plan, TaskNode, TaskStatus

logger = structlog.get_logger()


class RollbackEngine:
    """Reverse completed tasks in a plan when a failure occurs.

    Rollback actions are defined as JSON strings on each ``TaskNode``:
        ``{"connector": "github", "action": "delete_branch", "params": {...}}``

    The engine processes tasks in reverse-completion order and continues
    even if individual rollbacks fail (best-effort).

    Usage::

        engine = RollbackEngine(connector_hub)
        results = await engine.rollback_plan(plan)
        # or roll back up to a specific task:
        results = await engine.rollback_plan(plan, up_to_task_id=some_id)
    """

    def __init__(
        self,
        connector_hub: ConnectorHub,
        metrics: MetricsRegistry | None = None,
    ) -> None:
        self._hub = connector_hub
        self._metrics = metrics or get_metrics()

    async def rollback_plan(
        self,
        plan: Plan,
        up_to_task_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Roll back completed tasks in reverse chronological order.

        Args:
            plan: The plan containing tasks to roll back.
            up_to_task_id: If provided, only roll back tasks completed
                after (and including) this task. If ``None``, roll back
                all completed tasks.

        Returns:
            List of result dicts, one per rollback attempt:
            ``[{"task_id": ..., "task_name": ..., "status": ..., "error": ...}]``
        """
        log = logger.bind(plan_id=str(plan.plan_id))

        # Collect completed tasks with rollback actions
        completed = [
            t for t in plan.tasks
            if t.status == TaskStatus.COMPLETED and t.rollback_action
        ]

        # Sort by completion time, most recent first
        completed.sort(
            key=lambda t: t.completed_at or t.started_at or "",
            reverse=True,
        )

        # If up_to_task_id is specified, only include tasks completed
        # at or after the target task
        if up_to_task_id is not None:
            target_task = plan.get_task(up_to_task_id)
            if target_task and target_task.completed_at:
                cutoff = target_task.completed_at
                completed = [
                    t for t in completed
                    if t.completed_at is not None and t.completed_at >= cutoff
                ]

        if not completed:
            log.info("rollback.nothing_to_rollback")
            return []

        log.info("rollback.starting", tasks_to_rollback=len(completed))
        results: list[dict[str, Any]] = []

        for task in completed:
            result = await self._rollback_single(task)
            results.append(result)

        succeeded = sum(1 for r in results if r["status"] == "rolled_back")
        failed = sum(1 for r in results if r["status"] == "rollback_failed")
        log.info(
            "rollback.completed",
            total=len(results),
            succeeded=succeeded,
            failed=failed,
        )

        return results

    async def _rollback_single(self, task: TaskNode) -> dict[str, Any]:
        """Execute the rollback action for a single task.

        Parses the ``rollback_action`` string as JSON and dispatches via
        the ConnectorHub. Updates the task status on success.
        """
        log = logger.bind(
            task_id=str(task.task_id),
            task_name=task.name,
        )

        try:
            action_spec = self._parse_rollback_action(task.rollback_action or "")
        except ValueError as exc:
            log.warning("rollback.parse_failed", error=str(exc))
            return {
                "task_id": str(task.task_id),
                "task_name": task.name,
                "status": "rollback_failed",
                "error": f"Invalid rollback_action format: {exc}",
            }

        connector = action_spec["connector"]
        action = action_spec["action"]
        params = action_spec.get("params", {})

        log.info(
            "rollback.executing",
            connector=connector,
            action=action,
        )

        try:
            result = await self._hub.execute(connector, action, params)

            if result.success:
                task.status = TaskStatus.ROLLED_BACK
                self._metrics.tasks_total.labels(
                    task_type=task.task_type.value,
                    status="rolled_back",
                ).inc()
                log.info("rollback.task_rolled_back")
                return {
                    "task_id": str(task.task_id),
                    "task_name": task.name,
                    "status": "rolled_back",
                    "error": None,
                }
            else:
                log.warning("rollback.connector_failed", error=result.error)
                return {
                    "task_id": str(task.task_id),
                    "task_name": task.name,
                    "status": "rollback_failed",
                    "error": result.error,
                }

        except Exception as exc:
            log.error(
                "rollback.exception",
                error=str(exc),
                exc_info=True,
            )
            return {
                "task_id": str(task.task_id),
                "task_name": task.name,
                "status": "rollback_failed",
                "error": str(exc),
            }

    @staticmethod
    def _parse_rollback_action(action_str: str) -> dict[str, Any]:
        """Parse a rollback action specification.

        Accepted formats:
            - JSON: ``{"connector": "github", "action": "delete_branch", "params": {...}}``
            - Simple: ``"connector:action"`` (no params)

        Raises:
            ValueError: If the string cannot be parsed or is missing required fields.
        """
        if not action_str.strip():
            raise ValueError("Empty rollback_action string")

        # Try JSON first
        action_str = action_str.strip()
        if action_str.startswith("{"):
            try:
                spec = json.loads(action_str)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in rollback_action: {exc}") from exc

            if "connector" not in spec or "action" not in spec:
                raise ValueError(
                    "rollback_action JSON must contain 'connector' and 'action' keys"
                )
            return spec

        # Try simple "connector:action" format
        if ":" in action_str:
            parts = action_str.split(":", 1)
            return {
                "connector": parts[0].strip(),
                "action": parts[1].strip(),
                "params": {},
            }

        raise ValueError(
            f"Cannot parse rollback_action: '{action_str}'. "
            "Expected JSON object or 'connector:action' format."
        )
