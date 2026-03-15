"""Base sub-agent interface — shared contract for all specialized agents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import structlog
from pydantic import BaseModel, Field

from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class SubTask(BaseModel):
    """A unit of work delegated to a sub-agent."""

    task_id: UUID = Field(default_factory=uuid4)
    description: str
    task_type: str = ""
    context: str = ""
    input_data: dict[str, Any] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list)
    parent_task_id: UUID | None = None


class SubAgentResult(BaseModel):
    """Result returned by a sub-agent."""

    task_id: UUID
    agent_name: str
    success: bool = False
    output: Any = None
    error: str | None = None
    confidence: float = 0.0  # 0.0-1.0 self-assessed confidence
    reasoning: str = ""
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    duration_ms: float = 0.0
    model_tier_used: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentContext(BaseModel):
    """Context provided to sub-agents for execution."""

    rag_context: str = ""
    memory_context: str = ""
    rules_context: str = ""
    codebase_context: str = ""
    past_outcomes: list[dict[str, Any]] = Field(default_factory=list)
    session_id: UUID | None = None
    goal_summary: str = ""


class BaseSubAgent(ABC):
    """Specialized sub-agent with domain expertise.

    Each sub-agent:
    - Has a specific model tier it prefers (REASONING for architecture, ADVANCED for code, etc.)
    - Has a domain-specific system prompt
    - Knows which RAG collections are relevant
    - Can assess its own confidence in handling a task
    """

    agent_name: str = ""
    model_tier: ModelTier = ModelTier.ADVANCED
    system_prompt: str = ""
    rag_collections: list[str] = []

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    @abstractmethod
    async def execute(
        self, task: SubTask, context: AgentContext
    ) -> SubAgentResult:
        """Execute a sub-task with domain-specific expertise."""
        ...

    async def can_handle(self, task: SubTask) -> float:
        """Return confidence score (0.0-1.0) that this agent can handle the task.

        Default implementation uses keyword matching. Override for smarter routing.
        """
        return 0.0

    async def _llm_complete(
        self,
        prompt: str,
        context: AgentContext,
        temperature: float = 0.0,
        max_tokens: int = 8192,
    ) -> str:
        """Helper: execute LLM call with agent's system prompt and context."""
        full_system = self.system_prompt
        if context.rag_context:
            full_system += f"\n\n<codebase_context>\n{context.rag_context}\n</codebase_context>"
        if context.memory_context:
            full_system += f"\n\n<past_experience>\n{context.memory_context}\n</past_experience>"
        if context.rules_context:
            full_system += f"\n\n<learned_rules>\n{context.rules_context}\n</learned_rules>"

        return await self._llm.complete_simple(
            prompt=prompt,
            tier=self.model_tier,
            system_prompt=full_system,
            temperature=temperature,
            max_tokens=max_tokens,
        )
