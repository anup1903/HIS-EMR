"""Code Agent — specialized for code generation, modification, and refactoring."""

from __future__ import annotations

import time

import structlog

from aegisforge.agents.base import AgentContext, BaseSubAgent, SubAgentResult, SubTask
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class CodeAgent(BaseSubAgent):
    """Specialized agent for all code-related tasks.

    Uses ADVANCED tier (Qwen3-235B) for code generation and modification.
    Grounded in codebase context via RAG.
    """

    agent_name = "code_agent"
    model_tier = ModelTier.ADVANCED
    rag_collections = ["codebase"]
    system_prompt = (
        "You are an expert software engineer. You write clean, well-structured, "
        "production-quality code with proper error handling and type annotations.\n\n"
        "Rules:\n"
        "- Follow existing code conventions visible in the codebase context\n"
        "- Include necessary imports\n"
        "- Add docstrings to public functions and classes\n"
        "- Handle errors gracefully\n"
        "- Never hardcode secrets or credentials\n"
        "- Return ONLY the code, no explanations unless explicitly asked"
    )

    _CODE_KEYWORDS = {
        "generate", "code", "implement", "write", "create", "function",
        "class", "module", "refactor", "modify", "update", "fix", "patch",
        "add", "feature", "endpoint", "api", "handler", "service",
    }

    async def can_handle(self, task: SubTask) -> float:
        """High confidence for code generation/modification tasks."""
        desc_lower = task.description.lower()
        task_type_lower = task.task_type.lower()

        if task_type_lower in ("code_generation", "code_modification"):
            return 0.95

        matches = sum(1 for kw in self._CODE_KEYWORDS if kw in desc_lower)
        return min(0.9, matches * 0.15)

    async def execute(
        self, task: SubTask, context: AgentContext
    ) -> SubAgentResult:
        """Generate or modify code based on the task description."""
        start = time.perf_counter()

        try:
            prompt = self._build_prompt(task, context)
            code = await self._llm_complete(prompt, context, max_tokens=16384)

            # Strip markdown fences if present
            code = self._clean_code_output(code)

            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "code_agent.completed",
                task_id=str(task.task_id),
                output_length=len(code),
                duration_ms=duration_ms,
            )

            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=True,
                output=code,
                confidence=0.8,
                model_tier_used=self.model_tier.value,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error("code_agent.failed", error=str(exc))
            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

    def _build_prompt(self, task: SubTask, context: AgentContext) -> str:
        parts = [f"## Task\n{task.description}"]

        if task.constraints:
            parts.append("## Constraints\n" + "\n".join(f"- {c}" for c in task.constraints))

        if task.input_data.get("existing_code"):
            parts.append(f"## Existing Code\n```\n{task.input_data['existing_code']}\n```")

        if task.input_data.get("file_path"):
            parts.append(f"## File Path: {task.input_data['file_path']}")

        return "\n\n".join(parts)

    def _clean_code_output(self, code: str) -> str:
        """Remove markdown fences from LLM code output."""
        code = code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            # Remove first line (```python or ```)
            lines = lines[1:]
            # Remove last line if it's closing fence
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            code = "\n".join(lines)
        return code
