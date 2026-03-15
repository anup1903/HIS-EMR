"""Workflow engine — registry and executor for pre-built workflow templates."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel, Field

from aegisforge.planner.models import Goal, Plan, TaskNode, TaskType, RiskLevel

logger = structlog.get_logger()


class WorkflowTemplate(ABC):
    """Base class for pre-built workflow templates.

    Each template defines a fixed DAG pattern for a common operation.
    Parameters are injected at instantiation to customize the tasks.
    """

    name: str = ""
    description: str = ""

    @abstractmethod
    def build_plan(self, params: dict[str, Any]) -> Plan:
        """Build a Plan with TaskNodes from template parameters."""
        ...

    def _make_goal(self, params: dict[str, Any]) -> Goal:
        """Create a Goal from workflow parameters."""
        return Goal(
            title=params.get("title", f"{self.name} workflow"),
            description=params.get("description", self.description),
            context=params.get("context", ""),
            constraints=params.get("constraints", []),
            acceptance_criteria=params.get("acceptance_criteria", []),
            priority=params.get("priority", 5),
        )


class WorkflowEngine:
    """Registry and executor for workflow templates.

    Usage:
        engine = WorkflowEngine()
        engine.register(BugFixWorkflow())
        plan = engine.create_plan("bug_fix", {"repo": "...", "issue": "..."})
    """

    def __init__(self) -> None:
        self._templates: dict[str, WorkflowTemplate] = {}

    def register(self, template: WorkflowTemplate) -> None:
        """Register a workflow template."""
        self._templates[template.name] = template
        logger.info("workflow.template_registered", name=template.name)

    def list_templates(self) -> list[dict[str, str]]:
        """List all registered workflow templates."""
        return [
            {"name": t.name, "description": t.description}
            for t in self._templates.values()
        ]

    def create_plan(self, template_name: str, params: dict[str, Any]) -> Plan:
        """Create a Plan from a named template with parameters."""
        template = self._templates.get(template_name)
        if not template:
            available = list(self._templates.keys())
            raise ValueError(
                f"Unknown workflow template: '{template_name}'. "
                f"Available: {available}"
            )

        plan = template.build_plan(params)
        errors = plan.validate_dag()
        if errors:
            raise ValueError(f"Template '{template_name}' produced invalid DAG: {errors}")

        logger.info(
            "workflow.plan_created",
            template=template_name,
            task_count=plan.task_count,
        )
        return plan

    def get_template(self, name: str) -> WorkflowTemplate | None:
        return self._templates.get(name)
