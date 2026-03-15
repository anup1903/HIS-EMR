"""Prometheus metrics registry — exposes /metrics endpoint.

Tracks:
- HTTP request latency/count/errors
- LLM call latency/tokens/fallbacks
- RAG retrieval latency/hit rate
- Task execution duration/success/failure
- Celery queue depth
- Circuit breaker state
"""

from __future__ import annotations

from functools import lru_cache

from prometheus_client import Counter, Gauge, Histogram, Info


class MetricsRegistry:
    """Central Prometheus metrics for AegisForge."""

    def __init__(self) -> None:
        # ── HTTP ──
        self.http_requests_total = Counter(
            "aegis_http_requests_total",
            "Total HTTP requests",
            ["method", "path", "status_code"],
        )
        self.http_request_duration = Histogram(
            "aegis_http_request_duration_seconds",
            "HTTP request duration",
            ["method", "path"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        )

        # ── LLM ──
        self.llm_requests_total = Counter(
            "aegis_llm_requests_total",
            "Total LLM API calls",
            ["tier", "provider", "model", "status"],
        )
        self.llm_request_duration = Histogram(
            "aegis_llm_request_duration_seconds",
            "LLM request latency",
            ["tier", "provider"],
            buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0],
        )
        self.llm_tokens_total = Counter(
            "aegis_llm_tokens_total",
            "Total tokens consumed",
            ["tier", "direction"],  # direction: input/output
        )
        self.llm_fallbacks_total = Counter(
            "aegis_llm_fallbacks_total",
            "LLM fallback events",
            ["tier", "from_provider", "to_provider"],
        )

        # ── RAG ──
        self.rag_queries_total = Counter(
            "aegis_rag_queries_total",
            "Total RAG queries",
            ["collection", "status"],
        )
        self.rag_query_duration = Histogram(
            "aegis_rag_query_duration_seconds",
            "RAG query latency (retrieve + rerank)",
            ["collection"],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
        )
        self.rag_chunks_retrieved = Histogram(
            "aegis_rag_chunks_retrieved",
            "Number of chunks returned per query",
            ["collection"],
            buckets=[0, 1, 3, 5, 8, 10, 15, 20],
        )

        # ── Tasks ──
        self.tasks_total = Counter(
            "aegis_tasks_total",
            "Total tasks executed",
            ["task_type", "status"],
        )
        self.task_duration = Histogram(
            "aegis_task_duration_seconds",
            "Task execution duration",
            ["task_type"],
            buckets=[1, 5, 30, 60, 300, 600, 1800],
        )
        self.tasks_in_progress = Gauge(
            "aegis_tasks_in_progress",
            "Currently executing tasks",
            ["task_type"],
        )

        # ── Plans ──
        self.plans_total = Counter(
            "aegis_plans_total",
            "Total plans generated",
            ["status"],  # created, approved, rejected, completed
        )

        # ── Connectors ──
        self.connector_requests_total = Counter(
            "aegis_connector_requests_total",
            "External API calls",
            ["connector", "operation", "status"],
        )
        self.connector_circuit_breaker = Gauge(
            "aegis_connector_circuit_breaker_state",
            "Circuit breaker state (0=closed, 1=open, 2=half-open)",
            ["connector"],
        )

        # ── Audit ──
        self.audit_events_total = Counter(
            "aegis_audit_events_total",
            "Total audit events recorded",
            ["action", "status"],
        )

        # ── System ──
        self.build_info = Info(
            "aegis_build",
            "Build information",
        )


@lru_cache(maxsize=1)
def get_metrics() -> MetricsRegistry:
    return MetricsRegistry()
