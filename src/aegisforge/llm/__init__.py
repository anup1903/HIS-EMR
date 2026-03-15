"""LLM integration layer — open-source models (DeepSeek-R1, Qwen3, Llama 4).

All models served via OpenAI-compatible APIs:
- vLLM (self-hosted production)
- Ollama (local development)
- Together AI / Groq / Fireworks (hosted fallbacks)
"""

from aegisforge.llm.client import LLMClient, get_llm_client
from aegisforge.llm.models import LLMRequest, LLMResponse, ModelTier

__all__ = ["LLMClient", "LLMRequest", "LLMResponse", "ModelTier", "get_llm_client"]
