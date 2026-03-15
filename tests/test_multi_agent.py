"""Tests for the multi-agent coordination system."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from aegisforge.agents.base import AgentContext, BaseSubAgent, SubAgentResult, SubTask
from aegisforge.agents.code_agent import CodeAgent
from aegisforge.agents.security_agent import SecurityAgent
from aegisforge.agents.test_agent import TestAgent
from aegisforge.agents.architecture_agent import ArchitectureAgent
from aegisforge.agents.coordinator import AgentCoordinator
from aegisforge.agents.context_manager import (
    AdaptiveContextManager,
    ScoredChunk,
)


@pytest.fixture
def mock_llm():
    llm = AsyncMock()
    llm.complete_simple = AsyncMock(return_value="generated code output")
    llm.reason = AsyncMock()
    llm.reason.return_value = MagicMock(
        content="analysis result", thinking="deep thinking"
    )
    return llm


@pytest.fixture
def coordinator(mock_llm):
    coord = AgentCoordinator()
    coord.register(CodeAgent(mock_llm))
    coord.register(SecurityAgent(mock_llm))
    coord.register(TestAgent(mock_llm))
    coord.register(ArchitectureAgent(mock_llm))
    return coord


class TestCodeAgent:
    @pytest.mark.asyncio
    async def test_can_handle_code_generation(self, mock_llm):
        agent = CodeAgent(mock_llm)
        task = SubTask(description="Generate auth middleware", task_type="code_generation")
        score = await agent.can_handle(task)
        assert score >= 0.9

    @pytest.mark.asyncio
    async def test_can_handle_unrelated(self, mock_llm):
        agent = CodeAgent(mock_llm)
        task = SubTask(description="Send a notification", task_type="notification")
        score = await agent.can_handle(task)
        assert score < 0.5

    @pytest.mark.asyncio
    async def test_execute_returns_code(self, mock_llm):
        agent = CodeAgent(mock_llm)
        task = SubTask(description="Write a function to parse CSV")
        context = AgentContext()
        result = await agent.execute(task, context)
        assert result.success
        assert result.output is not None
        assert result.agent_name == "code_agent"

    @pytest.mark.asyncio
    async def test_strips_markdown_fences(self, mock_llm):
        mock_llm.complete_simple.return_value = "```python\nx = 1\n```"
        agent = CodeAgent(mock_llm)
        result = await agent.execute(SubTask(description="test"), AgentContext())
        assert result.output == "x = 1"


class TestSecurityAgent:
    @pytest.mark.asyncio
    async def test_can_handle_security_review(self, mock_llm):
        agent = SecurityAgent(mock_llm)
        task = SubTask(description="Review for SQL injection vulnerabilities")
        score = await agent.can_handle(task)
        assert score >= 0.4

    @pytest.mark.asyncio
    async def test_execute(self, mock_llm):
        agent = SecurityAgent(mock_llm)
        task = SubTask(
            description="Security audit",
            input_data={"code": "user_input = request.args.get('q')"},
        )
        result = await agent.execute(task, AgentContext())
        assert result.success


class TestTestAgent:
    @pytest.mark.asyncio
    async def test_can_handle_test_creation(self, mock_llm):
        agent = TestAgent(mock_llm)
        task = SubTask(description="Create tests", task_type="test_creation")
        score = await agent.can_handle(task)
        assert score >= 0.9

    @pytest.mark.asyncio
    async def test_execute(self, mock_llm):
        agent = TestAgent(mock_llm)
        task = SubTask(
            description="Write tests for Calculator",
            input_data={"source_code": "class Calculator: ..."},
        )
        result = await agent.execute(task, AgentContext())
        assert result.success


class TestArchitectureAgent:
    @pytest.mark.asyncio
    async def test_can_handle_analysis(self, mock_llm):
        agent = ArchitectureAgent(mock_llm)
        task = SubTask(description="Design the architecture", task_type="analysis")
        score = await agent.can_handle(task)
        assert score >= 0.9

    @pytest.mark.asyncio
    async def test_execute_uses_reasoning(self, mock_llm):
        agent = ArchitectureAgent(mock_llm)
        task = SubTask(description="Decompose microservices")
        result = await agent.execute(task, AgentContext())
        assert result.success
        mock_llm.reason.assert_called_once()


class TestAgentCoordinator:
    @pytest.mark.asyncio
    async def test_routes_code_task_to_code_agent(self, coordinator):
        task = SubTask(description="Generate code", task_type="code_generation")
        agent = await coordinator.route(task)
        assert agent.agent_name == "code_agent"

    @pytest.mark.asyncio
    async def test_routes_test_task(self, coordinator):
        task = SubTask(description="Create tests", task_type="test_creation")
        agent = await coordinator.route(task)
        assert agent.agent_name == "test_agent"

    @pytest.mark.asyncio
    async def test_execute_succeeds(self, coordinator):
        task = SubTask(description="Write a function", task_type="code_generation")
        result = await coordinator.execute(task, AgentContext())
        assert result.success

    @pytest.mark.asyncio
    async def test_execute_with_review(self, coordinator):
        task = SubTask(description="Write a function", task_type="code_generation")
        result = await coordinator.execute_with_review(task, AgentContext())
        assert result.success
        # Should have a cross-review artifact
        review_artifacts = [a for a in result.artifacts if a.get("type") == "cross_review"]
        assert len(review_artifacts) == 1
        assert review_artifacts[0]["reviewer"] == "security_agent"

    @pytest.mark.asyncio
    async def test_parallel_execute(self, coordinator):
        tasks = [
            SubTask(description="Write code", task_type="code_generation"),
            SubTask(description="Write tests", task_type="test_creation"),
            SubTask(description="Analyze architecture", task_type="analysis"),
        ]
        results = await coordinator.parallel_execute(tasks, AgentContext())
        assert len(results) == 3
        assert all(r.success for r in results)

    def test_list_agents(self, coordinator):
        agents = coordinator.list_agents()
        assert "code_agent" in agents
        assert "security_agent" in agents
        assert "test_agent" in agents
        assert "architecture_agent" in agents

    @pytest.mark.asyncio
    async def test_no_agents_raises(self):
        coord = AgentCoordinator()
        task = SubTask(description="anything")
        with pytest.raises(ValueError, match="No agents"):
            await coord.route(task)


class TestAdaptiveContextManager:
    def test_count_tokens(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        count = cm.count_tokens("Hello world")
        assert count > 0

    def test_allocate_budget(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        sources = {
            "codebase": [
                ScoredChunk(content="def foo(): pass", score=0.9, source="a.py"),
                ScoredChunk(content="class Bar: ...", score=0.7, source="b.py"),
            ],
            "memory": [
                ScoredChunk(content="Past: similar task succeeded", score=0.8),
            ],
        }
        allocation = cm.allocate("code_generation", sources)
        assert allocation.total_budget == 10000
        assert "codebase" in allocation.sources
        assert "memory" in allocation.sources
        assert allocation.final_context != ""

    def test_chunks_sorted_by_score(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        sources = {
            "codebase": [
                ScoredChunk(content="low relevance", score=0.1),
                ScoredChunk(content="high relevance", score=0.9),
                ScoredChunk(content="medium relevance", score=0.5),
            ],
        }
        allocation = cm.allocate("code_generation", sources)
        chunks = allocation.sources["codebase"].chunks
        assert chunks[0].score >= chunks[-1].score

    def test_respects_budget(self):
        cm = AdaptiveContextManager(max_context_tokens=100)
        huge = "x " * 500  # ~250 tokens
        sources = {
            "codebase": [ScoredChunk(content=huge, score=0.9)],
        }
        allocation = cm.allocate("code_generation", sources)
        # Should not include the huge chunk since it exceeds budget
        assert allocation.sources["codebase"].used_tokens <= allocation.sources["codebase"].allocated_tokens

    def test_different_profiles(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        sources = {
            "codebase": [ScoredChunk(content="code", score=0.9)],
            "memory": [ScoredChunk(content="memory", score=0.8)],
        }
        code_alloc = cm.allocate("code_generation", sources)
        analysis_alloc = cm.allocate("analysis", sources)

        # Code generation should allocate more to codebase
        code_cb = code_alloc.sources["codebase"].allocated_tokens
        analysis_cb = analysis_alloc.sources["codebase"].allocated_tokens
        assert code_cb > analysis_cb

    def test_reserved_tokens(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        sources = {"codebase": [ScoredChunk(content="code", score=0.9)]}
        alloc = cm.allocate("default", sources, reserved_tokens=3000)
        assert alloc.total_budget == 7000

    def test_utilization_pct(self):
        cm = AdaptiveContextManager(max_context_tokens=10000)
        sources = {"codebase": [ScoredChunk(content="short", score=0.9)]}
        alloc = cm.allocate("default", sources)
        assert 0 <= alloc.utilization_pct <= 100
