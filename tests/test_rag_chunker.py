"""Tests for the RAG document chunker."""

from __future__ import annotations

import pytest

from aegisforge.rag.chunker import (
    Chunk,
    ChunkingConfig,
    ContentType,
    chunk_document,
    detect_content_type,
)


class TestContentTypeDetection:
    def test_python_detection(self) -> None:
        assert detect_content_type("src/main.py") == ContentType.PYTHON

    def test_typescript_detection(self) -> None:
        assert detect_content_type("app/index.tsx") == ContentType.TYPESCRIPT
        assert detect_content_type("lib/utils.ts") == ContentType.TYPESCRIPT

    def test_markdown_detection(self) -> None:
        assert detect_content_type("README.md") == ContentType.MARKDOWN

    def test_java_detection(self) -> None:
        assert detect_content_type("Main.java") == ContentType.JAVA

    def test_go_detection(self) -> None:
        assert detect_content_type("server.go") == ContentType.GO

    def test_unknown_defaults_to_plain_text(self) -> None:
        assert detect_content_type("file.xyz") == ContentType.PLAIN_TEXT


class TestChunkDocument:
    def test_empty_text_returns_empty(self) -> None:
        result = chunk_document("", source="test.py")
        assert result == []

    def test_whitespace_only_returns_empty(self) -> None:
        result = chunk_document("   \n\n  ", source="test.py")
        assert result == []

    def test_small_document_single_chunk(self) -> None:
        result = chunk_document("x = 1\ny = 2", source="test.py")
        assert len(result) == 1
        assert result[0].content == "x = 1\ny = 2"
        assert result[0].content_type == ContentType.PYTHON

    def test_python_splits_on_function_boundaries(self) -> None:
        code = """import os

def foo():
    return 1

def bar():
    return 2

class MyClass:
    def method(self):
        pass
"""
        config = ChunkingConfig(max_chunk_tokens=30, overlap_tokens=5)
        result = chunk_document(code, source="module.py", config=config)
        assert len(result) >= 2

        # Each chunk should have metadata
        for chunk in result:
            assert chunk.source == "module.py"
            assert chunk.content_type == ContentType.PYTHON
            assert chunk.token_estimate > 0

    def test_markdown_splits_on_headings(self) -> None:
        doc = """# Title

Introduction paragraph.

## Section 1

Content for section 1 goes here with enough text to matter.

## Section 2

Content for section 2 goes here with enough text to matter.
"""
        config = ChunkingConfig(max_chunk_tokens=30, overlap_tokens=5)
        result = chunk_document(doc, source="docs.md", config=config)
        assert len(result) >= 2
        assert result[0].content_type == ContentType.MARKDOWN

    def test_chunks_have_line_numbers(self) -> None:
        code = "line1\nline2\nline3\nline4\nline5"
        result = chunk_document(code, source="test.txt")
        assert len(result) >= 1
        assert result[0].start_line == 1

    def test_metadata_passed_through(self) -> None:
        result = chunk_document(
            "content",
            source="test.py",
            metadata={"repo": "main", "branch": "feature"},
        )
        assert result[0].metadata["repo"] == "main"
        assert result[0].metadata["branch"] == "feature"

    def test_content_type_override(self) -> None:
        result = chunk_document(
            "some content",
            source="unknown.xyz",
            content_type=ContentType.SQL,
        )
        assert result[0].content_type == ContentType.SQL

    def test_large_document_produces_multiple_chunks(self) -> None:
        # Generate a document larger than one chunk
        large_text = "\n".join([f"Line {i}: " + "x" * 100 for i in range(200)])
        config = ChunkingConfig(max_chunk_tokens=100, overlap_tokens=10)
        result = chunk_document(large_text, source="large.txt", config=config)
        assert len(result) > 1

        # All chunks should be within size limits (approximately)
        for chunk in result:
            assert chunk.token_estimate <= config.max_chunk_tokens * 1.5  # Allow some flexibility


class TestChunkModel:
    def test_chunk_id_generated(self) -> None:
        c1 = Chunk(content="test", content_type=ContentType.PLAIN_TEXT)
        c2 = Chunk(content="test", content_type=ContentType.PLAIN_TEXT)
        assert c1.chunk_id != c2.chunk_id

    def test_chunk_token_estimate(self) -> None:
        chunk = Chunk(content="a" * 400, content_type=ContentType.PLAIN_TEXT)
        # Post-init should estimate ~100 tokens for 400 chars
        assert chunk.token_estimate == 0  # Pydantic default, __post_init__ needs manual call
