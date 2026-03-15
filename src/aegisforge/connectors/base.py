"""Base connector — abstract interface that all connectors implement."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger()


class ConnectorResult(BaseModel):
    """Standardised result returned by every connector action."""

    success: bool
    data: Any = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    duration_ms: float = 0.0


class BaseConnector(ABC):
    """Abstract base for all external-system connectors.

    Subclasses must:
    - Set ``connector_name`` as a class variable.
    - Populate ``_supported_actions`` with the set of valid action strings.
    - Implement ``_dispatch``, ``health_check``, and ``close``.
    """

    connector_name: str = ""
    _supported_actions: set[str] = set()

    async def execute(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        """Validate the requested action and delegate to ``_dispatch``.

        Args:
            action: The operation to perform (must be in ``_supported_actions``).
            params: Action-specific parameters.

        Returns:
            ConnectorResult with success status, data, and timing information.
        """
        if action not in self._supported_actions:
            return ConnectorResult(
                success=False,
                error=(
                    f"Unsupported action '{action}' for connector "
                    f"'{self.connector_name}'. "
                    f"Valid actions: {sorted(self._supported_actions)}"
                ),
            )

        start = time.monotonic()
        try:
            result = await self._dispatch(action, params)
            result.duration_ms = (time.monotonic() - start) * 1000
            return result
        except Exception as exc:
            duration_ms = (time.monotonic() - start) * 1000
            logger.error(
                "connector.action_failed",
                connector=self.connector_name,
                action=action,
                error=str(exc),
                duration_ms=round(duration_ms, 2),
            )
            return ConnectorResult(
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

    @abstractmethod
    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        """Route an action to the appropriate handler method.

        Subclasses implement the actual per-action logic here.
        """

    @abstractmethod
    async def health_check(self) -> bool:
        """Return ``True`` if the external service is reachable."""

    @abstractmethod
    async def close(self) -> None:
        """Release resources (HTTP clients, connections, etc.)."""
