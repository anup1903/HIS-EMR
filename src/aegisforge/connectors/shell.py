"""Shell connector — sandboxed local command execution."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import structlog

from aegisforge.config import Settings, get_settings
from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()

# Default allowed base paths when none are configured.
_DEFAULT_ALLOWED_PATHS: list[str] = ["/tmp"]


class ShellConnector(BaseConnector):
    """Connector for sandboxed local shell command execution.

    Security guarantees:
    - Uses ``asyncio.create_subprocess_exec`` (no ``shell=True``).
    - Working directory must be within ``allowed_paths``.
    - Enforces a per-command timeout from ``task_timeout_seconds``.
    - Captures stdout and stderr separately.
    """

    connector_name: str = "shell"
    _supported_actions: set[str] = {
        "run_command",
        "run_tests",
        "run_linter",
        "run_build",
    }

    def __init__(
        self,
        settings: Settings | None = None,
        allowed_paths: list[str] | None = None,
    ) -> None:
        """Initialise the shell connector.

        Args:
            settings: Application settings (for ``task_timeout_seconds``).
            allowed_paths: Directories the connector may execute within.
                           Defaults to ``["/tmp"]``.
        """
        self._settings = settings or get_settings()
        self._timeout = self._settings.task_timeout_seconds
        self._allowed_paths = [
            Path(p).resolve() for p in (allowed_paths or _DEFAULT_ALLOWED_PATHS)
        ]

    # ── Security ──────────────────────────────────────────────────────

    def _validate_working_dir(self, cwd: str) -> Path:
        """Ensure the working directory is within allowed paths.

        Args:
            cwd: Requested working directory.

        Returns:
            Resolved ``Path`` if valid.

        Raises:
            PermissionError: If the path is outside allowed directories.
        """
        resolved = Path(cwd).resolve()
        for allowed in self._allowed_paths:
            if resolved == allowed or allowed in resolved.parents:
                return resolved
        raise PermissionError(
            f"Working directory '{cwd}' is not within allowed paths: "
            f"{[str(p) for p in self._allowed_paths]}"
        )

    # ── Dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for '{action}'")
        return await handler(params)

    # ── Core execution ────────────────────────────────────────────────

    async def _run(
        self,
        command: list[str],
        cwd: str,
        timeout: int | None = None,
        env: dict[str, str] | None = None,
    ) -> ConnectorResult:
        """Execute a command via subprocess_exec with sandboxing.

        Args:
            command: Command and arguments as a list (no shell expansion).
            cwd: Working directory (validated against allowed paths).
            timeout: Override timeout in seconds.
            env: Optional extra environment variables.

        Returns:
            ConnectorResult with stdout, stderr, and exit_code in metadata.
        """
        working_dir = self._validate_working_dir(cwd)
        effective_timeout = timeout or self._timeout

        logger.info(
            "shell.executing",
            command=command[0] if command else "<empty>",
            arg_count=len(command) - 1,
            cwd=str(working_dir),
        )

        try:
            proc = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(working_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=effective_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                "shell.timeout",
                command=command[0] if command else "<empty>",
                timeout=effective_timeout,
            )
            # Attempt to kill the timed-out process.
            try:
                proc.kill()  # type: ignore[possibly-undefined]
            except ProcessLookupError:
                pass
            return ConnectorResult(
                success=False,
                error=f"Command timed out after {effective_timeout}s",
                metadata={"exit_code": -1},
            )
        except FileNotFoundError:
            return ConnectorResult(
                success=False,
                error=f"Command not found: '{command[0] if command else ''}'",
                metadata={"exit_code": -1},
            )

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        exit_code = proc.returncode or 0

        return ConnectorResult(
            success=exit_code == 0,
            data={"stdout": stdout, "stderr": stderr},
            error=stderr.strip() if exit_code != 0 else None,
            metadata={"exit_code": exit_code},
        )

    # ── Actions ───────────────────────────────────────────────────────

    async def _action_run_command(self, params: dict[str, Any]) -> ConnectorResult:
        """Run an arbitrary command (split as a list).

        Params:
            command: List of command parts, e.g. ``["git", "status"]``.
            cwd: Working directory.
            timeout: (optional) Override timeout in seconds.
            env: (optional) Extra environment variables dict.
        """
        command = params["command"]
        if isinstance(command, str):
            return ConnectorResult(
                success=False,
                error="'command' must be a list of strings, not a single string. "
                "This prevents shell injection.",
            )
        return await self._run(
            command=command,
            cwd=params["cwd"],
            timeout=params.get("timeout"),
            env=params.get("env"),
        )

    async def _action_run_tests(self, params: dict[str, Any]) -> ConnectorResult:
        """Run the project test suite.

        Params:
            cwd: Project root directory.
            test_path: (optional) Specific test file/directory.
            extra_args: (optional) Additional pytest arguments as a list.
        """
        command = ["pytest"]
        if test_path := params.get("test_path"):
            command.append(test_path)
        if extra := params.get("extra_args"):
            command.extend(extra)

        return await self._run(command=command, cwd=params["cwd"])

    async def _action_run_linter(self, params: dict[str, Any]) -> ConnectorResult:
        """Run the linter (ruff) on the project.

        Params:
            cwd: Project root directory.
            paths: (optional) List of paths to lint, defaults to ``["src/", "tests/"]``.
            fix: (optional) If ``True``, apply auto-fixes.
        """
        targets = params.get("paths", ["src/", "tests/"])
        command = ["ruff", "check"] + targets
        if params.get("fix"):
            command.append("--fix")

        return await self._run(command=command, cwd=params["cwd"])

    async def _action_run_build(self, params: dict[str, Any]) -> ConnectorResult:
        """Run a build command.

        Params:
            cwd: Project root directory.
            command: Build command as a list, e.g. ``["docker", "build", "-t", "app", "."]``.
            timeout: (optional) Override timeout.
        """
        command = params["command"]
        if isinstance(command, str):
            return ConnectorResult(
                success=False,
                error="'command' must be a list of strings, not a single string.",
            )
        return await self._run(
            command=command,
            cwd=params["cwd"],
            timeout=params.get("timeout"),
        )

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Verify that the shell can execute a basic command."""
        try:
            result = await self._run(
                command=["echo", "ok"],
                cwd="/tmp",
                timeout=5,
            )
            return result.success
        except Exception:
            return False

    async def close(self) -> None:
        """No persistent resources to release."""
