import logging
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.sse import EventSourceResponse, ServerSentEvent

from api.dependencies import current_user_id
from schemas.chat import AgentEvent, MessageCreate, MessageResponse, TokenUsage
from services.agent_runtime import (
    AgentRuntime,
    InvalidFileError,
    SessionNotFoundError,
    get_agent_runtime,
)
from services.events import add_usage, serialize_event
from services.object_store import ObjectStoreError

router = APIRouter(prefix="/sessions/{session_id}/messages", tags=["chat"])
logger = logging.getLogger(__name__)
Runtime = Annotated[AgentRuntime, Depends(get_agent_runtime)]
UserId = Annotated[str, Depends(current_user_id)]


async def require_session(session_id: str, runtime: Runtime, user_id: UserId) -> None:
    try:
        await runtime.get_session(user_id, session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc


SessionExists = Annotated[None, Depends(require_session)]


def sse(kind: str, payload: dict, event_id: str | None = None) -> ServerSentEvent:
    return ServerSentEvent(event=kind, data=payload, id=event_id)


@router.post("", response_model=MessageResponse)
async def create_message(
    session_id: str, body: MessageCreate, runtime: Runtime, user_id: UserId
) -> MessageResponse:
    events: list[AgentEvent] = []
    usage = TokenUsage()
    final_text = ""
    try:
        async for raw in runtime.run(user_id, session_id, body, stream=False):
            event = serialize_event(raw)
            if event.kind == "error":
                logger.warning("Agent event failed: %s", raw.error_message)
                raise RuntimeError("Agent execution failed")
            events.append(event)
            add_usage(usage, event)
            if event.final and event.text_delta:
                final_text = event.text_delta
        session = await runtime.get_session(user_id, session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc
    except InvalidFileError as exc:
        raise HTTPException(status_code=422, detail="Invalid attachment.") from exc
    except ObjectStoreError as exc:
        raise HTTPException(status_code=503, detail="Attachment storage unavailable.") from exc
    except Exception as exc:
        logger.exception("Message execution failed")
        raise HTTPException(status_code=503, detail="Request could not be completed.") from exc
    return MessageResponse(
        session_id=session_id,
        message=final_text,
        state=session.state,
        usage=usage,
        events=events,
    )


@router.post("/stream", response_class=EventSourceResponse)
async def stream_message(
    session_id: str,
    body: MessageCreate,
    runtime: Runtime,
    user_id: UserId,
    _session: SessionExists,
) -> AsyncIterator[ServerSentEvent]:
    usage = TokenUsage()
    failed = False
    yield sse("ready", {"session_id": session_id})
    try:
        async for raw in runtime.run(user_id, session_id, body, stream=True):
            event = serialize_event(raw)
            add_usage(usage, event)
            if event.kind == "error":
                logger.warning("Agent stream event failed: %s", raw.error_message)
                if not failed:
                    yield sse("error", {"code": "request_failed"})
                failed = True
                continue
            if failed:
                continue
            yield sse(
                event.kind,
                event.model_dump(mode="json", exclude_none=True),
                event.id,
            )
        if failed:
            return
        session = await runtime.get_session(user_id, session_id)
        yield sse(
            "done",
            {
                "session_id": session_id,
                "state": session.state,
                "usage": usage.model_dump(),
            },
        )
    except InvalidFileError:
        yield sse("error", {"code": "invalid_attachment"})
    except ObjectStoreError:
        logger.exception("Attachment storage failed")
        yield sse("error", {"code": "attachment_storage_unavailable"})
    except Exception:  # Streaming errors stay internal and use a stable public code.
        logger.exception("Message stream failed")
        yield sse("error", {"code": "request_failed"})
