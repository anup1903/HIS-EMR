"""FastAPI authentication middleware — validates tokens on every request.

Flow:
  Request → Extract Bearer token → Validate via Okta/Azure AD
         → Resolve role from groups → Attach to request.state
         → Pass to route handler (or reject with 401/403)

Health/readiness endpoints are exempt from auth.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from aegisforge.auth.providers import (
    AzureADProvider,
    OktaProvider,
    TokenValidationError,
    resolve_role_from_groups,
)
from aegisforge.config import get_settings

logger = structlog.get_logger()

# Paths that skip authentication
PUBLIC_PATHS: set[str] = {
    "/healthz",
    "/readyz",
    "/docs",
    "/openapi.json",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """Validates auth tokens and attaches user context to requests."""

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self._okta: OktaProvider | None = None
        self._azure: AzureADProvider | None = None

    def _get_providers(self) -> list[Any]:
        """Lazy-init providers based on config."""
        settings = get_settings()
        providers = []
        if settings.okta_domain:
            if not self._okta:
                self._okta = OktaProvider()
            providers.append(self._okta)
        if settings.azure_ad_tenant_id:
            if not self._azure:
                self._azure = AzureADProvider()
            providers.append(self._azure)
        return providers

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header[7:]  # Strip "Bearer "

        # Try each configured provider
        providers = self._get_providers()
        if not providers:
            # No IdP configured — dev mode, allow with default role
            settings = get_settings()
            if not settings.is_production:
                request.state.user_id = "dev-user"
                request.state.user_email = "dev@localhost"
                request.state.user_role = "admin"
                request.state.user_groups = []
                return await call_next(request)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No identity provider configured",
            )

        last_error: str = ""
        for provider in providers:
            try:
                claims = await provider.validate_token(token)

                # Attach user context to request
                request.state.user_id = claims.get("sub", "")
                request.state.user_email = claims.get("email", "")
                request.state.user_name = claims.get("name", "")
                request.state.user_groups = claims.get("groups", [])
                request.state.user_provider = claims.get("provider", "")
                request.state.user_role = resolve_role_from_groups(
                    claims.get("groups", [])
                )

                logger.info(
                    "auth.authenticated",
                    user_id=claims.get("sub"),
                    provider=claims.get("provider"),
                    role=request.state.user_role,
                )

                return await call_next(request)

            except TokenValidationError as exc:
                last_error = str(exc)
                continue

        # All providers failed
        logger.warning("auth.all_providers_failed", error=last_error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {last_error}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency — returns the authenticated user from request state."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return {
        "user_id": request.state.user_id,
        "email": getattr(request.state, "user_email", ""),
        "name": getattr(request.state, "user_name", ""),
        "role": getattr(request.state, "user_role", "viewer"),
        "groups": getattr(request.state, "user_groups", []),
        "provider": getattr(request.state, "user_provider", ""),
    }
