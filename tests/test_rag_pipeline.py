"""Tests for RAG pipeline helper functions."""

from __future__ import annotations

import pytest

from aegisforge.rag.pipeline import _assemble_context, _reciprocal_rank_fusion


class TestReciprocalRankFusion:
    def test_single_result_set(self) -> None:
        results = [
            [
                {"id": "a", "content": "doc a", "score": 0.9},
                {"id": "b", "content": "doc b", "score": 0.8},
            ]
        ]
        fused = _reciprocal_rank_fusion(results, k=60)
        assert len(fused) == 2
        assert fused[0]["id"] == "a"  # Higher rank = higher RRF score
        assert fused[0]["rrf_score"] > fused[1]["rrf_score"]

    def test_two_result_sets_boost_overlap(self) -> None:
        """Documents appearing in both sets should rank higher."""
        set1 = [
            {"id": "shared", "content": "overlap doc", "score": 0.9},
            {"id": "only_vec", "content": "vector only", "score": 0.8},
        ]
        set2 = [
            {"id": "shared", "content": "overlap doc", "score": 0.7},
            {"id": "only_kw", "content": "keyword only", "score": 0.6},
        ]
        fused = _reciprocal_rank_fusion([set1, set2], k=60)

        # "shared" should be first (appears in both sets)
        assert fused[0]["id"] == "shared"
        assert len(fused) == 3

    def test_empty_sets(self) -> None:
        fused = _reciprocal_rank_fusion([[], []])
        assert fused == []

    def test_rrf_k_affects_scoring(self) -> None:
        results = [[{"id": "a", "content": "a"}, {"id": "b", "content": "b"}]]
        fused_low_k = _reciprocal_rank_fusion(results, k=1)
        fused_high_k = _reciprocal_rank_fusion(results, k=1000)

        # Lower k amplifies rank differences
        diff_low = fused_low_k[0]["rrf_score"] - fused_low_k[1]["rrf_score"]
        diff_high = fused_high_k[0]["rrf_score"] - fused_high_k[1]["rrf_score"]
        assert diff_low > diff_high


class TestAssembleContext:
    def test_basic_assembly(self) -> None:
        chunks = [
            {"content": "def foo(): pass", "source": "main.py", "start_line": 1, "end_line": 1, "token_count": 5},
            {"content": "def bar(): pass", "source": "utils.py", "start_line": 10, "end_line": 10, "token_count": 5},
        ]
        context, sources = _assemble_context(chunks, max_tokens=1000)

        assert "def foo()" in context
        assert "def bar()" in context
        assert "[Source 1: main.py:1-1]" in context
        assert len(sources) == 2
        assert sources[0]["source"] == "main.py"

    def test_token_limit_truncates(self) -> None:
        chunks = [
            {"content": "a" * 400, "source": "big.py", "token_count": 200},
            {"content": "b" * 400, "source": "too_big.py", "token_count": 200},
        ]
        context, sources = _assemble_context(chunks, max_tokens=150)

        # Only first chunk should fit
        assert "a" * 400 in context
        assert "b" * 400 not in context
        assert len(sources) == 1

    def test_empty_chunks(self) -> None:
        context, sources = _assemble_context([])
        assert context == ""
        assert sources == []

    def test_source_refs_include_scores(self) -> None:
        chunks = [
            {
                "content": "test",
                "source": "file.py",
                "start_line": None,
                "end_line": None,
                "token_count": 2,
                "rerank_score": 0.95,
            },
        ]
        _, sources = _assemble_context(chunks)
        assert sources[0]["score"] == 0.95
