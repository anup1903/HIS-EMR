"""Handler for NOTIFICATION tasks.

Dispatches notifications to Slack or PagerDuty via the ConnectorHub,
based on the ``task.tool`` field.
"""

from __future__ import annotations

from typing import Any

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.pipeline import RAGPipeline

from aegisforge.executor.runner import TaskResult

logger = structlog.get_logger()


async def handle_notification(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Send a notification via Slack, PagerDuty, or another channel.

    ``tool_input`` keys:
        - channel: str — Slack channel or PagerDuty routing key
        - message: str — notification body (falls back to task.description)
        - severity: str — "info" | "warning" | "critical" (PagerDuty only)
        - title: str — notification title (optional)
    """
    log = logger.bind(task_id=str(task.task_id), handler="notification")

    connector_name = task.tool or "slack"
    channel = task.tool_input.get("channel", "")
    message = task.tool_input.get("message", task.description)
    title = task.tool_input.get("title", task.name)
    severity = task.tool_input.get("severity", "info")

    if not message:
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error="No notification message provided.",
        )

    # ── Dispatch based on connector type ────────────────────────────────
    if connector_name == "pagerduty":
        result = await connector_hub.execute(
            "pagerduty",
            "trigger",
            {
                "routing_key": channel,
                "summary": f"[AegisForge] {title}: {message}",
                "severity": severity,
                "source": "aegisforge-executor",
            },
        )
    else:
        # Default to Slack
        result = await connector_hub.execute(
            "slack",
            "send_message",
            {
                "channel": channel,
                "text": f"*{title}*\n{message}",
            },
        )

    if result.success:
        log.info(
            "notification.sent",
            connector=connector_name,
            channel=channel,
        )
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.COMPLETED,
            output={"connector": connector_name, "channel": channel, "sent": True},
            artifacts=[{"type": "notification", "connector": connector_name}],
        )

    log.error(
        "notification.failed",
        connector=connector_name,
        error=result.error,
    )
    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.FAILED,
        error=f"Notification failed via {connector_name}: {result.error}",
    )
