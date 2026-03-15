"""Syntax validation for generated code."""

from __future__ import annotations

import ast
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class SyntaxError_(Exception):
    """Wrapper for syntax errors with structured details."""

    def __init__(self, message: str, line: int | None = None, col: int | None = None):
        super().__init__(message)
        self.line = line
        self.col = col


class SyntaxValidator:
    """Validates that generated code is syntactically correct.

    Supports Python via ast.parse. Extensible to other languages
    via subprocess calls to their respective compilers/parsers.
    """

    SUPPORTED_LANGUAGES = {"python", "json", "yaml"}

    async def validate(
        self,
        code: str,
        language: str = "python",
        filename: str = "<generated>",
    ) -> list[dict[str, str | int | None]]:
        """Validate code syntax. Returns list of errors (empty = valid).

        Each error dict has: message, line, column, severity.
        """
        if language == "python":
            return self._validate_python(code, filename)
        if language == "json":
            return self._validate_json(code)
        if language == "yaml":
            return self._validate_yaml(code)

        logger.info("syntax.unsupported_language", language=language)
        return []

    def _validate_python(
        self, code: str, filename: str = "<generated>"
    ) -> list[dict[str, str | int | None]]:
        """Validate Python syntax using ast.parse."""
        errors: list[dict[str, str | int | None]] = []
        try:
            ast.parse(code, filename=filename)
        except SyntaxError as exc:
            errors.append({
                "message": str(exc.msg),
                "line": exc.lineno,
                "column": exc.offset,
                "severity": "error",
            })
            logger.warning(
                "syntax.python_error",
                filename=filename,
                line=exc.lineno,
                message=exc.msg,
            )
        return errors

    def _validate_json(self, code: str) -> list[dict[str, str | int | None]]:
        """Validate JSON syntax."""
        import json

        errors: list[dict[str, str | int | None]] = []
        try:
            json.loads(code)
        except json.JSONDecodeError as exc:
            errors.append({
                "message": str(exc),
                "line": exc.lineno,
                "column": exc.colno,
                "severity": "error",
            })
        return errors

    def _validate_yaml(self, code: str) -> list[dict[str, str | int | None]]:
        """Validate YAML syntax."""
        errors: list[dict[str, str | int | None]] = []
        try:
            import yaml

            yaml.safe_load(code)
        except yaml.YAMLError as exc:
            line = getattr(exc, "problem_mark", None)
            errors.append({
                "message": str(exc),
                "line": line.line + 1 if line else None,
                "column": line.column if line else None,
                "severity": "error",
            })
        return errors


def get_syntax_validator() -> SyntaxValidator:
    return SyntaxValidator()
