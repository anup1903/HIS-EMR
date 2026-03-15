"""Self-review — LLM reviews its own output for correctness before commit."""

from __future__ import annotations

import json
from typing import Any

import structlog
from pydantic import BaseModel, Field

from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class SelfReviewResult(BaseModel):
    """Result of an LLM self-review."""

    approved: bool = False
    confidence: float = 0.0  # 0.0-1.0
    issues: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    reasoning: str = ""


class SelfReviewer:
    """Has the LLM review its own output for correctness and completeness.

    Uses a different model tier than the one that generated the output
    to get an independent perspective. STANDARD tier reviews ADVANCED tier output.
    """

    REVIEW_SYSTEM_PROMPT = (
        "You are a senior code reviewer. Your job is to review generated code or text "
        "for correctness, completeness, security issues, and adherence to the task requirements.\n\n"
        "Respond ONLY with a JSON object in this exact format:\n"
        '{"approved": true/false, "confidence": 0.0-1.0, '
        '"issues": ["list of issues found"], '
        '"suggestions": ["list of improvement suggestions"], '
        '"reasoning": "brief explanation of your assessment"}\n\n'
        "Be critical but fair. Only approve if the output is correct and complete."
    )

    def __init__(
        self,
        llm_client: LLMClient,
        review_tier: ModelTier = ModelTier.STANDARD,
    ) -> None:
        self._llm = llm_client
        self._review_tier = review_tier

    async def review_code(
        self,
        code: str,
        task_description: str,
        language: str = "python",
        context: str = "",
    ) -> SelfReviewResult:
        """Review generated code against the original task description."""
        prompt = (
            f"## Task Description\n{task_description}\n\n"
            f"## Generated Code ({language})\n```{language}\n{code}\n```\n\n"
        )
        if context:
            prompt += f"## Additional Context\n{context}\n\n"
        prompt += (
            "Review this code for:\n"
            "1. Correctness: Does it solve the described task?\n"
            "2. Completeness: Are there missing edge cases or error handling?\n"
            "3. Security: Any injection, XSS, or other vulnerabilities?\n"
            "4. Quality: Is the code well-structured and maintainable?\n"
            "5. Imports: Are all imports valid and necessary?\n"
        )

        return await self._execute_review(prompt)

    async def review_text(
        self,
        text: str,
        task_description: str,
        expected_format: str = "",
    ) -> SelfReviewResult:
        """Review generated text output (docs, review comments, analysis)."""
        prompt = (
            f"## Task Description\n{task_description}\n\n"
            f"## Generated Output\n{text}\n\n"
        )
        if expected_format:
            prompt += f"## Expected Format\n{expected_format}\n\n"
        prompt += (
            "Review this output for:\n"
            "1. Accuracy: Is the information correct?\n"
            "2. Completeness: Does it address the full task?\n"
            "3. Clarity: Is it well-written and understandable?\n"
            "4. Hallucinations: Does it contain made-up information?\n"
        )

        return await self._execute_review(prompt)

    async def _execute_review(self, prompt: str) -> SelfReviewResult:
        """Execute the review LLM call and parse the result."""
        try:
            response = await self._llm.complete_simple(
                prompt=prompt,
                tier=self._review_tier,
                system_prompt=self.REVIEW_SYSTEM_PROMPT,
                temperature=0.0,
                max_tokens=2048,
            )

            return self._parse_review(response)

        except Exception as exc:
            logger.error("self_review.failed", error=str(exc))
            return SelfReviewResult(
                approved=False,
                confidence=0.0,
                issues=[f"Self-review failed: {exc}"],
                reasoning="Review could not be completed due to an error.",
            )

    def _parse_review(self, response: str) -> SelfReviewResult:
        """Parse the LLM review response into a SelfReviewResult."""
        # Try to extract JSON from the response
        try:
            # Handle markdown code fences
            text = response.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])

            data = json.loads(text)

            return SelfReviewResult(
                approved=bool(data.get("approved", False)),
                confidence=max(0.0, min(1.0, float(data.get("confidence", 0.0)))),
                issues=data.get("issues", []),
                suggestions=data.get("suggestions", []),
                reasoning=data.get("reasoning", ""),
            )
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            logger.warning(
                "self_review.parse_failed",
                error=str(exc),
                response_preview=response[:200],
            )
            # If we can't parse, assume not approved (conservative)
            return SelfReviewResult(
                approved=False,
                confidence=0.0,
                issues=["Could not parse review response"],
                reasoning=response[:500],
            )


def get_self_reviewer(llm_client: LLMClient) -> SelfReviewer:
    return SelfReviewer(llm_client=llm_client)
