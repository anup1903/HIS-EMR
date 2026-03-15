"""GitHub connector — GitHub App authentication with installation tokens."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import httpx
import structlog
from jose import jwt as jose_jwt

from aegisforge.config import Settings, get_settings
from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()

_GITHUB_API = "https://api.github.com"
_TOKEN_CACHE_SECONDS = 50 * 60  # refresh at 50 min (tokens expire at 60)


class GitHubConnector(BaseConnector):
    """Connector for GitHub via GitHub App authentication.

    Generates a JWT signed with the app's private key, exchanges it for a
    short-lived installation token, and caches the token for 50 minutes.
    """

    connector_name: str = "github"
    _supported_actions: set[str] = {
        "create_branch",
        "read_file",
        "write_file",
        "create_pull_request",
        "get_pull_request",
        "post_review_comment",
        "merge_pull_request",
        "trigger_workflow",
        "list_checks",
    }

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = http_client or httpx.AsyncClient(timeout=30.0)
        self._installation_token: str | None = None
        self._token_expires_at: float = 0.0
        self._private_key: str | None = None

    # ── Auth helpers ──────────────────────────────────────────────────

    def _load_private_key(self) -> str:
        """Load the GitHub App private key from disk (lazy, cached)."""
        if self._private_key is None:
            key_path = Path(self._settings.github_private_key_path)
            self._private_key = key_path.read_text()
        return self._private_key

    def _generate_jwt(self) -> str:
        """Create a short-lived JWT for GitHub App authentication (RS256)."""
        now = int(time.time())
        payload = {
            "iat": now - 60,  # allow clock skew
            "exp": now + (10 * 60),  # 10 minute max
            "iss": self._settings.github_app_id,
        }
        private_key = self._load_private_key()
        return jose_jwt.encode(payload, private_key, algorithm="RS256")

    async def _get_installation_token(self, installation_id: str) -> str:
        """Obtain or return cached installation access token.

        Args:
            installation_id: The GitHub App installation ID.

        Returns:
            A valid installation token string.
        """
        if self._installation_token and time.time() < self._token_expires_at:
            return self._installation_token

        app_jwt = self._generate_jwt()
        response = await self._client.post(
            f"{_GITHUB_API}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        response.raise_for_status()

        data = response.json()
        self._installation_token = data["token"]
        self._token_expires_at = time.time() + _TOKEN_CACHE_SECONDS

        logger.info("github.installation_token_refreshed")
        return self._installation_token  # type: ignore[return-value]

    def _auth_headers(self, token: str) -> dict[str, str]:
        """Standard headers for authenticated GitHub API requests."""
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    # ── Dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for '{action}'")
        return await handler(params)

    # ── Actions ───────────────────────────────────────────────────────

    async def _action_create_branch(self, params: dict[str, Any]) -> ConnectorResult:
        """Create a branch from a given SHA.

        Params: owner, repo, installation_id, branch, sha
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        resp = await self._client.post(
            f"{_GITHUB_API}/repos/{owner}/{repo}/git/refs",
            headers=self._auth_headers(token),
            json={"ref": f"refs/heads/{params['branch']}", "sha": params["sha"]},
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_read_file(self, params: dict[str, Any]) -> ConnectorResult:
        """Read a file from a repository.

        Params: owner, repo, installation_id, path, ref (optional)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]
        url = f"{_GITHUB_API}/repos/{owner}/{repo}/contents/{params['path']}"
        query: dict[str, str] = {}
        if ref := params.get("ref"):
            query["ref"] = ref

        resp = await self._client.get(
            url, headers=self._auth_headers(token), params=query
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_write_file(self, params: dict[str, Any]) -> ConnectorResult:
        """Create or update a file in a repository.

        Params: owner, repo, installation_id, path, content (base64),
                message, branch, sha (optional, required for update)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        body: dict[str, Any] = {
            "message": params["message"],
            "content": params["content"],
            "branch": params["branch"],
        }
        if sha := params.get("sha"):
            body["sha"] = sha

        resp = await self._client.put(
            f"{_GITHUB_API}/repos/{owner}/{repo}/contents/{params['path']}",
            headers=self._auth_headers(token),
            json=body,
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_create_pull_request(self, params: dict[str, Any]) -> ConnectorResult:
        """Open a pull request.

        Params: owner, repo, installation_id, title, head, base, body (optional)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        body: dict[str, Any] = {
            "title": params["title"],
            "head": params["head"],
            "base": params["base"],
        }
        if pr_body := params.get("body"):
            body["body"] = pr_body

        resp = await self._client.post(
            f"{_GITHUB_API}/repos/{owner}/{repo}/pulls",
            headers=self._auth_headers(token),
            json=body,
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_get_pull_request(self, params: dict[str, Any]) -> ConnectorResult:
        """Get details for a pull request.

        Params: owner, repo, installation_id, pull_number
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        resp = await self._client.get(
            f"{_GITHUB_API}/repos/{owner}/{repo}/pulls/{params['pull_number']}",
            headers=self._auth_headers(token),
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_post_review_comment(self, params: dict[str, Any]) -> ConnectorResult:
        """Post a review comment on a pull request.

        Params: owner, repo, installation_id, pull_number, body,
                commit_id, path, line (optional), side (optional)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        payload: dict[str, Any] = {
            "body": params["body"],
            "commit_id": params["commit_id"],
            "path": params["path"],
        }
        if line := params.get("line"):
            payload["line"] = line
        if side := params.get("side"):
            payload["side"] = side

        resp = await self._client.post(
            f"{_GITHUB_API}/repos/{owner}/{repo}/pulls/{params['pull_number']}/comments",
            headers=self._auth_headers(token),
            json=payload,
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_merge_pull_request(self, params: dict[str, Any]) -> ConnectorResult:
        """Merge a pull request.

        Params: owner, repo, installation_id, pull_number,
                merge_method (optional: "merge"|"squash"|"rebase", default "squash")
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        resp = await self._client.put(
            f"{_GITHUB_API}/repos/{owner}/{repo}/pulls/{params['pull_number']}/merge",
            headers=self._auth_headers(token),
            json={"merge_method": params.get("merge_method", "squash")},
        )
        resp.raise_for_status()
        return ConnectorResult(success=True, data=resp.json())

    async def _action_trigger_workflow(self, params: dict[str, Any]) -> ConnectorResult:
        """Trigger a workflow dispatch event.

        Params: owner, repo, installation_id, workflow_id, ref,
                inputs (optional dict)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]

        body: dict[str, Any] = {"ref": params["ref"]}
        if inputs := params.get("inputs"):
            body["inputs"] = inputs

        resp = await self._client.post(
            f"{_GITHUB_API}/repos/{owner}/{repo}/actions/workflows/{params['workflow_id']}/dispatches",
            headers=self._auth_headers(token),
            json=body,
        )
        resp.raise_for_status()
        # 204 No Content on success
        return ConnectorResult(success=True, data=None, metadata={"status_code": resp.status_code})

    async def _action_list_checks(self, params: dict[str, Any]) -> ConnectorResult:
        """List check runs for a given commit ref, with pagination.

        Params: owner, repo, installation_id, ref, per_page (optional, default 100)
        """
        token = await self._get_installation_token(params["installation_id"])
        owner, repo = params["owner"], params["repo"]
        per_page = params.get("per_page", 100)

        all_checks: list[dict[str, Any]] = []
        page = 1

        while True:
            resp = await self._client.get(
                f"{_GITHUB_API}/repos/{owner}/{repo}/commits/{params['ref']}/check-runs",
                headers=self._auth_headers(token),
                params={"per_page": per_page, "page": page},
            )
            resp.raise_for_status()
            data = resp.json()
            all_checks.extend(data.get("check_runs", []))

            if len(all_checks) >= data.get("total_count", 0):
                break
            page += 1

        return ConnectorResult(
            success=True,
            data=all_checks,
            metadata={"total_count": len(all_checks)},
        )

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Verify connectivity to the GitHub API."""
        try:
            resp = await self._client.get(
                f"{_GITHUB_API}/zen",
                headers={"Accept": "application/vnd.github+json"},
            )
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
