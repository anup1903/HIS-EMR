"""Cross-encoder reranker for improving retrieval precision.

Uses an open-source cross-encoder model to rerank candidates from the
initial retrieval stage. Cross-encoders jointly encode (query, document)
pairs, producing far more accurate relevance scores than bi-encoder
similarity alone.

Models:
  1. BAAI/bge-reranker-v2-m3     — Best quality, multilingual
  2. cross-encoder/ms-marco-MiniLM-L-12-v2 — Fast, English-only fallback
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import Any

import structlog

logger = structlog.get_logger()


class RerankerModel(str, Enum):
    BGE_RERANKER_V2 = "BAAI/bge-reranker-v2-m3"
    MS_MARCO_MINILM = "cross-encoder/ms-marco-MiniLM-L-12-v2"


class Reranker:
    """Cross-encoder reranker — runs locally, no external API calls."""

    def __init__(
        self,
        model_name: RerankerModel = RerankerModel.BGE_RERANKER_V2,
        device: str | None = None,
    ) -> None:
        self.model_name = model_name
        self._device = device
        self._model: Any = None

    def _load_model(self) -> Any:
        if self._model is None:
            from sentence_transformers import CrossEncoder

            logger.info("reranker.loading_model", model=self.model_name.value)
            kwargs: dict[str, Any] = {}
            if self._device:
                kwargs["device"] = self._device
            self._model = CrossEncoder(self.model_name.value, **kwargs)
            logger.info("reranker.model_loaded", model=self.model_name.value)
        return self._model

    async def rerank(
        self,
        query: str,
        candidates: list[dict[str, Any]],
        top_k: int = 5,
        score_threshold: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Rerank candidate documents using cross-encoder scoring.

        Args:
            query: The user's search query.
            candidates: List of dicts with at least a "content" key.
            top_k: Number of top results to return.
            score_threshold: Minimum reranker score to include.

        Returns:
            Reranked list of candidates with updated "rerank_score" field.
        """
        if not candidates:
            return []

        model = self._load_model()

        # Create (query, document) pairs for cross-encoding
        pairs = [(query, c["content"]) for c in candidates]
        scores = model.predict(pairs, show_progress_bar=False)

        # Attach scores and sort
        for candidate, score in zip(candidates, scores):
            candidate["rerank_score"] = float(score)

        reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)

        # Filter by threshold and limit
        filtered = [c for c in reranked if c["rerank_score"] >= score_threshold][:top_k]

        logger.debug(
            "reranker.done",
            input_count=len(candidates),
            output_count=len(filtered),
            top_score=filtered[0]["rerank_score"] if filtered else 0.0,
        )

        return filtered


@lru_cache(maxsize=1)
def get_reranker(model_name: RerankerModel = RerankerModel.BGE_RERANKER_V2) -> Reranker:
    return Reranker(model_name=model_name)
