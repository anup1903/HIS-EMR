"""Tests for planner data models — Goal, TaskNode, Plan, DAG validation."""

from __future__ import annotations

from uuid import uuid4

import pytest

from aegisforge.planner.models import (
    Goal,
    Plan,
    RiskLevel,
    TaskNode,
    TaskStatus,
    TaskType,
)


class TestTaskNode:
    def test_default_status_is_pending(self) -> None:
        task = TaskNode(
            name="Test task",
            description="A test",
            task_type=TaskType.ANALYSIS,
        )
        assert task.status == TaskStatus.PENDING
        assert task.risk_level == RiskLevel.LOW
        assert task.max_retries == 3

    def test_duration_none_when_not_started(self) -> None:
        task = TaskNode(name="t", description="d", task_type=TaskType.ANALYSIS)
        assert task.duration_seconds is None


class TestGoal:
    def test_goal_creation(self) -> None:
        goal = Goal(
            title="Add auth",
            description="Add authentication to the API",
            constraints=["Must use Okta SSO"],
            acceptance_criteria=["Users can log in via SSO"],
        )
        assert goal.title == "Add auth"
        assert len(goal.constraints) == 1
        assert goal.priority == 5


class TestPlan:
    def _make_plan_with_chain(self) -> Plan:
        """Create a plan: T1 → T2 → T3 (linear chain)."""
        t1 = TaskNode(name="Task 1", description="first", task_type=TaskType.ANALYSIS)
        t2 = TaskNode(
            name="Task 2",
            description="second",
            task_type=TaskType.CODE_GENERATION,
            depends_on=[t1.task_id],
        )
        t3 = TaskNode(
            name="Task 3",
            description="third",
            task_type=TaskType.TEST_EXECUTION,
            depends_on=[t2.task_id],
        )
        goal = Goal(title="Test", description="Test plan")
        return Plan(goal=goal, tasks=[t1, t2, t3])

    def test_task_count(self) -> None:
        plan = self._make_plan_with_chain()
        assert plan.task_count == 3

    def test_progress_zero_initially(self) -> None:
        plan = self._make_plan_with_chain()
        assert plan.progress_pct == 0.0

    def test_progress_after_completion(self) -> None:
        plan = self._make_plan_with_chain()
        plan.tasks[0].status = TaskStatus.COMPLETED
        assert plan.progress_pct == pytest.approx(33.33, rel=0.1)

    def test_get_ready_tasks_returns_root(self) -> None:
        plan = self._make_plan_with_chain()
        ready = plan.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].name == "Task 1"

    def test_get_ready_tasks_after_first_complete(self) -> None:
        plan = self._make_plan_with_chain()
        plan.tasks[0].status = TaskStatus.COMPLETED
        ready = plan.get_ready_tasks()
        assert len(ready) == 1
        assert ready[0].name == "Task 2"

    def test_validate_dag_valid(self) -> None:
        plan = self._make_plan_with_chain()
        errors = plan.validate_dag()
        assert errors == []

    def test_validate_dag_missing_dependency(self) -> None:
        t1 = TaskNode(
            name="Orphan",
            description="depends on non-existent",
            task_type=TaskType.ANALYSIS,
            depends_on=[uuid4()],
        )
        plan = Plan(goal=Goal(title="T", description="T"), tasks=[t1])
        errors = plan.validate_dag()
        assert any("unknown task ID" in e for e in errors)

    def test_validate_dag_cycle_detection(self) -> None:
        t1 = TaskNode(name="A", description="a", task_type=TaskType.ANALYSIS)
        t2 = TaskNode(
            name="B",
            description="b",
            task_type=TaskType.ANALYSIS,
            depends_on=[t1.task_id],
        )
        # Create cycle: A depends on B, but B also depends on A
        t1.depends_on.append(t2.task_id)

        plan = Plan(goal=Goal(title="T", description="T"), tasks=[t1, t2])
        errors = plan.validate_dag()
        assert any("Cycle" in e for e in errors)

    def test_get_task_by_id(self) -> None:
        plan = self._make_plan_with_chain()
        task = plan.get_task(plan.tasks[1].task_id)
        assert task is not None
        assert task.name == "Task 2"

    def test_get_task_returns_none_for_unknown(self) -> None:
        plan = self._make_plan_with_chain()
        assert plan.get_task(uuid4()) is None

    def test_empty_plan_progress(self) -> None:
        plan = Plan(goal=Goal(title="T", description="T"), tasks=[])
        assert plan.progress_pct == 0.0
        assert plan.get_ready_tasks() == []

    def test_parallel_tasks_all_ready(self) -> None:
        """Tasks with no dependencies should all be ready."""
        t1 = TaskNode(name="A", description="a", task_type=TaskType.ANALYSIS)
        t2 = TaskNode(name="B", description="b", task_type=TaskType.ANALYSIS)
        t3 = TaskNode(name="C", description="c", task_type=TaskType.ANALYSIS)
        plan = Plan(goal=Goal(title="T", description="T"), tasks=[t1, t2, t3])
        ready = plan.get_ready_tasks()
        assert len(ready) == 3
