"""FastAPI middleware for automatic request/response audit logging.

Every API request is recorded with:
- Actor (from auth token), IP, user-agent
- Request method, path, status code
- Duration
- PII-redacted request/response metadata
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from aegisforge.audit.redactor import get_redactor

logger = structlog.get_logger()
redactor = get_redactor()


class AuditMiddleware(BaseHTTPMiddleware):
    """Logs every HTTP request to the structured audit trail.

    Adds a unique request_id header for correlation across the system.
    PII-redacts all logged content.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Inject request_id for downstream correlation
        request.state.request_id = request_id

        # Extract actor from auth (if available)
        actor_id = "anonymous"
        if hasattr(request.state, "user_id"):
            actor_id = request.state.user_id

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "audit.http_request",
                request_id=request_id,
                actor=actor_id,
                method=request.method,
                path=redactor.redact_text(str(request.url.path)),
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
                ip=request.client.host if request.client else None,
                user_agent=redactor.redact_text(
                    request.headers.get("user-agent", "")[:200]
                ),
            )

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                "audit.http_request_error",
                request_id=request_id,
                actor=actor_id,
                method=request.method,
                path=redactor.redact_text(str(request.url.path)),
                error=type(exc).__name__,
                duration_ms=round(duration_ms, 2),
            )
            raise
