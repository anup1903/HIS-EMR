"""Feedback collector — orchestrates post-session analysis.

After a session completes (success or failure), the FeedbackCollector:
1. Persists the session to the database
2. Records each task outcome as an episodic memory
3. Extracts learned rules via LLM analysis
4. Returns a summary report
"""

from __future__ import annotations

from uuid import UUID

import structlog
from pydantic import BaseModel

from aegisforge.agent.models import AgentSession
from aegisforge.memory.episodic import EpisodicMemory
from aegisforge.memory.persistence import SessionStore
from aegisforge.memory.rules import RuleEngine

logger = structlog.get_logger()


class FeedbackReport(BaseModel):
    """Summary of post-session feedback analysis."""

    session_id: UUID
    outcomes_recorded: int
    rules_extracted: int
    new_rules: list[dict]
    total_duration_ms: float


class FeedbackCollector:
    """Orchestrates post-session analysis by coordinating persistence,
    episodic memory recording, and rule extraction.

    Call ``process_completed_session`` after any session reaches a
    terminal state (completed, failed, cancelled).
    """

    def __init__(
        self,
        episodic_memory: EpisodicMemory,
        rule_engine: RuleEngine,
        session_store: SessionStore,
    ) -> None:
        self._episodic = episodic_memory
        self._rules = rule_engine
        self._store = session_store

    async def process_completed_session(
        self, session: AgentSession
    ) -> FeedbackReport:
        """Process a completed session through the full feedback pipeline.

        Steps:
            1. Persist session to DB via SessionStore.
            2. For each task in the session's plan, record an outcome
               in EpisodicMemory with approach summary and error info.
            3. Extract learned rules via RuleEngine.
            4. Return a FeedbackReport with statistics.

        Args:
            session: A terminal-state AgentSession with plan and execution log.

        Returns:
            FeedbackReport summarising what was recorded and extracted.
        """
        logger.info(
            "feedback.processing_session",
            session_id=str(session.session_id),
            state=session.state.value,
        )

        # 1. Persist session
        try:
            await self._store.save(session)
        except Exception:
            logger.exception(
                "feedback.session_persist_failed",
                session_id=str(session.session_id),
            )
            # Continue — recording outcomes is still valuable even if
            # session persistence fails

        # 2. Record task outcomes
        outcomes_recorded = 0
        total_duration_ms = 0.0
        goal_summary = session.goal.title

        if session.plan and session.plan.tasks:
            for task in session.plan.tasks:
                # Build approach summary from task output
                approach = ""
                if task.tool:
                    approach = f"Used tool: {task.tool}."
                if task.output:
                    output_str = str(task.output)
                    approach += f" Output: {output_str[:300]}"

                duration_ms = (task.duration_seconds or 0.0) * 1000.0
                total_duration_ms += duration_ms

                # Build lessons from error context
                lessons = ""
                if task.error:
                    lessons = f"Failed with: {task.error[:500]}"
                if task.retry_count > 0:
                    lessons += f" Retried {task.retry_count} time(s)."

                try:
                    await self._episodic.record_outcome(
                        task=task,
                        session_id=session.session_id,
                        goal_summary=goal_summary,
                        approach=approach.strip(),
                        lessons=lessons.strip(),
                    )
                    outcomes_recorded += 1
                except Exception:
                    logger.exception(
                        "feedback.outcome_record_failed",
                        task_id=str(task.task_id),
                        session_id=str(session.session_id),
                    )
                    # Continue with remaining tasks

        # 3. Extract learned rules
        new_rules: list[dict] = []
        try:
            new_rules = await self._rules.extract_rules(session)
        except Exception:
            logger.exception(
                "feedback.rule_extraction_failed",
                session_id=str(session.session_id),
            )

        report = FeedbackReport(
            session_id=session.session_id,
            outcomes_recorded=outcomes_recorded,
            rules_extracted=len(new_rules),
            new_rules=new_rules,
            total_duration_ms=total_duration_ms,
        )

        logger.info(
            "feedback.session_processed",
            session_id=str(session.session_id),
            outcomes=outcomes_recorded,
            rules=len(new_rules),
            duration_ms=total_duration_ms,
        )

        return report
