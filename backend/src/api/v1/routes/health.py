from fastapi import APIRouter

from core.config import get_settings
from schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(environment=settings.environment, version=settings.version)
