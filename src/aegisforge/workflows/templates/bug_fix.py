"""Bug fix workflow — analyze → fix → test → PR → notify."""

from __future__ import annotations

from typing import Any

from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskType
from aegisforge.workflows.engine import WorkflowTemplate


class BugFixWorkflow(WorkflowTemplate):
    """Standard bug fix workflow.

    Flow: Analyze bug → Search codebase (RAG) → Generate fix → Create tests
          → Run tests → Open PR → Notify team

    Required params:
        repo: str           — GitHub repo (owner/name)
        issue_title: str    — Bug title
        issue_description: str — Bug description
        base_branch: str    — Branch to fix against (default: main)
    """

    name = "bug_fix"
    description = "Analyze, fix, test, and PR a bug"

    def build_plan(self, params: dict[str, Any]) -> Plan:
        repo = params.get("repo", "")
        issue_title = params.get("issue_title", "Bug fix")
        issue_desc = params.get("issue_description", "")
        base_branch = params.get("base_branch", "main")
        notify_channel = params.get("notify_channel", "")

        goal = self._make_goal({
            "title": f"Fix: {issue_title}",
            "description": issue_desc,
            "context": f"Repository: {repo}, Branch: {base_branch}",
            **params,
        })

        # Task 1: Analyze the bug
        analyze = TaskNode(
            name="Analyze bug report",
            description=f"Analyze the bug: {issue_title}. {issue_desc}",
            task_type=TaskType.ANALYSIS,
            tool="rag",
            tool_input={"query": issue_desc, "collection": "codebase"},
            risk_level=RiskLevel.LOW,
        )

        # Task 2: Generate fix
        fix = TaskNode(
            name="Generate code fix",
            description=f"Generate a fix for: {issue_title}",
            task_type=TaskType.CODE_MODIFICATION,
            tool="github",
            tool_input={
                "repo": repo,
                "base_branch": base_branch,
                "issue_title": issue_title,
            },
            depends_on=[analyze.task_id],
            risk_level=RiskLevel.MEDIUM,
        )

        # Task 3: Create tests
        tests = TaskNode(
            name="Create regression tests",
            description=f"Write tests to verify the fix for: {issue_title}",
            task_type=TaskType.TEST_CREATION,
            tool="github",
            tool_input={"repo": repo},
            depends_on=[fix.task_id],
            risk_level=RiskLevel.LOW,
        )

        # Task 4: Run tests
        run_tests = TaskNode(
            name="Run test suite",
            description="Execute full test suite to verify fix doesn't break anything",
            task_type=TaskType.TEST_EXECUTION,
            tool="shell",
            tool_input={"command": "pytest", "working_dir": repo},
            depends_on=[tests.task_id],
            risk_level=RiskLevel.LOW,
            success_criteria="All tests pass with exit code 0",
        )

        # Task 5: Open PR
        pr = TaskNode(
            name="Open pull request",
            description=f"Create PR for bug fix: {issue_title}",
            task_type=TaskType.CODE_MODIFICATION,
            tool="github",
            tool_input={
                "repo": repo,
                "action": "create_pull_request",
                "base_branch": base_branch,
                "title": f"fix: {issue_title}",
            },
            depends_on=[run_tests.task_id],
            risk_level=RiskLevel.LOW,
            rollback_action=f"Close PR and delete branch in {repo}",
        )

        tasks = [analyze, fix, tests, run_tests, pr]

        # Task 6 (optional): Notify
        if notify_channel:
            notify = TaskNode(
                name="Notify team",
                description=f"Post bug fix PR to {notify_channel}",
                task_type=TaskType.NOTIFICATION,
                tool="slack",
                tool_input={
                    "channel": notify_channel,
                    "message": f"Bug fix PR opened for: {issue_title}",
                },
                depends_on=[pr.task_id],
                risk_level=RiskLevel.LOW,
            )
            tasks.append(notify)

        return Plan(goal=goal, tasks=tasks)
