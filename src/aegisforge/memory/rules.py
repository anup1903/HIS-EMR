"""Rule engine — extracts and manages learned rules from task outcomes.

After each session completes, the LLM analyses the execution history to
extract reusable rules (positive patterns, negative patterns, estimation
adjustments, constraints). These rules are stored with a confidence score
that is adjusted as subsequent sessions confirm or contradict them.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from aegisforge.agent.models import AgentSession
from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import ModelTier
from aegisforge.memory.models import LearnedRule

logger = structlog.get_logger()

_RULE_EXTRACTION_PROMPT = """\
Analyse the following completed agent session and extract reusable rules \
that could improve future task planning and execution.

Session goal: {goal_title}
Session state: {session_state}

Task outcomes:
{task_summaries}

Extract rules in these categories:
- positive: approaches/patterns that led to success
- negative: anti-patterns or approaches that led to failure
- estimation: adjustments to time/effort estimates based on actual results
- constraint: environmental constraints discovered during execution

Return a JSON array of rule objects. Each rule must have:
- "rule_type": one of "positive", "negative", "estimation", "constraint"
- "description": a concise, actionable description of the rule
- "task_types": array of task type strings this rule applies to (e.g. ["code_generation", "test_execution"])

Return ONLY the JSON array, no other text. If no rules can be extracted, return [].
"""


class RuleEngine:
    """Extracts and manages learned rules from task execution history.

    Uses the STANDARD tier LLM to analyse completed sessions and extract
    actionable rules. Rules accumulate confidence as they are confirmed
    or weakened by subsequent sessions.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker,
        llm_client: LLMClient,
    ) -> None:
        self._session_factory = session_factory
        self._llm_client = llm_client

    async def extract_rules(self, session: AgentSession) -> list[dict]:
        """Analyse a completed session and extract reusable rules.

        Uses the STANDARD tier LLM to identify patterns from the session's
        task outcomes and stores them in the learned_rules table.

        Args:
            session: A completed AgentSession with a plan and task results.

        Returns:
            List of rule dicts with keys: rule_type, description, task_types.
        """
        if not session.plan or not session.plan.tasks:
            logger.info(
                "rule_engine.skip_no_tasks",
                session_id=str(session.session_id),
            )
            return []

        # Build task summaries for the prompt
        task_lines: list[str] = []
        for task in session.plan.tasks:
            duration_s = task.duration_seconds or 0.0
            line = (
                f"- {task.name} ({task.task_type.value}): {task.status.value}, "
                f"duration={duration_s:.1f}s"
            )
            if task.error:
                line += f", error: {task.error[:200]}"
            task_lines.append(line)

        prompt = _RULE_EXTRACTION_PROMPT.format(
            goal_title=session.goal.title,
            session_state=session.state.value,
            task_summaries="\n".join(task_lines),
        )

        try:
            raw_response = await self._llm_client.complete_simple(
                prompt=prompt,
                tier=ModelTier.STANDARD,
                system_prompt=(
                    "You are an expert at extracting reusable patterns from "
                    "software delivery task outcomes. Be concise and actionable."
                ),
                temperature=0.1,
                max_tokens=2048,
            )

            rules = self._parse_rules_response(raw_response)

            # Persist extracted rules
            stored_rules: list[dict] = []
            async with self._session_factory() as db:
                try:
                    for rule_data in rules:
                        rule = LearnedRule(
                            rule_type=rule_data["rule_type"],
                            description=rule_data["description"],
                            task_types=rule_data.get("task_types", []),
                            source_sessions=[str(session.session_id)],
                            confidence=0.5,
                        )
                        db.add(rule)
                        stored_rules.append(rule_data)

                    await db.commit()
                except Exception:
                    await db.rollback()
                    logger.exception(
                        "rule_engine.store_failed",
                        session_id=str(session.session_id),
                    )
                    raise

            logger.info(
                "rule_engine.rules_extracted",
                session_id=str(session.session_id),
                count=len(stored_rules),
            )
            return stored_rules

        except Exception:
            logger.exception(
                "rule_engine.extraction_failed",
                session_id=str(session.session_id),
            )
            return []

    async def get_relevant_rules(
        self,
        goal_description: str,
        task_types: list[str] | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """Retrieve active rules relevant to a goal.

        Filters by task_types if provided, and orders by confidence
        and confirmation count.

        Args:
            goal_description: Description of the current goal (for logging).
            task_types: Optional list of task type strings to filter on.
            limit: Maximum rules to return.

        Returns:
            List of rule dicts with keys: rule_id, rule_type, description,
            confidence, task_types, times_confirmed.
        """
        async with self._session_factory() as db:
            try:
                stmt = (
                    select(LearnedRule)
                    .where(LearnedRule.active.is_(True))
                    .order_by(
                        LearnedRule.confidence.desc(),
                        LearnedRule.times_confirmed.desc(),
                    )
                    .limit(limit)
                )

                # Filter by task types if provided — match rules whose
                # task_types array overlaps with the requested types
                if task_types:
                    # Use PostgreSQL JSONB ?| operator for array overlap
                    stmt = stmt.where(
                        LearnedRule.task_types.op("?|")(task_types)
                    )

                result = await db.execute(stmt)
                records = result.scalars().all()

                rules = [
                    {
                        "rule_id": str(r.rule_id),
                        "rule_type": r.rule_type,
                        "description": r.description,
                        "confidence": r.confidence,
                        "task_types": r.task_types,
                        "times_confirmed": r.times_confirmed,
                    }
                    for r in records
                ]

                logger.info(
                    "rule_engine.relevant_rules",
                    goal_preview=goal_description[:80],
                    task_types=task_types,
                    results=len(rules),
                )
                return rules
            except Exception:
                logger.exception("rule_engine.get_relevant_failed")
                raise

    async def confirm_rule(self, rule_id: UUID) -> None:
        """Increment times_confirmed and boost confidence for a rule.

        Called when a rule's prediction proves correct in a subsequent session.
        Confidence increases with diminishing returns, capped at 0.99.
        """
        async with self._session_factory() as db:
            try:
                result = await db.execute(
                    select(LearnedRule).where(LearnedRule.rule_id == rule_id)
                )
                rule = result.scalar_one_or_none()
                if rule is None:
                    logger.warning(
                        "rule_engine.confirm_not_found",
                        rule_id=str(rule_id),
                    )
                    return

                rule.times_confirmed += 1
                # Diminishing confidence boost: +10% of remaining headroom
                rule.confidence = min(
                    0.99, rule.confidence + (1.0 - rule.confidence) * 0.1
                )
                rule.last_confirmed = datetime.now(timezone.utc)

                await db.commit()
                logger.info(
                    "rule_engine.rule_confirmed",
                    rule_id=str(rule_id),
                    new_confidence=rule.confidence,
                    times_confirmed=rule.times_confirmed,
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "rule_engine.confirm_failed",
                    rule_id=str(rule_id),
                )
                raise

    async def weaken_rule(self, rule_id: UUID) -> None:
        """Decrease confidence when a rule proves wrong.

        Deactivates the rule automatically if confidence drops below 0.1.
        """
        async with self._session_factory() as db:
            try:
                result = await db.execute(
                    select(LearnedRule).where(LearnedRule.rule_id == rule_id)
                )
                rule = result.scalar_one_or_none()
                if rule is None:
                    logger.warning(
                        "rule_engine.weaken_not_found",
                        rule_id=str(rule_id),
                    )
                    return

                # Reduce confidence by 20%
                rule.confidence = max(0.0, rule.confidence * 0.8)

                if rule.confidence < 0.1:
                    rule.active = False
                    logger.info(
                        "rule_engine.rule_deactivated_low_confidence",
                        rule_id=str(rule_id),
                        confidence=rule.confidence,
                    )

                await db.commit()
                logger.info(
                    "rule_engine.rule_weakened",
                    rule_id=str(rule_id),
                    new_confidence=rule.confidence,
                    active=rule.active,
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "rule_engine.weaken_failed",
                    rule_id=str(rule_id),
                )
                raise

    async def deactivate_rule(self, rule_id: UUID) -> None:
        """Deactivate a rule so it is no longer returned by queries."""
        async with self._session_factory() as db:
            try:
                await db.execute(
                    update(LearnedRule)
                    .where(LearnedRule.rule_id == rule_id)
                    .values(active=False)
                )
                await db.commit()
                logger.info(
                    "rule_engine.rule_deactivated",
                    rule_id=str(rule_id),
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "rule_engine.deactivate_failed",
                    rule_id=str(rule_id),
                )
                raise

    @staticmethod
    def _parse_rules_response(raw: str) -> list[dict]:
        """Parse the LLM's JSON response into a list of rule dicts.

        Handles common LLM output quirks like markdown code fences.
        """
        text = raw.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last lines (``` markers)
            lines = [
                line
                for line in lines
                if not line.strip().startswith("```")
            ]
            text = "\n".join(lines)

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.warning(
                "rule_engine.parse_failed",
                response_preview=text[:200],
            )
            return []

        if not isinstance(parsed, list):
            logger.warning("rule_engine.unexpected_format", type=type(parsed).__name__)
            return []

        valid_types = {"positive", "negative", "estimation", "constraint"}
        rules: list[dict] = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            rule_type = item.get("rule_type", "")
            description = item.get("description", "")
            if rule_type not in valid_types or not description:
                continue
            rules.append(
                {
                    "rule_type": rule_type,
                    "description": description,
                    "task_types": item.get("task_types", []),
                }
            )

        return rules
