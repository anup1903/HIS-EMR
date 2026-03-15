"""Schema validation for LLM structured output (JSON/dict)."""

from __future__ import annotations

import json
from typing import Any

import structlog

logger = structlog.get_logger()


class SchemaValidator:
    """Validates that LLM structured output matches expected schemas.

    Catches malformed JSON, missing required fields, wrong types, etc.
    """

    async def validate_json(
        self,
        text: str,
        required_fields: list[str] | None = None,
    ) -> list[dict[str, str | None]]:
        """Validate that text is valid JSON with required fields.

        Returns list of errors (empty = valid).
        """
        errors: list[dict[str, str | None]] = []

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            errors.append({
                "message": f"Invalid JSON: {exc}",
                "field": None,
                "severity": "error",
            })
            return errors

        if required_fields and isinstance(data, dict):
            for field in required_fields:
                if field not in data:
                    errors.append({
                        "message": f"Missing required field: {field}",
                        "field": field,
                        "severity": "error",
                    })

        return errors

    async def validate_dict(
        self,
        data: dict[str, Any],
        schema: dict[str, type | tuple[type, ...]] | None = None,
        required_fields: list[str] | None = None,
    ) -> list[dict[str, str | None]]:
        """Validate a dict against an expected schema.

        Args:
            data: The dict to validate.
            schema: Mapping of field name -> expected type(s).
            required_fields: Fields that must be present.
        """
        errors: list[dict[str, str | None]] = []

        if required_fields:
            for field in required_fields:
                if field not in data:
                    errors.append({
                        "message": f"Missing required field: {field}",
                        "field": field,
                        "severity": "error",
                    })

        if schema:
            for field, expected_type in schema.items():
                if field in data:
                    if not isinstance(data[field], expected_type):
                        errors.append({
                            "message": (
                                f"Field '{field}' has type {type(data[field]).__name__}, "
                                f"expected {expected_type}"
                            ),
                            "field": field,
                            "severity": "error",
                        })

        if errors:
            logger.warning(
                "schema.validation_errors",
                count=len(errors),
                fields=[e["field"] for e in errors],
            )

        return errors

    async def validate_task_output(
        self,
        output: Any,
        task_type: str,
    ) -> list[dict[str, str | None]]:
        """Validate task output based on expected structure per task type.

        Each task type has different expected output fields.
        """
        errors: list[dict[str, str | None]] = []

        if output is None:
            errors.append({
                "message": "Task output is None",
                "field": "output",
                "severity": "error",
            })
            return errors

        if not isinstance(output, dict):
            return []  # Non-dict output is acceptable for some task types

        # Task-type-specific validation
        _type_schemas: dict[str, list[str]] = {
            "code_generation": ["code", "language"],
            "code_modification": ["code", "language"],
            "code_review": ["review_summary"],
            "test_creation": ["test_code"],
            "test_execution": ["passed", "exit_code"],
            "ci_cd_trigger": ["workflow_run_id"],
            "db_migration": ["migration_id"],
            "analysis": ["findings"],
        }

        required = _type_schemas.get(task_type)
        if required:
            for field in required:
                if field not in output:
                    errors.append({
                        "message": f"Expected field '{field}' in {task_type} output",
                        "field": field,
                        "severity": "warning",
                    })

        return errors

    def extract_json(self, text: str) -> dict[str, Any] | list | None:
        """Extract JSON from LLM text that may contain markdown fences or extra text."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code blocks
        import re

        patterns = [
            r"```json\s*\n(.*?)```",
            r"```\s*\n(.*?)```",
            r"\{[\s\S]*\}",
            r"\[[\s\S]*\]",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1) if "```" in pattern else match.group(0))
                except (json.JSONDecodeError, IndexError):
                    continue

        return None


def get_schema_validator() -> SchemaValidator:
    return SchemaValidator()
