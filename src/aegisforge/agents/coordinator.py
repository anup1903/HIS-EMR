"""Agent Coordinator — routes sub-tasks to the best specialist and manages cross-review."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import structlog

from aegisforge.agents.base import (
    AgentContext,
    BaseSubAgent,
    SubAgentResult,
    SubTask,
)

logger = structlog.get_logger()


class AgentCoordinator:
    """Routes sub-tasks to the most capable sub-agent.

    Features:
    - Confidence-based routing: asks each agent how well it can handle a task
    - Cross-review: primary agent executes, secondary agent reviews
    - Parallel execution: independent sub-tasks run concurrently
    - Fallback: if primary agent fails, tries next-best agent

    Usage:
        coordinator = AgentCoordinator()
        coordinator.register(CodeAgent(llm))
        coordinator.register(SecurityAgent(llm))
        coordinator.register(TestAgent(llm))
        coordinator.register(ArchitectureAgent(llm))

        result = await coordinator.execute(sub_task, context)
    """

    def __init__(self) -> None:
        self._agents: dict[str, BaseSubAgent] = {}

    def register(self, agent: BaseSubAgent) -> None:
        """Register a specialized sub-agent."""
        self._agents[agent.agent_name] = agent
        logger.info("coordinator.agent_registered", agent=agent.agent_name)

    def list_agents(self) -> list[str]:
        return list(self._agents.keys())

    async def route(self, task: SubTask) -> BaseSubAgent:
        """Select the best agent for a task based on confidence scores."""
        if not self._agents:
            raise ValueError("No agents registered")

        scores: list[tuple[str, float]] = []
        for name, agent in self._agents.items():
            score = await agent.can_handle(task)
            scores.append((name, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        best_name, best_score = scores[0]

        logger.info(
            "coordinator.routed",
            task_id=str(task.task_id),
            selected_agent=best_name,
            confidence=best_score,
            all_scores={n: round(s, 2) for n, s in scores[:3]},
        )

        return self._agents[best_name]

    async def execute(
        self,
        task: SubTask,
        context: AgentContext,
        fallback: bool = True,
    ) -> SubAgentResult:
        """Execute a task with the best-matched agent.

        If the primary agent fails and fallback is enabled,
        tries the next-best agent.
        """
        scores = []
        for name, agent in self._agents.items():
            score = await agent.can_handle(task)
            scores.append((name, score, agent))
        scores.sort(key=lambda x: x[1], reverse=True)

        for name, score, agent in scores:
            try:
                result = await agent.execute(task, context)
                if result.success:
                    return result

                if not fallback:
                    return result

                logger.warning(
                    "coordinator.agent_failed_trying_fallback",
                    agent=name,
                    error=result.error,
                )
            except Exception as exc:
                logger.error(
                    "coordinator.agent_exception",
                    agent=name,
                    error=str(exc),
                )
                if not fallback:
                    return SubAgentResult(
                        task_id=task.task_id,
                        agent_name=name,
                        success=False,
                        error=str(exc),
                    )

        return SubAgentResult(
            task_id=task.task_id,
            agent_name="coordinator",
            success=False,
            error="All agents failed to handle the task",
        )

    async def execute_with_review(
        self,
        task: SubTask,
        context: AgentContext,
        reviewer_name: str | None = None,
    ) -> SubAgentResult:
        """Execute task with primary agent, then cross-review with another.

        Example: Code Agent writes code → Security Agent reviews it.
        The review is attached to the result as an artifact.
        """
        # Primary execution
        primary = await self.route(task)
        result = await primary.execute(task, context)

        if not result.success:
            return result

        # Select reviewer (different from primary)
        reviewer = None
        if reviewer_name and reviewer_name in self._agents:
            reviewer = self._agents[reviewer_name]
        else:
            # Auto-select: security reviews code, test reviews features
            if primary.agent_name == "code_agent" and "security_agent" in self._agents:
                reviewer = self._agents["security_agent"]
            elif primary.agent_name != "test_agent" and "test_agent" in self._agents:
                reviewer = self._agents["test_agent"]

        if reviewer and reviewer.agent_name != primary.agent_name:
            review_task = SubTask(
                description=f"Review output from {primary.agent_name}: {task.description}",
                task_type="code_review",
                input_data={"code": str(result.output), **task.input_data},
                parent_task_id=task.task_id,
            )

            review_result = await reviewer.execute(review_task, context)

            result.artifacts.append({
                "type": "cross_review",
                "reviewer": reviewer.agent_name,
                "review": review_result.output,
                "review_success": review_result.success,
            })

            logger.info(
                "coordinator.cross_review_completed",
                primary=primary.agent_name,
                reviewer=reviewer.agent_name,
                task_id=str(task.task_id),
            )

        return result

    async def parallel_execute(
        self,
        tasks: list[SubTask],
        context: AgentContext,
    ) -> list[SubAgentResult]:
        """Execute independent sub-tasks across agents in parallel."""
        start = time.perf_counter()

        results = await asyncio.gather(
            *[self.execute(task, context) for task in tasks],
            return_exceptions=True,
        )

        processed: list[SubAgentResult] = []
        for task, result in zip(tasks, results):
            if isinstance(result, Exception):
                processed.append(SubAgentResult(
                    task_id=task.task_id,
                    agent_name="coordinator",
                    success=False,
                    error=str(result),
                ))
            else:
                processed.append(result)

        duration_ms = (time.perf_counter() - start) * 1000
        success_count = sum(1 for r in processed if r.success)
        logger.info(
            "coordinator.parallel_completed",
            total=len(tasks),
            succeeded=success_count,
            failed=len(tasks) - success_count,
            duration_ms=duration_ms,
        )

        return processed
