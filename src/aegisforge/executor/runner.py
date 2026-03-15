"""Task runner — dispatches a TaskNode to its type-specific handler.

The runner is the core dispatch layer between the Celery worker and the
individual handler modules. It resolves the correct handler based on
``TaskNode.task_type``, invokes it, and returns a normalised ``TaskResult``.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Coroutine
from uuid import UUID

import structlog
from pydantic import BaseModel, Field

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier
from aegisforge.observability.metrics import MetricsRegistry, get_metrics
from aegisforge.planner.models import TaskNode, TaskStatus, TaskType
from aegisforge.rag.pipeline import RAGPipeline

logger = structlog.get_logger()


class TaskResult(BaseModel):
    """Normalised result produced by every task handler."""

    task_id: UUID
    status: TaskStatus = TaskStatus.COMPLETED
    output: Any = None
    error: str | None = None
    duration_ms: float = 0.0
    artifacts: list[dict[str, Any]] = Field(default_factory=list)


# Type alias for handler callables
HandlerFn = Callable[
    [TaskNode, LLMClient, RAGPipeline | None, ConnectorHub],
    Coroutine[Any, Any, TaskResult],
]


class TaskRunner:
    """Dispatch a TaskNode to the appropriate async handler.

    Usage::

        runner = TaskRunner(connector_hub, llm_client, rag_pipeline)
        result = await runner.run(task_node)
    """

    def __init__(
        self,
        connector_hub: ConnectorHub,
        llm_client: LLMClient,
        rag_pipeline: RAGPipeline | None = None,
        metrics: MetricsRegistry | None = None,
    ) -> None:
        self._hub = connector_hub
        self._llm = llm_client
        self._rag = rag_pipeline
        self._metrics = metrics or get_metrics()

        # Lazy-import handlers to avoid circular imports and keep the
        # module import lightweight.
        from aegisforge.executor.handlers.analysis import handle_analysis
        from aegisforge.executor.handlers.approval import handle_approval_gate
        from aegisforge.executor.handlers.cicd import handle_cicd_trigger
        from aegisforge.executor.handlers.code import (
            handle_code_generation,
            handle_code_modification,
        )
        from aegisforge.executor.handlers.docs import handle_documentation
        from aegisforge.executor.handlers.migration import handle_db_migration
        from aegisforge.executor.handlers.notification import handle_notification
        from aegisforge.executor.handlers.review import handle_code_review
        from aegisforge.executor.handlers.test import (
            handle_test_creation,
            handle_test_execution,
        )

        self._handlers: dict[TaskType, HandlerFn] = {
            TaskType.CODE_GENERATION: handle_code_generation,
            TaskType.CODE_MODIFICATION: handle_code_modification,
            TaskType.CODE_REVIEW: handle_code_review,
            TaskType.TEST_CREATION: handle_test_creation,
            TaskType.TEST_EXECUTION: handle_test_execution,
            TaskType.CI_CD_TRIGGER: handle_cicd_trigger,
            TaskType.DB_MIGRATION: handle_db_migration,
            TaskType.API_CALL: self._handle_api_call,
            TaskType.INFRASTRUCTURE: self._handle_infrastructure,
            TaskType.DOCUMENTATION: handle_documentation,
            TaskType.APPROVAL_GATE: handle_approval_gate,
            TaskType.ANALYSIS: handle_analysis,
            TaskType.NOTIFICATION: handle_notification,
        }

    async def run(self, task: TaskNode) -> TaskResult:
        """Execute *task* via its registered handler.

        Wraps every handler call with structured logging, metrics emission,
        and error normalisation so callers always receive a ``TaskResult``.
        """
        handler = self._handlers.get(task.task_type)
        if handler is None:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"No handler registered for task type: {task.task_type.value}",
            )

        log = logger.bind(
            task_id=str(task.task_id),
            task_type=task.task_type.value,
            task_name=task.name,
        )

        self._metrics.tasks_in_progress.labels(task_type=task.task_type.value).inc()
        start = time.perf_counter()

        try:
            log.info("task_runner.handler_start")
            result = await handler(task, self._llm, self._rag, self._hub)
            elapsed_ms = (time.perf_counter() - start) * 1000
            result.duration_ms = elapsed_ms

            log.info(
                "task_runner.handler_complete",
                status=result.status.value,
                duration_ms=round(elapsed_ms, 2),
            )
            return result

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.error(
                "task_runner.handler_error",
                error=str(exc),
                duration_ms=round(elapsed_ms, 2),
                exc_info=True,
            )
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=str(exc),
                duration_ms=elapsed_ms,
            )

        finally:
            self._metrics.tasks_in_progress.labels(
                task_type=task.task_type.value,
            ).dec()

    # ── Inline handlers for simple pass-through types ────────────────────

    @staticmethod
    async def _handle_api_call(
        task: TaskNode,
        llm_client: LLMClient,
        rag_pipeline: RAGPipeline | None,
        connector_hub: ConnectorHub,
    ) -> TaskResult:
        """Execute a generic outbound API call via the ConnectorHub."""
        connector_name = task.tool or "http"
        action = task.tool_input.get("action", "request")
        params = task.tool_input.get("params", {})

        result = await connector_hub.execute(connector_name, action, params)

        if result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.COMPLETED,
                output=result.data,
                artifacts=[{"type": "api_response", "data": result.data}],
            )
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error=result.error,
        )

    @staticmethod
    async def _handle_infrastructure(
        task: TaskNode,
        llm_client: LLMClient,
        rag_pipeline: RAGPipeline | None,
        connector_hub: ConnectorHub,
    ) -> TaskResult:
        """Execute infrastructure operations via the appropriate connector."""
        connector_name = task.tool or "shell"
        action = task.tool_input.get("action", "run")
        params = task.tool_input.get("params", {})

        result = await connector_hub.execute(connector_name, action, params)

        if result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.COMPLETED,
                output=result.data,
                artifacts=[{"type": "infra_result", "data": result.data}],
            )
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error=result.error,
        )
