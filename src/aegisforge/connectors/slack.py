"""Slack connector — messaging and interactive approvals via Slack Web API."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from aegisforge.config import Settings, get_settings
from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()

_SLACK_API = "https://slack.com/api"


class SlackConnector(BaseConnector):
    """Connector for the Slack Web API using a bot token.

    Supports sending messages, threaded replies, interactive approval
    messages (Block Kit), and file uploads.
    """

    connector_name: str = "slack"
    _supported_actions: set[str] = {
        "send_message",
        "send_approval",
        "send_thread_reply",
        "upload_file",
    }

    def __init__(
        self,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        # Extract token value; never log it.
        self._token = self._settings.slack_bot_token.get_secret_value()
        self._client = http_client or httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )

    # ── Dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for '{action}'")
        return await handler(params)

    # ── Helpers ───────────────────────────────────────────────────────

    async def _post_slack(self, method: str, payload: dict[str, Any]) -> ConnectorResult:
        """Call a Slack Web API method and return a ConnectorResult."""
        resp = await self._client.post(f"{_SLACK_API}/{method}", json=payload)
        resp.raise_for_status()
        data = resp.json()

        if not data.get("ok"):
            error = data.get("error", "unknown_error")
            logger.error("slack.api_error", method=method, error=error)
            return ConnectorResult(success=False, error=error, data=data)

        return ConnectorResult(success=True, data=data)

    # ── Actions ───────────────────────────────────────────────────────

    async def _action_send_message(self, params: dict[str, Any]) -> ConnectorResult:
        """Send a plain or rich message to a channel.

        Params: channel, text, blocks (optional list of Block Kit blocks),
                unfurl_links (optional bool)
        """
        payload: dict[str, Any] = {
            "channel": params["channel"],
            "text": params["text"],
        }
        if blocks := params.get("blocks"):
            payload["blocks"] = blocks
        if "unfurl_links" in params:
            payload["unfurl_links"] = params["unfurl_links"]

        return await self._post_slack("chat.postMessage", payload)

    async def _action_send_approval(self, params: dict[str, Any]) -> ConnectorResult:
        """Send an interactive approval message with Approve/Reject buttons.

        Params: channel, text, approval_id (used as action value),
                context (optional description shown above buttons)
        """
        context_text = params.get("context", "Please review and take action.")
        approval_id = params["approval_id"]

        blocks: list[dict[str, Any]] = [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": params["text"]},
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": context_text}],
            },
            {
                "type": "actions",
                "block_id": f"approval_{approval_id}",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve"},
                        "style": "primary",
                        "action_id": "approval_approve",
                        "value": approval_id,
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Reject"},
                        "style": "danger",
                        "action_id": "approval_reject",
                        "value": approval_id,
                    },
                ],
            },
        ]

        payload: dict[str, Any] = {
            "channel": params["channel"],
            "text": params["text"],  # fallback for notifications
            "blocks": blocks,
        }

        return await self._post_slack("chat.postMessage", payload)

    async def _action_send_thread_reply(self, params: dict[str, Any]) -> ConnectorResult:
        """Reply in a thread.

        Params: channel, thread_ts, text, blocks (optional)
        """
        payload: dict[str, Any] = {
            "channel": params["channel"],
            "thread_ts": params["thread_ts"],
            "text": params["text"],
        }
        if blocks := params.get("blocks"):
            payload["blocks"] = blocks

        return await self._post_slack("chat.postMessage", payload)

    async def _action_upload_file(self, params: dict[str, Any]) -> ConnectorResult:
        """Upload a file to a channel.

        Params: channel, filename, content (str), title (optional),
                initial_comment (optional)
        """
        payload: dict[str, Any] = {
            "channels": params["channel"],
            "filename": params["filename"],
            "content": params["content"],
        }
        if title := params.get("title"):
            payload["title"] = title
        if comment := params.get("initial_comment"):
            payload["initial_comment"] = comment

        # files.upload uses multipart form, not JSON — override content type.
        headers = {
            "Authorization": f"Bearer {self._token}",
        }
        resp = await self._client.post(
            f"{_SLACK_API}/files.upload",
            data=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            return ConnectorResult(success=False, error=data.get("error", "upload_failed"), data=data)
        return ConnectorResult(success=True, data=data)

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Verify bot token validity via auth.test."""
        try:
            resp = await self._client.post(f"{_SLACK_API}/auth.test")
            data = resp.json()
            return bool(data.get("ok"))
        except Exception:
            return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
