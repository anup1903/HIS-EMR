# Stage 1: Build dependencies
FROM python:3.12-slim AS builder

WORKDIR /build
COPY pyproject.toml ./
COPY src/ src/
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

RUN groupadd --gid 1000 aegis && \
    useradd --uid 1000 --gid aegis --shell /bin/bash --create-home aegis

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /build/src /app/src
ENV PYTHONPATH="/app/src"
COPY alembic.ini /app/alembic.ini
COPY alembic/ /app/alembic/

USER aegis

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/healthz').raise_for_status()"

# Single worker for async — uvicorn handles concurrency via asyncio
CMD ["uvicorn", "aegisforge.main:app", "--host", "0.0.0.0", "--port", "8000"]
