"""SLI/SLO tracking — monitors service level indicators against objectives.

SLOs:
  - Availability: 99.9% (measured by successful health checks)
  - Latency: p99 < 500ms for API requests
  - Task success rate: > 95% of tasks complete successfully
  - Error budget: <0.1% of requests return 5xx
  - LLM latency: p99 < 30s for reasoning tier, p99 < 5s for fast tier
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from functools import lru_cache

import structlog

logger = structlog.get_logger()


class SLOStatus(str, Enum):
    HEALTHY = "healthy"         # Within budget
    WARNING = "warning"         # >80% of error budget consumed
    BREACHING = "breaching"     # Error budget exhausted
    UNKNOWN = "unknown"


@dataclass
class SLODefinition:
    """Defines a Service Level Objective."""

    name: str
    description: str
    target: float               # e.g., 0.999 for 99.9%
    window_hours: int = 720     # 30 days rolling
    warning_threshold: float = 0.80  # Alert at 80% budget consumed


@dataclass
class SLIReading:
    """A single SLI measurement."""

    slo_name: str
    good_count: int = 0
    total_count: int = 0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def ratio(self) -> float:
        if self.total_count == 0:
            return 1.0
        return self.good_count / self.total_count


# Default SLO definitions
DEFAULT_SLOS: list[SLODefinition] = [
    SLODefinition(
        name="availability",
        description="Percentage of successful health checks",
        target=0.999,
    ),
    SLODefinition(
        name="api_latency_p99",
        description="99th percentile API response time under 500ms",
        target=0.99,
    ),
    SLODefinition(
        name="task_success_rate",
        description="Percentage of tasks completing successfully",
        target=0.95,
    ),
    SLODefinition(
        name="error_rate",
        description="Percentage of requests NOT returning 5xx",
        target=0.999,
    ),
    SLODefinition(
        name="llm_reasoning_latency",
        description="Reasoning-tier LLM p99 under 30 seconds",
        target=0.99,
    ),
    SLODefinition(
        name="llm_fast_latency",
        description="Fast-tier LLM p99 under 5 seconds",
        target=0.99,
    ),
]


class SLITracker:
    """Tracks SLI readings and evaluates SLO compliance.

    In production, this is backed by Prometheus queries.
    This in-memory implementation supports unit testing and local dev.
    """

    def __init__(self, slos: list[SLODefinition] | None = None) -> None:
        self._slos = {s.name: s for s in (slos or DEFAULT_SLOS)}
        self._readings: dict[str, list[SLIReading]] = {name: [] for name in self._slos}

    def record(self, slo_name: str, good: bool) -> None:
        """Record a single SLI event (good or bad)."""
        if slo_name not in self._readings:
            return
        readings = self._readings[slo_name]
        if not readings or readings[-1].total_count >= 1000:
            readings.append(SLIReading(slo_name=slo_name))
        current = readings[-1]
        current.total_count += 1
        if good:
            current.good_count += 1

    def evaluate(self, slo_name: str) -> SLOStatus:
        """Evaluate current SLO status based on accumulated readings."""
        slo = self._slos.get(slo_name)
        if not slo:
            return SLOStatus.UNKNOWN

        readings = self._readings.get(slo_name, [])
        if not readings:
            return SLOStatus.UNKNOWN

        # Aggregate all readings
        total_good = sum(r.good_count for r in readings)
        total_count = sum(r.total_count for r in readings)

        if total_count == 0:
            return SLOStatus.UNKNOWN

        current_ratio = total_good / total_count
        error_budget_total = 1.0 - slo.target  # e.g., 0.001 for 99.9%
        error_budget_consumed = (1.0 - current_ratio) / error_budget_total if error_budget_total > 0 else 0

        if current_ratio >= slo.target:
            return SLOStatus.HEALTHY
        elif error_budget_consumed <= slo.warning_threshold:
            return SLOStatus.WARNING
        else:
            return SLOStatus.BREACHING

    def evaluate_all(self) -> dict[str, SLOStatus]:
        """Evaluate all SLOs and return their statuses."""
        return {name: self.evaluate(name) for name in self._slos}

    def get_summary(self) -> dict[str, dict]:
        """Return a summary of all SLOs with current readings."""
        summary = {}
        for name, slo in self._slos.items():
            readings = self._readings.get(name, [])
            total_good = sum(r.good_count for r in readings)
            total_count = sum(r.total_count for r in readings)
            ratio = total_good / total_count if total_count > 0 else 1.0

            summary[name] = {
                "target": slo.target,
                "current": round(ratio, 6),
                "status": self.evaluate(name).value,
                "total_events": total_count,
                "description": slo.description,
            }
        return summary


@lru_cache(maxsize=1)
def get_sli_tracker() -> SLITracker:
    return SLITracker()
