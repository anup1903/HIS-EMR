"""ConnectorHub — central dispatcher with circuit breaker and retry."""

from __future__ import annotations

import time
from typing import Any

import pybreaker
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from aegisforge.connectors.base import BaseConnector, ConnectorResult
from aegisforge.observability.metrics import get_metrics

logger = structlog.get_logger()

# Circuit-breaker state mapping for Prometheus gauge.
_CB_STATE_MAP: dict[str, int] = {
    "closed": 0,
    "open": 1,
    "half-open": 2,
}

# Default circuit-breaker configuration.
_CB_FAIL_MAX = 5
_CB_RESET_TIMEOUT = 60  # seconds


class _CircuitBreakerListener(pybreaker.CircuitBreakerListener):
    """Emit Prometheus metrics on circuit-breaker state transitions."""

    def __init__(self, connector_name: str) -> None:
        self._connector = connector_name
        self._metrics = get_metrics()

    def state_change(
        self,
        cb: pybreaker.CircuitBreaker,
        old_state: pybreaker.CircuitBreakerState,
        new_state: pybreaker.CircuitBreakerState,
    ) -> None:
        state_label = new_state.name.lower().replace("_", "-")
        numeric = _CB_STATE_MAP.get(state_label, -1)
        self._metrics.connector_circuit_breaker.labels(
            connector=self._connector,
        ).set(numeric)
        logger.warning(
            "connector.circuit_breaker_state_change",
            connector=self._connector,
            old_state=old_state.name,
            new_state=new_state.name,
        )


class ConnectorHub:
    """Unified entry point for all external-system connectors.

    Features:
    - Per-connector circuit breaker (pybreaker, fail_max=5, reset_timeout=60s).
    - Automatic retry with exponential back-off (3 attempts, 1/2/4s).
    - Prometheus metrics for request count, duration, and circuit-breaker state.

    Usage::

        hub = ConnectorHub()
        hub.register(GitHubConnector(settings))
        result = await hub.execute("github", "create_branch", {"repo": "...", ...})
    """

    def __init__(self) -> None:
        self._connectors: dict[str, BaseConnector] = {}
        self._breakers: dict[str, pybreaker.CircuitBreaker] = {}
        self._metrics = get_metrics()

    # ── Registration ──────────────────────────────────────────────────

    def register(self, connector: BaseConnector) -> None:
        """Register a connector and create its circuit breaker.

        Args:
            connector: An initialised ``BaseConnector`` subclass instance.

        Raises:
            ValueError: If a connector with the same name is already registered.
        """
        name = connector.connector_name
        if name in self._connectors:
            raise ValueError(f"Connector '{name}' is already registered")

        self._connectors[name] = connector

        listener = _CircuitBreakerListener(name)
        self._breakers[name] = pybreaker.CircuitBreaker(
            fail_max=_CB_FAIL_MAX,
            reset_timeout=_CB_RESET_TIMEOUT,
            listeners=[listener],
            name=f"cb_{name}",
        )

        # Initialise gauge to closed (0).
        self._metrics.connector_circuit_breaker.labels(connector=name).set(0)

        logger.info("connector.registered", connector=name)

    # ── Execution ─────────────────────────────────────────────────────

    async def execute(
        self,
        connector_name: str,
        action: str,
        params: dict[str, Any] | None = None,
    ) -> ConnectorResult:
        """Execute an action on the named connector.

        The call is wrapped in a circuit breaker and retried up to 3 times
        with exponential back-off (1s, 2s, 4s) on transient failures.

        Args:
            connector_name: Registered connector name (e.g. ``"github"``).
            action: The operation to perform.
            params: Action-specific parameters.

        Returns:
            ConnectorResult with outcome, data, and timing.
        """
        if connector_name not in self._connectors:
            return ConnectorResult(
                success=False,
                error=f"Unknown connector: '{connector_name}'",
            )

        params = params or {}
        connector = self._connectors[connector_name]
        breaker = self._breakers[connector_name]

        start = time.monotonic()
        try:
            result = await self._execute_with_retry(
                breaker, connector, action, params
            )
            status = "success" if result.success else "error"
        except pybreaker.CircuitBreakerError:
            duration_ms = (time.monotonic() - start) * 1000
            logger.error(
                "connector.circuit_open",
                connector=connector_name,
                action=action,
            )
            self._metrics.connector_requests_total.labels(
                connector=connector_name,
                operation=action,
                status="circuit_open",
            ).inc()
            return ConnectorResult(
                success=False,
                error=f"Circuit breaker open for connector '{connector_name}'",
                duration_ms=duration_ms,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - start) * 1000
            logger.error(
                "connector.execute_failed",
                connector=connector_name,
                action=action,
                error=str(exc),
                duration_ms=round(duration_ms, 2),
            )
            self._metrics.connector_requests_total.labels(
                connector=connector_name,
                operation=action,
                status="error",
            ).inc()
            return ConnectorResult(
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

        duration_ms = (time.monotonic() - start) * 1000
        result.duration_ms = duration_ms

        self._metrics.connector_requests_total.labels(
            connector=connector_name,
            operation=action,
            status=status,
        ).inc()

        logger.info(
            "connector.execute_complete",
            connector=connector_name,
            action=action,
            status=status,
            duration_ms=round(duration_ms, 2),
        )

        return result

    @staticmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def _execute_with_retry(
        breaker: pybreaker.CircuitBreaker,
        connector: BaseConnector,
        action: str,
        params: dict[str, Any],
    ) -> ConnectorResult:
        """Call the connector within the circuit breaker, with tenacity retry."""

        async def _call() -> ConnectorResult:
            result = await connector.execute(action, params)
            # Treat a result with success=False as a transient failure
            # so the circuit breaker can track it, but do NOT raise so
            # the caller still gets the structured result.
            return result

        return await breaker.call_async(_call)

    # ── Health & lifecycle ────────────────────────────────────────────

    async def health_check_all(self) -> dict[str, bool]:
        """Run health checks on every registered connector.

        Returns:
            Mapping of connector name to health status.
        """
        results: dict[str, bool] = {}
        for name, connector in self._connectors.items():
            try:
                results[name] = await connector.health_check()
            except Exception:
                logger.warning("connector.health_check_failed", connector=name)
                results[name] = False
        return results

    async def close_all(self) -> None:
        """Gracefully close all registered connectors."""
        for name, connector in self._connectors.items():
            try:
                await connector.close()
                logger.info("connector.closed", connector=name)
            except Exception:
                logger.warning("connector.close_failed", connector=name, exc_info=True)
