"""Memory & Feedback Loop — persistent session store, episodic recall, and learned rules.

Phase 7 of the AegisForge agent system. Provides:
  - SessionStore: durable session persistence (replaces in-memory dict)
  - EpisodicMemory: semantic recall of past task outcomes via pgvector
  - RuleEngine: LLM-extracted reusable rules from execution history
  - FeedbackCollector: post-session analysis orchestrator
"""

def __getattr__(name: str):
    """Lazy imports to avoid circular dependency chains."""
    if name == "EpisodicMemory":
        from aegisforge.memory.episodic import EpisodicMemory
        return EpisodicMemory
    if name == "FeedbackCollector":
        from aegisforge.memory.feedback import FeedbackCollector
        return FeedbackCollector
    if name == "SessionStore":
        from aegisforge.memory.persistence import SessionStore
        return SessionStore
    if name == "RuleEngine":
        from aegisforge.memory.rules import RuleEngine
        return RuleEngine
    raise AttributeError(f"module 'aegisforge.memory' has no attribute {name!r}")

__all__ = [
    "SessionStore",
    "EpisodicMemory",
    "RuleEngine",
    "FeedbackCollector",
]
