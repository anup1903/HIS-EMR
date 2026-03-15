"""SSE event streaming for real-time agent progress updates."""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from uuid import UUID

import structlog

from aegisforge.agent.models import ExecutionEvent

logger = structlog.get_logger()


class EventStream:
    """Server-Sent Events (SSE) stream manager for agent sessions.

    Each session has a set of subscriber queues. When an event is published,
    it fans out to all connected subscribers for that session.

    Usage:
        stream = EventStream()

        # Publisher side (orchestrator)
        await stream.publish(session_id, event)

        # Subscriber side (SSE endpoint)
        async for event in stream.subscribe(session_id):
            yield f"event: {event.event_type}\\ndata: {event.json()}\\n\\n"
    """

    def __init__(self, max_buffer: int = 1000) -> None:
        self._subscribers: dict[UUID, list[asyncio.Queue[ExecutionEvent | None]]] = (
            defaultdict(list)
        )
        self._max_buffer = max_buffer
        self._history: dict[UUID, list[ExecutionEvent]] = defaultdict(list)

    async def publish(self, session_id: UUID, event: ExecutionEvent) -> None:
        """Publish an event to all subscribers of a session."""
        # Store in history for late joiners
        history = self._history[session_id]
        history.append(event)
        if len(history) > self._max_buffer:
            history.pop(0)

        # Fan out to subscribers
        subscribers = self._subscribers.get(session_id, [])
        dead: list[asyncio.Queue] = []
        for queue in subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(queue)
                logger.warning(
                    "stream.subscriber_buffer_full",
                    session_id=str(session_id),
                )

        # Clean up dead subscribers
        for q in dead:
            if q in self._subscribers[session_id]:
                self._subscribers[session_id].remove(q)

    async def subscribe(
        self,
        session_id: UUID,
        replay: bool = True,
    ) -> asyncio.Queue[ExecutionEvent | None]:
        """Create a subscription queue for a session.

        Args:
            session_id: Session to subscribe to.
            replay: If True, replay historical events into the queue.

        Returns:
            An asyncio Queue that receives ExecutionEvent objects.
            A None value signals the stream has ended.
        """
        queue: asyncio.Queue[ExecutionEvent | None] = asyncio.Queue(
            maxsize=self._max_buffer
        )

        # Replay history
        if replay:
            for event in self._history.get(session_id, []):
                await queue.put(event)

        self._subscribers[session_id].append(queue)
        logger.info(
            "stream.subscriber_added",
            session_id=str(session_id),
            total_subscribers=len(self._subscribers[session_id]),
        )
        return queue

    async def unsubscribe(self, session_id: UUID, queue: asyncio.Queue) -> None:
        """Remove a subscription queue."""
        subs = self._subscribers.get(session_id, [])
        if queue in subs:
            subs.remove(queue)
        if not subs and session_id in self._subscribers:
            del self._subscribers[session_id]

    async def end_session(self, session_id: UUID) -> None:
        """Signal all subscribers that the session has ended."""
        for queue in self._subscribers.get(session_id, []):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass
        self._subscribers.pop(session_id, None)

    def get_history(self, session_id: UUID) -> list[ExecutionEvent]:
        """Get the event history for a session."""
        return list(self._history.get(session_id, []))

    def clear_history(self, session_id: UUID) -> None:
        """Clear event history for a session."""
        self._history.pop(session_id, None)


def format_sse(event: ExecutionEvent) -> str:
    """Format an ExecutionEvent as an SSE message string."""
    data = {
        "event_id": str(event.event_id),
        "event_type": event.event_type.value,
        "session_id": str(event.session_id),
        "task_id": str(event.task_id) if event.task_id else None,
        "plan_id": str(event.plan_id) if event.plan_id else None,
        "timestamp": event.timestamp.isoformat(),
        "message": event.message,
        "data": event.data,
    }
    return f"event: {event.event_type.value}\ndata: {json.dumps(data)}\n\n"
