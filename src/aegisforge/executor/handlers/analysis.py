"""Handler for ANALYSIS tasks.

Uses the REASONING-tier LLM (DeepSeek-R1) combined with RAG retrieval
for deep, multi-step analysis. Returns structured findings.
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

_ANALYSIS_SYSTEM = (
    "You are a principal engineer performing deep technical analysis. "
    "Provide thorough, well-reasoned analysis with:\n"
    "1. Executive summary (2-3 sentences)\n"
    "2. Detailed findings with evidence\n"
    "3. Risk assessment (if applicable)\n"
    "4. Actionable recommendations (prioritised)\n\n"
    "Format your response as structured JSON with:\n"
    '  "summary": "...",\n'
    '  "findings": [{"title": "...", "detail": "...", "severity": "high|medium|low", '
    '"evidence": "..."}],\n'
    '  "risks": [{"description": "...", "likelihood": "...", "impact": "..."}],\n'
    '  "recommendations": [{"action": "...", "priority": 1, "effort": "low|medium|high"}]\n'
    "Output ONLY valid JSON."
)


async def handle_analysis(
    task: TaskNode,
    llm_client: LLMClient,
    rag_pipeline: RAGPipeline | None,
    connector_hub: ConnectorHub,
) -> TaskResult:
    """Perform deep analysis using the REASONING tier and RAG context.

    Workflow:
        1. Query RAG for all relevant context (code, docs, tickets).
        2. Call the REASONING-tier LLM (DeepSeek-R1) with full context
           to produce a structured analysis.
        3. Return findings as structured output.

    ``tool_input`` keys:
        - query: str — analysis query (falls back to task.description)
        - collections: list[str] — RAG collections to search (default: all)
        - max_context_chunks: int — how many RAG chunks to include
    """
    log = logger.bind(task_id=str(task.task_id), handler="analysis")

    analysis_query = task.tool_input.get("query", task.description)
    collections = task.tool_input.get("collections", ["codebase", "docs"])
    max_chunks = task.tool_input.get("max_context_chunks", 15)

    # ── 1. RAG retrieval across collections ─────────────────────────────
    all_context_parts: list[str] = []

    if rag_pipeline is not None:
        for collection in collections:
            try:
                retrieved = await rag_pipeline.retrieve(
                    query=analysis_query,
                    collection=collection,
                    top_k=max_chunks,
                )
                for chunk in retrieved:
                    source = chunk.get("source", "unknown")
                    content = chunk.get("content", "")
                    all_context_parts.append(f"[{collection}:{source}]\n{content}")
            except Exception as exc:
                log.warning(
                    "analysis.rag_failed",
                    collection=collection,
                    error=str(exc),
                )

    rag_context = "\n\n---\n\n".join(all_context_parts) if all_context_parts else ""

    # ── 2. REASONING-tier analysis ──────────────────────────────────────
    prompt_parts = [f"## Analysis Request\n{analysis_query}"]

    if task.success_criteria:
        prompt_parts.append(f"## Expected Deliverables\n{task.success_criteria}")

    if rag_context:
        prompt_parts.append(
            f"## Retrieved Context\n{rag_context[:10000]}"
        )

    prompt = "\n\n".join(prompt_parts)

    response = await llm_client.reason(
        prompt=prompt,
        system_prompt=_ANALYSIS_SYSTEM,
        max_tokens=8192,
    )

    log.info(
        "analysis.complete",
        output_length=len(response.content),
        has_thinking=response.thinking is not None,
        tokens=response.usage.total_tokens,
    )

    return TaskResult(
        task_id=task.task_id,
        status=TaskStatus.COMPLETED,
        output=response.content,
        artifacts=[
            {
                "type": "analysis",
                "model": response.model,
                "rag_chunks_used": len(all_context_parts),
                "has_reasoning": response.thinking is not None,
            },
        ],
    )
