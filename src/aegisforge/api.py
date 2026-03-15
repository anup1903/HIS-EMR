"""Public API routes for RAG querying and plan generation."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.dependencies import get_db
from aegisforge.llm.client import get_llm_client
from aegisforge.planner.decomposer import PlanDecomposer
from aegisforge.planner.models import Goal, Plan, TaskNode
from aegisforge.rag.pipeline import RAGPipeline
from aegisforge.rag.reranker import get_reranker
from aegisforge.rag.embeddings import get_embedding_service

router = APIRouter(prefix="/api/v1", tags=["api"])


# ── RAG Query ────────────────────────────────────────────────────────────────


class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, description="User question or task")
    collection: str | None = Field(
        default=None, description="Optional collection name to scope retrieval"
    )


class RAGSource(BaseModel):
    index: int | None = None
    source: str
    start_line: int | None = None
    end_line: int | None = None
    score: float | None = None


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[RAGSource] = Field(default_factory=list)
    chunks_used: int = 0


@router.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(
    payload: RAGQueryRequest,
    session: AsyncSession = Depends(get_db),
) -> RAGQueryResponse:
    """Run a retrieval-augmented query against the knowledge base."""
    # Demo mode: return a fast canned response to avoid heavy model loads
    if os.getenv("AEGIS_DEMO_MODE"):
        return RAGQueryResponse(
            answer="Audit middleware logs every HTTP request with PII redaction and injects a request_id.",
            sources=[
                RAGSource(
                    index=1,
                    source="aegisforge/audit/middleware.py",
                    start_line=10,
                    end_line=70,
                    score=0.99,
                )
            ],
            chunks_used=1,
        )

    try:
        pipeline = RAGPipeline(
            session=session,
            llm_client=get_llm_client(),
            embedding_service=get_embedding_service(),
            reranker=get_reranker(),
        )
        result = await pipeline.query(
            question=payload.question,
            collection=payload.collection,
        )
        sources = [
            RAGSource(**s) for s in result.metadata.get("rag_sources", [])
        ]
        return RAGQueryResponse(
            answer=result.content,
            sources=sources,
            chunks_used=result.metadata.get("rag_chunks_used", 0),
        )
    except Exception as exc:  # pragma: no cover - surfaced to client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG query failed: {type(exc).__name__}",
        ) from exc


# ── Plan Generation ─────────────────────────────────────────────────────────-


class PlanRequest(BaseModel):
    title: str
    description: str
    context: str = ""
    constraints: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    collection: str | None = None


@router.post("/planner/plan", response_model=Plan)
async def create_plan(
    payload: PlanRequest,
    session: AsyncSession = Depends(get_db),
) -> Plan:
    """Decompose a goal into an executable plan using the reasoning LLM + RAG."""
    if os.getenv("AEGIS_DEMO_MODE"):
        goal = Goal(
            title=payload.title,
            description=payload.description,
            context=payload.context,
            constraints=payload.constraints,
            acceptance_criteria=payload.acceptance_criteria,
        )
        from uuid import uuid4
        from aegisforge.planner.models import TaskType, RiskLevel
        return Plan(
            goal=goal,
            tasks=[
                TaskNode(
                    task_id=uuid4(),
                    name="Review audit middleware",
                    description="Read audit/middleware.py to confirm request logging and redaction.",
                    task_type=TaskType.ANALYSIS,
                    risk_level=RiskLevel.LOW,
                    depends_on=[],
                ),
                TaskNode(
                    task_id=uuid4(),
                    name="Add RAG endpoint",
                    description="Implement POST /api/v1/rag/query returning answer + sources.",
                    task_type=TaskType.CODE_MODIFICATION,
                    risk_level=RiskLevel.MEDIUM,
                    depends_on=[],
                ),
                TaskNode(
                    task_id=uuid4(),
                    name="Add tests",
                    description="Add unit tests for RAG pipeline and API surface.",
                    task_type=TaskType.TEST_CREATION,
                    risk_level=RiskLevel.LOW,
                    depends_on=[],
                ),
            ],
            reasoning="Demo mode: planner stubbed for fast UI response.",
            assumptions=[],
            open_questions=[],
            rag_sources_used=[],
        )

    try:
        goal = Goal(
            title=payload.title,
            description=payload.description,
            context=payload.context,
            constraints=payload.constraints,
            acceptance_criteria=payload.acceptance_criteria,
        )

        rag = RAGPipeline(
            session=session,
            llm_client=get_llm_client(),
            embedding_service=get_embedding_service(),
            reranker=get_reranker(),
        )

        decomposer = PlanDecomposer(
            session=session,
            llm_client=get_llm_client(),
            rag_pipeline=rag,
        )

        plan = await decomposer.decompose(goal=goal, collection=payload.collection or "default")
        plan.rag_sources_used = plan.rag_sources_used or []
        return plan
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plan generation failed: {type(exc).__name__}",
        ) from exc
