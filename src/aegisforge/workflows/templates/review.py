"""Code review workflow — fetch diff → analyze → post comments → verdict."""

from __future__ import annotations

from typing import Any

from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskType
from aegisforge.workflows.engine import WorkflowTemplate


class CodeReviewWorkflow(WorkflowTemplate):
    """Automated code review workflow.

    Flow: Fetch PR diff → RAG search for patterns → LLM analysis
          → Post review comments → Approve or request changes

    Required params:
        repo: str
        pr_number: int
    """

    name = "code_review"
    description = "Automated code review for a pull request"

    def build_plan(self, params: dict[str, Any]) -> Plan:
        repo = params.get("repo", "")
        pr_number = params.get("pr_number", 0)
        notify_channel = params.get("notify_channel", "")

        goal = self._make_goal({
            "title": f"Review PR #{pr_number} in {repo}",
            "description": f"Perform automated code review on PR #{pr_number}",
            **params,
        })

        # Task 1: Fetch PR details and diff
        fetch = TaskNode(
            name="Fetch PR details",
            description=f"Get PR #{pr_number} diff, description, and changed files",
            task_type=TaskType.API_CALL,
            tool="github",
            tool_input={
                "repo": repo,
                "action": "get_pull_request",
                "pr_number": pr_number,
            },
            risk_level=RiskLevel.LOW,
        )

        # Task 2: Search codebase for related patterns
        context = TaskNode(
            name="Search codebase patterns",
            description="Find related code patterns and conventions in the codebase",
            task_type=TaskType.ANALYSIS,
            tool="rag",
            tool_input={
                "collection": "codebase",
                "query": f"PR #{pr_number} related code patterns",
            },
            risk_level=RiskLevel.LOW,
        )

        # Task 3: LLM review analysis
        review = TaskNode(
            name="Analyze code changes",
            description=(
                "Review the PR diff for: correctness, security vulnerabilities, "
                "performance issues, code style, test coverage, documentation"
            ),
            task_type=TaskType.CODE_REVIEW,
            tool="github",
            tool_input={
                "repo": repo,
                "pr_number": pr_number,
            },
            depends_on=[fetch.task_id, context.task_id],
            risk_level=RiskLevel.LOW,
        )

        # Task 4: Post review comments
        post_comments = TaskNode(
            name="Post review comments",
            description=f"Post line-level review comments on PR #{pr_number}",
            task_type=TaskType.CODE_REVIEW,
            tool="github",
            tool_input={
                "repo": repo,
                "action": "post_review_comment",
                "pr_number": pr_number,
            },
            depends_on=[review.task_id],
            risk_level=RiskLevel.LOW,
        )

        tasks = [fetch, context, review, post_comments]

        if notify_channel:
            notify = TaskNode(
                name="Notify review complete",
                description=f"Post review summary to {notify_channel}",
                task_type=TaskType.NOTIFICATION,
                tool="slack",
                tool_input={
                    "channel": notify_channel,
                    "message": f"Code review completed for PR #{pr_number} in {repo}",
                },
                depends_on=[post_comments.task_id],
                risk_level=RiskLevel.LOW,
            )
            tasks.append(notify)

        return Plan(goal=goal, tasks=tasks)
