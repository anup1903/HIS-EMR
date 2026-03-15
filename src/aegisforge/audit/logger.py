"""Audit logger — writes immutable events to the audit_events table.

All events are PII-redacted before storage. The audit table is append-only;
no UPDATE or DELETE operations are permitted.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.audit.models import AuditAction, AuditEvent
from aegisforge.audit.redactor import PIIRedactor, get_redactor

logger = structlog.get_logger()


class AuditLogger:
    """Writes immutable audit events to PostgreSQL.

    Usage:
        audit = AuditLogger(session)
        await audit.log(
            action=AuditAction.TASK_COMPLETED,
            actor_id="user:jane@company.com",
            resource_type="task",
            resource_id="abc-123",
            description="Completed code generation task",
        )
    """

    def __init__(
        self,
        session: AsyncSession,
        redactor: PIIRedactor | None = None,
    ) -> None:
        self._session = session
        self._redactor = redactor or get_redactor()

    async def log(
        self,
        action: AuditAction | str,
        actor_id: str,
        resource_type: str = "",
        resource_id: str = "",
        description: str = "",
        diff: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        status: str = "success",
        error_message: str | None = None,
        duration_ms: float | None = None,
        actor_type: str = "user",
        actor_ip: str | None = None,
        actor_user_agent: str | None = None,
        request_id: str | None = None,
        parent_event_id: UUID | None = None,
        approval_required: bool = False,
        approved_by: str | None = None,
    ) -> AuditEvent:
        """Record an immutable audit event.

        All text fields are PII-redacted before storage.
        """
        action_str = action.value if isinstance(action, AuditAction) else action

        # PII-redact all user-facing text
        safe_description = self._redactor.redact_text(description)
        safe_error = self._redactor.redact_text(error_message) if error_message else None
        safe_diff = self._redactor.redact_dict(diff) if diff else None
        safe_metadata = self._redactor.redact_dict(metadata) if metadata else {}

        event = AuditEvent(
            actor_id=actor_id,
            actor_type=actor_type,
            actor_ip=actor_ip,
            actor_user_agent=actor_user_agent,
            action=action_str,
            resource_type=resource_type,
            resource_id=resource_id,
            description=safe_description,
            diff=safe_diff,
            metadata=safe_metadata,
            status=status,
            error_message=safe_error,
            duration_ms=duration_ms,
            approval_required=approval_required,
            approved_by=approved_by,
            approval_timestamp=datetime.now(timezone.utc) if approved_by else None,
            request_id=request_id,
            parent_event_id=parent_event_id,
        )

        self._session.add(event)
        await self._session.flush()

        logger.info(
            "audit.event_recorded",
            action=action_str,
            actor=actor_id,
            resource=f"{resource_type}:{resource_id}",
            status=status,
        )

        return event

    async def log_approval(
        self,
        action: AuditAction,
        actor_id: str,
        resource_type: str,
        resource_id: str,
        approved_by: str,
        description: str = "",
    ) -> AuditEvent:
        """Record an approval event (shortcut)."""
        return await self.log(
            action=action,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            approval_required=True,
            approved_by=approved_by,
            status="success",
        )

    async def log_failure(
        self,
        action: AuditAction,
        actor_id: str,
        resource_type: str,
        resource_id: str,
        error_message: str,
        duration_ms: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditEvent:
        """Record a failure event (shortcut)."""
        return await self.log(
            action=action,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            description=f"Failed: {error_message}",
            status="failure",
            error_message=error_message,
            duration_ms=duration_ms,
            metadata=metadata,
        )


def get_audit_logger(session: AsyncSession) -> AuditLogger:
    return AuditLogger(session=session)
