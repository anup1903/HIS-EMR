"""Authentication & Authorization — Okta/Azure AD SSO with RBAC.

Supports:
- Okta OIDC (primary)
- Azure AD OIDC (secondary)
- RBAC with 4 roles: viewer, operator, admin, super-admin
- MFA enforcement
- Session management with 15-min timeout
"""

from aegisforge.auth.rbac import Permission, Role, require_role
from aegisforge.auth.middleware import AuthMiddleware, get_current_user

__all__ = [
    "AuthMiddleware",
    "Permission",
    "Role",
    "get_current_user",
    "require_role",
]
