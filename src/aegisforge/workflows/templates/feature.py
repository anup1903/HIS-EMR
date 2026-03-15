"""Feature workflow — decompose → implement → test → document → PR."""

from __future__ import annotations

from typing import Any

from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskType
from aegisforge.workflows.engine import WorkflowTemplate


class FeatureWorkflow(WorkflowTemplate):
    """New feature implementation workflow.

    Flow: Analyze requirements → Generate code → Create tests → Run tests
          → Generate docs → Open PR → Notify

    Required params:
        repo: str
        feature_title: str
        feature_description: str
    """

    name = "feature"
    description = "Implement a new feature end-to-end"

    def build_plan(self, params: dict[str, Any]) -> Plan:
        repo = params.get("repo", "")
        title = params.get("feature_title", "New feature")
        desc = params.get("feature_description", "")
        base_branch = params.get("base_branch", "main")
        notify_channel = params.get("notify_channel", "")

        goal = self._make_goal({
            "title": f"Feature: {title}",
            "description": desc,
            "context": f"Repository: {repo}",
            **params,
        })

        # Task 1: Analyze requirements with RAG
        analyze = TaskNode(
            name="Analyze requirements and codebase",
            description=f"Understand requirements for: {title}. Research existing patterns.",
            task_type=TaskType.ANALYSIS,
            tool="rag",
            tool_input={"query": desc, "collection": "codebase"},
            risk_level=RiskLevel.LOW,
        )

        # Task 2: Generate implementation
        implement = TaskNode(
            name="Generate feature code",
            description=f"Implement: {title}",
            task_type=TaskType.CODE_GENERATION,
            tool="github",
            tool_input={
                "repo": repo,
                "base_branch": base_branch,
                "feature_title": title,
            },
            depends_on=[analyze.task_id],
            risk_level=RiskLevel.MEDIUM,
        )

        # Task 3: Create tests
        tests = TaskNode(
            name="Create feature tests",
            description=f"Write comprehensive tests for: {title}",
            task_type=TaskType.TEST_CREATION,
            tool="github",
            tool_input={"repo": repo},
            depends_on=[implement.task_id],
            risk_level=RiskLevel.LOW,
        )

        # Task 4: Run tests
        run_tests = TaskNode(
            name="Run test suite",
            description="Execute tests to validate the new feature",
            task_type=TaskType.TEST_EXECUTION,
            tool="shell",
            tool_input={"command": "pytest", "working_dir": repo},
            depends_on=[tests.task_id],
            risk_level=RiskLevel.LOW,
            success_criteria="All tests pass",
        )

        # Task 5: Generate documentation
        docs = TaskNode(
            name="Generate documentation",
            description=f"Write documentation for: {title}",
            task_type=TaskType.DOCUMENTATION,
            tool="github",
            tool_input={"repo": repo},
            depends_on=[implement.task_id],
            risk_level=RiskLevel.LOW,
        )

        # Task 6: Open PR (depends on tests + docs)
        pr = TaskNode(
            name="Open pull request",
            description=f"Create PR for feature: {title}",
            task_type=TaskType.CODE_MODIFICATION,
            tool="github",
            tool_input={
                "repo": repo,
                "action": "create_pull_request",
                "base_branch": base_branch,
                "title": f"feat: {title}",
            },
            depends_on=[run_tests.task_id, docs.task_id],
            risk_level=RiskLevel.LOW,
            rollback_action=f"Close PR and delete branch in {repo}",
        )

        tasks = [analyze, implement, tests, run_tests, docs, pr]

        if notify_channel:
            notify = TaskNode(
                name="Notify team",
                description=f"Post feature PR to {notify_channel}",
                task_type=TaskType.NOTIFICATION,
                tool="slack",
                tool_input={"channel": notify_channel},
                depends_on=[pr.task_id],
                risk_level=RiskLevel.LOW,
            )
            tasks.append(notify)

        return Plan(goal=goal, tasks=tasks)
