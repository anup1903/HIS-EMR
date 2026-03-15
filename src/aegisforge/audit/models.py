"""Immutable audit event model — append-only PostgreSQL table.

CRITICAL: This table is append-only. No UPDATE or DELETE operations
are permitted at the application layer. Enforced by:
1. No update/delete methods in the repository
2. PostgreSQL trigger blocking UPDATE/DELETE (applied via migration)
3. Row-level security policy (if using RLS)
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from aegisforge.db.base import Base


class AuditAction(str, Enum):
    """Categorized actions tracked in the audit log."""

    # Auth
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    TOKEN_REFRESH = "auth.token_refresh"
    PERMISSION_CHECK = "auth.permission_check"

    # Planning
    GOAL_CREATED = "planner.goal_created"
    PLAN_GENERATED = "planner.plan_generated"
    PLAN_APPROVED = "planner.plan_approved"
    PLAN_REJECTED = "planner.plan_rejected"
    PLAN_REFINED = "planner.plan_refined"

    # Execution
    TASK_STARTED = "executor.task_started"
    TASK_COMPLETED = "executor.task_completed"
    TASK_FAILED = "executor.task_failed"
    TASK_RETRIED = "executor.task_retried"
    TASK_ROLLED_BACK = "executor.task_rolled_back"

    # Approval
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_GRANTED = "approval.granted"
    APPROVAL_DENIED = "approval.denied"
    APPROVAL_EXPIRED = "approval.expired"

    # Deployment
    DEPLOY_STARTED = "deploy.started"
    DEPLOY_CANARY = "deploy.canary"
    DEPLOY_PROMOTED = "deploy.promoted"
    DEPLOY_ROLLED_BACK = "deploy.rolled_back"

    # Data
    SECRET_ACCESSED = "secret.accessed"
    DB_MIGRATION_RUN = "db.migration_run"
    DB_MIGRATION_ROLLBACK = "db.migration_rollback"
    BULK_OPERATION = "data.bulk_operation"

    # LLM / RAG
    LLM_REQUEST = "llm.request"
    LLM_FALLBACK = "llm.fallback"
    RAG_QUERY = "rag.query"
    KNOWLEDGE_INGESTED = "knowledge.ingested"

    # External
    API_CALL_OUTBOUND = "api.outbound"
    WEBHOOK_RECEIVED = "api.webhook_received"

    # Admin
    CONFIG_CHANGED = "admin.config_changed"
    RBAC_MODIFIED = "admin.rbac_modified"


class AuditEvent(Base):
    """Immutable audit event — append-only, never modified or deleted.

    Retention: 7 years (2555 days) per SOC2/ISO27001/PCI/HIPAA requirements.
    Archived to S3 after 90 days (hot), queryable via Athena (cold).
    """

    __tablename__ = "audit_events"

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # When
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Who
    actor_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        doc="User ID, service account, or 'system'",
    )
    actor_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="user",
        doc="'user', 'service', 'system', 'scheduler'",
    )
    actor_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    actor_user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # What
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="",
        doc="E.g., 'goal', 'plan', 'task', 'deployment', 'secret'",
    )
    resource_id: Mapped[str] = mapped_column(
        String(255), nullable=False, default="",
        doc="ID of the affected resource",
    )

    # Details (PII-redacted before storage)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    diff: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)

    # Outcome
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="success",
        doc="'success', 'failure', 'denied', 'timeout'",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(nullable=True)

    # Approval chain (for destructive actions)
    approval_required: Mapped[bool] = mapped_column(default=False)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approval_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Correlation
    request_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True,
        doc="Correlates events across a single request/workflow",
    )
    parent_event_id: Mapped[UUID | None] = mapped_column(nullable=True)
