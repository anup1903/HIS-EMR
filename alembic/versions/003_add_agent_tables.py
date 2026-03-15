"""Add agent sessions, task executions, and approval tables.

Revision ID: 003_agent_tables
Revises: 002
Create Date: 2026-03-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = "003_agent_tables"
down_revision = None  # Update to actual previous revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agent sessions table
    op.create_table(
        "agent_sessions",
        sa.Column("session_id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("goal", JSONB, nullable=False),
        sa.Column("plan", JSONB, nullable=True),
        sa.Column("state", sa.VARCHAR(32), nullable=False, server_default="planning"),
        sa.Column("actor_id", sa.VARCHAR(255), nullable=False),
        sa.Column("actor_role", sa.VARCHAR(32), nullable=False, server_default="operator"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_sessions_state", "agent_sessions", ["state"])
    op.create_index("idx_sessions_actor", "agent_sessions", ["actor_id"])
    op.create_index("idx_sessions_created", "agent_sessions", ["created_at"])

    # Task executions table
    op.create_table(
        "task_executions",
        sa.Column("execution_id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID, sa.ForeignKey("agent_sessions.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", UUID, nullable=False),
        sa.Column("task_name", sa.VARCHAR(255), nullable=False, server_default=""),
        sa.Column("task_type", sa.VARCHAR(32), nullable=False),
        sa.Column("status", sa.VARCHAR(32), nullable=False, server_default="pending"),
        sa.Column("connector", sa.VARCHAR(64), nullable=True),
        sa.Column("input", JSONB, nullable=True),
        sa.Column("output", JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Float, nullable=True),
    )
    op.create_index("idx_executions_session", "task_executions", ["session_id"])
    op.create_index("idx_executions_status", "task_executions", ["status"])
    op.create_index("idx_executions_task", "task_executions", ["task_id"])

    # Approval requests table
    op.create_table(
        "approval_requests",
        sa.Column("approval_id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID, sa.ForeignKey("agent_sessions.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", UUID, nullable=True),
        sa.Column("plan_id", UUID, nullable=True),
        sa.Column("requested_by", sa.VARCHAR(255), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("risk_level", sa.VARCHAR(16), nullable=False, server_default="medium"),
        sa.Column("status", sa.VARCHAR(16), nullable=False, server_default="pending"),
        sa.Column("resolved_by", sa.VARCHAR(255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comments", sa.Text, nullable=True),
    )
    op.create_index("idx_approvals_pending", "approval_requests", ["status"], postgresql_where=sa.text("status = 'pending'"))
    op.create_index("idx_approvals_session", "approval_requests", ["session_id"])


def downgrade() -> None:
    op.drop_table("approval_requests")
    op.drop_table("task_executions")
    op.drop_table("agent_sessions")
