"""Handlers for CODE_GENERATION and CODE_MODIFICATION tasks.

Both handlers follow the same pattern:
  1. Retrieve relevant codebase context via RAG
  2. Build a structured prompt with constraints
  3. Call the ADVANCED-tier LLM to produce code
  4. Push results via the GitHub connector (branch + PR)
"""

from __future__ import annotations

from typing import Any

import structlog

from aegisforge.connectors import ConnectorHub
from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.pipeline import RAGPipeline
from aegisforge.validation.pipeline import ValidationPipeline, get_validation_pipeline

from aegisforge.executor.runner import TaskResult

logger = structlog.get_logger()

_CODE_GEN_SYSTEM = (
    "You are an expert software engineer. Generate production-quality code "
    "that is clean, well-documented, and follows the project's existing "
    "conventions. Include type annotations and docstrings. "
    "Output ONLY the code — no explanations unless requested."
)

_CODE_MOD_SYSTEM = (
    "You are an expert software engineer. Modify the provided source code "
    "according to the instructions. Preserve the existing style, type "
    "annotations, and docstrings. Return the COMPLETE modified file — "
    "do not use ellipses or placeholders."
)


async def handle_code_generation(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Generate new code from a task description and push via GitHub.

    Workflow:
        1. Query RAG for relevant codebase context (patterns, utilities).
        2. Build a prompt with the task description, constraints, and context.
        3. Call the ADVANCED-tier LLM for code generation.
        4. If ``task.tool == "github"``, create a branch, write files, and
           open a pull request.
        5. Return a ``TaskResult`` with the PR URL or generated code.
    """
    log = logger.bind(task_id=str(task.task_id), handler="code_generation")
    artifacts: list[dict[str, Any]] = []

    # ── 1. RAG context retrieval ────────────────────────────────────────
    rag_context = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query=task.description,
                collection="codebase",
            )
            rag_context = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
            log.info("code_gen.rag_retrieved", chunks=len(retrieved))
        except Exception as exc:
            log.warning("code_gen.rag_failed", error=str(exc))

    # ── 2. Build prompt ─────────────────────────────────────────────────
    prompt_parts = [f"## Task\n{task.description}"]

    if task.tool_input.get("file_path"):
        prompt_parts.append(f"## Target File\n`{task.tool_input['file_path']}`")

    if task.tool_input.get("language"):
        prompt_parts.append(f"## Language\n{task.tool_input['language']}")

    if task.success_criteria:
        prompt_parts.append(f"## Success Criteria\n{task.success_criteria}")

    if rag_context:
        prompt_parts.append(
            f"## Existing Codebase Context\n```\n{rag_context[:6000]}\n```"
        )

    prompt = "\n\n".join(prompt_parts)

    # ── 3. LLM generation ──────────────────────────────────────────────
    generated_code = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.ADVANCED,
        system_prompt=_CODE_GEN_SYSTEM,
        temperature=0.0,
        max_tokens=8192,
    )

    log.info("code_gen.llm_complete", output_length=len(generated_code))

    # ── 3b. Validate and auto-fix generated code ─────────────────────
    validator = get_validation_pipeline(llm_client=llm_client)
    validation = await validator.validate_and_fix(
        code=generated_code,
        task_description=task.description,
        language=task.tool_input.get("language", "python"),
        max_iterations=3,
    )
    if validation.fixed_code:
        generated_code = validation.fixed_code
        log.info("code_gen.auto_fixed", iteration=validation.iteration)
    if not validation.passed:
        log.warning(
            "code_gen.validation_failed",
            errors=validation.error_count,
            warnings=validation.warning_count,
        )

    # ── 4. Push via GitHub connector ────────────────────────────────────
    if task.tool == "github":
        repo = task.tool_input.get("repo", "")
        file_path = task.tool_input.get("file_path", "generated_code.py")
        branch_name = task.tool_input.get(
            "branch", f"aegis/code-gen/{task.task_id!s:.8}",
        )

        # Create branch
        branch_result = await connector_hub.execute(
            "github", "create_branch", {"repo": repo, "branch": branch_name},
        )
        if not branch_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to create branch: {branch_result.error}",
            )

        # Write file
        write_result = await connector_hub.execute(
            "github",
            "write_file",
            {
                "repo": repo,
                "branch": branch_name,
                "path": file_path,
                "content": generated_code,
                "message": f"feat: {task.name}",
            },
        )
        if not write_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to write file: {write_result.error}",
            )

        # Create pull request
        pr_result = await connector_hub.execute(
            "github",
            "create_pr",
            {
                "repo": repo,
                "head": branch_name,
                "title": f"[AegisForge] {task.name}",
                "body": (
                    f"Auto-generated by AegisForge.\n\n"
                    f"**Task:** {task.description}\n\n"
                    f"**Success criteria:** {task.success_criteria}"
                ),
            },
        )
        if pr_result.success:
            pr_url = pr_result.data.get("url", "") if isinstance(pr_result.data, dict) else ""
            artifacts.append({"type": "pull_request", "url": pr_url})
            log.info("code_gen.pr_created", pr_url=pr_url)
        else:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to create PR: {pr_result.error}",
            )

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=generated_code if not artifacts else artifacts[0].get("url", generated_code),
        artifacts=artifacts,
    )


async def handle_code_modification(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Modify existing code based on instructions and push the result.

    Workflow:
        1. Read the existing file via the GitHub connector.
        2. Query RAG for surrounding context and patterns.
        3. Build a modification prompt with original code + instructions.
        4. Call the ADVANCED-tier LLM to produce modified code.
        5. Write modified file and create a PR.
    """
    log = logger.bind(task_id=str(task.task_id), handler="code_modification")
    artifacts: list[dict[str, Any]] = []

    repo = task.tool_input.get("repo", "")
    file_path = task.tool_input.get("file_path", "")
    branch_name = task.tool_input.get(
        "branch", f"aegis/code-mod/{task.task_id!s:.8}",
    )

    # ── 1. Read existing file ──────────────────────────────────────────
    original_code = ""
    if task.tool == "github" and file_path:
        read_result = await connector_hub.execute(
            "github",
            "read_file",
            {"repo": repo, "path": file_path},
        )
        if read_result.success:
            original_code = read_result.data if isinstance(read_result.data, str) else str(read_result.data)
        else:
            log.warning("code_mod.read_failed", error=read_result.error)

    # ── 2. RAG context ─────────────────────────────────────────────────
    rag_context = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query=f"{task.description} {file_path}",
                collection="codebase",
            )
            rag_context = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
        except Exception as exc:
            log.warning("code_mod.rag_failed", error=str(exc))

    # ── 3. Build prompt ─────────────────────────────────────────────────
    prompt_parts = [f"## Modification Instructions\n{task.description}"]

    if original_code:
        prompt_parts.append(
            f"## Original Code (`{file_path}`)\n```\n{original_code}\n```"
        )

    if task.success_criteria:
        prompt_parts.append(f"## Success Criteria\n{task.success_criteria}")

    if rag_context:
        prompt_parts.append(
            f"## Related Codebase Context\n```\n{rag_context[:4000]}\n```"
        )

    prompt = "\n\n".join(prompt_parts)

    # ── 4. LLM modification ────────────────────────────────────────────
    modified_code = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.ADVANCED,
        system_prompt=_CODE_MOD_SYSTEM,
        temperature=0.0,
        max_tokens=8192,
    )

    log.info("code_mod.llm_complete", output_length=len(modified_code))

    # ── 4b. Validate and auto-fix modified code ──────────────────────
    validator = get_validation_pipeline(llm_client=llm_client)
    validation = await validator.validate_and_fix(
        code=modified_code,
        task_description=task.description,
        language=task.tool_input.get("language", "python"),
        max_iterations=3,
    )
    if validation.fixed_code:
        modified_code = validation.fixed_code
        log.info("code_mod.auto_fixed", iteration=validation.iteration)
    if not validation.passed:
        log.warning(
            "code_mod.validation_failed",
            errors=validation.error_count,
            warnings=validation.warning_count,
        )

    # ── 5. Push via GitHub connector ────────────────────────────────────
    if task.tool == "github" and file_path:
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
                "content": modified_code,
                "message": f"refactor: {task.name}",
            },
        )
        if not write_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to write modified file: {write_result.error}",
            )

        pr_result = await connector_hub.execute(
            "github",
            "create_pr",
            {
                "repo": repo,
                "head": branch_name,
                "title": f"[AegisForge] {task.name}",
                "body": (
                    f"Auto-modified by AegisForge.\n\n"
                    f"**Task:** {task.description}\n\n"
                    f"**File:** `{file_path}`\n\n"
                    f"**Success criteria:** {task.success_criteria}"
                ),
            },
        )
        if pr_result.success:
            pr_url = pr_result.data.get("url", "") if isinstance(pr_result.data, dict) else ""
            artifacts.append({"type": "pull_request", "url": pr_url})
            log.info("code_mod.pr_created", pr_url=pr_url)
        else:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to create PR: {pr_result.error}",
            )

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=modified_code if not artifacts else artifacts[0].get("url", modified_code),
        artifacts=artifacts,
    )
