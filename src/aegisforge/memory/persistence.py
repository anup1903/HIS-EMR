"""Durable session persistence layer — replaces in-memory dict in orchestrator.

Stores agent sessions in PostgreSQL so they survive process restarts,
support listing/filtering, and enable post-session analysis.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from aegisforge.agent.models import AgentSession, ExecutionEvent, ExecutionState
from aegisforge.memory.models import SessionRecord
from aegisforge.planner.models import Goal, Plan

logger = structlog.get_logger()


class SessionStore:
    """Persistent store for agent sessions backed by PostgreSQL.

    Provides CRUD operations and query helpers to replace the in-memory
    ``dict[UUID, AgentSession]`` used by the orchestrator, ensuring
    sessions are durable across restarts.
    """

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory

    async def save(self, session: AgentSession) -> None:
        """Upsert an agent session to the session_records table.

        Serialises the goal, plan, and execution log as JSON for storage.
        Uses the unique session_id constraint for conflict resolution.
        """
        async with self._session_factory() as db:
            try:
                existing = await db.execute(
                    select(SessionRecord).where(
                        SessionRecord.session_id == session.session_id
                    )
                )
                record = existing.scalar_one_or_none()

                goal_data = session.goal.model_dump(mode="json")
                plan_data = (
                    session.plan.model_dump(mode="json") if session.plan else None
                )
                log_data = [
                    evt.model_dump(mode="json") for evt in session.execution_log
                ]

                if record:
                    record.goal = goal_data
                    record.plan = plan_data
                    record.state = session.state.value
                    record.actor_id = session.actor_id
                    record.actor_role = session.actor_role
                    record.error = session.error
                    record.execution_log = log_data
                    record.updated_at = datetime.now(timezone.utc)
                    record.completed_at = session.completed_at
                else:
                    record = SessionRecord(
                        session_id=session.session_id,
                        goal=goal_data,
                        plan=plan_data,
                        state=session.state.value,
                        actor_id=session.actor_id,
                        actor_role=session.actor_role,
                        error=session.error,
                        execution_log=log_data,
                        created_at=session.created_at,
                        updated_at=session.updated_at,
                        completed_at=session.completed_at,
                    )
                    db.add(record)

                await db.commit()
                logger.info(
                    "session_store.saved",
                    session_id=str(session.session_id),
                    state=session.state.value,
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "session_store.save_failed",
                    session_id=str(session.session_id),
                )
                raise

    async def load(self, session_id: UUID) -> AgentSession | None:
        """Load and deserialise an AgentSession from the database.

        Returns None if no session with the given ID exists.
        """
        async with self._session_factory() as db:
            try:
                result = await db.execute(
                    select(SessionRecord).where(
                        SessionRecord.session_id == session_id
                    )
                )
                record = result.scalar_one_or_none()
                if record is None:
                    return None

                return self._record_to_session(record)
            except Exception:
                logger.exception(
                    "session_store.load_failed",
                    session_id=str(session_id),
                )
                raise

    async def list_sessions(
        self,
        state: ExecutionState | str | None = None,
        actor_id: str | None = None,
        limit: int = 50,
    ) -> list[AgentSession]:
        """Query sessions with optional filtering, ordered by created_at descending."""
        async with self._session_factory() as db:
            try:
                query = select(SessionRecord).order_by(
                    SessionRecord.created_at.desc()
                )

                if state is not None:
                    state_value = (
                        state.value if isinstance(state, ExecutionState) else state
                    )
                    query = query.where(SessionRecord.state == state_value)
                if actor_id is not None:
                    query = query.where(SessionRecord.actor_id == actor_id)

                query = query.limit(limit)
                result = await db.execute(query)
                records = result.scalars().all()

                return [self._record_to_session(r) for r in records]
            except Exception:
                logger.exception("session_store.list_failed")
                raise

    async def get_recent_similar(
        self, goal_title: str, limit: int = 5
    ) -> list[AgentSession]:
        """Find past sessions with similar goal titles using ILIKE search.

        Useful for showing the operator what happened last time a similar
        goal was attempted.
        """
        async with self._session_factory() as db:
            try:
                # Search in the JSONB goal->title field
                pattern = f"%{goal_title}%"
                query = (
                    select(SessionRecord)
                    .where(
                        SessionRecord.goal["title"].astext.ilike(pattern)
                    )
                    .order_by(SessionRecord.created_at.desc())
                    .limit(limit)
                )

                result = await db.execute(query)
                records = result.scalars().all()

                logger.info(
                    "session_store.similar_search",
                    query=goal_title,
                    results=len(records),
                )
                return [self._record_to_session(r) for r in records]
            except Exception:
                logger.exception(
                    "session_store.similar_search_failed",
                    query=goal_title,
                )
                raise

    async def delete(self, session_id: UUID) -> None:
        """Delete a session record by session_id."""
        async with self._session_factory() as db:
            try:
                await db.execute(
                    delete(SessionRecord).where(
                        SessionRecord.session_id == session_id
                    )
                )
                await db.commit()
                logger.info(
                    "session_store.deleted",
                    session_id=str(session_id),
                )
            except Exception:
                await db.rollback()
                logger.exception(
                    "session_store.delete_failed",
                    session_id=str(session_id),
                )
                raise

    @staticmethod
    def _record_to_session(record: SessionRecord) -> AgentSession:
        """Deserialise a SessionRecord ORM object into an AgentSession Pydantic model."""
        goal = Goal.model_validate(record.goal)
        plan = Plan.model_validate(record.plan) if record.plan else None
        execution_log = [
            ExecutionEvent.model_validate(evt) for evt in (record.execution_log or [])
        ]

        return AgentSession(
            session_id=record.session_id,
            goal=goal,
            plan=plan,
            state=ExecutionState(record.state),
            actor_id=record.actor_id,
            actor_role=record.actor_role,
            error=record.error,
            execution_log=execution_log,
            created_at=record.created_at,
            updated_at=record.updated_at,
            completed_at=record.completed_at,
        )
