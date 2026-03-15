"""Handler for CODE_REVIEW tasks.

Fetches a pull request diff, retrieves coding standards from the
knowledge base, and uses the ADVANCED-tier LLM to produce a structured
code review with inline comments.
"""

from __future__ import annotations

from typing import Any

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.pipeline import RAGPipeline

from aegisforge.executor.runner import TaskResult

logger = structlog.get_logger()

_REVIEW_SYSTEM = (
    "You are a senior software engineer performing a thorough code review. "
    "Evaluate the diff for:\n"
    "1. Correctness and potential bugs\n"
    "2. Security vulnerabilities (injection, secrets, etc.)\n"
    "3. Performance concerns\n"
    "4. Adherence to project coding standards\n"
    "5. Test coverage gaps\n"
    "6. Documentation completeness\n\n"
    "Format your review as a structured JSON with:\n"
    '  "summary": one-paragraph overall assessment,\n'
    '  "verdict": "approve" | "request_changes" | "comment",\n'
    '  "issues": [{"severity": "critical|major|minor|nit", '
    '"file": "...", "line": N, "comment": "..."}],\n'
    '  "positives": ["...list of things done well..."]\n'
    "Output ONLY valid JSON."
)


async def handle_code_review(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Review a pull request diff and post comments.

    Workflow:
        1. Fetch the PR diff via the GitHub connector.
        2. Query RAG for coding standards and conventions.
        3. Submit the diff + standards to the ADVANCED-tier LLM.
        4. Post the review back via the GitHub connector.
        5. Return the review summary.
    """
    log = logger.bind(task_id=str(task.task_id), handler="code_review")
    artifacts: list[dict[str, Any]] = []

    repo = task.tool_input.get("repo", "")
    pr_number = task.tool_input.get("pr_number")

    # ── 1. Get PR diff ──────────────────────────────────────────────────
    diff_text = ""
    if task.tool == "github" and pr_number is not None:
        diff_result = await connector_hub.execute(
            "github",
            "get_pr_diff",
            {"repo": repo, "pr_number": pr_number},
        )
        if diff_result.success:
            diff_text = diff_result.data if isinstance(diff_result.data, str) else str(diff_result.data)
            log.info("code_review.diff_fetched", diff_length=len(diff_text))
        else:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to fetch PR diff: {diff_result.error}",
            )
    elif task.tool_input.get("diff"):
        diff_text = task.tool_input["diff"]

    if not diff_text:
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error="No diff available for review — provide pr_number or diff in tool_input.",
        )

    # ── 2. RAG: coding standards ────────────────────────────────────────
    standards_context = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query="coding standards code review guidelines conventions",
                collection="docs",
            )
            standards_context = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
        except Exception as exc:
            log.warning("code_review.rag_failed", error=str(exc))

    # ── 3. LLM review ──────────────────────────────────────────────────
    prompt_parts = [f"## Pull Request Diff\n```diff\n{diff_text[:12000]}\n```"]

    if task.description:
        prompt_parts.insert(0, f"## Review Focus\n{task.description}")

    if standards_context:
        prompt_parts.append(
            f"## Project Coding Standards\n{standards_context[:3000]}"
        )

    prompt = "\n\n".join(prompt_parts)

    review_text = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.ADVANCED,
        system_prompt=_REVIEW_SYSTEM,
        temperature=0.0,
        max_tokens=4096,
    )

    log.info("code_review.llm_complete", review_length=len(review_text))

    # ── 4. Post review via GitHub connector ─────────────────────────────
    if task.tool == "github" and pr_number is not None:
        post_result = await connector_hub.execute(
            "github",
            "post_review",
            {
                "repo": repo,
                "pr_number": pr_number,
                "body": review_text,
            },
        )
        if post_result.success:
            artifacts.append({
                "type": "code_review",
                "pr_number": pr_number,
                "repo": repo,
            })
            log.info("code_review.posted", pr_number=pr_number)
        else:
            log.warning("code_review.post_failed", error=post_result.error)

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=review_text,
        artifacts=artifacts,
    )
