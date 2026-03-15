"""PagerDuty connector — incident management via Events API v2."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from aegisforge.config import Settings, get_settings
from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()

_PD_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue"


class PagerDutyConnector(BaseConnector):
    """Connector for PagerDuty Events API v2.

    Creates, acknowledges, and resolves incidents using the integration
    key from application settings.
    """

    connector_name: str = "pagerduty"
    _supported_actions: set[str] = {
        "create_incident",
        "acknowledge",
        "resolve",
    }

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._routing_key = self._settings.pagerduty_integration_key.get_secret_value()
        self._client = http_client or httpx.AsyncClient(timeout=30.0)

    # ── Dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for '{action}'")
        return await handler(params)

    # ── Helpers ───────────────────────────────────────────────────────

    async def _send_event(self, payload: dict[str, Any]) -> ConnectorResult:
        """Post an event to the PagerDuty Events API v2."""
        resp = await self._client.post(_PD_EVENTS_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return ConnectorResult(
            success=True,
            data=data,
            metadata={"dedup_key": data.get("dedup_key", "")},
        )

    # ── Actions ───────────────────────────────────────────────────────

    async def _action_create_incident(self, params: dict[str, Any]) -> ConnectorResult:
        """Trigger a new PagerDuty incident.

        Params:
            summary: Human-readable incident description.
            severity: "critical" | "error" | "warning" | "info"
            source: Where the event originated (e.g. service name).
            dedup_key: (optional) Deduplication key for grouping.
            custom_details: (optional) Arbitrary dict of extra context.
        """
        payload: dict[str, Any] = {
            "routing_key": self._routing_key,
            "event_action": "trigger",
            "payload": {
                "summary": params["summary"],
                "severity": params.get("severity", "error"),
                "source": params.get("source", "aegisforge"),
            },
        }
        if dedup := params.get("dedup_key"):
            payload["dedup_key"] = dedup
        if details := params.get("custom_details"):
            payload["payload"]["custom_details"] = details

        logger.info("pagerduty.creating_incident", severity=params.get("severity", "error"))
        return await self._send_event(payload)

    async def _action_acknowledge(self, params: dict[str, Any]) -> ConnectorResult:
        """Acknowledge an existing incident.

        Params:
            dedup_key: The deduplication key of the incident to acknowledge.
        """
        payload: dict[str, Any] = {
            "routing_key": self._routing_key,
            "event_action": "acknowledge",
            "dedup_key": params["dedup_key"],
        }
        logger.info("pagerduty.acknowledging", dedup_key=params["dedup_key"])
        return await self._send_event(payload)

    async def _action_resolve(self, params: dict[str, Any]) -> ConnectorResult:
        """Resolve an existing incident.

        Params:
            dedup_key: The deduplication key of the incident to resolve.
        """
        payload: dict[str, Any] = {
            "routing_key": self._routing_key,
            "event_action": "resolve",
            "dedup_key": params["dedup_key"],
        }
        logger.info("pagerduty.resolving", dedup_key=params["dedup_key"])
        return await self._send_event(payload)

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Verify PagerDuty Events API reachability.

        The Events API does not have a dedicated health endpoint, so we
        check that the endpoint responds (even a 400 means it is up).
        """
        try:
            resp = await self._client.post(
                _PD_EVENTS_URL,
                json={"routing_key": "health_check", "event_action": "trigger"},
            )
            # 400 (bad request) means the API is reachable.
            return resp.status_code in (200, 202, 400)
        except Exception:
            return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
