"""Serve locally persisted images created by the configured generation model."""

from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from agents.food_risk_agent.image_tools import GENERATED_IMAGE_DIR

router = APIRouter(prefix="/generated-images", tags=["generated-images"])


@router.get("/{image_id}", response_class=FileResponse)
async def generated_image(image_id: UUID) -> FileResponse:
    path = GENERATED_IMAGE_DIR / f"{image_id}.png"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Generated image not found.")
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )
