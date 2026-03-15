"""Tests for RBAC — role hierarchy and permissions."""

from __future__ import annotations

import pytest

from aegisforge.auth.rbac import (
    Permission,
    Role,
    ROLE_PERMISSIONS,
    get_permissions,
    has_permission,
)
from aegisforge.auth.providers import resolve_role_from_groups


class TestRolePermissions:
    def test_viewer_can_view_tasks(self) -> None:
        assert has_permission(Role.VIEWER, Permission.VIEW_TASKS)

    def test_viewer_cannot_deploy(self) -> None:
        assert not has_permission(Role.VIEWER, Permission.TRIGGER_STAGING_DEPLOY)
        assert not has_permission(Role.VIEWER, Permission.TRIGGER_PRODUCTION_DEPLOY)

    def test_operator_can_deploy_staging(self) -> None:
        assert has_permission(Role.OPERATOR, Permission.TRIGGER_STAGING_DEPLOY)

    def test_operator_cannot_deploy_production(self) -> None:
        assert not has_permission(Role.OPERATOR, Permission.TRIGGER_PRODUCTION_DEPLOY)

    def test_admin_can_deploy_production(self) -> None:
        assert has_permission(Role.ADMIN, Permission.TRIGGER_PRODUCTION_DEPLOY)

    def test_admin_cannot_modify_rbac(self) -> None:
        assert not has_permission(Role.ADMIN, Permission.MODIFY_RBAC)

    def test_super_admin_has_all_permissions(self) -> None:
        for perm in Permission:
            assert has_permission(Role.SUPER_ADMIN, perm), f"Super-admin missing: {perm}"

    def test_role_hierarchy_is_cumulative(self) -> None:
        """Higher roles should have all permissions of lower roles."""
        viewer_perms = get_permissions(Role.VIEWER)
        operator_perms = get_permissions(Role.OPERATOR)
        admin_perms = get_permissions(Role.ADMIN)
        super_admin_perms = get_permissions(Role.SUPER_ADMIN)

        assert viewer_perms.issubset(operator_perms)
        assert operator_perms.issubset(admin_perms)
        assert admin_perms.issubset(super_admin_perms)

    def test_get_permissions_unknown_role(self) -> None:
        # Shouldn't crash, just return empty set
        assert get_permissions("nonexistent") == set()


class TestGroupRoleResolution:
    def test_single_group_maps_to_role(self) -> None:
        assert resolve_role_from_groups(["aegisforge-admins"]) == "admin"

    def test_multiple_groups_picks_highest(self) -> None:
        groups = ["aegisforge-viewers", "aegisforge-operators", "aegisforge-admins"]
        assert resolve_role_from_groups(groups) == "admin"

    def test_no_matching_groups_defaults_to_viewer(self) -> None:
        assert resolve_role_from_groups(["some-other-group"]) == "viewer"

    def test_empty_groups_defaults_to_viewer(self) -> None:
        assert resolve_role_from_groups([]) == "viewer"

    def test_super_admin_group(self) -> None:
        assert resolve_role_from_groups(["aegisforge-super-admins"]) == "super-admin"

    def test_custom_group_map(self) -> None:
        custom_map = {"devops": "operator", "platform-team": "admin"}
        assert resolve_role_from_groups(["platform-team"], custom_map) == "admin"
