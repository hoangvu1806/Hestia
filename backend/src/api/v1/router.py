from fastapi import APIRouter

from api.v1.routes.chat import router as chat_router
from api.v1.routes.generated_images import router as generated_images_router
from api.v1.routes.health import router as health_router
from api.v1.routes.library import router as library_router
from api.v1.routes.sessions import router as sessions_router

router = APIRouter()
router.include_router(health_router)
router.include_router(library_router)
router.include_router(sessions_router)
router.include_router(chat_router)
router.include_router(generated_images_router)
