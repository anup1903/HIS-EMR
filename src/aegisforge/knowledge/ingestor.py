"""Knowledge ingestor — crawls sources and feeds into the RAG vector store.

Supports multiple source types, each with its own crawl strategy,
and provides incremental updates (only re-ingest changed content).
"""

from __future__ import annotations

import hashlib
import os
from enum import Enum
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.rag.chunker import ChunkingConfig
from aegisforge.rag.pipeline import RAGPipeline

logger = structlog.get_logger()


class SourceType(str, Enum):
    CODEBASE = "codebase"
    DOCUMENTATION = "documentation"
    TICKETS = "tickets"
    RUNBOOKS = "runbooks"
    API_SPECS = "api_specs"
    LOGS = "logs"


# File extensions to index per source type
INDEX_EXTENSIONS: dict[SourceType, set[str]] = {
    SourceType.CODEBASE: {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs",
        ".sql", ".yaml", ".yml", ".toml", ".json", ".tf", ".hcl",
        ".sh", ".bash", ".dockerfile", ".proto",
    },
    SourceType.DOCUMENTATION: {
        ".md", ".mdx", ".rst", ".txt", ".adoc",
    },
    SourceType.RUNBOOKS: {
        ".md", ".mdx", ".yaml", ".yml", ".txt",
    },
    SourceType.API_SPECS: {
        ".yaml", ".yml", ".json",
    },
}

# Directories to skip when crawling codebases
SKIP_DIRS: set[str] = {
    ".git", ".hg", "__pycache__", "node_modules", ".venv", "venv",
    ".tox", ".mypy_cache", ".ruff_cache", ".pytest_cache",
    "dist", "build", ".next", ".nuxt", "target", "out",
    ".terraform", ".claude",
}

# Max file size to ingest (skip binaries and huge generated files)
MAX_FILE_SIZE_BYTES = 512 * 1024  # 512 KB


class IngestResult(BaseModel):
    """Summary of an ingestion run."""

    source_type: SourceType
    collection: str
    files_scanned: int = 0
    files_ingested: int = 0
    files_skipped: int = 0
    chunks_created: int = 0
    errors: list[str] = Field(default_factory=list)


