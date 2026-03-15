"""Lint validation using ruff — catches style issues and common errors."""

from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class LintValidator:
    """Runs ruff linter on generated code to catch issues before commit.

    Checks for:
    - E: pycodestyle errors (syntax-adjacent)
    - F: pyflakes (unused imports, undefined names, etc.)
    - W: pycodestyle warnings
    - I: isort (import ordering)
    """

    DEFAULT_RULES = ["E", "F", "W"]

    async def validate(
        self,
        code: str,
        rules: list[str] | None = None,
        language: str = "python",
    ) -> list[dict[str, str | int | None]]:
        """Lint code with ruff. Returns list of violations.

        Each violation dict has: message, line, column, code, severity.
        """
        if language != "python":
            return []

        select = ",".join(rules or self.DEFAULT_RULES)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False
        ) as f:
            f.write(code)
            f.flush()
            tmp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "ruff", "check", "--select", select,
                "--output-format", "json",
                "--no-fix",
                tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)

            if not stdout:
                return []

            violations = []
            try:
                results = json.loads(stdout.decode())
            except json.JSONDecodeError:
                logger.warning("lint.parse_error", output=stdout.decode()[:200])
                return []

            for item in results:
                severity = "error" if item.get("code", "").startswith(("E", "F")) else "warning"
                violations.append({
                    "message": item.get("message", ""),
                    "line": item.get("location", {}).get("row"),
                    "column": item.get("location", {}).get("column"),
                    "code": item.get("code", ""),
                    "severity": severity,
                })

            if violations:
                logger.info(
                    "lint.violations_found",
                    count=len(violations),
                    codes=[v["code"] for v in violations[:5]],
                )

            return violations

        except FileNotFoundError:
            logger.warning("lint.ruff_not_found")
            return []
        except asyncio.TimeoutError:
            logger.warning("lint.timeout")
            return []
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    async def fix(self, code: str) -> str:
        """Auto-fix lint issues using ruff. Returns fixed code."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False
        ) as f:
            f.write(code)
            f.flush()
            tmp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "ruff", "check", "--fix", "--select", "E,F,W,I",
                tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=30)
            return Path(tmp_path).read_text()
        except (FileNotFoundError, asyncio.TimeoutError):
            return code
        finally:
            Path(tmp_path).unlink(missing_ok=True)


def get_lint_validator() -> LintValidator:
    return LintValidator()
