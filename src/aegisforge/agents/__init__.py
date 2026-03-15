"""Multi-agent coordination — specialized sub-agents and adaptive context."""

from aegisforge.agents.base import BaseSubAgent, SubAgentResult, SubTask
from aegisforge.agents.coordinator import AgentCoordinator
from aegisforge.agents.context_manager import AdaptiveContextManager

__all__ = [
    "AdaptiveContextManager",
    "AgentCoordinator",
    "BaseSubAgent",
    "SubAgentResult",
    "SubTask",
]
