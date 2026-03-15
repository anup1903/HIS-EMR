"""Test Agent — specialized for test generation and coverage analysis."""

from __future__ import annotations

import time

import structlog

from aegisforge.agents.base import AgentContext, BaseSubAgent, SubAgentResult, SubTask
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class TestAgent(BaseSubAgent):
    """Specialized agent for test generation, test strategy, and coverage analysis.

    Uses STANDARD tier (Llama 4 Maverick) for test generation — tests are
    typically more formulaic than production code.
    """

    agent_name = "test_agent"
    model_tier = ModelTier.STANDARD
    rag_collections = ["codebase"]
    system_prompt = (
        "You are a test engineering expert. You write thorough, well-structured tests "
        "that cover happy paths, edge cases, error scenarios, and boundary conditions.\n\n"
        "Rules:\n"
        "- Use pytest as the test framework\n"
        "- Follow the existing test patterns in the codebase\n"
        "- Use fixtures for setup/teardown\n"
        "- Mock external dependencies (httpx, databases, APIs)\n"
        "- Test one behavior per test function\n"
        "- Use descriptive test names: test_<what>_<scenario>_<expected>\n"
        "- Include both positive and negative test cases\n"
        "- For async code, use pytest.mark.asyncio\n"
        "- Return ONLY the test code, no explanations"
    )

    _TEST_KEYWORDS = {
        "test", "testing", "coverage", "assertion", "mock", "fixture",
        "unittest", "pytest", "regression", "integration", "e2e",
        "edge case", "boundary", "negative test",
    }

    async def can_handle(self, task: SubTask) -> float:
        desc_lower = task.description.lower()
        if task.task_type.lower() in ("test_creation", "test_execution"):
            return 0.95
        matches = sum(1 for kw in self._TEST_KEYWORDS if kw in desc_lower)
        return min(0.9, matches * 0.2)

    async def execute(
        self, task: SubTask, context: AgentContext
    ) -> SubAgentResult:
        """Generate tests or analyze test coverage."""
        start = time.perf_counter()

        try:
            prompt = self._build_prompt(task)
            tests = await self._llm_complete(prompt, context, max_tokens=12288)

            # Clean up output
            tests = self._clean_output(tests)

            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "test_agent.completed",
                task_id=str(task.task_id),
                output_length=len(tests),
                duration_ms=duration_ms,
            )

            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=True,
                output=tests,
                confidence=0.8,
                model_tier_used=self.model_tier.value,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error("test_agent.failed", error=str(exc))
            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

    def _build_prompt(self, task: SubTask) -> str:
        parts = [f"## Test Task\n{task.description}"]

        source_code = task.input_data.get("source_code")
        if source_code:
            parts.append(f"## Source Code to Test\n```python\n{source_code}\n```")

        existing_tests = task.input_data.get("existing_tests")
        if existing_tests:
            parts.append(f"## Existing Tests (follow this style)\n```python\n{existing_tests}\n```")

        if task.input_data.get("file_path"):
            parts.append(f"## Source File: {task.input_data['file_path']}")

        parts.append(
            "Generate comprehensive tests covering:\n"
            "- Happy path (normal operation)\n"
            "- Edge cases (empty input, None, boundaries)\n"
            "- Error scenarios (exceptions, invalid input)\n"
            "- Async behavior (if applicable)"
        )
        return "\n\n".join(parts)

    def _clean_output(self, code: str) -> str:
        code = code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            code = "\n".join(lines)
        return code
