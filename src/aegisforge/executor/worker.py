"""Celery application and top-level task definition.

The ``execute_task`` Celery task is the single entry-point that the
orchestration layer enqueues. It deserialises a ``TaskNode`` dict,
delegates to :class:`~aegisforge.executor.runner.TaskRunner`, and
returns a normalised result dict.

Retry policy:
  - Exponential back-off: 10 s × 2^retry  (10 s, 20 s, 40 s …)
  - Maximum retries driven by ``TaskNode.max_retries``
  - ``SoftTimeLimitExceeded`` is treated as a non-retryable failure
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import structlog
from celery import Celery
from celery.exceptions import SoftTimeLimitExceeded

from aegisforge.config import get_settings
from aegisforge.observability.metrics import get_metrics
from aegisforge.planner.models import TaskNode, TaskStatus

logger = structlog.get_logger()

# ── Celery application ──────────────────────────────────────────────────

_settings = get_settings()
_broker_url = _settings.redis_url.get_secret_value()

celery_app = Celery("aegisforge", broker=_broker_url)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_soft_time_limit=_settings.task_timeout_seconds,
    task_time_limit=_settings.task_timeout_seconds + 60,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_backend=_broker_url,
)


def _get_runner():
    """Lazily build a TaskRunner with real service instances.

    Deferred to call-time so that Celery workers import fast and
    expensive model loading only happens when work is dispatched.
    """
    from aegisforge.connectors import ConnectorHub
    from aegisforge.executor.runner import TaskRunner
    from aegisforge.llm.client import get_llm_client

    # ConnectorHub is expected to be constructed without arguments;
    # individual connectors are registered by the application bootstrap.
    hub = ConnectorHub()
    llm = get_llm_client()
    # RAG pipeline requires a DB session; handlers that need it will
    # create one on-the-fly via the session factory.
    return TaskRunner(connector_hub=hub, llm_client=llm, rag_pipeline=None)


@celery_app.task(
    bind=True,
    name="aegisforge.execute_task",
    max_retries=None,  # We manage retries ourselves via TaskNode.max_retries
    acks_late=True,
)
def execute_task(self, session_id: str, task_node_dict: dict[str, Any]) -> dict[str, Any]:
    """Execute a single TaskNode inside a Celery worker.

    This is a *synchronous* Celery task that bridges into the async
    world via ``asyncio.run()``.

    Args:
        session_id: Correlation identifier for the orchestration session.
        task_node_dict: Serialised ``TaskNode`` (from ``model_dump(mode='json')``).

    Returns:
        Dict with keys: task_id, status, output, error, duration_ms.
    """
    metrics = get_metrics()
    log = logger.bind(session_id=session_id)

    # ── 1. Deserialise ──────────────────────────────────────────────────
    try:
        task = TaskNode.model_validate(task_node_dict)
    except Exception as exc:
        log.error("execute_task.deserialise_failed", error=str(exc))
        return {
            "task_id": task_node_dict.get("task_id", "unknown"),
            "status": TaskStatus.FAILED.value,
            "output": None,
            "error": f"Failed to deserialise TaskNode: {exc}",
            "duration_ms": 0.0,
        }

    log = log.bind(task_id=str(task.task_id), task_type=task.task_type.value)

    # ── 2. Mark IN_PROGRESS ─────────────────────────────────────────────
    task.status = TaskStatus.IN_PROGRESS
    log.info("execute_task.started")
    metrics.tasks_in_progress.labels(task_type=task.task_type.value).inc()

    start = time.perf_counter()

    try:
        # ── 3. Delegate to TaskRunner ───────────────────────────────────
        runner = _get_runner()
        result = asyncio.run(runner.run(task))
        elapsed_ms = (time.perf_counter() - start) * 1000

        # ── 4. Emit metrics ─────────────────────────────────────────────
        metrics.tasks_total.labels(
            task_type=task.task_type.value,
            status=result.status.value,
        ).inc()
        metrics.task_duration.labels(task_type=task.task_type.value).observe(
            elapsed_ms / 1000,
        )

        log.info(
            "execute_task.completed",
            status=result.status.value,
            duration_ms=round(elapsed_ms, 2),
        )

        return {
            "task_id": str(result.task_id),
            "status": result.status.value,
            "output": result.output,
            "error": result.error,
            "duration_ms": round(elapsed_ms, 2),
            "artifacts": [a for a in result.artifacts],
        }

    except SoftTimeLimitExceeded:
        elapsed_ms = (time.perf_counter() - start) * 1000
        error_msg = (
            f"Task timed out after {_settings.task_timeout_seconds}s "
            f"(soft limit exceeded)"
        )
        log.error("execute_task.timeout", duration_ms=round(elapsed_ms, 2))
        metrics.tasks_total.labels(
            task_type=task.task_type.value,
            status=TaskStatus.FAILED.value,
        ).inc()
        return {
            "task_id": str(task.task_id),
            "status": TaskStatus.FAILED.value,
            "output": None,
            "error": error_msg,
            "duration_ms": round(elapsed_ms, 2),
        }

    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.error(
            "execute_task.failed",
            error=str(exc),
            retry_count=task.retry_count,
            max_retries=task.max_retries,
            duration_ms=round(elapsed_ms, 2),
            exc_info=True,
        )

        # ── 5. Retry with exponential back-off ─────────────────────────
        if task.retry_count < task.max_retries:
            backoff = 10 * (2 ** task.retry_count)
            task.retry_count += 1
            log.info(
                "execute_task.scheduling_retry",
                retry_count=task.retry_count,
                backoff_seconds=backoff,
            )
            metrics.tasks_total.labels(
                task_type=task.task_type.value,
                status="retrying",
            ).inc()
            raise self.retry(
                exc=exc,
                countdown=backoff,
                kwargs={
                    "session_id": session_id,
                    "task_node_dict": task.model_dump(mode="json"),
                },
            )

        metrics.tasks_total.labels(
            task_type=task.task_type.value,
            status=TaskStatus.FAILED.value,
        ).inc()
        return {
            "task_id": str(task.task_id),
            "status": TaskStatus.FAILED.value,
            "output": None,
            "error": str(exc),
            "duration_ms": round(elapsed_ms, 2),
        }

    finally:
        metrics.tasks_in_progress.labels(task_type=task.task_type.value).dec()
