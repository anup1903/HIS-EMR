"""Adaptive Context Manager — intelligent token budget allocation across information sources."""

from __future__ import annotations

from typing import Any

import structlog
import tiktoken
from pydantic import BaseModel, Field

logger = structlog.get_logger()


class ScoredChunk(BaseModel):
    """A piece of context with a relevance score."""

    content: str
    score: float = 0.0
    source: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContextBudget(BaseModel):
    """Token budget allocation for a single context source."""

    source_name: str
    allocated_tokens: int = 0
    used_tokens: int = 0
    chunks: list[ScoredChunk] = Field(default_factory=list)

    @property
    def remaining(self) -> int:
        return max(0, self.allocated_tokens - self.used_tokens)


class ContextAllocation(BaseModel):
    """Full context allocation across all sources."""

    total_budget: int
    sources: dict[str, ContextBudget] = Field(default_factory=dict)
    final_context: str = ""
    total_used: int = 0

    @property
    def utilization_pct(self) -> float:
        if self.total_budget == 0:
            return 0.0
        return (self.total_used / self.total_budget) * 100


# Budget allocation percentages per task type
_BUDGET_PROFILES: dict[str, dict[str, float]] = {
    "code_generation": {
        "codebase": 0.55,
        "memory": 0.20,
        "rules": 0.10,
        "instructions": 0.15,
    },
    "code_modification": {
        "codebase": 0.60,
        "memory": 0.15,
        "rules": 0.10,
        "instructions": 0.15,
    },
    "code_review": {
        "diff": 0.45,
        "codebase": 0.25,
        "memory": 0.15,
        "rules": 0.15,
    },
    "analysis": {
        "codebase": 0.35,
        "docs": 0.20,
        "memory": 0.25,
        "rules": 0.20,
    },
    "test_creation": {
        "codebase": 0.50,
        "memory": 0.20,
        "rules": 0.10,
        "instructions": 0.20,
    },
    "db_migration": {
        "codebase": 0.40,
        "memory": 0.30,
        "rules": 0.20,
        "instructions": 0.10,
    },
    "default": {
        "codebase": 0.45,
        "memory": 0.20,
        "rules": 0.15,
        "instructions": 0.20,
    },
}


