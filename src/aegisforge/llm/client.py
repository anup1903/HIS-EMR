"""LLM client with automatic fallback across open-source model providers.

All providers expose OpenAI-compatible APIs, so we use the openai SDK as a
universal client. The fallback chain tries each model in order per tier,
falling to the next on timeout, rate-limit, or server errors.
"""

from __future__ import annotations

import os
import time
from functools import lru_cache
from typing import Any

import structlog
from openai import AsyncOpenAI, APIConnectionError, APITimeoutError, RateLimitError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from aegisforge.llm.models import (
    MODEL_REGISTRY,
    LLMRequest,
    LLMResponse,
    Message,
    ModelConfig,
    ModelTier,
    TokenUsage,
)

logger = structlog.get_logger()

# Exceptions that trigger a fallback to the next model
FALLBACK_EXCEPTIONS = (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    ConnectionError,
    TimeoutError,
)


class LLMClient:
    """Unified async LLM client with tier-based model selection and automatic fallback.

    Architecture:
        Request → Tier selection → Primary model → [Fallback 1] → [Fallback 2]
                                                   ↑ on error     ↑ on error

    All models are open-source (DeepSeek-R1, Qwen3, Llama 4, Mistral)
    served via vLLM (self-hosted), Together AI, Groq, or Fireworks.
    """

    def __init__(self, model_registry: dict[ModelTier, list[ModelConfig]] | None = None) -> None:
        self._registry = model_registry or MODEL_REGISTRY
        self._clients: dict[str, AsyncOpenAI] = {}

    def _get_client(self, config: ModelConfig) -> AsyncOpenAI:
        """Get or create an AsyncOpenAI client for the given provider endpoint."""
        cache_key = f"{config.provider.value}:{config.base_url}"
        if cache_key not in self._clients:
            api_key = "no-key-needed"  # vLLM/Ollama don't require keys
            if config.api_key_env:
                api_key = os.environ.get(config.api_key_env, "")
                if not api_key:
                    logger.warning(
                        "llm.missing_api_key",
                        provider=config.provider.value,
                        env_var=config.api_key_env,
                    )
                    api_key = "missing"

            self._clients[cache_key] = AsyncOpenAI(
                base_url=config.base_url,
                api_key=api_key,
                timeout=120.0,
                max_retries=0,  # We handle retries ourselves
            )
        return self._clients[cache_key]

    def _build_messages(self, request: LLMRequest) -> list[dict[str, Any]]:
        """Build the messages array, injecting RAG context into the system prompt."""
        messages: list[dict[str, Any]] = []

        # System prompt with optional RAG context
        system_parts: list[str] = []
        if request.system_prompt:
            system_parts.append(request.system_prompt)
        if request.rag_context:
            system_parts.append(
                "\n\n<retrieved_context>\n"
                f"{request.rag_context}\n"
                "</retrieved_context>\n\n"
                "Use the retrieved context above to inform your response. "
                "Cite sources when applicable. If the context doesn't contain "
                "relevant information, say so and rely on your training knowledge."
            )
        if system_parts:
            messages.append({"role": "system", "content": "\n\n".join(system_parts)})

        # Conversation messages
        for msg in request.messages:
            m: dict[str, Any] = {"role": msg.role, "content": msg.content}
            if msg.tool_calls:
                m["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                m["tool_call_id"] = msg.tool_call_id
            messages.append(m)

        return messages

    def _build_tools(self, request: LLMRequest) -> list[dict[str, Any]] | None:
        """Convert tool definitions to OpenAI function-calling format."""
        if not request.tools:
            return None
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            for tool in request.tools
        ]

    async def _call_model(
        self,
        config: ModelConfig,
        request: LLMRequest,
    ) -> LLMResponse:
        """Make a single API call to one model endpoint."""
        client = self._get_client(config)
        messages = self._build_messages(request)
        tools = self._build_tools(request)

        kwargs: dict[str, Any] = {
            "model": config.model_id,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        if request.stop_sequences:
            kwargs["stop"] = request.stop_sequences

        start = time.perf_counter()
        response = await client.chat.completions.create(**kwargs)
        latency_ms = (time.perf_counter() - start) * 1000

        choice = response.choices[0]
        content = choice.message.content or ""
        thinking = None

        # Extract thinking/reasoning from models that return it (DeepSeek-R1)
        if hasattr(choice.message, "reasoning_content") and choice.message.reasoning_content:
            thinking = choice.message.reasoning_content
        elif "<think>" in content:
            # Some models wrap reasoning in <think> tags
            import re
            think_match = re.search(r"<think>(.*?)</think>", content, re.DOTALL)
            if think_match:
                thinking = think_match.group(1).strip()
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        # Extract tool calls
        tool_calls: list[dict[str, Any]] = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                })

        usage = TokenUsage(
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            total_tokens=response.usage.total_tokens if response.usage else 0,
        )

        return LLMResponse(
            request_id=request.request_id,
            provider=config.provider.value,
            model=config.model_id,
            content=content,
            thinking=thinking,
            tool_calls=tool_calls,
            usage=usage,
            latency_ms=latency_ms,
            metadata=request.metadata,
        )

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute an LLM request with automatic fallback across the tier's model chain.

        Tries each model in the tier's fallback chain. On connection errors,
        timeouts, or rate limits, falls through to the next model.
        """
        models = self._registry.get(request.tier, [])
        if not models:
            raise ValueError(f"No models registered for tier: {request.tier}")

        last_error: Exception | None = None

        for i, config in enumerate(models):
            try:
                logger.info(
                    "llm.call_start",
                    request_id=str(request.request_id),
                    tier=request.tier.value,
                    provider=config.provider.value,
                    model=config.model_id,
                    attempt=i + 1,
                )

                response = await self._call_model(config, request)

                if i > 0:
                    response.fallback_used = True
                    response.fallback_reason = (
                        f"Primary failed: {type(last_error).__name__}" if last_error else None
                    )

                logger.info(
                    "llm.call_success",
                    request_id=str(request.request_id),
                    provider=config.provider.value,
                    model=config.model_id,
                    latency_ms=response.latency_ms,
                    tokens=response.usage.total_tokens,
                    fallback=response.fallback_used,
                )

                return response

            except FALLBACK_EXCEPTIONS as exc:
                last_error = exc
                logger.warning(
                    "llm.call_failed_fallback",
                    request_id=str(request.request_id),
                    provider=config.provider.value,
                    model=config.model_id,
                    error=str(exc),
                    remaining_fallbacks=len(models) - i - 1,
                )
                continue

        # All models in chain exhausted
        raise RuntimeError(
            f"All {len(models)} models in tier '{request.tier.value}' failed. "
            f"Last error: {last_error}"
        )

    async def complete_simple(
        self,
        prompt: str,
        tier: ModelTier = ModelTier.STANDARD,
        system_prompt: str = "",
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> str:
        """Convenience method for simple prompt→text completion."""
        request = LLMRequest(
            tier=tier,
            system_prompt=system_prompt,
            messages=[Message(role="user", content=prompt)],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        response = await self.complete(request)
        return response.content

    async def complete_with_tools(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]],
        tier: ModelTier = ModelTier.ADVANCED,
        system_prompt: str = "",
    ) -> LLMResponse:
        """Convenience method for tool-use (agentic) completions."""
        from aegisforge.llm.models import ToolDefinition

        tool_defs = [ToolDefinition(**t) for t in tools]
        request = LLMRequest(
            tier=tier,
            system_prompt=system_prompt,
            messages=messages,
            tools=tool_defs,
        )
        return await self.complete(request)

    async def reason(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 16384,
    ) -> LLMResponse:
        """Use the REASONING tier (DeepSeek-R1) for complex multi-step thinking."""
        request = LLMRequest(
            tier=ModelTier.REASONING,
            system_prompt=system_prompt,
            messages=[Message(role="user", content=prompt)],
            enable_thinking=True,
            thinking_budget=max_tokens,
            max_tokens=max_tokens,
        )
        return await self.complete(request)

    async def close(self) -> None:
        """Close all HTTP connections."""
        for client in self._clients.values():
            await client.close()
        self._clients.clear()


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    """Return a singleton LLM client."""
    return LLMClient()
