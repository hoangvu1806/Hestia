from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from google.adk.errors.already_exists_error import AlreadyExistsError

from api.dependencies import current_user_id
from schemas.session import (
    SessionCreate,
    SessionEventsResponse,
    SessionPatch,
    SessionResponse,
)
from services.agent_runtime import AgentRuntime, SessionNotFoundError, get_agent_runtime
from services.events import serialize_event
from services.object_store import ObjectStoreError

router = APIRouter(prefix="/sessions", tags=["sessions"])
Runtime = Annotated[AgentRuntime, Depends(get_agent_runtime)]
UserId = Annotated[str, Depends(current_user_id)]


def view(session) -> SessionResponse:
    return SessionResponse(id=session.id, state=session.state, updated_at=session.last_update_time)


def not_found(_: SessionNotFoundError) -> HTTPException:
    return HTTPException(status_code=404, detail="Session not found.")


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate, runtime: Runtime, user_id: UserId) -> SessionResponse:
    try:
        return view(await runtime.create_session(user_id, body.id, body.state))
    except AlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail="Session already exists.") from exc


@router.get("", response_model=list[SessionResponse])
async def list_sessions(runtime: Runtime, user_id: UserId) -> list[SessionResponse]:
    return [view(item) for item in await runtime.list_sessions(user_id)]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, runtime: Runtime, user_id: UserId) -> SessionResponse:
    try:
        return view(await runtime.get_session(user_id, session_id))
    except SessionNotFoundError as exc:
        raise not_found(exc) from exc


@router.get("/{session_id}/events", response_model=SessionEventsResponse)
async def get_events(
    session_id: str, runtime: Runtime, user_id: UserId
) -> SessionEventsResponse:
    try:
        session = await runtime.get_session(user_id, session_id)
    except SessionNotFoundError as exc:
        raise not_found(exc) from exc
    try:
        await runtime.hydrate_legacy_attachments(user_id, session_id, session)
    except ObjectStoreError as exc:
        raise HTTPException(status_code=503, detail="Attachment storage unavailable.") from exc
    return SessionEventsResponse(
        session_id=session.id,
        events=[serialize_event(event) for event in session.events],
    )


@router.patch("/{session_id}", response_model=SessionResponse)
async def patch_session(
    session_id: str, body: SessionPatch, runtime: Runtime, user_id: UserId
) -> SessionResponse:
    try:
        return view(await runtime.patch_state(user_id, session_id, body.state_delta))
    except SessionNotFoundError as exc:
        raise not_found(exc) from exc


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str, runtime: Runtime, user_id: UserId
) -> Response:
    try:
        await runtime.delete_session(user_id, session_id)
    except SessionNotFoundError as exc:
        raise not_found(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
