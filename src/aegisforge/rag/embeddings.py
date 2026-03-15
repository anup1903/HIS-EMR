"""Open-source embedding models via sentence-transformers.

Models (ranked by quality):
  1. BAAI/bge-m3          — Best multilingual, 1024-dim, 8192 tokens
  2. intfloat/e5-mistral-7b-instruct — High quality, 4096-dim, 32K tokens
  3. BAAI/bge-large-en-v1.5 — Fast, 1024-dim, 512 tokens (fallback)

All run locally — no external API calls, no data leaves the cluster.
"""

from __future__ import annotations

import hashlib
from enum import Enum
from functools import lru_cache
from typing import Any

import numpy as np
import structlog

logger = structlog.get_logger()


class EmbeddingModel(str, Enum):
    """Available open-source embedding models."""

    BGE_M3 = "BAAI/bge-m3"
    E5_MISTRAL = "intfloat/e5-mistral-7b-instruct"
    BGE_LARGE = "BAAI/bge-large-en-v1.5"


# Model metadata
MODEL_INFO: dict[EmbeddingModel, dict[str, Any]] = {
    EmbeddingModel.BGE_M3: {
        "dimensions": 1024,
        "max_tokens": 8192,
        "instruction_prefix": "",
        "query_prefix": "",
    },
    EmbeddingModel.E5_MISTRAL: {
        "dimensions": 4096,
        "max_tokens": 32768,
        "instruction_prefix": "Instruct: Retrieve relevant documents\nQuery: ",
        "query_prefix": "Instruct: Retrieve relevant documents\nQuery: ",
    },
    EmbeddingModel.BGE_LARGE: {
        "dimensions": 1024,
        "max_tokens": 512,
        "instruction_prefix": "",
        "query_prefix": "Represent this sentence for searching relevant passages: ",
    },
}


class EmbeddingService:
    """Generates embeddings using local open-source models.

    Runs entirely on-premise — no data leaves the infrastructure.
    Supports GPU acceleration when available, falls back to CPU.
    """

    def __init__(
        self,
        model_name: EmbeddingModel = EmbeddingModel.BGE_M3,
        device: str | None = None,
        cache_size: int = 10_000,
    ) -> None:
        self.model_name = model_name
        self.info = MODEL_INFO[model_name]
        self._cache: dict[str, list[float]] = {}
        self._cache_size = cache_size
        self._model: Any = None
        self._device = device

    def _load_model(self) -> Any:
        """Lazy-load the model on first use."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            kwargs: dict[str, Any] = {}
            if self._device:
                kwargs["device"] = self._device

            logger.info(
                "embeddings.loading_model",
                model=self.model_name.value,
                device=self._device or "auto",
            )
            self._model = SentenceTransformer(self.model_name.value, **kwargs)
            logger.info(
                "embeddings.model_loaded",
                model=self.model_name.value,
                dimensions=self.info["dimensions"],
            )
        return self._model

    def _cache_key(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    @property
    def dimensions(self) -> int:
        return self.info["dimensions"]

    async def embed_texts(
        self,
        texts: list[str],
        is_query: bool = False,
        batch_size: int = 32,
    ) -> list[list[float]]:
        """Generate embeddings for a batch of texts.

        Args:
            texts: Documents or queries to embed.
            is_query: If True, apply query-specific prefix (improves retrieval accuracy).
            batch_size: Batch size for the model.

        Returns:
            List of embedding vectors (each is a list of floats).
        """
        model = self._load_model()

        # Apply query prefix if needed
        prefix = self.info["query_prefix"] if is_query else self.info.get("instruction_prefix", "")
        processed_texts: list[str] = []
        cached_results: dict[int, list[float]] = {}

        for i, text in enumerate(texts):
            full_text = f"{prefix}{text}" if prefix else text
            key = self._cache_key(full_text)
            if key in self._cache:
                cached_results[i] = self._cache[key]
            else:
                processed_texts.append(full_text)

        # Embed uncached texts
        new_embeddings: list[list[float]] = []
        if processed_texts:
            embeddings_array = model.encode(
                processed_texts,
                batch_size=batch_size,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            new_embeddings = embeddings_array.tolist()

            # Cache results
            for text, emb in zip(processed_texts, new_embeddings):
                key = self._cache_key(text)
                if len(self._cache) < self._cache_size:
                    self._cache[key] = emb

        # Reconstruct full results in order
        results: list[list[float]] = []
        uncached_idx = 0
        for i in range(len(texts)):
            if i in cached_results:
                results.append(cached_results[i])
            else:
                results.append(new_embeddings[uncached_idx])
                uncached_idx += 1

        logger.debug(
            "embeddings.generated",
            count=len(texts),
            cached=len(cached_results),
            computed=len(processed_texts),
        )

        return results

    async def embed_query(self, query: str) -> list[float]:
        """Embed a single query string."""
        results = await self.embed_texts([query], is_query=True)
        return results[0]

    async def embed_documents(self, documents: list[str], batch_size: int = 32) -> list[list[float]]:
        """Embed a batch of documents."""
        return await self.embed_texts(documents, is_query=False, batch_size=batch_size)


@lru_cache(maxsize=1)
def get_embedding_service(
    model_name: EmbeddingModel = EmbeddingModel.BGE_M3,
) -> EmbeddingService:
    return EmbeddingService(model_name=model_name)
