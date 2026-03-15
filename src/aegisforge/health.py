"""Health and readiness endpoints for Kubernetes probes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, Any]


@router.get("/healthz", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check() -> HealthResponse:
    """Liveness probe — returns 200 if the process is running."""
    from aegisforge import __version__

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version=__version__,
    )


@router.get("/readyz", response_model=ReadinessResponse, status_code=status.HTTP_200_OK)
async def readiness_check() -> ReadinessResponse:
    """Readiness probe — verifies database and Redis connectivity."""
    checks: dict[str, Any] = {}
    all_ok = True

    # Database check
    try:
        from aegisforge.db.session import get_engine

        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {type(exc).__name__}"
        all_ok = False

    # Redis check
    try:
        from aegisforge.config import get_settings

        import redis.asyncio as aioredis

        settings = get_settings()
        r = aioredis.from_url(settings.redis_url.get_secret_value())
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {type(exc).__name__}"
        all_ok = False

    return ReadinessResponse(
        status="ready" if all_ok else "degraded",
        checks=checks,
    )
