"""Data models for LLM requests, responses, and configuration.

All models are open-source. Providers expose an OpenAI-compatible API
(vLLM, Ollama, Together AI, Groq, Fireworks) so we use a single client protocol.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ModelTier(str, Enum):
    """Model selection tiers — highest capability to fastest."""

    REASONING = "reasoning"   # Complex planning, multi-step decomposition, architecture
    ADVANCED = "advanced"     # Code generation, detailed analysis
    STANDARD = "standard"     # Summarization, classification, routine tasks
    FAST = "fast"             # Simple extraction, formatting, validation


class ProviderType(str, Enum):
    """Supported inference backends — all serve OpenAI-compatible APIs."""

    VLLM = "vllm"             # Self-hosted vLLM (production)
    OLLAMA = "ollama"         # Local dev / edge
    TOGETHER = "together"     # Together AI hosted
    GROQ = "groq"             # Groq hosted (ultra-fast inference)
    FIREWORKS = "fireworks"   # Fireworks AI hosted


class ModelConfig(BaseModel):
    """Configuration for a single model endpoint."""

    provider: ProviderType
    model_id: str
    base_url: str
    api_key_env: str = ""          # env var name holding the API key (empty = no auth)
    max_context_tokens: int = 131072
    supports_tools: bool = True
    supports_vision: bool = False


# ──────────────────────────────────────────────────────────────────────────────
# Open-Source Model Registry — fallback chains per tier
#
# Primary: DeepSeek-R1 (reasoning), Qwen3-235B (advanced), Llama-4-Maverick (standard)
# All served via vLLM in production; Together/Groq as hosted fallbacks
# ──────────────────────────────────────────────────────────────────────────────

MODEL_REGISTRY: dict[ModelTier, list[ModelConfig]] = {
    ModelTier.REASONING: [
        ModelConfig(
            provider=ProviderType.GROQ,
            model_id="qwen/qwen3-32b",
            base_url="https://api.groq.com/openai/v1",
            api_key_env="GROQ_API_KEY",
            max_context_tokens=131072,
        ),
        ModelConfig(
            provider=ProviderType.VLLM,
            model_id="deepseek-ai/DeepSeek-R1",
            base_url="http://vllm-reasoning:8000/v1",
            max_context_tokens=131072,
            supports_tools=True,
        ),
        ModelConfig(
            provider=ProviderType.TOGETHER,
            model_id="deepseek-ai/DeepSeek-R1",
            base_url="https://api.together.xyz/v1",
            api_key_env="TOGETHER_API_KEY",
            max_context_tokens=131072,
        ),
    ],
    ModelTier.ADVANCED: [
        ModelConfig(
            provider=ProviderType.GROQ,
            model_id="llama-3.3-70b-versatile",
            base_url="https://api.groq.com/openai/v1",
            api_key_env="GROQ_API_KEY",
            max_context_tokens=131072,
        ),
        ModelConfig(
            provider=ProviderType.VLLM,
            model_id="Qwen/Qwen3-235B-A22B",
            base_url="http://vllm-advanced:8000/v1",
            max_context_tokens=131072,
            supports_tools=True,
        ),
        ModelConfig(
            provider=ProviderType.TOGETHER,
            model_id="Qwen/Qwen3-235B-A22B",
            base_url="https://api.together.xyz/v1",
            api_key_env="TOGETHER_API_KEY",
            max_context_tokens=131072,
        ),
    ],
    ModelTier.STANDARD: [
        ModelConfig(
            provider=ProviderType.GROQ,
            model_id="meta-llama/llama-4-scout-17b-16e-instruct",
            base_url="https://api.groq.com/openai/v1",
            api_key_env="GROQ_API_KEY",
            max_context_tokens=131072,
        ),
        ModelConfig(
            provider=ProviderType.VLLM,
            model_id="meta-llama/Llama-4-Maverick-17B-128E-Instruct",
            base_url="http://vllm-standard:8000/v1",
            max_context_tokens=131072,
            supports_tools=True,
        ),
        ModelConfig(
            provider=ProviderType.TOGETHER,
            model_id="meta-llama/Llama-4-Maverick-17B-128E-Instruct",
            base_url="https://api.together.xyz/v1",
            api_key_env="TOGETHER_API_KEY",
        ),
    ],
    ModelTier.FAST: [
        ModelConfig(
            provider=ProviderType.GROQ,
            model_id="llama-3.1-8b-instant",
            base_url="https://api.groq.com/openai/v1",
            api_key_env="GROQ_API_KEY",
            max_context_tokens=131072,
        ),
        ModelConfig(
            provider=ProviderType.VLLM,
            model_id="meta-llama/Llama-4-Scout-17B-16E-Instruct",
            base_url="http://vllm-fast:8000/v1",
            max_context_tokens=131072,
        ),
        ModelConfig(
            provider=ProviderType.OLLAMA,
            model_id="llama4-scout",
            base_url="http://localhost:11434/v1",
            max_context_tokens=131072,
        ),
    ],
}


class ToolDefinition(BaseModel):
    """Tool/function the LLM can call."""

    name: str
    description: str
    parameters: dict[str, Any]


class Message(BaseModel):
    """A single message in a conversation."""

    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None


class LLMRequest(BaseModel):
    """Structured request to the LLM layer."""

    request_id: UUID = Field(default_factory=uuid4)
    tier: ModelTier = ModelTier.ADVANCED
    system_prompt: str = ""
    messages: list[Message]
    tools: list[ToolDefinition] | None = None
    temperature: float = 0.0
    max_tokens: int = 8192
    top_p: float = 1.0
    stop_sequences: list[str] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    # RAG context injection — set by the RAG pipeline before LLM call
    rag_context: str | None = None
    rag_sources: list[dict[str, Any]] = Field(default_factory=list)

    # Reasoning control for DeepSeek-R1 / thinking models
    enable_thinking: bool = False
    thinking_budget: int = 16384


class TokenUsage(BaseModel):
    """Token consumption tracking for cost and audit."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class LLMResponse(BaseModel):
    """Structured response from the LLM layer."""

    request_id: UUID
    provider: str
    model: str
    content: str
    thinking: str | None = None  # Chain-of-thought from reasoning models
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    usage: TokenUsage = Field(default_factory=TokenUsage)
    latency_ms: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    from_cache: bool = False
    fallback_used: bool = False
    fallback_reason: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0
