"""Pre-built workflow templates."""

from aegisforge.workflows.templates.bug_fix import BugFixWorkflow
from aegisforge.workflows.templates.deploy import DeployWorkflow
from aegisforge.workflows.templates.feature import FeatureWorkflow
from aegisforge.workflows.templates.incident import IncidentWorkflow
from aegisforge.workflows.templates.review import CodeReviewWorkflow

__all__ = [
    "BugFixWorkflow",
    "CodeReviewWorkflow",
    "DeployWorkflow",
    "FeatureWorkflow",
    "IncidentWorkflow",
]
