"""Tests for LLM data models and model registry."""

from __future__ import annotations

import pytest

from aegisforge.llm.models import (
    MODEL_REGISTRY,
    LLMRequest,
    LLMResponse,
    Message,
    ModelConfig,
    ModelTier,
    ProviderType,
    TokenUsage,
)


class TestModelRegistry:
    def test_all_tiers_have_models(self) -> None:
        for tier in ModelTier:
            assert tier in MODEL_REGISTRY, f"Missing models for tier: {tier}"
            assert len(MODEL_REGISTRY[tier]) >= 1

    def test_reasoning_tier_has_deepseek(self) -> None:
        models = MODEL_REGISTRY[ModelTier.REASONING]
        model_ids = [m.model_id for m in models]
        assert any("DeepSeek" in mid or "deepseek" in mid for mid in model_ids)

    def test_advanced_tier_has_qwen(self) -> None:
        models = MODEL_REGISTRY[ModelTier.ADVANCED]
        model_ids = [m.model_id for m in models]
        assert any("Qwen" in mid or "qwen" in mid for mid in model_ids)

    def test_all_models_have_valid_provider(self) -> None:
        for tier, models in MODEL_REGISTRY.items():
            for model in models:
                assert isinstance(model.provider, ProviderType)
                assert model.base_url.startswith("http")
                assert model.max_context_tokens > 0

    def test_vllm_models_have_no_api_key(self) -> None:
        for tier, models in MODEL_REGISTRY.items():
            for model in models:
                if model.provider == ProviderType.VLLM:
                    assert model.api_key_env == ""

    def test_hosted_models_have_api_key_env(self) -> None:
        hosted = {ProviderType.TOGETHER, ProviderType.GROQ, ProviderType.FIREWORKS}
        for tier, models in MODEL_REGISTRY.items():
            for model in models:
                if model.provider in hosted:
                    assert model.api_key_env != "", (
                        f"{model.provider.value} model {model.model_id} missing api_key_env"
                    )


class TestLLMRequest:
    def test_default_request(self) -> None:
        req = LLMRequest(
            messages=[Message(role="user", content="hello")],
        )
        assert req.tier == ModelTier.ADVANCED
        assert req.temperature == 0.0
        assert req.max_tokens == 8192
        assert req.rag_context is None

    def test_request_with_rag_context(self) -> None:
        req = LLMRequest(
            messages=[Message(role="user", content="test")],
            rag_context="Retrieved docs here",
            rag_sources=[{"source": "file.py", "score": 0.95}],
        )
        assert req.rag_context == "Retrieved docs here"
        assert len(req.rag_sources) == 1

    def test_request_with_thinking(self) -> None:
        req = LLMRequest(
            tier=ModelTier.REASONING,
            messages=[Message(role="user", content="complex task")],
            enable_thinking=True,
            thinking_budget=16384,
        )
        assert req.enable_thinking is True
        assert req.thinking_budget == 16384


class TestLLMResponse:
    def test_response_has_tool_calls(self) -> None:
        resp = LLMResponse(
            request_id=LLMRequest(messages=[]).request_id,
            provider="vllm",
            model="test-model",
            content="",
            tool_calls=[{"id": "1", "type": "function", "function": {"name": "test"}}],
        )
        assert resp.has_tool_calls is True

    def test_response_no_tool_calls(self) -> None:
        resp = LLMResponse(
            request_id=LLMRequest(messages=[]).request_id,
            provider="vllm",
            model="test-model",
            content="Hello",
        )
        assert resp.has_tool_calls is False

    def test_response_with_thinking(self) -> None:
        resp = LLMResponse(
            request_id=LLMRequest(messages=[]).request_id,
            provider="vllm",
            model="deepseek-r1",
            content="Final answer",
            thinking="Step 1: analyze... Step 2: conclude...",
        )
        assert resp.thinking is not None
        assert "Step 1" in resp.thinking


class TestTokenUsage:
    def test_default_zero(self) -> None:
        usage = TokenUsage()
        assert usage.input_tokens == 0
        assert usage.output_tokens == 0
        assert usage.total_tokens == 0
