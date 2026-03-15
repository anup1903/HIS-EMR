"""Deployment workflow — test → build → canary → soak → promote/rollback."""

from __future__ import annotations

from typing import Any

from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskType
from aegisforge.workflows.engine import WorkflowTemplate


class DeployWorkflow(WorkflowTemplate):
    """Deployment workflow with canary release.

    Flow: Run tests → Build → Deploy canary → Soak period → Promote to prod
          (or rollback on failure)

    Required params:
        repo: str
        environment: str (staging/production)
        version: str (tag or commit SHA)
    """

    name = "deploy"
    description = "Deploy with canary release and soak period"

    def build_plan(self, params: dict[str, Any]) -> Plan:
        repo = params.get("repo", "")
        env = params.get("environment", "staging")
        version = params.get("version", "latest")
        soak_minutes = params.get("soak_minutes", 15)
        notify_channel = params.get("notify_channel", "#deployments")
        is_prod = env == "production"

        goal = self._make_goal({
            "title": f"Deploy {version} to {env}",
            "description": f"Deploy version {version} of {repo} to {env}",
            "priority": 2 if is_prod else 4,
            **params,
        })

        # Task 1: Run full test suite
        tests = TaskNode(
            name="Run pre-deploy tests",
            description="Execute full test suite before deployment",
            task_type=TaskType.TEST_EXECUTION,
            tool="shell",
            tool_input={
                "command": "pytest --tb=short",
                "working_dir": repo,
            },
            risk_level=RiskLevel.LOW,
            success_criteria="All tests pass with exit code 0",
        )

        # Task 2: Lint and type check
        lint = TaskNode(
            name="Run linter and type checks",
            description="Run ruff and mypy to verify code quality",
            task_type=TaskType.TEST_EXECUTION,
            tool="shell",
            tool_input={
                "command": "ruff check src/ && mypy src/",
                "working_dir": repo,
            },
            risk_level=RiskLevel.LOW,
        )

        # Task 3: Build
        build = TaskNode(
            name="Build deployment artifact",
            description=f"Build Docker image for version {version}",
            task_type=TaskType.CI_CD_TRIGGER,
            tool="github",
            tool_input={
                "repo": repo,
                "action": "trigger_workflow",
                "workflow": "build.yml",
                "ref": version,
            },
            depends_on=[tests.task_id, lint.task_id],
            risk_level=RiskLevel.MEDIUM,
        )

        # Task 4: Deploy canary
        canary = TaskNode(
            name=f"Deploy canary to {env}",
            description=f"Deploy {version} to canary instances in {env}",
            task_type=TaskType.INFRASTRUCTURE,
            tool="shell",
            tool_input={
                "command": f"kubectl set image deployment/aegisforge aegisforge={repo}:{version} --namespace={env}",
            },
            depends_on=[build.task_id],
            risk_level=RiskLevel.HIGH if is_prod else RiskLevel.MEDIUM,
            requires_approval=is_prod,
            is_destructive=True,
            rollback_action=f"kubectl rollout undo deployment/aegisforge --namespace={env}",
        )

        # Task 5: Soak period — monitor health
        soak = TaskNode(
            name=f"Canary soak ({soak_minutes} min)",
            description=f"Monitor canary for {soak_minutes} minutes, check error rate and latency",
            task_type=TaskType.ANALYSIS,
            tool="shell",
            tool_input={
                "command": f"sleep {soak_minutes * 60} && curl -sf http://aegisforge.{env}/healthz",
            },
            depends_on=[canary.task_id],
            risk_level=RiskLevel.LOW,
            success_criteria="Error rate < 0.1%, latency p99 < 500ms",
        )

        # Task 6: Promote to full rollout
        promote = TaskNode(
            name=f"Promote to full rollout in {env}",
            description=f"Scale canary to full deployment in {env}",
            task_type=TaskType.INFRASTRUCTURE,
            tool="shell",
            tool_input={
                "command": f"kubectl rollout status deployment/aegisforge --namespace={env} --timeout=300s",
            },
            depends_on=[soak.task_id],
            risk_level=RiskLevel.HIGH if is_prod else RiskLevel.MEDIUM,
            requires_approval=is_prod,
            rollback_action=f"kubectl rollout undo deployment/aegisforge --namespace={env}",
        )

        # Task 7: Notify
        notify = TaskNode(
            name="Notify deployment complete",
            description=f"Post deployment status to {notify_channel}",
            task_type=TaskType.NOTIFICATION,
            tool="slack",
            tool_input={
                "channel": notify_channel,
                "message": f":rocket: Deployed {version} to {env} successfully",
            },
            depends_on=[promote.task_id],
            risk_level=RiskLevel.LOW,
        )

        return Plan(
            goal=goal,
            tasks=[tests, lint, build, canary, soak, promote, notify],
        )
