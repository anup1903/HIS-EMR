"""Handler for CI_CD_TRIGGER tasks.

Triggers a GitHub Actions workflow run and polls for completion.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.pipeline import RAGPipeline

from aegisforge.executor.runner import TaskResult

logger = structlog.get_logger()

# Maximum time to poll for workflow completion (seconds)
_MAX_POLL_SECONDS = 1200
_POLL_INTERVAL_SECONDS = 15


async def handle_cicd_trigger(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Trigger a CI/CD workflow and optionally poll for completion.

    Workflow:
        1. Trigger a GitHub Actions workflow via the GitHub connector.
        2. If ``wait_for_completion`` is set, poll until the run finishes
           or the timeout is reached.
        3. Return the workflow run status.

    ``tool_input`` keys:
        - repo: str — owner/repo
        - workflow: str — workflow file name or ID
        - ref: str — branch/tag (default: "main")
        - inputs: dict — workflow dispatch inputs
        - wait_for_completion: bool — whether to poll (default: True)
    """
    log = logger.bind(task_id=str(task.task_id), handler="cicd_trigger")
    artifacts: list[dict[str, Any]] = []

    repo = task.tool_input.get("repo", "")
    workflow = task.tool_input.get("workflow", "")
    ref = task.tool_input.get("ref", "main")
    inputs = task.tool_input.get("inputs", {})
    wait = task.tool_input.get("wait_for_completion", True)

    if not workflow:
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error="Missing required 'workflow' in tool_input.",
        )

    # ── 1. Trigger workflow ─────────────────────────────────────────────
    trigger_result = await connector_hub.execute(
        "github",
        "trigger_workflow",
        {
            "repo": repo,
            "workflow": workflow,
            "ref": ref,
            "inputs": inputs,
        },
    )

    if not trigger_result.success:
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error=f"Failed to trigger workflow: {trigger_result.error}",
        )

    run_id = None
    if isinstance(trigger_result.data, dict):
        run_id = trigger_result.data.get("run_id")

    log.info("cicd.workflow_triggered", workflow=workflow, ref=ref, run_id=run_id)
    artifacts.append({
        "type": "workflow_run",
        "workflow": workflow,
        "ref": ref,
        "run_id": run_id,
    })

    # ── 2. Optionally poll for completion ───────────────────────────────
    if not wait or run_id is None:
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.COMPLETED,
            output={"workflow": workflow, "run_id": run_id, "triggered": True},
            artifacts=artifacts,
        )

    elapsed = 0.0
    final_status = "unknown"
    conclusion = "unknown"

    while elapsed < _MAX_POLL_SECONDS:
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        elapsed += _POLL_INTERVAL_SECONDS

        status_result = await connector_hub.execute(
            "github",
            "get_workflow_run",
            {"repo": repo, "run_id": run_id},
        )

        if not status_result.success:
            log.warning("cicd.poll_failed", error=status_result.error)
            continue

        if isinstance(status_result.data, dict):
            final_status = status_result.data.get("status", "unknown")
            conclusion = status_result.data.get("conclusion", "")

            if final_status == "completed":
                log.info(
                    "cicd.workflow_completed",
                    conclusion=conclusion,
                    elapsed_seconds=elapsed,
                )
                break

    is_success = conclusion == "success"
    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED if is_success else TaskStatus.FAILED,
        output={
            "workflow": workflow,
            "run_id": run_id,
            "status": final_status,
            "conclusion": conclusion,
            "elapsed_seconds": elapsed,
        },
        error=f"Workflow concluded with '{conclusion}'" if not is_success else None,
        artifacts=artifacts,
    )
