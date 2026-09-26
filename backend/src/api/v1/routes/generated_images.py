"""Serve private chat images from S3-compatible object storage."""

import asyncio
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse

from agents.food_risk_agent.image_tools import GENERATED_IMAGE_DIR
from api.dependencies import current_user_id
from services.agent_runtime import AgentRuntime, SessionNotFoundError, get_agent_runtime
from services.object_store import ObjectStoreError, StoredObject, get_object_store

router = APIRouter(prefix="/sessions/{session_id}", tags=["chat images"])
Runtime = Annotated[AgentRuntime, Depends(get_agent_runtime)]
UserId = Annotated[str, Depends(current_user_id)]


async def require_session(session_id: str, runtime: Runtime, user_id: UserId) -> None:
    try:
        await runtime.get_session(user_id, session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Session not found.") from exc


def image_response(value: StoredObject) -> Response:
    return StreamingResponse(
        value.iter_bytes(),
        media_type=value.content_type,
        headers={
            "Cache-Control": "private, max-age=86400, immutable",
            "Content-Length": str(value.size),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/attachments/{attachment_id}")
async def attachment(
    session_id: str,
    attachment_id: UUID,
    runtime: Runtime,
    user_id: UserId,
) -> Response:
    await require_session(session_id, runtime, user_id)
    try:
        value = await asyncio.to_thread(
            get_object_store().get_attachment, user_id, session_id, attachment_id
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Attachment not found.") from exc
    except ObjectStoreError as exc:
        raise HTTPException(status_code=503, detail="Attachment storage unavailable.") from exc
    return image_response(value)


@router.get("/images/{image_id}")
async def generated_image(
    session_id: str,
    image_id: UUID,
    runtime: Runtime,
    user_id: UserId,
) -> Response:
    await require_session(session_id, runtime, user_id)
    try:
        value = await asyncio.to_thread(
            get_object_store().get_generated_image, user_id, session_id, image_id
        )
        return image_response(value)
    except FileNotFoundError:
        legacy_path = GENERATED_IMAGE_DIR / f"{image_id}.png"
        if legacy_path.is_file():
            payload = await asyncio.to_thread(legacy_path.read_bytes)
            try:
                await asyncio.to_thread(
                    get_object_store().put_generated_image,
                    user_id,
                    session_id,
                    image_id,
                    payload,
                )
            except ObjectStoreError as exc:
                raise HTTPException(status_code=503, detail="Image storage unavailable.") from exc
            return Response(
                content=payload,
                media_type="image/png",
                headers={"Cache-Control": "private, max-age=86400"},
            )
        raise HTTPException(status_code=404, detail="Generated image not found.") from None
    except ObjectStoreError as exc:
        raise HTTPException(status_code=503, detail="Image storage unavailable.") from exc
