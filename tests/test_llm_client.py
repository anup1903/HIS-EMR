"""Tests for the LLM client with mocked OpenAI API responses."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from aegisforge.llm.client import LLMClient
from aegisforge.llm.models import (
    LLMRequest,
    Message,
    ModelConfig,
    ModelTier,
    ProviderType,
)


def _make_test_registry() -> dict[ModelTier, list[ModelConfig]]:
    """Build a test registry with fake endpoints."""
    return {
        ModelTier.ADVANCED: [
            ModelConfig(
                provider=ProviderType.VLLM,
                model_id="test-primary",
                base_url="http://fake-primary:8000/v1",
            ),
            ModelConfig(
                provider=ProviderType.TOGETHER,
                model_id="test-fallback",
                base_url="http://fake-fallback:8000/v1",
                api_key_env="TEST_API_KEY",
            ),
        ],
        ModelTier.FAST: [
            ModelConfig(
                provider=ProviderType.OLLAMA,
                model_id="test-fast",
                base_url="http://fake-fast:11434/v1",
            ),
        ],
    }


def _mock_completion_response(
    content: str = "Test response",
    model: str = "test-model",
    tool_calls: Any = None,
) -> MagicMock:
    """Create a mock OpenAI chat completion response."""
    message = MagicMock()
    message.content = content
    message.tool_calls = tool_calls
    message.reasoning_content = None

    choice = MagicMock()
    choice.message = message

    usage = MagicMock()
    usage.prompt_tokens = 100
    usage.completion_tokens = 50
    usage.total_tokens = 150

    response = MagicMock()
    response.choices = [choice]
    response.usage = usage
    response.model = model

    return response


class TestLLMClient:
    def test_client_creates_with_custom_registry(self) -> None:
        registry = _make_test_registry()
        client = LLMClient(model_registry=registry)
        assert client._registry == registry

    @pytest.mark.asyncio
    async def test_complete_calls_primary_model(self) -> None:
        client = LLMClient(model_registry=_make_test_registry())

        mock_response = _mock_completion_response("Primary answer")
        mock_openai = AsyncMock()
        mock_openai.chat.completions.create = AsyncMock(return_value=mock_response)

        # Inject mock client
        client._clients["vllm:http://fake-primary:8000/v1"] = mock_openai

        request = LLMRequest(
            tier=ModelTier.ADVANCED,
            messages=[Message(role="user", content="test question")],
        )

        response = await client.complete(request)
        assert response.content == "Primary answer"
        assert response.fallback_used is False
        assert response.usage.total_tokens == 150

    @pytest.mark.asyncio
    async def test_fallback_on_connection_error(self) -> None:
        from openai import APIConnectionError

        client = LLMClient(model_registry=_make_test_registry())

        # Primary fails
        mock_primary = AsyncMock()
        mock_primary.chat.completions.create = AsyncMock(
            side_effect=APIConnectionError(request=MagicMock())
        )
        client._clients["vllm:http://fake-primary:8000/v1"] = mock_primary

        # Fallback succeeds
        mock_fallback = AsyncMock()
        mock_fallback.chat.completions.create = AsyncMock(
            return_value=_mock_completion_response("Fallback answer")
        )
        client._clients["together:http://fake-fallback:8000/v1"] = mock_fallback

        request = LLMRequest(
            tier=ModelTier.ADVANCED,
            messages=[Message(role="user", content="test")],
        )

        response = await client.complete(request)
        assert response.content == "Fallback answer"
        assert response.fallback_used is True

    @pytest.mark.asyncio
    async def test_all_models_fail_raises_runtime_error(self) -> None:
        from openai import APIConnectionError

        client = LLMClient(model_registry=_make_test_registry())

        # All fail
        for key in ["vllm:http://fake-primary:8000/v1", "together:http://fake-fallback:8000/v1"]:
            mock = AsyncMock()
            mock.chat.completions.create = AsyncMock(
                side_effect=APIConnectionError(request=MagicMock())
            )
            client._clients[key] = mock

        request = LLMRequest(
            tier=ModelTier.ADVANCED,
            messages=[Message(role="user", content="test")],
        )

        with pytest.raises(RuntimeError, match="All 2 models"):
            await client.complete(request)

    @pytest.mark.asyncio
    async def test_no_models_for_tier_raises_value_error(self) -> None:
        client = LLMClient(model_registry={})
        request = LLMRequest(
            tier=ModelTier.REASONING,
            messages=[Message(role="user", content="test")],
        )
        with pytest.raises(ValueError, match="No models registered"):
            await client.complete(request)

    @pytest.mark.asyncio
    async def test_rag_context_injected_into_system_prompt(self) -> None:
        client = LLMClient(model_registry=_make_test_registry())

        mock_openai = AsyncMock()
        mock_openai.chat.completions.create = AsyncMock(
            return_value=_mock_completion_response("answer")
        )
        client._clients["vllm:http://fake-primary:8000/v1"] = mock_openai

        request = LLMRequest(
            tier=ModelTier.ADVANCED,
            system_prompt="You are helpful.",
            messages=[Message(role="user", content="question")],
            rag_context="Retrieved: function foo() returns bar",
        )

        await client.complete(request)

        # Verify the messages sent to the API include RAG context
        call_kwargs = mock_openai.chat.completions.create.call_args[1]
        system_msg = call_kwargs["messages"][0]
        assert system_msg["role"] == "system"
        assert "retrieved_context" in system_msg["content"]
        assert "function foo()" in system_msg["content"]

    @pytest.mark.asyncio
    async def test_thinking_extraction_from_tags(self) -> None:
        client = LLMClient(model_registry=_make_test_registry())

        # Simulate DeepSeek-R1 output with <think> tags
        content_with_thinking = "<think>I need to analyze this step by step.</think>\nFinal answer here."
        mock_openai = AsyncMock()
        mock_openai.chat.completions.create = AsyncMock(
            return_value=_mock_completion_response(content_with_thinking)
        )
        client._clients["vllm:http://fake-primary:8000/v1"] = mock_openai

        request = LLMRequest(
            tier=ModelTier.ADVANCED,
            messages=[Message(role="user", content="test")],
        )

        response = await client.complete(request)
        assert response.thinking == "I need to analyze this step by step."
        assert response.content == "Final answer here."
        assert "<think>" not in response.content

    @pytest.mark.asyncio
    async def test_close_clears_clients(self) -> None:
        client = LLMClient(model_registry=_make_test_registry())
        mock = AsyncMock()
        client._clients["test"] = mock
        await client.close()
        assert len(client._clients) == 0
