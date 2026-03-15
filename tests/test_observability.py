"""Tests for observability — metrics registry and SLI/SLO tracking."""

from __future__ import annotations

import pytest

from aegisforge.observability.metrics import MetricsRegistry
from aegisforge.observability.sli import SLITracker, SLODefinition, SLOStatus


class TestMetricsRegistry:
    def test_registry_creates_all_metrics(self) -> None:
        metrics = MetricsRegistry()
        # Verify key metrics exist and are the right types
        assert metrics.http_requests_total is not None
        assert metrics.llm_requests_total is not None
        assert metrics.rag_queries_total is not None
        assert metrics.tasks_total is not None
        assert metrics.audit_events_total is not None
        assert metrics.connector_circuit_breaker is not None

    def test_http_counter_increments(self) -> None:
        metrics = MetricsRegistry()
        metrics.http_requests_total.labels(method="GET", path="/healthz", status_code="200").inc()
        # No assertion needed — just verify it doesn't raise

    def test_llm_histogram_observes(self) -> None:
        metrics = MetricsRegistry()
        metrics.llm_request_duration.labels(tier="advanced", provider="vllm").observe(2.5)

    def test_build_info_set(self) -> None:
        metrics = MetricsRegistry()
        metrics.build_info.info({"version": "0.1.0", "env": "test"})


class TestSLITracker:
    def test_empty_tracker_returns_unknown(self) -> None:
        tracker = SLITracker()
        assert tracker.evaluate("availability") == SLOStatus.UNKNOWN

    def test_healthy_slo(self) -> None:
        tracker = SLITracker([
            SLODefinition(name="test", description="test", target=0.99),
        ])
        # Record 100 good events out of 100
        for _ in range(100):
            tracker.record("test", good=True)
        assert tracker.evaluate("test") == SLOStatus.HEALTHY

    def test_breaching_slo(self) -> None:
        tracker = SLITracker([
            SLODefinition(name="test", description="test", target=0.99),
        ])
        # Record 90 good, 10 bad (90% < 99% target)
        for _ in range(90):
            tracker.record("test", good=True)
        for _ in range(10):
            tracker.record("test", good=False)
        assert tracker.evaluate("test") == SLOStatus.BREACHING

    def test_unknown_slo_name(self) -> None:
        tracker = SLITracker()
        assert tracker.evaluate("nonexistent") == SLOStatus.UNKNOWN

    def test_evaluate_all(self) -> None:
        tracker = SLITracker()
        results = tracker.evaluate_all()
        assert "availability" in results
        assert "task_success_rate" in results
        assert all(v == SLOStatus.UNKNOWN for v in results.values())

    def test_get_summary(self) -> None:
        tracker = SLITracker([
            SLODefinition(name="test", description="Test SLO", target=0.95),
        ])
        for _ in range(100):
            tracker.record("test", good=True)

        summary = tracker.get_summary()
        assert "test" in summary
        assert summary["test"]["target"] == 0.95
        assert summary["test"]["current"] == 1.0
        assert summary["test"]["status"] == "healthy"
        assert summary["test"]["total_events"] == 100

    def test_recording_unknown_slo_is_noop(self) -> None:
        tracker = SLITracker()
        tracker.record("does_not_exist", good=True)  # Should not raise

    def test_default_slos_loaded(self) -> None:
        tracker = SLITracker()
        summary = tracker.get_summary()
        assert len(summary) == 6  # 6 default SLOs
        assert "availability" in summary
        assert "llm_reasoning_latency" in summary
