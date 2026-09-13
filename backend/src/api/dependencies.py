from typing import Annotated

from fastapi import Header

from core.config import get_settings


async def current_user_id(
    x_hestia_user_id: Annotated[str | None, Header(alias="X-Hestia-User-Id")] = None,
) -> str:
    """Development identity seam; replace with verified auth claims later."""
    return x_hestia_user_id or get_settings().default_user_id
