"""Role-Based Access Control (RBAC) — enforces least privilege.

Roles:
  viewer      — Read-only access to task status and own audit logs
  operator    — Can trigger staging deployments, run tasks
  admin       — Production deployments (with approval), schema migrations (dual approval)
  super-admin — Modify RBAC, access all audit logs, manage secrets
"""

from __future__ import annotations

from enum import Enum
from functools import wraps
from typing import Any, Callable

import structlog
from fastapi import HTTPException, status

logger = structlog.get_logger()


class Role(str, Enum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"
    SUPER_ADMIN = "super-admin"


class Permission(str, Enum):
    """Granular permissions mapped to roles."""

    # Read
    VIEW_TASKS = "view_tasks"
    VIEW_OWN_AUDIT = "view_own_audit"
    VIEW_ALL_AUDIT = "view_all_audit"

    # Execute
    TRIGGER_STAGING_DEPLOY = "trigger_staging_deploy"
    TRIGGER_PRODUCTION_DEPLOY = "trigger_production_deploy"
    RUN_TASK = "run_task"
    APPROVE_TASK = "approve_task"

    # Data
    CREATE_GOAL = "create_goal"
    MODIFY_PLAN = "modify_plan"
    RUN_MIGRATION = "run_migration"
    BULK_OPERATION = "bulk_operation"

    # Admin
    MODIFY_RBAC = "modify_rbac"
    MANAGE_SECRETS = "manage_secrets"
    MANAGE_INTEGRATIONS = "manage_integrations"


# Role → Permissions mapping (cumulative: higher roles include lower)
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.VIEWER: {
        Permission.VIEW_TASKS,
        Permission.VIEW_OWN_AUDIT,
    },
    Role.OPERATOR: {
        Permission.VIEW_TASKS,
        Permission.VIEW_OWN_AUDIT,
        Permission.TRIGGER_STAGING_DEPLOY,
        Permission.RUN_TASK,
        Permission.CREATE_GOAL,
    },
    Role.ADMIN: {
        Permission.VIEW_TASKS,
        Permission.VIEW_OWN_AUDIT,
        Permission.VIEW_ALL_AUDIT,
        Permission.TRIGGER_STAGING_DEPLOY,
        Permission.TRIGGER_PRODUCTION_DEPLOY,
        Permission.RUN_TASK,
        Permission.APPROVE_TASK,
        Permission.CREATE_GOAL,
        Permission.MODIFY_PLAN,
        Permission.RUN_MIGRATION,
        Permission.BULK_OPERATION,
        Permission.MANAGE_INTEGRATIONS,
    },
    Role.SUPER_ADMIN: set(Permission),  # All permissions
}


def has_permission(role: Role, permission: Permission) -> bool:
    """Check if a role has a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())


def get_permissions(role: Role) -> set[Permission]:
    """Get all permissions for a role."""
    return ROLE_PERMISSIONS.get(role, set())


def require_role(minimum_role: Role) -> Callable:
    """FastAPI dependency that enforces minimum role.

    Usage:
        @router.post("/deploy", dependencies=[Depends(require_role(Role.ADMIN))])
        async def deploy(): ...
    """
    # Role hierarchy for comparison
    role_hierarchy = {
        Role.VIEWER: 0,
        Role.OPERATOR: 1,
        Role.ADMIN: 2,
        Role.SUPER_ADMIN: 3,
    }

    async def _check_role(request: Any) -> None:
        user_role_str = getattr(request.state, "user_role", None)
        if not user_role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        try:
            user_role = Role(user_role_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unknown role: {user_role_str}",
            )

        if role_hierarchy.get(user_role, -1) < role_hierarchy[minimum_role]:
            logger.warning(
                "auth.insufficient_role",
                user_role=user_role.value,
                required_role=minimum_role.value,
                path=str(request.url.path),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {minimum_role.value}",
            )

    return _check_role


def require_permission(permission: Permission) -> Callable:
    """FastAPI dependency that enforces a specific permission."""

    async def _check_permission(request: Any) -> None:
        user_role_str = getattr(request.state, "user_role", None)
        if not user_role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        try:
            user_role = Role(user_role_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unknown role: {user_role_str}",
            )

        if not has_permission(user_role, permission):
            logger.warning(
                "auth.insufficient_permission",
                user_role=user_role.value,
                required_permission=permission.value,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission.value}",
            )

    return _check_permission
