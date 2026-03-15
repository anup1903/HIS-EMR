"""Connector Hub — unified interface for all external system integrations.

All external API calls go through the ConnectorHub which provides:
- Circuit breaker protection (pybreaker)
- Automatic retry with exponential backoff (tenacity)
- Prometheus metrics emission
- Structured logging with PII redaction
"""

from aegisforge.connectors.base import BaseConnector, ConnectorResult
from aegisforge.connectors.hub import ConnectorHub

__all__ = [
    "BaseConnector",
    "ConnectorHub",
    "ConnectorResult",
]
