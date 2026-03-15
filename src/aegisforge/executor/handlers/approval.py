"""Handler for APPROVAL_GATE tasks.

Sends an approval request via the appropriate channel (Slack by default)
and returns an AWAITING_APPROVAL status. The orchestration layer is
responsible for polling or receiving the webhook when approval is granted.
"""

from __future__ import annotations

import json
from typing import Any

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.pipeline import RAGPipeline

from aegisforge.executor.runner import TaskResult

logger = structlog.get_logger()


async def handle_approval_gate(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Request approval from a human operator.

    The handler sends an interactive approval request (typically via Slack)
    and immediately returns ``AWAITING_APPROVAL``. The orchestrator must
    handle the asynchronous approval flow (webhook callback, polling, or
    manual status update).

    ``tool_input`` keys:
        - approvers: list[str] — user IDs / email addresses to notify
        - channel: str — Slack channel for the request
        - context: str — human-readable summary of what's being approved
        - risk_level: str — risk label shown in the message
        - deadline_minutes: int — auto-reject after N minutes (optional)
    """
    log = logger.bind(task_id=str(task.task_id), handler="approval_gate")

    connector_name = task.tool or "slack"
    approvers = task.tool_input.get("approvers", [])
    channel = task.tool_input.get("channel", "")
    context = task.tool_input.get("context", task.description)
    risk_level = task.tool_input.get("risk_level", task.risk_level.value)
    deadline_minutes = task.tool_input.get("deadline_minutes")

    # Build approval message
    approver_mentions = " ".join(f"<@{a}>" for a in approvers) if approvers else ""
    deadline_text = f"\nAuto-rejects in {deadline_minutes} minutes." if deadline_minutes else ""

    approval_message = (
        f":warning: *Approval Required*\n\n"
        f"*Task:* {task.name}\n"
        f"*Risk Level:* {risk_level}\n"
        f"*Description:* {context}\n"
        f"{approver_mentions}"
        f"{deadline_text}\n\n"
        f"React with :white_check_mark: to approve or :x: to reject.\n"
        f"Task ID: `{task.task_id}`"
    )

    # Send approval request
    send_result = await connector_hub.execute(
        connector_name,
        "send_message",
        {
            "channel": channel,
            "text": approval_message,
            "metadata": {
                "task_id": str(task.task_id),
                "type": "approval_request",
                "approvers": approvers,
                "deadline_minutes": deadline_minutes,
            },
        },
    )

    if not send_result.success:
        log.error("approval_gate.send_failed", error=send_result.error)
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error=f"Failed to send approval request: {send_result.error}",
        )

    message_id = None
    if isinstance(send_result.data, dict):
        message_id = send_result.data.get("ts") or send_result.data.get("message_id")

    log.info(
        "approval_gate.request_sent",
        channel=channel,
        approvers=approvers,
        message_id=message_id,
    )

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.AWAITING_APPROVAL,
        output={
            "approval_requested": True,
            "channel": channel,
            "message_id": message_id,
            "approvers": approvers,
            "deadline_minutes": deadline_minutes,
        },
        artifacts=[
            {
                "type": "approval_request",
                "channel": channel,
                "message_id": message_id,
            },
        ],
    )