class KnowledgeIngestor:
    """Crawls knowledge sources and ingests them into the RAG pipeline.

    Supports:
    - Local file system (codebase, docs, runbooks)
    - Git repositories (clone + crawl)
    - Jira / ServiceNow tickets (via connector adapters)
    - API specs (OpenAPI / gRPC proto)

    Provides incremental ingestion via content hashing — only
    re-indexes files whose content has actually changed.
    """

    def __init__(self, pipeline: RAGPipeline, session: AsyncSession) -> None:
        self._pipeline = pipeline
        self._session = session
        self._content_hashes: dict[str, str] = {}

    def _hash_content(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _should_skip_file(self, path: Path, source_type: SourceType) -> bool:
        """Check if a file should be skipped based on extension, size, or directory."""
        # Skip directories in the blocklist
        for part in path.parts:
            if part in SKIP_DIRS:
                return True

        # Skip files too large (likely generated/binary)
        try:
            if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                return True
        except OSError:
            return True

        # Check extension whitelist
        allowed_exts = INDEX_EXTENSIONS.get(source_type)
        if allowed_exts and path.suffix.lower() not in allowed_exts:
            return True

        return False

    async def ingest_directory(
        self,
        directory: str | Path,
        source_type: SourceType = SourceType.CODEBASE,
        collection: str = "default",
        chunking_config: ChunkingConfig | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> IngestResult:
        """Crawl a directory and ingest all matching files.

        Performs incremental ingestion — skips files whose content
        hash matches the previous ingestion run.
        """
        root = Path(directory)
        result = IngestResult(source_type=source_type, collection=collection)

        if not root.is_dir():
            result.errors.append(f"Directory not found: {directory}")
            return result

        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue

            result.files_scanned += 1

            if self._should_skip_file(path, source_type):
                result.files_skipped += 1
                continue

            try:
                content = path.read_text(encoding="utf-8", errors="replace")
            except Exception as exc:
                result.files_skipped += 1
                result.errors.append(f"{path}: {exc}")
                continue

            if not content.strip():
                result.files_skipped += 1
                continue

            # Incremental: skip if content unchanged
            content_hash = self._hash_content(content)
            source_key = str(path.relative_to(root))
            if self._content_hashes.get(source_key) == content_hash:
                result.files_skipped += 1
                continue

            # Ingest
            file_metadata = {
                "source_type": source_type.value,
                "relative_path": source_key,
                "size_bytes": len(content.encode()),
                **(metadata or {}),
            }

            chunks = await self._pipeline.ingest(
                source=source_key,
                content=content,
                collection=collection,
                metadata=file_metadata,
                chunking_config=chunking_config,
            )

            self._content_hashes[source_key] = content_hash
            result.files_ingested += 1
            result.chunks_created += chunks

        logger.info(
            "knowledge.ingest_directory.complete",
            directory=str(directory),
            source_type=source_type.value,
            scanned=result.files_scanned,
            ingested=result.files_ingested,
            skipped=result.files_skipped,
            chunks=result.chunks_created,
        )

        return result

    async def ingest_git_repo(
        self,
        repo_url: str,
        branch: str = "main",
        collection: str = "default",
        clone_dir: str | None = None,
    ) -> IngestResult:
        """Clone a git repo and ingest its contents.

        Uses sparse checkout to avoid downloading unnecessary files.
        """
        import subprocess
        import tempfile

        target_dir = clone_dir or tempfile.mkdtemp(prefix="aegis_repo_")

        try:
            # Shallow clone for speed
            subprocess.run(
                ["git", "clone", "--depth", "1", "--branch", branch, repo_url, target_dir],
                check=True,
                capture_output=True,
                timeout=300,
            )

            return await self.ingest_directory(
                directory=target_dir,
                source_type=SourceType.CODEBASE,
                collection=collection,
                metadata={"repo_url": repo_url, "branch": branch},
            )
        except subprocess.CalledProcessError as exc:
            logger.error("knowledge.git_clone_failed", repo=repo_url, error=str(exc))
            return IngestResult(
                source_type=SourceType.CODEBASE,
                collection=collection,
                errors=[f"Git clone failed: {exc}"],
            )

    async def ingest_tickets(
        self,
        tickets: list[dict[str, Any]],
        collection: str = "tickets",
    ) -> IngestResult:
        """Ingest Jira/ServiceNow tickets as knowledge.

        Each ticket dict should have: key, summary, description, status, labels.
        """
        result = IngestResult(source_type=SourceType.TICKETS, collection=collection)

        for ticket in tickets:
            key = ticket.get("key", "unknown")
            summary = ticket.get("summary", "")
            description = ticket.get("description", "")
            comments = ticket.get("comments", [])

            # Compose ticket content
            parts = [f"# {key}: {summary}"]
            if description:
                parts.append(f"\n## Description\n{description}")
            if ticket.get("status"):
                parts.append(f"\n**Status:** {ticket['status']}")
            if ticket.get("labels"):
                parts.append(f"**Labels:** {', '.join(ticket['labels'])}")
            for i, comment in enumerate(comments):
                parts.append(f"\n## Comment {i + 1}\n{comment}")

            content = "\n".join(parts)
            result.files_scanned += 1

            try:
                chunks = await self._pipeline.ingest(
                    source=f"ticket:{key}",
                    content=content,
                    collection=collection,
                    metadata={
                        "source_type": "ticket",
                        "ticket_key": key,
                        "status": ticket.get("status"),
                        "labels": ticket.get("labels", []),
                    },
                )
                result.files_ingested += 1
                result.chunks_created += chunks
            except Exception as exc:
                result.errors.append(f"{key}: {exc}")

        return result

    async def ingest_runbooks(
        self,
        directory: str | Path,
        collection: str = "runbooks",
    ) -> IngestResult:
        """Ingest ops runbooks from a directory."""
        return await self.ingest_directory(
            directory=directory,
            source_type=SourceType.RUNBOOKS,
            collection=collection,
        )


def get_knowledge_ingestor(pipeline: RAGPipeline, session: AsyncSession) -> KnowledgeIngestor:
    return KnowledgeIngestor(pipeline=pipeline, session=session)
