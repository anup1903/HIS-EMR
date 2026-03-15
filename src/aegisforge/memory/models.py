"""SQLAlchemy ORM models for the memory & feedback layer.

Tables:
  - task_outcomes: completed task results with pgvector embedding for semantic recall
  - learned_rules: patterns extracted from outcomes for future planning
  - session_records: persisted agent sessions (replaces in-memory dict)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from aegisforge.db.base import Base


class TaskOutcome(Base):
    """Stores completed task results with pgvector embedding for semantic recall.

    Each outcome captures what was attempted, whether it succeeded, how long
    it took, and any lessons learned. The embedding enables future semantic
    search over past execution history.
    """

    __tablename__ = "task_outcomes"

    outcome_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    goal_summary: Mapped[str] = mapped_column(Text, nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    approach: Mapped[str] = mapped_column(Text, nullable=False, default="")
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    lessons: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Embedding vector — 1024-dim to match BGE-M3
    embedding: Mapped[Any] = mapped_column(Vector(1024), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_task_outcomes_embedding_hnsw",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 256},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class LearnedRule(Base):
    """Patterns extracted from task outcomes for future planning guidance.

    Rules have a confidence score that increases when confirmed and decreases
    when contradicted. Rules below a confidence threshold are deactivated.
    """

    __tablename__ = "learned_rules"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    rule_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="positive, negative, estimation, or constraint",
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    task_types: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    source_sessions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    times_confirmed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    last_confirmed: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    __table_args__ = (
        Index(
            "ix_learned_rules_active",
            "rule_id",
            postgresql_where="active = true",
        ),
    )


class SessionRecord(Base):
    """Persisted agent session — durable replacement for the in-memory dict.

    Stores the full session state including serialised goal, plan, and
    execution log so sessions survive process restarts.
    """

    __tablename__ = "session_records"

    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
    )
    goal: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    plan: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="planning", index=True
    )
    actor_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    actor_role: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="operator"
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_log: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
