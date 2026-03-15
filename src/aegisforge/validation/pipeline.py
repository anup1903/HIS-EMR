"""Validation pipeline — chains all validators with iterative LLM self-correction."""

from __future__ import annotations

from typing import Any

import structlog
from pydantic import BaseModel, Field

from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier
from aegisforge.validation.imports import ImportValidator, get_import_validator
from aegisforge.validation.lint import LintValidator, get_lint_validator
from aegisforge.validation.schema import SchemaValidator, get_schema_validator
from aegisforge.validation.self_review import SelfReviewResult, SelfReviewer, get_self_reviewer
from aegisforge.validation.syntax import SyntaxValidator, get_syntax_validator

logger = structlog.get_logger()


class ValidationError(BaseModel):
    """A single validation error."""

    validator: str  # syntax, lint, imports, schema, self_review
    message: str
    line: int | None = None
    column: int | None = None
    code: str | None = None
    severity: str = "error"  # error, warning


class ValidationResult(BaseModel):
    """Aggregate result of the full validation pipeline."""

    passed: bool = False
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)
    iteration: int = 0
    fixed_code: str | None = None
    self_review: SelfReviewResult | None = None

    @property
    def error_count(self) -> int:
        return len(self.errors)

    @property
    def warning_count(self) -> int:
        return len(self.warnings)

    def summary(self) -> str:
        if self.passed:
            return f"Validation passed (iteration {self.iteration}, {self.warning_count} warnings)"
        return (
            f"Validation failed: {self.error_count} errors, "
            f"{self.warning_count} warnings (iteration {self.iteration})"
        )


