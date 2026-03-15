"""Handler for DB_MIGRATION tasks.

Generates Alembic migrations via the LLM, validates with a dry-run,
and applies them via a shell connector. DB migrations are always high-risk
and require approval before the apply step.
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

_MIGRATION_SYSTEM = (
    "You are an expert database engineer. Generate a complete Alembic migration "
    "script with both upgrade() and downgrade() functions.\n\n"
    "Requirements:\n"
    "- Use SQLAlchemy 2.x / Alembic 1.x syntax\n"
    "- Include proper nullable/index/constraint specifications\n"
    "- The downgrade() MUST perfectly reverse the upgrade()\n"
    "- Use batch mode for SQLite compatibility where appropriate\n"
    "- Add a clear docstring describing the migration\n"
    "Output ONLY the migration Python file content."
)


async def handle_db_migration(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Generate and optionally apply an Alembic migration.

    This task type is inherently high-risk. The handler:
        1. Uses the ADVANCED-tier LLM to generate the migration script.
        2. Optionally pushes the script via GitHub.
        3. Runs a dry-run (``alembic upgrade head --sql``) to validate.
        4. If ``apply`` is True and the task has been approved, runs the
           actual ``alembic upgrade head``.

    ``tool_input`` keys:
        - description: str — what the migration should do
        - repo: str — GitHub repo (optional)
        - apply: bool — whether to run the migration (default: False)
        - working_dir: str — where alembic.ini lives (default: ".")
    """
    log = logger.bind(task_id=str(task.task_id), handler="db_migration")
    artifacts: list[dict[str, Any]] = []

    migration_description = task.tool_input.get("description", task.description)
    repo = task.tool_input.get("repo", "")
    should_apply = task.tool_input.get("apply", False)
    working_dir = task.tool_input.get("working_dir", ".")

    # ── 1. RAG context for existing models ──────────────────────────────
    model_context = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query=f"SQLAlchemy models database schema {migration_description}",
                collection="codebase",
            )
            model_context = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
        except Exception as exc:
            log.warning("db_migration.rag_failed", error=str(exc))

    # ── 2. LLM generates migration ─────────────────────────────────────
    prompt_parts = [f"## Migration Description\n{migration_description}"]

    if model_context:
        prompt_parts.append(
            f"## Existing Models / Schema\n```python\n{model_context[:5000]}\n```"
        )

    if task.success_criteria:
        prompt_parts.append(f"## Requirements\n{task.success_criteria}")

    prompt = "\n\n".join(prompt_parts)

    migration_code = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.ADVANCED,
        system_prompt=_MIGRATION_SYSTEM,
        temperature=0.0,
        max_tokens=4096,
    )

    log.info("db_migration.llm_complete", output_length=len(migration_code))
    artifacts.append({"type": "migration_script", "content_preview": migration_code[:500]})

    # ── 3. Push to GitHub (if configured) ───────────────────────────────
    if task.tool == "github" and repo:
        branch_name = task.tool_input.get(
            "branch", f"aegis/migration/{task.task_id!s:.8}",
        )

        branch_result = await connector_hub.execute(
            "github", "create_branch", {"repo": repo, "branch": branch_name},
        )
        if branch_result.success:
            # Use a placeholder path — the actual alembic revision command
            # would generate the proper filename
            migration_path = task.tool_input.get(
                "migration_path",
                f"alembic/versions/{task.task_id!s:.8}_migration.py",
            )

            write_result = await connector_hub.execute(
                "github",
                "write_file",
                {
                    "repo": repo,
                    "branch": branch_name,
                    "path": migration_path,
                    "content": migration_code,
                    "message": f"migration: {task.name}",
                },
            )
            if write_result.success:
                artifacts.append({"type": "file", "path": migration_path})

    # ── 4. Dry-run validation ───────────────────────────────────────────
    dry_run_result = await connector_hub.execute(
        task.tool or "shell",
        "run",
        {
            "command": "alembic upgrade head --sql",
            "working_dir": working_dir,
            "timeout": 60,
        },
    )

    dry_run_ok = dry_run_result.success
    dry_run_output = ""
    if isinstance(dry_run_result.data, dict):
        dry_run_output = dry_run_result.data.get("stdout", "")
    elif isinstance(dry_run_result.data, str):
        dry_run_output = dry_run_result.data

    if not dry_run_ok:
        log.error("db_migration.dry_run_failed", error=dry_run_result.error)
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error=f"Migration dry-run failed: {dry_run_result.error}",
            output={"migration_code": migration_code, "dry_run_output": dry_run_output},
            artifacts=artifacts,
        )

    log.info("db_migration.dry_run_passed")
    artifacts.append({"type": "dry_run", "output": dry_run_output[:2000]})

    # ── 5. Apply migration (only if approved and requested) ─────────────
    if should_apply:
        if task.requires_approval and not task.tool_input.get("approved"):
            log.info("db_migration.awaiting_approval")
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.AWAITING_APPROVAL,
                output={
                    "migration_code": migration_code,
                    "dry_run_output": dry_run_output,
                    "message": "Migration requires approval before apply.",
                },
                artifacts=artifacts,
            )

        apply_result = await connector_hub.execute(
            task.tool or "shell",
            "run",
            {
                "command": "alembic upgrade head",
                "working_dir": working_dir,
                "timeout": 300,
            },
        )

        if not apply_result.success:
            log.error("db_migration.apply_failed", error=apply_result.error)
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Migration apply failed: {apply_result.error}",
                output={"migration_code": migration_code},
                artifacts=artifacts,
            )

        log.info("db_migration.applied")
        artifacts.append({"type": "migration_applied", "status": "success"})

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output={
            "migration_code": migration_code,
            "dry_run_output": dry_run_output,
            "applied": should_apply,
        },
        artifacts=artifacts,
    )
