"""Tests for memory module — feedback, rules, episodic, persistence."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from aegisforge.agent.models import AgentSession, ExecutionState
from aegisforge.memory.episodic import EpisodicMemory, PastOutcome
from aegisforge.memory.feedback import FeedbackCollector, FeedbackReport
from aegisforge.memory.rules import RuleEngine
from aegisforge.planner.models import Goal, Plan, TaskNode, TaskStatus, TaskType


def _make_session(with_plan: bool = True) -> AgentSession:
    goal = Goal(title="Fix auth bug", description="Auth timeout after 30s")
    tasks = []
    if with_plan:
        t1 = TaskNode(
            name="Analyze code",
            description="Look at auth module",
            task_type=TaskType.ANALYSIS,
            status=TaskStatus.COMPLETED,
        )
        t2 = TaskNode(
            name="Write fix",
            description="Fix the timeout",
            task_type=TaskType.CODE_MODIFICATION,
            status=TaskStatus.FAILED,
            error="Syntax error in generated code",
            retry_count=1,
        )
        tasks = [t1, t2]
    plan = Plan(goal=goal, tasks=tasks) if with_plan else None
    session = AgentSession(goal=goal, plan=plan)
    return session


# ---------------------------------------------------------------------------
# TestRuleEngine
# ---------------------------------------------------------------------------
class TestRuleEngine:
    """Tests for RuleEngine._parse_rules_response and extract_rules edge cases."""

    def test_parse_valid_rules(self) -> None:
        raw = (
            '[{"rule_type": "positive", "description": "Use retries for flaky APIs", '
            '"task_types": ["api_call"]}, '
            '{"rule_type": "negative", "description": "Never mutate prod DB without backup", '
            '"task_types": ["db_migration"]}]'
        )
        result = RuleEngine._parse_rules_response(raw)
        assert len(result) == 2
        assert result[0]["rule_type"] == "positive"
        assert result[0]["description"] == "Use retries for flaky APIs"
        assert result[0]["task_types"] == ["api_call"]
        assert result[1]["rule_type"] == "negative"

    def test_parse_empty_array(self) -> None:
        result = RuleEngine._parse_rules_response("[]")
        assert result == []

    def test_parse_invalid_json(self) -> None:
        result = RuleEngine._parse_rules_response("this is not json at all {{{")
        assert result == []

    def test_parse_strips_markdown_fences(self) -> None:
        raw = (
            '```json\n'
            '[{"rule_type": "constraint", "description": "Max 5 concurrent deploys", '
            '"task_types": ["infrastructure"]}]\n'
            '```'
        )
        result = RuleEngine._parse_rules_response(raw)
        assert len(result) == 1
        assert result[0]["rule_type"] == "constraint"
        assert result[0]["description"] == "Max 5 concurrent deploys"

    def test_parse_filters_invalid_types(self) -> None:
        raw = (
            '[{"rule_type": "positive", "description": "Good pattern", "task_types": []}, '
            '{"rule_type": "INVALID_TYPE", "description": "Bad type", "task_types": []}, '
            '{"rule_type": "negative", "description": "Anti-pattern", "task_types": []}]'
        )
        result = RuleEngine._parse_rules_response(raw)
        assert len(result) == 2
        assert all(r["rule_type"] in {"positive", "negative"} for r in result)

    @pytest.mark.asyncio
    async def test_extract_rules_no_plan(self) -> None:
        session_factory = MagicMock()
        llm_client = AsyncMock()
        engine = RuleEngine(session_factory=session_factory, llm_client=llm_client)

        session = _make_session(with_plan=False)
        result = await engine.extract_rules(session)

        assert result == []
        llm_client.complete_simple.assert_not_called()


# ---------------------------------------------------------------------------
# TestFeedbackCollector
# ---------------------------------------------------------------------------
class TestFeedbackCollector:
    """Tests for FeedbackCollector with fully mocked dependencies."""

    @pytest.mark.asyncio
    async def test_process_completed_session(self) -> None:
        mock_store = AsyncMock()
        mock_episodic = AsyncMock()
        mock_rules = AsyncMock()

        mock_rules.extract_rules.return_value = [
            {"rule_type": "positive", "description": "Retry works", "task_types": ["api_call"]},
        ]

        collector = FeedbackCollector(
            episodic_memory=mock_episodic,
            rule_engine=mock_rules,
            session_store=mock_store,
        )

        session = _make_session(with_plan=True)
        report = await collector.process_completed_session(session)

        # SessionStore.save was called once with the session
        mock_store.save.assert_awaited_once_with(session)

        # EpisodicMemory.record_outcome was called once per task (2 tasks)
        assert mock_episodic.record_outcome.await_count == 2

        # RuleEngine.extract_rules was called once
        mock_rules.extract_rules.assert_awaited_once_with(session)

        # Report is correct
        assert isinstance(report, FeedbackReport)
        assert report.session_id == session.session_id
        assert report.outcomes_recorded == 2
        assert report.rules_extracted == 1
        assert len(report.new_rules) == 1

    @pytest.mark.asyncio
    async def test_process_session_no_plan(self) -> None:
        mock_store = AsyncMock()
        mock_episodic = AsyncMock()
        mock_rules = AsyncMock()
        mock_rules.extract_rules.return_value = []

        collector = FeedbackCollector(
            episodic_memory=mock_episodic,
            rule_engine=mock_rules,
            session_store=mock_store,
        )

        session = _make_session(with_plan=False)
        report = await collector.process_completed_session(session)

        assert report.outcomes_recorded == 0
        mock_episodic.record_outcome.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_store_failure_continues(self) -> None:
        mock_store = AsyncMock()
        mock_store.save.side_effect = RuntimeError("DB connection lost")

        mock_episodic = AsyncMock()
        mock_rules = AsyncMock()
        mock_rules.extract_rules.return_value = [
            {"rule_type": "negative", "description": "Avoid raw SQL", "task_types": []},
        ]

        collector = FeedbackCollector(
            episodic_memory=mock_episodic,
            rule_engine=mock_rules,
            session_store=mock_store,
        )

        session = _make_session(with_plan=True)
        report = await collector.process_completed_session(session)

        # Even though save failed, outcomes and rules should still process
        assert report.outcomes_recorded == 2
        assert report.rules_extracted == 1
        assert mock_episodic.record_outcome.await_count == 2
        mock_rules.extract_rules.assert_awaited_once()


# ---------------------------------------------------------------------------
# TestPastOutcome
# ---------------------------------------------------------------------------
class TestPastOutcome:
    """Simple model tests for PastOutcome."""

    def test_past_outcome_fields(self) -> None:
        now = datetime.now(timezone.utc)
        outcome = PastOutcome(
            task_name="Run unit tests",
            task_type="test_execution",
            status="completed",
            duration_ms=3500.0,
            approach_summary="Used pytest with coverage",
            error_summary=None,
            lessons_learned="Tests flaky on CI — add retry",
            similarity_score=0.92,
            session_goal="Improve test coverage",
            timestamp=now,
        )

        assert outcome.task_name == "Run unit tests"
        assert outcome.task_type == "test_execution"
        assert outcome.status == "completed"
        assert outcome.duration_ms == 3500.0
        assert outcome.approach_summary == "Used pytest with coverage"
        assert outcome.error_summary is None
        assert outcome.lessons_learned == "Tests flaky on CI — add retry"
        assert outcome.similarity_score == 0.92
        assert outcome.session_goal == "Improve test coverage"
        assert outcome.timestamp == now
