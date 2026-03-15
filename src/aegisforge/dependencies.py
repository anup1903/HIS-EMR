"""FastAPI dependency injection providers."""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.config import Settings, get_settings
from aegisforge.db.session import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session, auto-closing on exit."""
    async with async_session_factory()() as session:
        yield session


def get_config() -> Settings:
    """Return cached application settings."""
    return get_settings()
