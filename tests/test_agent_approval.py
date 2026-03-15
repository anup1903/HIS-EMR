"""Tests for the approval controller."""

from uuid import uuid4

import pytest

from aegisforge.agent.approval import ApprovalController


class TestApprovalController:
    def test_request_plan_approval(self):
        ctrl = ApprovalController()
        approval = ctrl.request_plan_approval(
            session_id=uuid4(),
            plan_id=uuid4(),
            requested_by="user@test.com",
            reason="High risk plan",
        )
        assert approval.status == "pending"
        assert approval.requested_by == "user@test.com"

    def test_request_task_approval(self):
        ctrl = ApprovalController()
        approval = ctrl.request_task_approval(
            session_id=uuid4(),
            task_id=uuid4(),
            requested_by="user@test.com",
            risk_level="critical",
        )
        assert approval.risk_level == "critical"

    def test_approve(self):
        ctrl = ApprovalController()
        approval = ctrl.request_plan_approval(
            session_id=uuid4(),
            plan_id=uuid4(),
            requested_by="user@test.com",
        )
        result = ctrl.approve(
            approval.approval_id,
            approved_by="admin@test.com",
            comments="Looks good",
        )
        assert result.status == "approved"
        assert result.resolved_by == "admin@test.com"
        assert result.resolved_at is not None

    def test_reject(self):
        ctrl = ApprovalController()
        approval = ctrl.request_plan_approval(
            session_id=uuid4(),
            plan_id=uuid4(),
            requested_by="user@test.com",
        )
        result = ctrl.reject(
            approval.approval_id,
            rejected_by="admin@test.com",
            comments="Too risky",
        )
        assert result.status == "rejected"

    def test_approve_nonexistent_raises(self):
        ctrl = ApprovalController()
        with pytest.raises(ValueError, match="not found"):
            ctrl.approve(uuid4(), "admin@test.com")

    def test_double_approve_raises(self):
        ctrl = ApprovalController()
        approval = ctrl.request_plan_approval(
            session_id=uuid4(), plan_id=uuid4(), requested_by="user@test.com"
        )
        ctrl.approve(approval.approval_id, "admin@test.com")
        with pytest.raises(ValueError, match="already"):
            ctrl.approve(approval.approval_id, "admin@test.com")

    def test_get_pending(self):
        ctrl = ApprovalController()
        sid = uuid4()
        ctrl.request_plan_approval(session_id=sid, plan_id=uuid4(), requested_by="a")
        ctrl.request_task_approval(session_id=sid, task_id=uuid4(), requested_by="b")
        ctrl.request_task_approval(session_id=uuid4(), task_id=uuid4(), requested_by="c")

        all_pending = ctrl.get_pending()
        assert len(all_pending) == 3

        session_pending = ctrl.get_pending(session_id=sid)
        assert len(session_pending) == 2

    def test_has_pending_for_task(self):
        ctrl = ApprovalController()
        tid = uuid4()
        ctrl.request_task_approval(session_id=uuid4(), task_id=tid, requested_by="a")
        assert ctrl.has_pending_for_task(tid)
        assert not ctrl.has_pending_for_task(uuid4())

    def test_has_pending_for_plan(self):
        ctrl = ApprovalController()
        pid = uuid4()
        ctrl.request_plan_approval(session_id=uuid4(), plan_id=pid, requested_by="a")
        assert ctrl.has_pending_for_plan(pid)
        assert not ctrl.has_pending_for_plan(uuid4())
