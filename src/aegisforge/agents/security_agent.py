"""Security Agent — specialized for vulnerability detection and secure code review."""

from __future__ import annotations

import time

import structlog

from aegisforge.agents.base import AgentContext, BaseSubAgent, SubAgentResult, SubTask
from aegisforge.llm.models import ModelTier

logger = structlog.get_logger()


class SecurityAgent(BaseSubAgent):
    """Specialized agent for security analysis and vulnerability detection.

    Uses ADVANCED tier for thorough security analysis. Reviews code for
    OWASP Top 10, injection attacks, auth issues, secret leakage, etc.
    """

    agent_name = "security_agent"
    model_tier = ModelTier.ADVANCED
    rag_collections = ["codebase", "docs"]
    system_prompt = (
        "You are a senior application security engineer. You review code for "
        "security vulnerabilities with deep expertise in:\n\n"
        "- OWASP Top 10 (injection, XSS, CSRF, SSRF, etc.)\n"
        "- Authentication and authorization flaws\n"
        "- Secret/credential leakage\n"
        "- Input validation and sanitization\n"
        "- SQL injection, command injection, path traversal\n"
        "- Insecure deserialization\n"
        "- Cryptographic weaknesses\n"
        "- Race conditions and TOCTOU bugs\n"
        "- Dependency vulnerabilities\n\n"
        "For each issue found, provide:\n"
        "1. Severity (critical/high/medium/low)\n"
        "2. Location (file, line if possible)\n"
        "3. Description of the vulnerability\n"
        "4. Concrete fix recommendation\n"
        "5. CWE identifier if applicable\n\n"
        "Respond with a JSON object: {\"vulnerabilities\": [...], \"summary\": \"...\", "
        "\"risk_score\": 0-10, \"approved\": true/false}"
    )

    _SECURITY_KEYWORDS = {
        "security", "vulnerability", "vuln", "exploit", "injection",
        "xss", "csrf", "auth", "password", "secret", "token", "owasp",
        "penetration", "pentest", "scan", "audit", "review",
    }

    async def can_handle(self, task: SubTask) -> float:
        desc_lower = task.description.lower()
        if task.task_type.lower() in ("security_review", "code_review"):
            return 0.9
        matches = sum(1 for kw in self._SECURITY_KEYWORDS if kw in desc_lower)
        return min(0.9, matches * 0.2)

    async def execute(
        self, task: SubTask, context: AgentContext
    ) -> SubAgentResult:
        """Perform security analysis on the provided code or changes."""
        start = time.perf_counter()

        try:
            prompt = self._build_prompt(task)
            analysis = await self._llm_complete(prompt, context, max_tokens=8192)

            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "security_agent.completed",
                task_id=str(task.task_id),
                duration_ms=duration_ms,
            )

            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=True,
                output=analysis,
                confidence=0.85,
                model_tier_used=self.model_tier.value,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error("security_agent.failed", error=str(exc))
            return SubAgentResult(
                task_id=task.task_id,
                agent_name=self.agent_name,
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
            )

    def _build_prompt(self, task: SubTask) -> str:
        parts = [f"## Security Review Task\n{task.description}"]

        code = task.input_data.get("code") or task.input_data.get("diff")
        if code:
            parts.append(f"## Code to Review\n```\n{code}\n```")

        if task.input_data.get("file_path"):
            parts.append(f"## File: {task.input_data['file_path']}")

        parts.append(
            "Perform a thorough security review. "
            "Flag ALL potential vulnerabilities, even low-severity ones."
        )
        return "\n\n".join(parts)
