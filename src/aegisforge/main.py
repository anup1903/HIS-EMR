"""AegisForge FastAPI application entry point."""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # Load .env before any config/client reads os.environ

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from aegisforge import __version__
from aegisforge.agent.routes import router as agent_router, set_orchestrator
from aegisforge.api import router as api_router
from aegisforge.audit.middleware import AuditMiddleware
from aegisforge.auth.middleware import AuthMiddleware
from aegisforge.config import get_settings
from aegisforge.health import router as health_router
from aegisforge.observability.metrics import get_metrics

logger = structlog.get_logger()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="AegisForge",
        description="Enterprise autonomy agent for software delivery and automation",
        version=__version__,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
    )

    # Middleware (order matters: outermost → innermost)
    # 1. CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if not settings.is_production else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # 2. Audit logging (logs every request with PII redaction)
    application.add_middleware(AuditMiddleware)
    # 3. Authentication (validates JWT tokens, attaches user context)
    if settings.is_production or settings.okta_domain or settings.azure_ad_tenant_id:
        application.add_middleware(AuthMiddleware)

    # Prometheus metrics endpoint
    metrics = get_metrics()
    metrics.build_info.info({
        "version": __version__,
        "env": settings.env.value,
    })
    metrics_app = make_asgi_app()
    application.mount("/metrics", metrics_app)

    # Routers
    application.include_router(health_router)
    application.include_router(api_router)
    application.include_router(agent_router)

    @application.on_event("startup")
    async def on_startup() -> None:
        logger.info(
            "aegisforge.startup",
            version=__version__,
            env=settings.env.value,
        )

        # Initialize Agent Orchestrator
        import os
        from unittest.mock import AsyncMock, MagicMock

        from aegisforge.agent.orchestrator import AgentOrchestrator

        demo_mode = os.getenv("AEGIS_DEMO_MODE", "").lower() in ("true", "1", "yes")

        if demo_mode:
            # Demo mode: mock LLM decomposer that returns a canned plan
            from aegisforge.planner.models import (
                Plan,
                RiskLevel,
                TaskNode,
                TaskType,
            )

            mock_decomposer = AsyncMock()

            async def _demo_decompose(goal, **kwargs):
                """Return a realistic demo plan for any goal."""
                t1 = TaskNode(
                    name="Analyze codebase",
                    description=f"Analyze relevant code for: {goal.title}",
                    task_type=TaskType.ANALYSIS,
                    risk_level=RiskLevel.LOW,
                )
                t2 = TaskNode(
                    name="Implement changes",
                    description=f"Implement solution for: {goal.description}",
                    task_type=TaskType.CODE_MODIFICATION,
                    risk_level=RiskLevel.MEDIUM,
                    depends_on=[t1.task_id],
                )
                t3 = TaskNode(
                    name="Create tests",
                    description="Write unit tests for the changes",
                    task_type=TaskType.TEST_CREATION,
                    risk_level=RiskLevel.LOW,
                    depends_on=[t2.task_id],
                )
                t4 = TaskNode(
                    name="Run test suite",
                    description="Execute all tests to verify changes",
                    task_type=TaskType.TEST_EXECUTION,
                    risk_level=RiskLevel.LOW,
                    depends_on=[t3.task_id],
                )
                t5 = TaskNode(
                    name="Notify team",
                    description="Post summary to Slack",
                    task_type=TaskType.NOTIFICATION,
                    risk_level=RiskLevel.LOW,
                    depends_on=[t4.task_id],
                )
                return Plan(
                    goal=goal,
                    tasks=[t1, t2, t3, t4, t5],
                    reasoning="Demo mode: auto-generated plan",
                )

            mock_decomposer.decompose = _demo_decompose
            orchestrator = AgentOrchestrator(plan_decomposer=mock_decomposer)
            logger.info("aegisforge.orchestrator_initialized", mode="demo")
        else:
            # Production mode: real decomposer with DB session
            from aegisforge.db.session import async_session_factory
            from aegisforge.planner.decomposer import PlanDecomposer
            from aegisforge.llm.client import get_llm_client

            sf = async_session_factory()
            async with sf() as db_session:
                decomposer = PlanDecomposer(
                    session=db_session,
                    llm_client=get_llm_client(),
                )
            orchestrator = AgentOrchestrator(plan_decomposer=decomposer)
            logger.info("aegisforge.orchestrator_initialized", mode="production")

        set_orchestrator(orchestrator)

    @application.on_event("shutdown")
    async def on_shutdown() -> None:
        logger.info("aegisforge.shutdown")

    return application


app = create_app()
