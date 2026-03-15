"""OIDC token validation for Okta and Azure AD.

Validates JWT tokens from either IdP, extracting user identity and roles.
Supports token caching and automatic JWKS key rotation.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import structlog
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError

from aegisforge.config import get_settings

logger = structlog.get_logger()


class TokenValidationError(Exception):
    """Raised when a JWT token fails validation."""

    pass


class OIDCProvider:
    """Base OIDC provider for JWT validation."""

    def __init__(
        self,
        issuer: str,
        audience: str,
        jwks_uri: str,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.jwks_uri = jwks_uri
        self._jwks: dict[str, Any] | None = None
        self._jwks_fetched_at: float = 0
        self._jwks_ttl: float = 3600  # Refresh JWKS every hour

    async def _fetch_jwks(self) -> dict[str, Any]:
        """Fetch JWKS from the IdP (cached for 1 hour)."""
        now = time.time()
        if self._jwks and (now - self._jwks_fetched_at) < self._jwks_ttl:
            return self._jwks

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.jwks_uri)
            response.raise_for_status()
            self._jwks = response.json()
            self._jwks_fetched_at = now
            logger.info("auth.jwks_refreshed", issuer=self.issuer)
            return self._jwks

    async def validate_token(self, token: str) -> dict[str, Any]:
        """Validate a JWT token and return its claims.

        Raises TokenValidationError on any failure.
        """
        try:
            jwks = await self._fetch_jwks()

            # Decode without verification first to get the header
            unverified = jwt.get_unverified_header(token)
            kid = unverified.get("kid")

            # Find the matching key
            key = None
            for jwk in jwks.get("keys", []):
                if jwk.get("kid") == kid:
                    key = jwk
                    break

            if not key:
                # Try refreshing JWKS (key rotation may have happened)
                self._jwks = None
                jwks = await self._fetch_jwks()
                for jwk in jwks.get("keys", []):
                    if jwk.get("kid") == kid:
                        key = jwk
                        break

            if not key:
                raise TokenValidationError(f"No matching key found for kid: {kid}")

            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer,
            )

            return claims

        except ExpiredSignatureError:
            raise TokenValidationError("Token has expired")
        except JWTError as exc:
            raise TokenValidationError(f"Invalid token: {exc}")


class OktaProvider(OIDCProvider):
    """Okta OIDC provider."""

    def __init__(self) -> None:
        settings = get_settings()
        domain = settings.okta_domain
        super().__init__(
            issuer=f"https://{domain}/oauth2/default",
            audience=settings.okta_client_id,
            jwks_uri=f"https://{domain}/oauth2/default/v1/keys",
        )

    async def validate_token(self, token: str) -> dict[str, Any]:
        claims = await super().validate_token(token)
        return {
            "sub": claims.get("sub", ""),
            "email": claims.get("email", ""),
            "name": claims.get("name", ""),
            "groups": claims.get("groups", []),
            "provider": "okta",
        }


class AzureADProvider(OIDCProvider):
    """Azure AD OIDC provider."""

    def __init__(self) -> None:
        settings = get_settings()
        tenant = settings.azure_ad_tenant_id
        super().__init__(
            issuer=f"https://login.microsoftonline.com/{tenant}/v2.0",
            audience=settings.azure_ad_client_id,
            jwks_uri=f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
        )

    async def validate_token(self, token: str) -> dict[str, Any]:
        claims = await super().validate_token(token)
        return {
            "sub": claims.get("sub", ""),
            "email": claims.get("preferred_username", ""),
            "name": claims.get("name", ""),
            "groups": claims.get("groups", []),
            "provider": "azure_ad",
        }


# Group name → Role mapping (configure per org)
DEFAULT_GROUP_ROLE_MAP: dict[str, str] = {
    "aegisforge-viewers": "viewer",
    "aegisforge-operators": "operator",
    "aegisforge-admins": "admin",
    "aegisforge-super-admins": "super-admin",
}


def resolve_role_from_groups(
    groups: list[str],
    group_role_map: dict[str, str] | None = None,
) -> str:
    """Resolve the highest role from a user's IdP group memberships."""
    mapping = group_role_map or DEFAULT_GROUP_ROLE_MAP
    role_hierarchy = {"viewer": 0, "operator": 1, "admin": 2, "super-admin": 3}
    highest_role = "viewer"

    for group in groups:
        role = mapping.get(group)
        if role and role_hierarchy.get(role, -1) > role_hierarchy.get(highest_role, -1):
            highest_role = role

    return highest_role