class AdaptiveContextManager:
    """Intelligently allocates context window budget across information sources.

    Instead of hard-coded limits like `rag_context[:6000]`, this:
    1. Calculates exact token counts (tiktoken)
    2. Prioritizes information by relevance score
    3. Allocates budget proportionally per task type
    4. Never truncates mid-sentence — drops whole chunks
    5. Fills highest-scored chunks first within each budget

    Usage:
        ctx = AdaptiveContextManager(max_context_tokens=24000)
        allocation = ctx.allocate(
            task_type="code_generation",
            sources={
                "codebase": [ScoredChunk(content="...", score=0.9), ...],
                "memory": [ScoredChunk(content="...", score=0.8), ...],
            },
        )
        final_text = allocation.final_context
    """

    def __init__(
        self,
        max_context_tokens: int = 24000,
        encoding_name: str = "cl100k_base",
    ) -> None:
        self._max_tokens = max_context_tokens
        try:
            self._enc = tiktoken.get_encoding(encoding_name)
        except Exception:
            self._enc = None
            logger.warning("context_manager.tiktoken_unavailable")

    def count_tokens(self, text: str) -> int:
        """Exact token count using tiktoken, with fallback estimation."""
        if self._enc:
            return len(self._enc.encode(text))
        # Fallback: rough estimate (1 token ≈ 4 chars)
        return len(text) // 4

    def allocate(
        self,
        task_type: str,
        sources: dict[str, list[ScoredChunk]],
        reserved_tokens: int = 0,
    ) -> ContextAllocation:
        """Allocate token budget across context sources for a task type.

        Args:
            task_type: The type of task (used to select budget profile).
            sources: Dict of source_name -> list of scored chunks.
            reserved_tokens: Tokens reserved for system prompt, etc.

        Returns:
            ContextAllocation with budgets filled and final_context assembled.
        """
        available = self._max_tokens - reserved_tokens
        profile = _BUDGET_PROFILES.get(task_type, _BUDGET_PROFILES["default"])

        allocation = ContextAllocation(total_budget=available)

        # Compute budgets per source
        for source_name, chunks in sources.items():
            pct = profile.get(source_name, 0.1)
            budget = ContextBudget(
                source_name=source_name,
                allocated_tokens=int(available * pct),
            )

            # Sort chunks by score (highest first)
            sorted_chunks = sorted(chunks, key=lambda c: c.score, reverse=True)

            # Fill budget with highest-scored chunks
            for chunk in sorted_chunks:
                chunk_tokens = self.count_tokens(chunk.content)
                if budget.used_tokens + chunk_tokens <= budget.allocated_tokens:
                    budget.chunks.append(chunk)
                    budget.used_tokens += chunk_tokens

            allocation.sources[source_name] = budget

        # Redistribute unused budget to sources that have more content
        self._redistribute_unused(allocation, sources)

        # Assemble final context
        allocation.final_context = self._assemble(allocation)
        allocation.total_used = self.count_tokens(allocation.final_context)

        logger.info(
            "context_manager.allocated",
            task_type=task_type,
            total_budget=available,
            total_used=allocation.total_used,
            utilization=f"{allocation.utilization_pct:.1f}%",
            sources={
                name: {"allocated": b.allocated_tokens, "used": b.used_tokens}
                for name, b in allocation.sources.items()
            },
        )

        return allocation

    def _redistribute_unused(
        self,
        allocation: ContextAllocation,
        sources: dict[str, list[ScoredChunk]],
    ) -> None:
        """Redistribute unused tokens from sources that couldn't fill their budget."""
        # Find unused budget
        unused = sum(
            b.remaining for b in allocation.sources.values()
        )
        if unused <= 0:
            return

        # Find sources with remaining chunks
        hungry_sources: list[str] = []
        for name, budget in allocation.sources.items():
            all_chunks = sources.get(name, [])
            used_ids = {id(c) for c in budget.chunks}
            remaining = [c for c in all_chunks if id(c) not in used_ids]
            if remaining:
                hungry_sources.append(name)

        if not hungry_sources:
            return

        # Distribute evenly
        extra_per_source = unused // len(hungry_sources)
        for name in hungry_sources:
            budget = allocation.sources[name]
            budget.allocated_tokens += extra_per_source

            # Try to fill with more chunks
            all_chunks = sorted(
                sources.get(name, []), key=lambda c: c.score, reverse=True
            )
            used_ids = {id(c) for c in budget.chunks}
            for chunk in all_chunks:
                if id(chunk) in used_ids:
                    continue
                chunk_tokens = self.count_tokens(chunk.content)
                if budget.used_tokens + chunk_tokens <= budget.allocated_tokens:
                    budget.chunks.append(chunk)
                    budget.used_tokens += chunk_tokens

    def _assemble(self, allocation: ContextAllocation) -> str:
        """Assemble the final context string from allocated chunks."""
        sections: list[str] = []

        source_order = ["codebase", "diff", "docs", "memory", "rules", "instructions"]

        # Add sources in defined order, then any remaining
        ordered_names = [n for n in source_order if n in allocation.sources]
        remaining = [n for n in allocation.sources if n not in ordered_names]
        ordered_names.extend(remaining)

        for name in ordered_names:
            budget = allocation.sources[name]
            if not budget.chunks:
                continue

            label = _SOURCE_LABELS.get(name, name.replace("_", " ").title())
            section_parts = [f"<{name}_context>"]
            for chunk in budget.chunks:
                if chunk.source:
                    section_parts.append(f"[Source: {chunk.source}]")
                section_parts.append(chunk.content)
            section_parts.append(f"</{name}_context>")
            sections.append("\n".join(section_parts))

        return "\n\n".join(sections)


_SOURCE_LABELS = {
    "codebase": "Codebase Context",
    "diff": "Code Diff",
    "docs": "Documentation",
    "memory": "Past Experience",
    "rules": "Learned Rules",
    "instructions": "Task Instructions",
}


def get_context_manager(
    max_tokens: int = 24000,
) -> AdaptiveContextManager:
    return AdaptiveContextManager(max_context_tokens=max_tokens)
