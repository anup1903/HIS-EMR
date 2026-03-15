"""End-to-end RAG pipeline: Query → Retrieve → Rerank → Augment → Generate.

Orchestrates the full retrieval-augmented generation flow:
  1. Embed the user query
  2. Hybrid search (vector similarity + keyword)
  3. Reciprocal rank fusion to merge results
  4. Cross-encoder reranking for precision
  5. Context assembly with source attribution
  6. LLM generation with retrieved context injected
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.llm.client import LLMClient, get_llm_client
from aegisforge.llm.models import LLMRequest, LLMResponse, Message, ModelTier
from aegisforge.rag.chunker import Chunk, ChunkingConfig, chunk_document
from aegisforge.rag.embeddings import EmbeddingService, get_embedding_service
from aegisforge.rag.reranker import Reranker, get_reranker
from aegisforge.rag.vectorstore import VectorStore

logger = structlog.get_logger()


class RAGConfig:
    """Configuration for the RAG pipeline."""

    # Retrieval
    vector_top_k: int = 20          # Candidates from vector search
    keyword_top_k: int = 10         # Candidates from keyword search
    rrf_k: int = 60                 # Reciprocal rank fusion constant
    rerank_top_k: int = 8           # Final results after reranking
    rerank_threshold: float = 0.1   # Minimum reranker score

    # Context assembly
    max_context_tokens: int = 6000  # Max tokens for retrieved context
    include_source_refs: bool = True

    # Generation
    default_tier: ModelTier = ModelTier.ADVANCED
    temperature: float = 0.0


def _reciprocal_rank_fusion(
    result_sets: list[list[dict[str, Any]]],
    k: int = 60,
) -> list[dict[str, Any]]:
    """Merge multiple ranked result lists using Reciprocal Rank Fusion (RRF).

    RRF score = sum(1 / (k + rank_i)) across all result sets.
    This is the standard method for combining vector + keyword search results.
    """
    scores: dict[str, float] = {}
    docs: dict[str, dict[str, Any]] = {}

    for result_set in result_sets:
        for rank, doc in enumerate(result_set):
            doc_id = doc.get("id", doc.get("content", "")[:100])
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
            if doc_id not in docs:
                docs[doc_id] = doc

    # Sort by fused score
    ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    results = []
    for doc_id in ranked_ids:
        doc = docs[doc_id].copy()
        doc["rrf_score"] = scores[doc_id]
        results.append(doc)

    return results


def _assemble_context(
    chunks: list[dict[str, Any]],
    max_tokens: int = 6000,
    include_sources: bool = True,
) -> tuple[str, list[dict[str, Any]]]:
    """Assemble retrieved chunks into a formatted context string.

    Returns:
        Tuple of (context_text, source_references)
    """
    context_parts: list[str] = []
    sources: list[dict[str, Any]] = []
    total_tokens = 0

    for i, chunk in enumerate(chunks):
        token_count = chunk.get("token_count", len(chunk["content"]) // 4)
        if total_tokens + token_count > max_tokens:
            break

        # Format with source attribution
        source_ref = chunk.get("source", "unknown")
        lines = ""
        if chunk.get("start_line") and chunk.get("end_line"):
            lines = f":{chunk['start_line']}-{chunk['end_line']}"

        header = f"[Source {i + 1}: {source_ref}{lines}]"
        context_parts.append(f"{header}\n{chunk['content']}")
        sources.append({
            "index": i + 1,
            "source": source_ref,
            "start_line": chunk.get("start_line"),
            "end_line": chunk.get("end_line"),
            "score": chunk.get("rerank_score", chunk.get("rrf_score", chunk.get("score", 0))),
        })
        total_tokens += token_count

    context_text = "\n\n---\n\n".join(context_parts)
    return context_text, sources


class RAGPipeline:
    """Full RAG pipeline: ingest, retrieve, and generate with context.

    Usage:
        pipeline = RAGPipeline(session)

        # Ingest documents
        await pipeline.ingest("path/to/file.py", file_content)

        # Query with RAG
        response = await pipeline.query("How does the auth middleware work?")
    """

    def __init__(
        self,
        session: AsyncSession,
        llm_client: LLMClient | None = None,
        embedding_service: EmbeddingService | None = None,
        reranker: Reranker | None = None,
        config: RAGConfig | None = None,
    ) -> None:
        self._session = session
        self._store = VectorStore(session)
        self._llm = llm_client or get_llm_client()
        self._embeddings = embedding_service or get_embedding_service()
        self._reranker = reranker or get_reranker()
        self._config = config or RAGConfig()

    # ── Ingestion ─────────────────────────────────────────────────────────

    async def ingest(
        self,
        source: str,
        content: str,
        collection: str = "default",
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> int:
        """Ingest a document: chunk → embed → store.

        Args:
            source: File path, URL, or identifier.
            content: Full document text.
            collection: Logical grouping (e.g., "codebase", "docs", "tickets").
            metadata: Extra metadata to attach.
            chunking_config: Override default chunking.

        Returns:
            Number of chunks stored.
        """
        # 1. Chunk
        chunks = chunk_document(
            text=content,
            source=source,
            config=chunking_config,
            metadata=metadata,
        )

        if not chunks:
            logger.warning("rag.ingest.empty", source=source)
            return 0

        # 2. Embed
        texts = [c.content for c in chunks]
        embeddings = await self._embeddings.embed_documents(texts)

        # 3. Store
        count = await self._store.upsert_chunks(
            chunks=chunks,
            embeddings=embeddings,
            collection=collection,
        )

        logger.info(
            "rag.ingested",
            source=source,
            collection=collection,
            chunks=count,
        )
        return count

    async def ingest_batch(
        self,
        documents: list[dict[str, str]],
        collection: str = "default",
    ) -> int:
        """Ingest multiple documents. Each dict must have 'source' and 'content' keys."""
        total = 0
        for doc in documents:
            count = await self.ingest(
                source=doc["source"],
                content=doc["content"],
                collection=collection,
                metadata=doc.get("metadata"),
            )
            total += count
        return total

    # ── Retrieval ─────────────────────────────────────────────────────────

    async def retrieve(
        self,
        query: str,
        collection: str | None = None,
        content_types: list[str] | None = None,
        top_k: int | None = None,
    ) -> list[dict[str, Any]]:
        """Hybrid retrieve: vector + keyword → RRF fusion → cross-encoder rerank.

        This is the core retrieval method used by `query()` but also
        available standalone for inspection/debugging.
        """
        final_top_k = top_k or self._config.rerank_top_k

        # 1. Embed query
        query_embedding = await self._embeddings.embed_query(query)

        # 2. Vector similarity search
        vector_results = await self._store.search_similar(
            query_embedding=query_embedding,
            limit=self._config.vector_top_k,
            collection=collection,
            content_types=content_types,
        )

        # 3. Keyword search (complements vector for exact matches)
        keyword_results = await self._store.search_keyword(
            query_text=query,
            limit=self._config.keyword_top_k,
            collection=collection,
        )

        # 4. Reciprocal Rank Fusion
        fused = _reciprocal_rank_fusion(
            [vector_results, keyword_results],
            k=self._config.rrf_k,
        )

        if not fused:
            logger.info("rag.retrieve.no_results", query=query[:100])
            return []

        # 5. Cross-encoder reranking for precision
        reranked = await self._reranker.rerank(
            query=query,
            candidates=fused,
            top_k=final_top_k,
            score_threshold=self._config.rerank_threshold,
        )

        logger.info(
            "rag.retrieved",
            query=query[:80],
            vector_hits=len(vector_results),
            keyword_hits=len(keyword_results),
            fused=len(fused),
            final=len(reranked),
        )

        return reranked

    # ── RAG-augmented Generation ──────────────────────────────────────────

    async def query(
        self,
        question: str,
        system_prompt: str = "",
        collection: str | None = None,
        tier: ModelTier | None = None,
        conversation_history: list[Message] | None = None,
    ) -> LLMResponse:
        """Full RAG pipeline: retrieve context, then generate an LLM response.

        Args:
            question: The user's question or task description.
            system_prompt: Additional system instructions.
            collection: Restrict retrieval to a specific collection.
            tier: Override the model tier (default: ADVANCED).
            conversation_history: Prior messages for multi-turn.

        Returns:
            LLMResponse with content, sources in metadata, and usage stats.
        """
        # 1. Retrieve relevant context
        retrieved = await self.retrieve(
            query=question,
            collection=collection,
        )

        # 2. Assemble context with source references
        context_text, sources = _assemble_context(
            chunks=retrieved,
            max_tokens=self._config.max_context_tokens,
            include_sources=self._config.include_source_refs,
        )

        # 3. Build conversation
        messages = list(conversation_history or [])
        messages.append(Message(role="user", content=question))

        # 4. LLM generation with injected context
        request = LLMRequest(
            tier=tier or self._config.default_tier,
            system_prompt=system_prompt,
            messages=messages,
            rag_context=context_text if context_text else None,
            rag_sources=sources,
            temperature=self._config.temperature,
        )

        response = await self._llm.complete(request)
        response.metadata["rag_sources"] = sources
        response.metadata["rag_chunks_used"] = len(retrieved)

        logger.info(
            "rag.query.complete",
            question=question[:80],
            chunks_used=len(retrieved),
            model=response.model,
            tokens=response.usage.total_tokens,
        )

        return response

    # ── Management ────────────────────────────────────────────────────────

    async def delete_source(self, source: str, collection: str = "default") -> int:
        """Remove all chunks for a source (e.g., when a file is deleted/renamed)."""
        return await self._store.delete_by_source(source, collection)

    async def get_stats(self, collection: str = "default") -> dict[str, Any]:
        """Return collection statistics."""
        return await self._store.get_collection_stats(collection)


@lru_cache(maxsize=1)
def get_rag_pipeline() -> None:
    """Placeholder — actual pipeline requires a DB session, so use dependency injection."""
    raise RuntimeError(
        "Use RAGPipeline(session=...) directly or inject via FastAPI dependency. "
        "The pipeline requires an active database session."
    )
