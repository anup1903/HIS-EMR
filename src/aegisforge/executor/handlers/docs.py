"""Handler for DOCUMENTATION tasks.

Uses the STANDARD-tier LLM to generate or update documentation,
then commits the result to GitHub.
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

_DOCS_SYSTEM = (
    "You are a technical writer. Generate clear, comprehensive documentation "
    "that follows best practices:\n"
    "- Use Markdown formatting\n"
    "- Include a table of contents for long documents\n"
    "- Provide code examples where appropriate\n"
    "- Use consistent heading hierarchy\n"
    "- Include prerequisite/setup sections when relevant\n"
    "Output ONLY the Markdown content."
)


async def handle_documentation(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Generate or update documentation.

    Workflow:
        1. If updating existing docs, read the current content.
        2. Query RAG for relevant code / API signatures.
        3. Use the STANDARD-tier LLM to generate documentation.
        4. Commit the result to GitHub.

    ``tool_input`` keys:
        - repo: str — owner/repo
        - file_path: str — docs file path (e.g., "docs/api.md")
        - doc_type: str — "api", "guide", "runbook", "changelog", etc.
        - update_existing: bool — read and update vs generate fresh
    """
    log = logger.bind(task_id=str(task.task_id), handler="documentation")
    artifacts: list[dict[str, Any]] = []

    repo = task.tool_input.get("repo", "")
    file_path = task.tool_input.get("file_path", "docs/generated.md")
    doc_type = task.tool_input.get("doc_type", "documentation")
    update_existing = task.tool_input.get("update_existing", False)
    branch_name = task.tool_input.get(
        "branch", f"aegis/docs/{task.task_id!s:.8}",
    )

    # ── 1. Read existing docs (if updating) ─────────────────────────────
    existing_content = ""
    if update_existing and task.tool == "github":
        read_result = await connector_hub.execute(
            "github", "read_file", {"repo": repo, "path": file_path},
        )
        if read_result.success:
            existing_content = read_result.data if isinstance(read_result.data, str) else str(read_result.data)
            log.info("docs.existing_read", length=len(existing_content))

    # ── 2. RAG for code context ─────────────────────────────────────────
    code_context = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query=task.description,
                collection="codebase",
            )
            code_context = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
        except Exception as exc:
            log.warning("docs.rag_failed", error=str(exc))

    # ── 3. LLM documentation generation ────────────────────────────────
    prompt_parts = [f"## Documentation Task\n{task.description}"]
    prompt_parts.append(f"## Document Type\n{doc_type}")

    if existing_content:
        prompt_parts.append(
            f"## Current Document Content\n```markdown\n{existing_content[:5000]}\n```\n"
            "Update and improve the above document."
        )

    if code_context:
        prompt_parts.append(
            f"## Relevant Source Code\n```\n{code_context[:5000]}\n```"
        )

    if task.success_criteria:
        prompt_parts.append(f"## Requirements\n{task.success_criteria}")

    prompt = "\n\n".join(prompt_parts)

    doc_content = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.STANDARD,
        system_prompt=_DOCS_SYSTEM,
        temperature=0.1,
        max_tokens=8192,
    )

    log.info("docs.llm_complete", output_length=len(doc_content))

    # ── 4. Commit to GitHub ─────────────────────────────────────────────
    if task.tool == "github" and repo:
        branch_result = await connector_hub.execute(
            "github", "create_branch", {"repo": repo, "branch": branch_name},
        )
        if not branch_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to create branch: {branch_result.error}",
            )

        write_result = await connector_hub.execute(
            "github",
            "write_file",
            {
                "repo": repo,
                "branch": branch_name,
                "path": file_path,
                "content": doc_content,
                "message": f"docs: {task.name}",
            },
        )
        if not write_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to write docs file: {write_result.error}",
            )

        pr_result = await connector_hub.execute(
            "github",
            "create_pr",
            {
                "repo": repo,
                "head": branch_name,
                "title": f"[AegisForge] Docs: {task.name}",
                "body": (
                    f"Auto-generated documentation by AegisForge.\n\n"
                    f"**Type:** {doc_type}\n"
                    f"**File:** `{file_path}`"
                ),
            },
        )
        if pr_result.success:
            pr_url = pr_result.data.get("url", "") if isinstance(pr_result.data, dict) else ""
            artifacts.append({"type": "pull_request", "url": pr_url})

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=doc_content if not artifacts else artifacts[0].get("url", doc_content),
        artifacts=artifacts,
    )
