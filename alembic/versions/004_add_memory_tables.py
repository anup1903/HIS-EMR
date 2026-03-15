"""Add memory layer tables: task_outcomes, learned_rules, session_records.

Revision ID: 004_memory_tables
Revises: 003_agent_tables
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers
revision = "004_memory_tables"
down_revision = "003_agent_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure pgvector extension is available
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── task_outcomes ──────────────────────────────────────────────────
    op.create_table(
        "task_outcomes",
        sa.Column(
            "outcome_id",
            UUID,
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("session_id", UUID, nullable=False),
        sa.Column("task_id", UUID, nullable=False),
        sa.Column("task_type", sa.VARCHAR(64), nullable=False),
        sa.Column("status", sa.VARCHAR(32), nullable=False),
        sa.Column("goal_summary", sa.Text, nullable=False),
        sa.Column("task_description", sa.Text, nullable=False),
        sa.Column("approach", sa.Text, nullable=False, server_default=""),
        sa.Column("error_summary", sa.Text, nullable=True),
        sa.Column("lessons", sa.Text, nullable=True),
        sa.Column("duration_ms", sa.Float, nullable=False, server_default="0"),
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_task_outcomes_session_id", "task_outcomes", ["session_id"])

    # HNSW index for fast approximate nearest neighbor search
    op.execute(
        "CREATE INDEX ix_task_outcomes_embedding_hnsw "
        "ON task_outcomes USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 256)"
    )

    # ── learned_rules ─────────────────────────────────────────────────
    op.create_table(
        "learned_rules",
        sa.Column(
            "rule_id",
            UUID,
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "rule_type",
            sa.VARCHAR(32),
            nullable=False,
            comment="positive, negative, estimation, or constraint",
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("task_types", JSONB, nullable=False, server_default="[]"),
        sa.Column("source_sessions", JSONB, nullable=False, server_default="[]"),
        sa.Column("times_confirmed", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_confirmed",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "active", sa.Boolean, nullable=False, server_default=sa.text("true")
        ),
    )

    # Partial index on active rules for efficient filtered queries
    op.execute(
        "CREATE INDEX ix_learned_rules_active "
        "ON learned_rules (rule_id) "
        "WHERE active = true"
    )

    # ── session_records ───────────────────────────────────────────────
    op.create_table(
        "session_records",
        sa.Column(
            "record_id",
            UUID,
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("session_id", UUID, unique=True, nullable=False),
        sa.Column("goal", JSONB, nullable=False),
        sa.Column("plan", JSONB, nullable=True),
        sa.Column(
            "state",
            sa.VARCHAR(32),
            nullable=False,
            server_default="planning",
        ),
        sa.Column("actor_id", sa.VARCHAR(255), nullable=False),
        sa.Column(
            "actor_role",
            sa.VARCHAR(32),
            nullable=False,
            server_default="operator",
        ),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("execution_log", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_session_records_state", "session_records", ["state"])
    op.create_index("ix_session_records_actor_id", "session_records", ["actor_id"])
    op.create_index(
        "ix_session_records_created_at", "session_records", ["created_at"]
    )


def downgrade() -> None:
    op.drop_table("session_records")

    op.execute("DROP INDEX IF EXISTS ix_learned_rules_active")
    op.drop_table("learned_rules")

    op.execute("DROP INDEX IF EXISTS ix_task_outcomes_embedding_hnsw")
    op.drop_table("task_outcomes")
