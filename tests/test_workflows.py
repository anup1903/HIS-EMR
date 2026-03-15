"""Tests for workflow engine and templates."""

import pytest

from aegisforge.planner.models import TaskStatus, TaskType
from aegisforge.workflows.engine import WorkflowEngine
from aegisforge.workflows.templates.bug_fix import BugFixWorkflow
from aegisforge.workflows.templates.deploy import DeployWorkflow
from aegisforge.workflows.templates.feature import FeatureWorkflow
from aegisforge.workflows.templates.incident import IncidentWorkflow
from aegisforge.workflows.templates.review import CodeReviewWorkflow


@pytest.fixture
def engine():
    eng = WorkflowEngine()
    eng.register(BugFixWorkflow())
    eng.register(FeatureWorkflow())
    eng.register(IncidentWorkflow())
    eng.register(DeployWorkflow())
    eng.register(CodeReviewWorkflow())
    return eng


class TestWorkflowEngine:
    def test_register_and_list(self, engine):
        templates = engine.list_templates()
        names = [t["name"] for t in templates]
        assert "bug_fix" in names
        assert "feature" in names
        assert "incident" in names
        assert "deploy" in names
        assert "code_review" in names

    def test_unknown_template_raises(self, engine):
        with pytest.raises(ValueError, match="Unknown workflow template"):
            engine.create_plan("nonexistent", {})

    def test_get_template(self, engine):
        assert engine.get_template("bug_fix") is not None
        assert engine.get_template("nonexistent") is None


class TestBugFixWorkflow:
    def test_creates_valid_plan(self, engine):
        plan = engine.create_plan("bug_fix", {
            "repo": "acme/api",
            "issue_title": "Auth timeout",
            "issue_description": "Login times out after 30s",
            "base_branch": "main",
        })
        assert plan.task_count >= 5
        assert plan.validate_dag() == []

    def test_with_notification(self, engine):
        plan = engine.create_plan("bug_fix", {
            "repo": "acme/api",
            "issue_title": "Bug",
            "issue_description": "Description",
            "notify_channel": "#bugs",
        })
        task_types = [t.task_type for t in plan.tasks]
        assert TaskType.NOTIFICATION in task_types

    def test_task_dependency_chain(self, engine):
        plan = engine.create_plan("bug_fix", {
            "repo": "acme/api",
            "issue_title": "Bug",
            "issue_description": "Desc",
        })
        # First task (analyze) should have no dependencies
        assert plan.tasks[0].depends_on == []
        # Second task should depend on first
        assert plan.tasks[0].task_id in plan.tasks[1].depends_on


class TestFeatureWorkflow:
    def test_creates_valid_plan(self, engine):
        plan = engine.create_plan("feature", {
            "repo": "acme/api",
            "feature_title": "User profiles",
            "feature_description": "Add user profile pages",
        })
        assert plan.task_count >= 6
        assert plan.validate_dag() == []

    def test_docs_and_tests_parallel(self, engine):
        plan = engine.create_plan("feature", {
            "repo": "acme/api",
            "feature_title": "Profiles",
            "feature_description": "Profiles",
        })
        # Docs and tests both depend on implement, not on each other
        docs = next(t for t in plan.tasks if t.task_type == TaskType.DOCUMENTATION)
        tests = next(t for t in plan.tasks if t.task_type == TaskType.TEST_CREATION)
        assert docs.task_id not in [d for d in tests.depends_on]
        assert tests.task_id not in [d for d in docs.depends_on]


class TestIncidentWorkflow:
    def test_creates_valid_plan(self, engine):
        plan = engine.create_plan("incident", {
            "incident_title": "DB connection pool exhausted",
            "incident_description": "All connections consumed",
            "severity": "critical",
        })
        assert plan.validate_dag() == []

    def test_critical_requires_approval(self, engine):
        plan = engine.create_plan("incident", {
            "incident_title": "Outage",
            "incident_description": "Full outage",
            "severity": "critical",
        })
        fix_tasks = [t for t in plan.tasks if "fix" in t.name.lower()]
        assert any(t.requires_approval for t in fix_tasks)

    def test_with_pagerduty(self, engine):
        plan = engine.create_plan("incident", {
            "incident_title": "Alert",
            "incident_description": "High CPU",
            "severity": "high",
            "pagerduty_incident_id": "PD123",
        })
        api_tasks = [t for t in plan.tasks if t.tool == "pagerduty"]
        assert len(api_tasks) == 1


class TestDeployWorkflow:
    def test_creates_valid_plan(self, engine):
        plan = engine.create_plan("deploy", {
            "repo": "acme/api",
            "environment": "staging",
            "version": "v1.2.3",
        })
        assert plan.validate_dag() == []
        assert plan.task_count == 7

    def test_prod_requires_approval(self, engine):
        plan = engine.create_plan("deploy", {
            "repo": "acme/api",
            "environment": "production",
            "version": "v1.2.3",
        })
        infra_tasks = [t for t in plan.tasks if t.task_type == TaskType.INFRASTRUCTURE]
        assert any(t.requires_approval for t in infra_tasks)

    def test_staging_no_approval(self, engine):
        plan = engine.create_plan("deploy", {
            "repo": "acme/api",
            "environment": "staging",
            "version": "v1.2.3",
        })
        infra_tasks = [t for t in plan.tasks if t.task_type == TaskType.INFRASTRUCTURE]
        assert not any(t.requires_approval for t in infra_tasks)

    def test_tests_and_lint_parallel(self, engine):
        plan = engine.create_plan("deploy", {
            "repo": "acme/api",
            "environment": "staging",
            "version": "v1.0.0",
        })
        tests = plan.tasks[0]
        lint = plan.tasks[1]
        assert tests.depends_on == []
        assert lint.depends_on == []


class TestCodeReviewWorkflow:
    def test_creates_valid_plan(self, engine):
        plan = engine.create_plan("code_review", {
            "repo": "acme/api",
            "pr_number": 42,
        })
        assert plan.validate_dag() == []
        assert plan.task_count >= 4

    def test_fetch_and_context_parallel(self, engine):
        plan = engine.create_plan("code_review", {
            "repo": "acme/api",
            "pr_number": 42,
        })
        fetch = plan.tasks[0]
        context = plan.tasks[1]
        assert fetch.depends_on == []
        assert context.depends_on == []
