"""Handlers for TEST_CREATION and TEST_EXECUTION tasks.

TEST_CREATION uses the ADVANCED-tier LLM + RAG to generate tests for
existing source code, then pushes the test file via GitHub.

TEST_EXECUTION runs tests via a shell connector and parses results.
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

_TEST_GEN_SYSTEM = (
    "You are an expert test engineer. Generate comprehensive, production-quality "
    "tests following best practices:\n"
    "- Use pytest for Python (with fixtures, parametrize where appropriate)\n"
    "- Cover happy paths, edge cases, and error paths\n"
    "- Use descriptive test names (test_<what>_<condition>_<expected>)\n"
    "- Mock external dependencies appropriately\n"
    "- Include type annotations\n"
    "Output ONLY the test file code — no explanations."
)


async def handle_test_creation(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Generate test code for a given source module.

    Workflow:
        1. Read the source file via the GitHub connector (if available).
        2. Query RAG for existing test patterns in the project.
        3. LLM ADVANCED generates comprehensive tests.
        4. Push test file to a branch and open a PR.
    """
    log = logger.bind(task_id=str(task.task_id), handler="test_creation")
    artifacts: list[dict[str, Any]] = []

    repo = task.tool_input.get("repo", "")
    source_path = task.tool_input.get("source_path", "")
    test_path = task.tool_input.get(
        "test_path",
        source_path.replace("src/", "tests/test_", 1) if source_path else "tests/test_generated.py",
    )
    branch_name = task.tool_input.get(
        "branch", f"aegis/tests/{task.task_id!s:.8}",
    )

    # ── 1. Read source file ─────────────────────────────────────────────
    source_code = ""
    if task.tool == "github" and source_path:
        read_result = await connector_hub.execute(
            "github", "read_file", {"repo": repo, "path": source_path},
        )
        if read_result.success:
            source_code = read_result.data if isinstance(read_result.data, str) else str(read_result.data)
        else:
            log.warning("test_creation.read_source_failed", error=read_result.error)

    # ── 2. RAG for test patterns ────────────────────────────────────────
    test_patterns = ""
    if rag_pipeline is not None:
        try:
            retrieved = await rag_pipeline.retrieve(
                query=f"test patterns fixtures {source_path}",
                collection="codebase",
            )
            test_patterns = "\n\n".join(
                chunk.get("content", "") for chunk in retrieved
            )
        except Exception as exc:
            log.warning("test_creation.rag_failed", error=str(exc))

    # ── 3. LLM test generation ──────────────────────────────────────────
    prompt_parts = [f"## Task\n{task.description}"]

    if source_code:
        prompt_parts.append(
            f"## Source Code (`{source_path}`)\n```python\n{source_code}\n```"
        )

    if task.success_criteria:
        prompt_parts.append(f"## Requirements\n{task.success_criteria}")

    if test_patterns:
        prompt_parts.append(
            f"## Existing Test Patterns\n```python\n{test_patterns[:4000]}\n```"
        )

    prompt = "\n\n".join(prompt_parts)

    test_code = await llm_client.complete_simple(
        prompt=prompt,
        tier=ModelTier.ADVANCED,
        system_prompt=_TEST_GEN_SYSTEM,
        temperature=0.0,
        max_tokens=8192,
    )

    log.info("test_creation.llm_complete", output_length=len(test_code))

    # ── 4. Push test file ───────────────────────────────────────────────
    if task.tool == "github":
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
                "path": test_path,
                "content": test_code,
                "message": f"test: add tests for {source_path or task.name}",
            },
        )
        if not write_result.success:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Failed to write test file: {write_result.error}",
            )

        pr_result = await connector_hub.execute(
            "github",
            "create_pr",
            {
                "repo": repo,
                "head": branch_name,
                "title": f"[AegisForge] Tests: {task.name}",
                "body": (
                    f"Auto-generated tests by AegisForge.\n\n"
                    f"**Source:** `{source_path}`\n"
                    f"**Test file:** `{test_path}`"
                ),
            },
        )
        if pr_result.success:
            pr_url = pr_result.data.get("url", "") if isinstance(pr_result.data, dict) else ""
            artifacts.append({"type": "pull_request", "url": pr_url})

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=test_code if not artifacts else artifacts[0].get("url", test_code),
        artifacts=artifacts,
    )


async def handle_test_execution(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Run tests via a shell connector and parse the results.

    Workflow:
        1. Determine the test command from ``tool_input`` (default: ``pytest``).
        2. Execute via the shell connector.
        3. Parse output for pass/fail counts.
        4. Return structured results.
    """
    log = logger.bind(task_id=str(task.task_id), handler="test_execution")

    test_command = task.tool_input.get("command", "pytest --tb=short -q")
    working_dir = task.tool_input.get("working_dir", ".")
    connector_name = task.tool or "shell"

    run_result = await connector_hub.execute(
        connector_name,
        "run",
        {
            "command": test_command,
            "working_dir": working_dir,
            "timeout": task.tool_input.get("timeout", 600),
        },
    )

    output_text = ""
    exit_code = -1

    if run_result.success and isinstance(run_result.data, dict):
        output_text = run_result.data.get("stdout", "")
        exit_code = run_result.data.get("exit_code", 0)
    elif run_result.success and isinstance(run_result.data, str):
        output_text = run_result.data
        exit_code = 0
    else:
        output_text = run_result.error or "Test execution failed"
        exit_code = 1

    # Parse summary from pytest output
    passed = failed = errors = 0
    for line in output_text.splitlines():
        lower = line.lower().strip()
        if "passed" in lower or "failed" in lower or "error" in lower:
            # Attempt to extract counts from lines like "5 passed, 2 failed"
            import re

            for match in re.finditer(r"(\d+)\s+(passed|failed|error)", lower):
                count = int(match.group(1))
                kind = match.group(2)
                if kind == "passed":
                    passed += count
                elif kind == "failed":
                    failed += count
                elif kind == "error":
                    errors += count

    test_summary = {
        "exit_code": exit_code,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "total": passed + failed + errors,
        "output": output_text[:5000],  # Cap output size
    }

    status = TaskStatus.COMPLETED if exit_code == 0 else TaskStatus.FAILED
    log.info(
        "test_execution.complete",
        exit_code=exit_code,
        passed=passed,
        failed=failed,
        errors=errors,
    )

    return TaskResult(
        task_id=task.task_id,
        status=status,
        output=test_summary,
        error=f"Tests failed: {failed} failures, {errors} errors" if exit_code != 0 else None,
        artifacts=[{"type": "test_results", "data": test_summary}],
    )
