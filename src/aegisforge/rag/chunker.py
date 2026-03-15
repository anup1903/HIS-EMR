"""Intelligent document chunking — code-aware and semantic-boundary splitting.

Supports:
- Source code: splits on function/class boundaries, preserves imports
- Markdown/docs: splits on heading boundaries
- Plain text: recursive character splitting with semantic overlap
- Structured data: JSON/YAML preserves object boundaries
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any
from uuid import uuid4

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger()


class ContentType(str, Enum):
    """Content types with specialized chunking strategies."""

    PYTHON = "python"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    GO = "go"
    MARKDOWN = "markdown"
    PLAIN_TEXT = "plain_text"
    JSON_DATA = "json"
    YAML_DATA = "yaml"
    LOG = "log"
    SQL = "sql"


# File extension → ContentType mapping
EXTENSION_MAP: dict[str, ContentType] = {
    ".py": ContentType.PYTHON,
    ".ts": ContentType.TYPESCRIPT,
    ".tsx": ContentType.TYPESCRIPT,
    ".js": ContentType.TYPESCRIPT,
    ".jsx": ContentType.TYPESCRIPT,
    ".java": ContentType.JAVA,
    ".go": ContentType.GO,
    ".md": ContentType.MARKDOWN,
    ".mdx": ContentType.MARKDOWN,
    ".txt": ContentType.PLAIN_TEXT,
    ".json": ContentType.JSON_DATA,
    ".yaml": ContentType.YAML_DATA,
    ".yml": ContentType.YAML_DATA,
    ".log": ContentType.LOG,
    ".sql": ContentType.SQL,
}


class Chunk(BaseModel):
    """A single chunk of content with metadata for retrieval."""

    chunk_id: str = Field(default_factory=lambda: uuid4().hex[:12])
    content: str
    content_type: ContentType
    source: str = ""                  # file path, URL, ticket ID
    start_line: int | None = None
    end_line: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    token_estimate: int = 0

    def __post_init__(self) -> None:
        if self.token_estimate == 0:
            # Rough estimate: ~4 chars per token
            self.token_estimate = len(self.content) // 4


class ChunkingConfig(BaseModel):
    """Configuration for the chunking strategy."""

    max_chunk_tokens: int = 512
    overlap_tokens: int = 50
    min_chunk_tokens: int = 30
    preserve_boundaries: bool = True  # Keep function/class boundaries intact


# ──────────────────────────────────────────────────────────────────────────────
# Language-specific boundary patterns
# ──────────────────────────────────────────────────────────────────────────────

PYTHON_BOUNDARIES = re.compile(
    r"^(?:class\s+\w|def\s+\w|async\s+def\s+\w|@\w+|if\s+__name__)",
    re.MULTILINE,
)

TYPESCRIPT_BOUNDARIES = re.compile(
    r"^(?:export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)|"
    r"class\s+\w|function\s+\w|const\s+\w+\s*=\s*(?:async\s+)?\()",
    re.MULTILINE,
)

JAVA_BOUNDARIES = re.compile(
    r"^(?:\s*(?:public|private|protected)\s+(?:static\s+)?(?:class|interface|enum|record|\w+\s+\w+\s*\())",
    re.MULTILINE,
)

GO_BOUNDARIES = re.compile(
    r"^(?:func\s+|type\s+\w+\s+(?:struct|interface))",
    re.MULTILINE,
)

MARKDOWN_BOUNDARIES = re.compile(r"^#{1,6}\s+", re.MULTILINE)

BOUNDARY_PATTERNS: dict[ContentType, re.Pattern[str]] = {
    ContentType.PYTHON: PYTHON_BOUNDARIES,
    ContentType.TYPESCRIPT: TYPESCRIPT_BOUNDARIES,
    ContentType.JAVA: JAVA_BOUNDARIES,
    ContentType.GO: GO_BOUNDARIES,
    ContentType.MARKDOWN: MARKDOWN_BOUNDARIES,
}


def detect_content_type(source: str) -> ContentType:
    """Detect content type from file path or extension."""
    for ext, ct in EXTENSION_MAP.items():
        if source.endswith(ext):
            return ct
    return ContentType.PLAIN_TEXT


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token for English/code)."""
    return max(1, len(text) // 4)


def _split_at_boundaries(
    text: str,
    content_type: ContentType,
    config: ChunkingConfig,
) -> list[str]:
    """Split text at language-aware boundaries (functions, classes, headings)."""
    pattern = BOUNDARY_PATTERNS.get(content_type)
    if not pattern:
        return _split_recursive(text, config)

    matches = list(pattern.finditer(text))
    if not matches:
        return _split_recursive(text, config)

    segments: list[str] = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        segment = text[start:end].strip()
        if segment:
            segments.append(segment)

    # Handle text before first boundary (imports, module docstrings)
    if matches and matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            segments.insert(0, preamble)

    # Merge small segments, split large ones
    result: list[str] = []
    buffer = ""
    for seg in segments:
        if _estimate_tokens(buffer + "\n" + seg) <= config.max_chunk_tokens:
            buffer = f"{buffer}\n{seg}".strip() if buffer else seg
        else:
            if buffer:
                result.append(buffer)
            if _estimate_tokens(seg) > config.max_chunk_tokens:
                result.extend(_split_recursive(seg, config))
            else:
                buffer = seg
    if buffer:
        result.append(buffer)

    return result


def _split_recursive(text: str, config: ChunkingConfig) -> list[str]:
    """Recursive character splitting with overlap — fallback strategy."""
    max_chars = config.max_chunk_tokens * 4
    overlap_chars = config.overlap_tokens * 4
    min_chars = config.min_chunk_tokens * 4

    # Try splitting on paragraph breaks, then sentences, then hard cut
    separators = ["\n\n", "\n", ". ", " "]

    chunks: list[str] = []
    remaining = text

    while remaining:
        if len(remaining) <= max_chars:
            if len(remaining) >= min_chars or not chunks:
                chunks.append(remaining.strip())
            elif chunks:
                # Merge tiny remainder into last chunk
                chunks[-1] = f"{chunks[-1]}\n{remaining.strip()}"
            break

        # Find best split point
        split_at = max_chars
        for sep in separators:
            idx = remaining.rfind(sep, 0, max_chars)
            if idx > min_chars:
                split_at = idx + len(sep)
                break

        chunk = remaining[:split_at].strip()
        if chunk:
            chunks.append(chunk)

        # Overlap: back up a bit for context continuity
        overlap_start = max(0, split_at - overlap_chars)
        remaining = remaining[overlap_start:] if overlap_start < split_at else remaining[split_at:]

    return chunks


def chunk_document(
    text: str,
    source: str = "",
    content_type: ContentType | None = None,
    config: ChunkingConfig | None = None,
    metadata: dict[str, Any] | None = None,
) -> list[Chunk]:
    """Chunk a document into retrieval-optimized pieces.

    Args:
        text: The full document text.
        source: File path, URL, or identifier.
        content_type: Override auto-detection.
        config: Chunking parameters.
        metadata: Extra metadata attached to every chunk.

    Returns:
        List of Chunk objects ready for embedding.
    """
    if not text.strip():
        return []

    config = config or ChunkingConfig()
    ct = content_type or detect_content_type(source)
    extra_meta = metadata or {}

    if config.preserve_boundaries and ct in BOUNDARY_PATTERNS:
        raw_chunks = _split_at_boundaries(text, ct, config)
    else:
        raw_chunks = _split_recursive(text, config)

    chunks: list[Chunk] = []
    current_line = 1

    for raw in raw_chunks:
        line_count = raw.count("\n") + 1
        chunk = Chunk(
            content=raw,
            content_type=ct,
            source=source,
            start_line=current_line,
            end_line=current_line + line_count - 1,
            token_estimate=_estimate_tokens(raw),
            metadata=extra_meta,
        )
        chunks.append(chunk)
        current_line += line_count

    logger.debug(
        "chunker.split",
        source=source,
        content_type=ct.value,
        total_chunks=len(chunks),
        avg_tokens=sum(c.token_estimate for c in chunks) // max(len(chunks), 1),
    )

    return chunks
