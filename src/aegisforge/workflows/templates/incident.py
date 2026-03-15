"""Incident response workflow — triage → fix → validate → resolve → post-mortem."""

from __future__ import annotations

from typing import Any

from aegisforge.planner.models import Goal, Plan, RiskLevel, TaskNode, TaskType
from aegisforge.workflows.engine import WorkflowTemplate


class IncidentWorkflow(WorkflowTemplate):
    """Incident response workflow.

    Flow: Triage incident → Search runbooks (RAG) → Apply fix → Run validation
          → Resolve PagerDuty → Notify → Post-mortem analysis

    Required params:
        incident_title: str
        incident_description: str
        severity: str (critical/high/medium/low)
        pagerduty_incident_id: str (optional)
    """

    name = "incident"
    description = "Respond to and resolve a production incident"

    def build_plan(self, params: dict[str, Any]) -> Plan:
        title = params.get("incident_title", "Incident")
        desc = params.get("incident_description", "")
        severity = params.get("severity", "high")
        pd_incident = params.get("pagerduty_incident_id", "")
        repo = params.get("repo", "")
        notify_channel = params.get("notify_channel", "#incidents")

        goal = self._make_goal({
            "title": f"Incident: {title}",
            "description": desc,
            "priority": 1 if severity == "critical" else 3,
            **params,
        })

        # Task 1: Triage — search runbooks and docs
        triage = TaskNode(
            name="Triage incident",
            description=f"Analyze incident: {title}. Search runbooks for resolution steps.",
            task_type=TaskType.ANALYSIS,
            tool="rag",
            tool_input={
                "query": f"{title} {desc}",
                "collection": "runbooks",
            },
            risk_level=RiskLevel.LOW,
        )

        # Task 2: Notify channel that incident is being worked
        ack_notify = TaskNode(
            name="Acknowledge incident",
            description=f"Notify {notify_channel} that incident is being investigated",
            task_type=TaskType.NOTIFICATION,
            tool="slack",
            tool_input={
                "channel": notify_channel,
                "message": f":rotating_light: Investigating: {title} (severity: {severity})",
            },
            risk_level=RiskLevel.LOW,
        )

        # Task 3: Apply fix (requires approval for critical)
        is_critical = severity in ("critical", "high")
        fix = TaskNode(
            name="Apply incident fix",
            description=f"Apply remediation for: {title}",
            task_type=TaskType.CODE_MODIFICATION,
            tool="github" if repo else "shell",
            tool_input={"repo": repo} if repo else {},
            depends_on=[triage.task_id],
            risk_level=RiskLevel.HIGH if is_critical else RiskLevel.MEDIUM,
            requires_approval=is_critical,
            is_destructive=is_critical,
            rollback_action="Revert the applied fix",
        )

        # Task 4: Validate fix
        validate = TaskNode(
            name="Validate fix",
            description="Run validation checks to confirm incident is resolved",
            task_type=TaskType.TEST_EXECUTION,
            tool="shell",
            tool_input={"command": "pytest tests/ -x"},
            depends_on=[fix.task_id],
            risk_level=RiskLevel.LOW,
            success_criteria="Health checks pass, error rate returns to baseline",
        )

        tasks = [triage, ack_notify, fix, validate]

        # Task 5: Resolve PagerDuty (optional)
        if pd_incident:
            resolve_pd = TaskNode(
                name="Resolve PagerDuty incident",
                description=f"Resolve PagerDuty incident {pd_incident}",
                task_type=TaskType.API_CALL,
                tool="pagerduty",
                tool_input={
                    "action": "resolve",
                    "incident_id": pd_incident,
                },
                depends_on=[validate.task_id],
                risk_level=RiskLevel.LOW,
            )
            tasks.append(resolve_pd)

        # Task 6: Post-mortem analysis
        postmortem = TaskNode(
            name="Generate post-mortem",
            description=f"Create post-mortem analysis for: {title}",
            task_type=TaskType.ANALYSIS,
            tool="rag",
            tool_input={"query": f"post-mortem {title}"},
            depends_on=[validate.task_id],
            risk_level=RiskLevel.LOW,
        )
        tasks.append(postmortem)

        # Task 7: Resolution notification
        resolve_notify = TaskNode(
            name="Notify resolution",
            description=f"Notify {notify_channel} that incident is resolved",
            task_type=TaskType.NOTIFICATION,
            tool="slack",
            tool_input={
                "channel": notify_channel,
                "message": f":white_check_mark: Resolved: {title}",
            },
            depends_on=[postmortem.task_id],
            risk_level=RiskLevel.LOW,
        )
        tasks.append(resolve_notify)

        return Plan(goal=goal, tasks=tasks)
