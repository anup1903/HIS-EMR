"""Executor workers — Celery-based task execution engine.

Dispatches TaskNode instances to type-specific handlers, manages retries,
rollbacks, and emits audit events + Prometheus metrics for every execution.
"""

from aegisforge.executor.worker import celery_app, execute_task

__all__ = [
    "celery_app",
    "execute_task",
]
