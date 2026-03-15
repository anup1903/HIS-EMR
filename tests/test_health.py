"""Tests for health and readiness endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from aegisforge import __version__


@pytest.mark.asyncio
async def test_healthz_returns_200(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == __version__
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_healthz_response_schema(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    data = response.json()
    assert set(data.keys()) == {"status", "timestamp", "version"}


@pytest.mark.asyncio
async def test_readyz_returns_checks(client: AsyncClient) -> None:
    """Readiness endpoint returns status and checks dict (may be degraded in test env)."""
    response = await client.get("/readyz")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert isinstance(data["checks"], dict)
