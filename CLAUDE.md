# AegisForge — Agent Working Instructions

## Project Overview
Enterprise autonomy agent for software delivery and automation.
Stack: Python 3.12, FastAPI, PostgreSQL (pgvector), Redis, Celery, AWS EKS.
LLM: Open-source models — DeepSeek-R1, Qwen3-235B, Llama 4 (via vLLM / Together / Groq).
RAG: BGE-M3 embeddings + pgvector HNSW + BGE-reranker-v2 cross-encoder (all self-hosted).

## Development Commands
```bash
# Install
pip install -e ".[dev]"

# Run locally
docker compose up -d postgres redis
uvicorn aegisforge.main:app --reload

# Tests
pytest                          # all tests
pytest tests/test_health.py     # specific file
pytest --cov-report=html        # coverage report

# Lint & format
ruff check src/ tests/ --fix
ruff format src/ tests/
mypy src/

# Security
bandit -r src/
pip-audit

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

## Architecture
- `src/aegisforge/main.py` — FastAPI app entry point
- `src/aegisforge/config.py` — Pydantic Settings (env-based)
- `src/aegisforge/health.py` — /healthz, /readyz endpoints
- `src/aegisforge/db/` — SQLAlchemy async engine, base models

### Intelligence Layer (LLM + RAG)
- `src/aegisforge/llm/` — LLM client with tier-based model selection and auto-fallback
  - `models.py` — ModelTier (REASONING/ADVANCED/STANDARD/FAST), MODEL_REGISTRY, request/response types
  - `client.py` — Unified async client, all providers via OpenAI-compatible API
- `src/aegisforge/rag/` — Full RAG pipeline
  - `embeddings.py` — BGE-M3 embeddings via sentence-transformers (local, no external API)
  - `chunker.py` — Code-aware + semantic-boundary document splitting
  - `vectorstore.py` — pgvector store with HNSW index + full-text search
  - `reranker.py` — BGE-reranker-v2 cross-encoder for precision reranking
  - `pipeline.py` — End-to-end: query → hybrid search → RRF → rerank → augment → generate
- `src/aegisforge/knowledge/` — Knowledge ingestion (code repos, docs, tickets, runbooks)
  - `ingestor.py` — Crawl sources, incremental indexing via content hashing

### Planning & Orchestration
- `src/aegisforge/planner/` — LLM+RAG powered goal → DAG decomposition
  - `models.py` — Goal, Plan, TaskNode, DAG validation
  - `decomposer.py` — Uses REASONING tier (DeepSeek-R1) + RAG context for grounded planning
- `src/aegisforge/executor/` — Celery task workers (Commit 4)
- `src/aegisforge/connectors/` — External system adapters (Commits 4-5)
- `src/aegisforge/auth/` — Okta/Azure AD SSO, RBAC (Commit 2)
- `src/aegisforge/audit/` — Immutable audit logger (Commit 2)
- `src/aegisforge/observability/` — Metrics, SLIs (Commit 5)
- `src/aegisforge/workflows/` — High-level workflow orchestration (Commit 5)

## LLM Model Tiers
| Tier | Primary | Use Case |
|------|---------|----------|
| REASONING | DeepSeek-R1 | Goal decomposition, architecture, complex analysis |
| ADVANCED | Qwen3-235B-A22B | Code generation, integration design |
| STANDARD | Llama 4 Maverick | Summarization, classification |
| FAST | Llama 4 Scout | Extraction, formatting, quick checks |

## Rules
- NEVER log, echo, or return secrets in any output
- All database changes require tested downgrade() in migrations
- All external API calls go through Connector Hub (retry + circuit breaker)
- Minimum 90% test coverage
- Every task execution must produce an audit event
- PII redaction on all log output before storage
- All LLM/RAG models run self-hosted (vLLM) — no data leaves the cluster
- Embedding and reranking models run locally via sentence-transformers
- RAG context always includes source attribution
