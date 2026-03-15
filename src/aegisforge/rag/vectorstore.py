"""pgvector-backed vector store for document embeddings.

Uses PostgreSQL with the pgvector extension for:
- Dense vector similarity search (cosine, L2, inner product)
- Full-text keyword search (tsvector/tsquery) for hybrid retrieval
- Metadata filtering (source, content type, date range)

Schema is managed by Alembic migrations.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Index, String, Text, func, select, text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from aegisforge.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from aegisforge.rag.chunker import Chunk

logger = structlog.get_logger()


class DocumentEmbedding(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Stores document chunks with their vector embeddings for RAG retrieval."""

    __tablename__ = "document_embeddings"

    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(nullable=False, default=0)

    # Embedding vector — dimension set at migration time to match model
    embedding: Mapped[Any] = mapped_column(Vector(1024), nullable=False)

    # Full-text search column (auto-populated by trigger)
    search_vector: Mapped[Any] = mapped_column(TSVECTOR, nullable=True)

    # Metadata
    start_line: Mapped[int | None] = mapped_column(nullable=True)
    end_line: Mapped[int | None] = mapped_column(nullable=True)
    token_count: Mapped[int] = mapped_column(nullable=False, default=0)
    details: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)

    # Knowledge management
    collection: Mapped[str] = mapped_column(
        String(255), nullable=False, default="default", index=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # HNSW index for fast approximate nearest neighbor search
        Index(
            "ix_embedding_hnsw",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 256},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        # GIN index for full-text search
        Index("ix_search_vector_gin", search_vector, postgresql_using="gin"),
        # Composite index for filtered queries
        Index("ix_collection_source", "collection", "source"),
    )


class VectorStore:
    """Async interface to the pgvector document store."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert_chunks(
        self,
        chunks: list[Chunk],
        embeddings: list[list[float]],
        collection: str = "default",
        expires_at: datetime | None = None,
    ) -> int:
        """Insert or update document chunks with their embeddings.

        Uses source + chunk_index as the conflict key for idempotent upserts.
        Returns the number of rows upserted.
        """
        count = 0
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            # Check if exists
            existing = await self._session.execute(
                select(DocumentEmbedding).where(
                    DocumentEmbedding.source == chunk.source,
                    DocumentEmbedding.chunk_index == i,
                    DocumentEmbedding.collection == collection,
                )
            )
            row = existing.scalar_one_or_none()

            if row:
                row.content = chunk.content
                row.embedding = embedding
                row.content_type = chunk.content_type.value
                row.token_count = chunk.token_estimate
                row.start_line = chunk.start_line
                row.end_line = chunk.end_line
                row.details = chunk.metadata
                row.expires_at = expires_at
            else:
                row = DocumentEmbedding(
                    content=chunk.content,
                    content_type=chunk.content_type.value,
                    source=chunk.source,
                    chunk_index=i,
                    embedding=embedding,
                    token_count=chunk.token_estimate,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    details=chunk.metadata,
                    collection=collection,
                    expires_at=expires_at,
                )
                self._session.add(row)
            count += 1

        await self._session.flush()

        logger.info(
            "vectorstore.upserted",
            collection=collection,
            count=count,
            source=chunks[0].source if chunks else "",
        )
        return count

    async def search_similar(
        self,
        query_embedding: list[float],
        limit: int = 10,
        collection: str | None = None,
        content_types: list[str] | None = None,
        source_filter: str | None = None,
        score_threshold: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Vector similarity search using cosine distance.

        Returns chunks ranked by similarity score (highest first).
        """
        # Build base query with cosine distance
        distance = DocumentEmbedding.embedding.cosine_distance(query_embedding)
        query = (
            select(
                DocumentEmbedding,
                (1 - distance).label("score"),
            )
            .order_by(distance)
            .limit(limit)
        )

        # Apply filters
        if collection:
            query = query.where(DocumentEmbedding.collection == collection)
        if content_types:
            query = query.where(DocumentEmbedding.content_type.in_(content_types))
        if source_filter:
            query = query.where(DocumentEmbedding.source.ilike(f"%{source_filter}%"))

        # Exclude expired documents
        now = datetime.now(timezone.utc)
        query = query.where(
            (DocumentEmbedding.expires_at.is_(None)) | (DocumentEmbedding.expires_at > now)
        )

        result = await self._session.execute(query)
        rows = result.all()

        results: list[dict[str, Any]] = []
        for row in rows:
            doc = row[0]
            score = float(row[1])
            if score >= score_threshold:
                results.append({
                    "id": str(doc.id),
                    "content": doc.content,
                    "source": doc.source,
                    "content_type": doc.content_type,
                    "start_line": doc.start_line,
                    "end_line": doc.end_line,
                    "score": score,
                    "token_count": doc.token_count,
                    "metadata": doc.details,
                    "collection": doc.collection,
                })

        return results

    async def search_keyword(
        self,
        query_text: str,
        limit: int = 10,
        collection: str | None = None,
    ) -> list[dict[str, Any]]:
        """Full-text keyword search using PostgreSQL tsvector/tsquery.

        Complements vector search for exact term matches (function names,
        error codes, config keys).
        """
        tsquery = func.plainto_tsquery("english", query_text)
        rank = func.ts_rank(DocumentEmbedding.search_vector, tsquery)

        query = (
            select(DocumentEmbedding, rank.label("score"))
            .where(DocumentEmbedding.search_vector.op("@@")(tsquery))
            .order_by(rank.desc())
            .limit(limit)
        )

        if collection:
            query = query.where(DocumentEmbedding.collection == collection)

        now = datetime.now(timezone.utc)
        query = query.where(
            (DocumentEmbedding.expires_at.is_(None)) | (DocumentEmbedding.expires_at > now)
        )

        result = await self._session.execute(query)
        rows = result.all()

        return [
            {
                "id": str(row[0].id),
                "content": row[0].content,
                "source": row[0].source,
                "content_type": row[0].content_type,
                "start_line": row[0].start_line,
                "end_line": row[0].end_line,
                "score": float(row[1]),
                "token_count": row[0].token_count,
                "metadata": row[0].details,
                "collection": row[0].collection,
            }
            for row in rows
        ]

    async def delete_by_source(self, source: str, collection: str = "default") -> int:
        """Delete all chunks for a given source (e.g., when a file is deleted)."""
        result = await self._session.execute(
            select(DocumentEmbedding).where(
                DocumentEmbedding.source == source,
                DocumentEmbedding.collection == collection,
            )
        )
        rows = result.scalars().all()
        for row in rows:
            await self._session.delete(row)
        await self._session.flush()
        return len(rows)

    async def get_collection_stats(self, collection: str = "default") -> dict[str, Any]:
        """Return statistics for a collection."""
        result = await self._session.execute(
            select(
                func.count(DocumentEmbedding.id).label("total_chunks"),
                func.count(func.distinct(DocumentEmbedding.source)).label("total_sources"),
                func.sum(DocumentEmbedding.token_count).label("total_tokens"),
            ).where(DocumentEmbedding.collection == collection)
        )
        row = result.one()
        return {
            "collection": collection,
            "total_chunks": row[0] or 0,
            "total_sources": row[1] or 0,
            "total_tokens": row[2] or 0,
        }
