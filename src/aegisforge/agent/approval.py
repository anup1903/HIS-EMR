"""Approval gate controller — manages plan and task approval workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import structlog

from aegisforge.agent.models import ApprovalRequest, ExecutionState

logger = structlog.get_logger()


class ApprovalController:
    """Manages approval requests for plans and tasks.

    Approval flow:
    1. Orchestrator detects a task/plan requires approval
    2. ApprovalController creates an ApprovalRequest
    3. Notification sent via Slack connector (interactive buttons)
    4. Human approves/rejects via API endpoint
    5. ApprovalController resolves the request, orchestrator resumes
    """

    def __init__(self) -> None:
        self._pending: dict[UUID, ApprovalRequest] = {}

    def request_plan_approval(
        self,
        session_id: UUID,
        plan_id: UUID,
        requested_by: str,
        reason: str = "",
    ) -> ApprovalRequest:
        """Create a plan-level approval request."""
        approval = ApprovalRequest(
            session_id=session_id,
            plan_id=plan_id,
            requested_by=requested_by,
            reason=reason or "Plan contains tasks requiring approval",
            risk_level="high",
        )
        self._pending[approval.approval_id] = approval
        logger.info(
            "approval.plan_requested",
            approval_id=str(approval.approval_id),
            plan_id=str(plan_id),
            session_id=str(session_id),
        )
        return approval

    def request_task_approval(
        self,
        session_id: UUID,
        task_id: UUID,
        requested_by: str,
        reason: str = "",
        risk_level: str = "high",
    ) -> ApprovalRequest:
        """Create a task-level approval request."""
        approval = ApprovalRequest(
            session_id=session_id,
            task_id=task_id,
            requested_by=requested_by,
            reason=reason,
            risk_level=risk_level,
        )
        self._pending[approval.approval_id] = approval
        logger.info(
            "approval.task_requested",
            approval_id=str(approval.approval_id),
            task_id=str(task_id),
            risk_level=risk_level,
        )
        return approval

    def approve(
        self,
        approval_id: UUID,
        approved_by: str,
        comments: str | None = None,
    ) -> ApprovalRequest:
        """Approve a pending request."""
        approval = self._pending.get(approval_id)
        if not approval:
            raise ValueError(f"Approval request not found: {approval_id}")
        if approval.status != "pending":
            raise ValueError(
                f"Approval {approval_id} is already {approval.status}"
            )

        approval.status = "approved"
        approval.resolved_by = approved_by
        approval.resolved_at = datetime.now(timezone.utc)
        approval.comments = comments

        logger.info(
            "approval.approved",
            approval_id=str(approval_id),
            approved_by=approved_by,
            task_id=str(approval.task_id) if approval.task_id else None,
            plan_id=str(approval.plan_id) if approval.plan_id else None,
        )
        return approval

    def reject(
        self,
        approval_id: UUID,
        rejected_by: str,
        comments: str | None = None,
    ) -> ApprovalRequest:
        """Reject a pending request."""
        approval = self._pending.get(approval_id)
        if not approval:
            raise ValueError(f"Approval request not found: {approval_id}")
        if approval.status != "pending":
            raise ValueError(
                f"Approval {approval_id} is already {approval.status}"
            )

        approval.status = "rejected"
        approval.resolved_by = rejected_by
        approval.resolved_at = datetime.now(timezone.utc)
        approval.comments = comments

        logger.info(
            "approval.rejected",
            approval_id=str(approval_id),
            rejected_by=rejected_by,
        )
        return approval

    def get_pending(self, session_id: UUID | None = None) -> list[ApprovalRequest]:
        """Get all pending approval requests, optionally filtered by session."""
        pending = [a for a in self._pending.values() if a.status == "pending"]
        if session_id:
            pending = [a for a in pending if a.session_id == session_id]
        return pending

    def get_approval(self, approval_id: UUID) -> ApprovalRequest | None:
        return self._pending.get(approval_id)

    def has_pending_for_task(self, task_id: UUID) -> bool:
        return any(
            a.task_id == task_id and a.status == "pending"
            for a in self._pending.values()
        )

    def has_pending_for_plan(self, plan_id: UUID) -> bool:
        return any(
            a.plan_id == plan_id and a.status == "pending"
            for a in self._pending.values()
        )
