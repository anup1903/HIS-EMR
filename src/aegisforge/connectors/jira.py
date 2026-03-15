"""Jira connector — issue management via Jira REST API v3."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from aegisforge.config import Settings, get_settings
from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()


class JiraConnector(BaseConnector):
    """Connector for Atlassian Jira Cloud / Server REST API.

    Supports basic auth (email + API token) or OAuth, configured via
    ``jira_base_url`` and credential headers passed at init time.
    """

    connector_name: str = "jira"
    _supported_actions: set[str] = {
        "create_issue",
        "update_issue",
        "transition_issue",
        "add_comment",
        "search_issues",
        "link_issues",
    }

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
        auth: tuple[str, str] | None = None,
    ) -> None:
        """Initialise the Jira connector.

        Args:
            settings: Application settings (for ``jira_base_url``).
            http_client: Optional pre-configured httpx client.
            auth: Tuple of ``(email, api_token)`` for basic auth.
        """
        self._settings = settings or get_settings()
        self._base_url = self._settings.jira_base_url.rstrip("/")
        self._auth = auth
        self._client = http_client or httpx.AsyncClient(
            timeout=30.0,
            auth=self._auth,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

    @property
    def _api(self) -> str:
        return f"{self._base_url}/rest/api/3"

    # ── Dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for '{action}'")
        return await handler(params)

    # ── Actions ───────────────────────────────────────────────────────

    async def _action_create_issue(self, params: dict[str, Any]) -> ConnectorResult:
        """Create a Jira issue.

        Params: project_key, summary, issue_type, description (optional),
                priority (optional), labels (optional), assignee_id (optional),
                custom_fields (optional dict merged into fields)
        """
        fields: dict[str, Any] = {
            "project": {"key": params["project_key"]},
            "summary": params["summary"],
            "issuetype": {"name": params.get("issue_type", "Task")},
        }
        if desc := params.get("description"):
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": desc}]}
                ],
            }
        if priority := params.get("priority"):
            fields["priority"] = {"name": priority}
        if labels := params.get("labels"):
            fields["labels"] = labels
        if assignee := params.get("assignee_id"):
            fields["assignee"] = {"accountId": assignee}
        if custom := params.get("custom_fields"):
            fields.update(custom)

        resp = await self._client.post(
            f"{self._api}/issue",
            json={"fields": fields},
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("jira.issue_created", key=data.get("key"))
        return ConnectorResult(success=True, data=data)

    async def _action_update_issue(self, params: dict[str, Any]) -> ConnectorResult:
        """Update fields on an existing issue.

        Params: issue_key, fields (dict of field updates)
        """
        resp = await self._client.put(
            f"{self._api}/issue/{params['issue_key']}",
            json={"fields": params["fields"]},
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=None, metadata={"issue_key": params["issue_key"]})

    async def _action_transition_issue(self, params: dict[str, Any]) -> ConnectorResult:
        """Transition an issue to a new status.

        Params: issue_key, transition_id
        """
        resp = await self._client.post(
            f"{self._api}/issue/{params['issue_key']}/transitions",
            json={"transition": {"id": str(params["transition_id"])}},
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=None, metadata={"issue_key": params["issue_key"]})

    async def _action_add_comment(self, params: dict[str, Any]) -> ConnectorResult:
        """Add a comment to an issue.

        Params: issue_key, body (plain text)
        """
        comment_body = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": params["body"]}],
                    }
                ],
            }
        }
        resp = await self._client.post(
            f"{self._api}/issue/{params['issue_key']}/comment",
            json=comment_body,
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_search_issues(self, params: dict[str, Any]) -> ConnectorResult:
        """Search issues using JQL.

        Params: jql, max_results (optional, default 50),
                fields (optional list of field names)
        """
        body: dict[str, Any] = {
            "jql": params["jql"],
            "maxResults": params.get("max_results", 50),
        }
        if fields := params.get("fields"):
            body["fields"] = fields

        resp = await self._client.post(
            f"{self._api}/search",
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        return ConnectorResult(
            success=True,
            data=data.get("issues", []),
            metadata={"total": data.get("total", 0)},
        )

    async def _action_link_issues(self, params: dict[str, Any]) -> ConnectorResult:
        """Create a link between two issues.

        Params: link_type (e.g. "Blocks"), inward_issue, outward_issue
        """
        resp = await self._client.post(
            f"{self._api}/issueLink",
            json={
                "type": {"name": params["link_type"]},
                "inwardIssue": {"key": params["inward_issue"]},
                "outwardIssue": {"key": params["outward_issue"]},
            },
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=None)

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Check Jira server status endpoint."""
        try:
            resp = await self._client.get(f"{self._base_url}/rest/api/3/serverInfo")
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