class ValidationPipeline:
    """Chains validators and supports iterative LLM self-correction.

    Pipeline order:
    1. Syntax check (fast, catches parse errors)
    2. Import validation (catches hallucinated modules)
    3. Lint check (catches style and logic issues)
    4. Self-review (LLM reviews own output for correctness)

    On failure, feeds errors back to LLM for self-correction,
    up to max_iterations.
    """

    def __init__(
        self,
        llm_client: LLMClient | None = None,
        syntax_validator: SyntaxValidator | None = None,
        lint_validator: LintValidator | None = None,
        import_validator: ImportValidator | None = None,
        schema_validator: SchemaValidator | None = None,
        self_reviewer: SelfReviewer | None = None,
    ) -> None:
        self._llm = llm_client
        self._syntax = syntax_validator or get_syntax_validator()
        self._lint = lint_validator or get_lint_validator()
        self._imports = import_validator or get_import_validator()
        self._schema = schema_validator or get_schema_validator()
        self._reviewer = self_reviewer or (
            get_self_reviewer(llm_client) if llm_client else None
        )

    async def validate_code(
        self,
        code: str,
        language: str = "python",
        task_description: str = "",
        skip_self_review: bool = False,
    ) -> ValidationResult:
        """Run the full validation pipeline on generated code.

        Returns ValidationResult with all errors and warnings collected.
        """
        result = ValidationResult(iteration=1)
        all_errors: list[ValidationError] = []
        all_warnings: list[ValidationError] = []

        # Step 1: Syntax
        syntax_errors = await self._syntax.validate(code, language)
        for err in syntax_errors:
            all_errors.append(ValidationError(
                validator="syntax",
                message=str(err["message"]),
                line=err.get("line"),
                column=err.get("column"),
                severity="error",
            ))

        # Bail early if syntax is broken — other checks will fail
        if all_errors:
            result.errors = all_errors
            logger.info("validation.syntax_failed", error_count=len(all_errors))
            return result

        # Step 2: Import validation
        import_errors = await self._imports.validate(code, language)
        for err in import_errors:
            all_errors.append(ValidationError(
                validator="imports",
                message=str(err["message"]),
                line=err.get("line"),
                severity=str(err.get("severity", "error")),
            ))

        # Step 3: Lint
        lint_issues = await self._lint.validate(code, language=language)
        for issue in lint_issues:
            ve = ValidationError(
                validator="lint",
                message=str(issue["message"]),
                line=issue.get("line"),
                column=issue.get("column"),
                code=issue.get("code"),
                severity=str(issue.get("severity", "warning")),
            )
            if ve.severity == "error":
                all_errors.append(ve)
            else:
                all_warnings.append(ve)

        # Step 4: Self-review (optional, requires LLM)
        review = None
        if not skip_self_review and self._reviewer and task_description:
            review = await self._reviewer.review_code(
                code=code,
                task_description=task_description,
                language=language,
            )
            result.self_review = review

            if not review.approved:
                for issue in review.issues:
                    all_errors.append(ValidationError(
                        validator="self_review",
                        message=issue,
                        severity="error",
                    ))

        result.errors = all_errors
        result.warnings = all_warnings
        result.passed = len(all_errors) == 0

        logger.info(
            "validation.completed",
            passed=result.passed,
            errors=result.error_count,
            warnings=result.warning_count,
            self_review_approved=review.approved if review else None,
        )

        return result

    async def validate_and_fix(
        self,
        code: str,
        task_description: str,
        language: str = "python",
        max_iterations: int = 3,
    ) -> ValidationResult:
        """Validate code and iteratively fix using LLM self-correction.

        On each failure:
        1. Collect all validation errors
        2. Send original code + errors to LLM for correction
        3. Re-validate the corrected code
        4. Repeat up to max_iterations

        Returns the final ValidationResult with potentially fixed code.
        """
        if not self._llm:
            return await self.validate_code(
                code, language, task_description, skip_self_review=True
            )

        current_code = code

        for iteration in range(1, max_iterations + 1):
            result = await self.validate_code(
                current_code,
                language,
                task_description,
                skip_self_review=(iteration < max_iterations),  # Self-review only on last pass
            )
            result.iteration = iteration

            if result.passed:
                if iteration > 1:
                    result.fixed_code = current_code
                logger.info(
                    "validation.passed_after_fix",
                    iteration=iteration,
                )
                return result

            # Don't fix on last iteration — just return the failure
            if iteration == max_iterations:
                logger.warning(
                    "validation.max_iterations_reached",
                    iteration=iteration,
                    remaining_errors=result.error_count,
                )
                return result

            # Ask LLM to fix the errors
            current_code = await self._fix_with_llm(
                code=current_code,
                errors=result.errors,
                task_description=task_description,
                language=language,
                iteration=iteration,
            )

        return result  # Should not reach here

    async def _fix_with_llm(
        self,
        code: str,
        errors: list[ValidationError],
        task_description: str,
        language: str,
        iteration: int,
    ) -> str:
        """Ask LLM to fix validation errors."""
        error_text = "\n".join(
            f"- [{e.validator}] Line {e.line}: {e.message}" if e.line
            else f"- [{e.validator}] {e.message}"
            for e in errors
        )

        prompt = (
            f"## Task\n{task_description}\n\n"
            f"## Current Code ({language})\n```{language}\n{code}\n```\n\n"
            f"## Validation Errors (iteration {iteration})\n{error_text}\n\n"
            "Fix ALL the listed errors. Return ONLY the corrected code, "
            "with no explanation or markdown fences."
        )

        try:
            fixed = await self._llm.complete_simple(
                prompt=prompt,
                tier=ModelTier.ADVANCED,
                system_prompt=(
                    "You are a code fixer. Given code with validation errors, "
                    "return the corrected code ONLY. No explanations, no markdown."
                ),
                temperature=0.0,
            )

            # Strip markdown fences if the LLM wraps them anyway
            fixed = fixed.strip()
            if fixed.startswith("```"):
                lines = fixed.split("\n")
                fixed = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

            logger.info(
                "validation.llm_fix_applied",
                iteration=iteration,
                original_len=len(code),
                fixed_len=len(fixed),
            )
            return fixed

        except Exception as exc:
            logger.error("validation.llm_fix_failed", error=str(exc))
            return code  # Return original on failure

    async def validate_structured_output(
        self,
        text: str,
        required_fields: list[str] | None = None,
        task_type: str = "",
    ) -> ValidationResult:
        """Validate LLM structured output (JSON) against expected schema."""
        result = ValidationResult(iteration=1)

        json_errors = await self._schema.validate_json(text, required_fields)
        for err in json_errors:
            result.errors.append(ValidationError(
                validator="schema",
                message=str(err["message"]),
                severity=str(err.get("severity", "error")),
            ))

        if not result.errors and task_type:
            data = self._schema.extract_json(text)
            if isinstance(data, dict):
                type_errors = await self._schema.validate_task_output(data, task_type)
                for err in type_errors:
                    sev = str(err.get("severity", "warning"))
                    ve = ValidationError(
                        validator="schema",
                        message=str(err["message"]),
                        severity=sev,
                    )
                    if sev == "error":
                        result.errors.append(ve)
                    else:
                        result.warnings.append(ve)

        result.passed = len(result.errors) == 0
        return result


def get_validation_pipeline(
    llm_client: LLMClient | None = None,
) -> ValidationPipeline:
    """Create a ValidationPipeline with default validators."""
    return ValidationPipeline(llm_client=llm_client)
