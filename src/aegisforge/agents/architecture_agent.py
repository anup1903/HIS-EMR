"""Architecture Agent — specialized for system design, decomposition, and trade-off analysis."""

from __future__ import annotations

import time

import structlog

from aegisforge.agents.base import AgentContext, BaseSubAgent, SubAgentResult, SubTask
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class ArchitectureAgent(BaseSubAgent):
    """Specialized agent for system design and architectural analysis.

    Uses REASONING tier (DeepSeek-R1) for deep multi-step thinking about
    architecture, trade-offs, and complex problem decomposition.
    """

    agent_name = "architecture_agent"
    model_tier = ModelTier.REASONING
    rag_collections = ["codebase", "docs"]
    system_prompt = (
        "You are a senior software architect. You excel at:\n\n"
        "- Decomposing complex problems into well-defined components\n"
        "- Identifying architectural patterns and anti-patterns\n"
        "- Analyzing trade-offs (performance, maintainability, scalability)\n"
        "- Designing clean interfaces between system boundaries\n"
        "- Planning migration strategies for large changes\n"
        "- Identifying risks and dependencies early\n\n"
        "Think step by step. Consider multiple approaches before recommending one.\n"
        "Always justify your recommendations with concrete reasoning.\n\n"
        "Respond with structured JSON:\n"
        "{\"analysis\": \"...\", \"recommendation\": \"...\", \"components\": [...], "
        "\"risks\": [...], \"trade_offs\": [...], \"confidence\": 0.0-1.0}"
    )

    _ARCH_KEYWORDS = {
        "architecture", "design", "decompose", "structure", "pattern",
        "trade-off", "tradeoff", "scalability", "migration", "refactor",
        "interface", "boundary", "component", "system", "api design",
        "database design", "schema design", "microservice",
    }

    async def can_handle(self, task: SubTask) -> float:
        desc_lower = task.description.lower()
        if task.task_type.lower() in ("analysis", "architecture"):
            return 0.9
        matches = sum(1 for kw in self._ARCH_KEYWORDS if kw in desc_lower)
        return min(0.9, matches * 0.2)

    async def execute(
        self, task: SubTask, context: AgentContext
    ) -> SubAgentResult:
        """Perform architectural analysis or design."""
        start = time.perf_counter()

        try:
            prompt = self._build_prompt(task, context)

            # Use reason() for REASONING tier with thinking support
            response = await self._llm.reason(
                prompt=prompt,
                system_prompt=self.system_prompt,
                max_tokens=16384,
            )

            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "architecture_agent.completed",
                task_id=str(task.task_id),
                thinking_present=response.thinking is not None,
                duration_ms=duration_ms,
            )

            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=True,
                output=response.content,
                reasoning=response.thinking or "",
                confidence=0.85,
                model_tier_used=self.model_tier.value,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error("architecture_agent.failed", error=str(exc))
            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

    def _build_prompt(self, task: SubTask, context: AgentContext) -> str:
        parts = [f"## Architecture Task\n{task.description}"]

        if context.goal_summary:
            parts.append(f"## Goal Context\n{context.goal_summary}")

        if task.constraints:
            parts.append("## Constraints\n" + "\n".join(f"- {c}" for c in task.constraints))

        if task.input_data.get("current_architecture"):
            parts.append(
                f"## Current Architecture\n{task.input_data['current_architecture']}"
            )

        parts.append(
            "Analyze this thoroughly. Consider multiple approaches, "
            "identify risks, and recommend the best path forward."
        )
        return "\n\n".join(parts)
