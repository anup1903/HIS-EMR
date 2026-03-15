"""Tests for the DAG scheduler."""

import pytest

from aegisforge.agent.scheduler import DAGScheduler
from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskStatus, TaskType


def _make_plan(*tasks: TaskNode) -> Plan:
    goal = Goal(title="Test", description="Test goal")
    return Plan(goal=goal, tasks=list(tasks))


def _task(name: str, **kwargs) -> TaskNode:
    return TaskNode(
        name=name,
        description=f"Task: {name}",
        task_type=kwargs.pop("task_type", TaskType.ANALYSIS),
        **kwargs,
    )


class TestDAGScheduler:
    def test_single_task_is_ready(self):
        t1 = _task("Task 1")
        scheduler = DAGScheduler(_make_plan(t1))
        ready = scheduler.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].task_id == t1.task_id

    def test_independent_tasks_all_ready(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2")
        t3 = _task("Task 3")
        scheduler = DAGScheduler(_make_plan(t1, t2, t3))
        ready = scheduler.get_ready_tasks()
        assert len(ready) == 3

    def test_dependent_task_blocked(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2", depends_on=[t1.task_id])
        scheduler = DAGScheduler(_make_plan(t1, t2))
        ready = scheduler.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].task_id == t1.task_id

    def test_dependent_task_becomes_ready(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2", depends_on=[t1.task_id])
        scheduler = DAGScheduler(_make_plan(t1, t2))

        scheduler.mark_task_completed(t1.task_id)
        ready = scheduler.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].task_id == t2.task_id

    def test_diamond_dependency(self):
        """A -> B, A -> C, B+C -> D"""
        a = _task("A")
        b = _task("B", depends_on=[a.task_id])
        c = _task("C", depends_on=[a.task_id])
        d = _task("D", depends_on=[b.task_id, c.task_id])
        scheduler = DAGScheduler(_make_plan(a, b, c, d))

        # Initially only A is ready
        assert [t.name for t in scheduler.get_ready_tasks()] == ["A"]

        # After A, both B and C are ready
        scheduler.mark_task_completed(a.task_id)
        ready_names = sorted(t.name for t in scheduler.get_ready_tasks())
        assert ready_names == ["B", "C"]

        # After B only, D is still blocked
        scheduler.mark_task_completed(b.task_id)
        assert [t.name for t in scheduler.get_ready_tasks()] == ["C"]

        # After C, D is ready
        scheduler.mark_task_completed(c.task_id)
        assert [t.name for t in scheduler.get_ready_tasks()] == ["D"]

    def test_mark_task_failed(self):
        t1 = _task("Task 1")
        scheduler = DAGScheduler(_make_plan(t1))
        scheduler.mark_task_failed(t1.task_id, "Error occurred")
        assert t1.status == TaskStatus.FAILED
        assert t1.error == "Error occurred"

    def test_skip_blocked_dependents(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2", depends_on=[t1.task_id])
        t3 = _task("Task 3", depends_on=[t2.task_id])
        scheduler = DAGScheduler(_make_plan(t1, t2, t3))

        scheduler.mark_task_failed(t1.task_id, "Failed")
        skipped = scheduler.skip_blocked_dependents(t1.task_id)
        assert len(skipped) == 2
        assert t2.status == TaskStatus.SKIPPED
        assert t3.status == TaskStatus.SKIPPED

    def test_all_terminal(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2")
        scheduler = DAGScheduler(_make_plan(t1, t2))
        assert not scheduler.all_terminal

        scheduler.mark_task_completed(t1.task_id)
        assert not scheduler.all_terminal

        scheduler.mark_task_completed(t2.task_id)
        assert scheduler.all_terminal

    def test_skipped_satisfies_dependency(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2", depends_on=[t1.task_id])
        scheduler = DAGScheduler(_make_plan(t1, t2))

        scheduler.mark_task_skipped(t1.task_id, "Not needed")
        ready = scheduler.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].task_id == t2.task_id

    def test_in_progress_count(self):
        t1 = _task("Task 1")
        t2 = _task("Task 2")
        scheduler = DAGScheduler(_make_plan(t1, t2))

        assert scheduler.in_progress_count == 0
        scheduler.mark_task_started(t1.task_id)
        assert scheduler.in_progress_count == 1

    def test_pending_approvals(self):
        t1 = _task("Task 1")
        scheduler = DAGScheduler(_make_plan(t1))
        scheduler.mark_task_awaiting_approval(t1.task_id)
        assert len(scheduler.pending_approvals) == 1
