"""Episodic memory — stores task outcomes as embeddings for semantic recall.

Enables the agent to learn from past executions by embedding task outcome
summaries with BGE-M3 and storing them in pgvector. Future planning and
execution steps can query this store to find relevant past experiences.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import structlog
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from aegisforge.memory.models import TaskOutcome
from aegisforge.planner.models import TaskNode, TaskStatus
from aegisforge.rag.embeddings import EmbeddingService

logger = structlog.get_logger()


class PastOutcome(BaseModel):
    """A recalled past task outcome with similarity score."""

    task_name: str
    task_type: str
    status: str
    duration_ms: float
    approach_summary: str
    error_summary: str | None
    lessons_learned: str | None
    similarity_score: float
    session_goal: str
    timestamp: datetime


class EpisodicMemory:
    """Semantic recall over past task outcomes using pgvector cosine similarity.

    Records task results as text summaries, embeds them with BGE-M3,
    and stores the vectors for future nearest-neighbour retrieval.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker,
        embedding_service: EmbeddingService,
    ) -> None:
        self._session_factory = session_factory
        self._embedding_service = embedding_service

    async def record_outcome(
        self,
        task: TaskNode,
        session_id: UUID,
        goal_summary: str,
        approach: str = "",
        lessons: str = "",
    ) -> None:
        """Create a text summary of a task outcome, embed it, and store in task_outcomes.

        Args:
            task: The completed TaskNode with status, output, error, timing, etc.
            session_id: The parent session's UUID.
            goal_summary: Short description of the session's goal.
            approach: How the task was executed (tool, strategy).
            lessons: Any lessons learned from this execution.
        """
        duration_ms = (task.duration_seconds or 0.0) * 1000.0
        error_text = task.error if task.status == TaskStatus.FAILED else None

        # Build a descriptive summary for embedding
        summary_parts = [
            f"Task: {task.name}.",
            f"Type: {task.task_type.value}.",
            f"Result: {task.status.value}.",
            f"Goal: {goal_summary}.",
            f"Description: {task.description}.",
        ]
        if approach:
            summary_parts.append(f"Approach: {approach}.")
        if error_text:
            summary_parts.append(f"Error: {error_text}.")
        if lessons:
            summary_parts.append(f"Lessons: {lessons}.")

        summary_text = " ".join(summary_parts)

        async with self._session_factory() as db:
            try:
                # Embed the summary
                embeddings = await self._embedding_service.embed_texts(
                    [summary_text], is_query=False
                )
                embedding_vector = embeddings[0]

                outcome = TaskOutcome(
                    session_id=session_id,
                    task_id=task.task_id,
                    task_type=task.task_type.value,
                    status=task.status.value,
                    goal_summary=goal_summary,
                    task_description=task.description,
                    approach=approach,
                    error_summary=error_text,
                    lessons=lessons or None,
                    duration_ms=duration_ms,
                    embedding=embedding_vector,
                )
                db.add(outcome)
                await db.commit()

                logger.info(
                    "episodic_memory.outcome_recorded",
                    task_id=str(task.task_id),
                    task_type=task.task_type.value,
                    status=task.status.value,
                    duration_ms=duration_ms,
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "episodic_memory.record_failed",
                    task_id=str(task.task_id),
                )
                raise

    async def recall(self, query: str, limit: int = 5) -> list[PastOutcome]:
        """Semantic search over past outcomes using pgvector cosine similarity.

        Args:
            query: Natural language query describing what to search for.
            limit: Maximum number of results to return.

        Returns:
            List of PastOutcome sorted by similarity (highest first).
        """
        query_embedding = await self._embedding_service.embed_query(query)

        async with self._session_factory() as db:
            try:
                distance = TaskOutcome.embedding.cosine_distance(query_embedding)
                stmt = (
                    select(TaskOutcome, (1 - distance).label("score"))
                    .order_by(distance)
                    .limit(limit)
                )

                result = await db.execute(stmt)
                rows = result.all()

                outcomes = [
                    self._row_to_past_outcome(row[0], float(row[1])) for row in rows
                ]

                logger.info(
                    "episodic_memory.recall",
                    query_preview=query[:80],
                    results=len(outcomes),
                )
                return outcomes
            except Exception:
                logger.exception("episodic_memory.recall_failed")
                raise

    async def recall_failures(
        self, task_type: str | None = None, limit: int = 5
    ) -> list[PastOutcome]:
        """Retrieve past failures, optionally filtered by task type.

        Useful for understanding what went wrong in similar past tasks
        to avoid repeating the same mistakes.
        """
        return await self._recall_by_status("failed", task_type=task_type, limit=limit)

    async def recall_successes(
        self, task_type: str | None = None, limit: int = 5
    ) -> list[PastOutcome]:
        """Retrieve past successes for positive examples.

        Useful for identifying approaches that worked well for similar tasks.
        """
        return await self._recall_by_status(
            "completed", task_type=task_type, limit=limit
        )

    async def _recall_by_status(
        self,
        status: str,
        task_type: str | None = None,
        limit: int = 5,
    ) -> list[PastOutcome]:
        """Internal helper to query outcomes by status and optional task type."""
        async with self._session_factory() as db:
            try:
                stmt = (
                    select(TaskOutcome)
                    .where(TaskOutcome.status == status)
                    .order_by(TaskOutcome.created_at.desc())
                    .limit(limit)
                )

                if task_type is not None:
                    stmt = stmt.where(TaskOutcome.task_type == task_type)

                result = await db.execute(stmt)
                records = result.scalars().all()

                outcomes = [
                    self._row_to_past_outcome(record, similarity_score=0.0)
                    for record in records
                ]

                logger.info(
                    "episodic_memory.recall_by_status",
                    status=status,
                    task_type=task_type,
                    results=len(outcomes),
                )
                return outcomes
            except Exception:
                logger.exception(
                    "episodic_memory.recall_by_status_failed",
                    status=status,
                )
                raise

    @staticmethod
    def _row_to_past_outcome(
        record: TaskOutcome, similarity_score: float
    ) -> PastOutcome:
        """Convert a TaskOutcome ORM row to a PastOutcome response model."""
        return PastOutcome(
            task_name=record.task_description[:120],
            task_type=record.task_type,
            status=record.status,
            duration_ms=record.duration_ms,
            approach_summary=record.approach or "",
            error_summary=record.error_summary,
            lessons_learned=record.lessons,
            similarity_score=similarity_score,
            session_goal=record.goal_summary,
            timestamp=record.created_at,
        )
