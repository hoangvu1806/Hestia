from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query

from core.config import get_settings
from services.food_library import FoodLibrary

router = APIRouter(prefix="/library", tags=["food library"])
library = FoodLibrary(get_settings())


@router.get("/discover")
async def discover() -> dict:
    return await library.discover()


@router.get("/search")
async def search(
    q: Annotated[str, Query(min_length=2, max_length=120)],
    kind: Literal["all", "meals", "foods", "nutrients", "chemistry"] = "all",
    nutrient: str | None = None,
) -> dict:
    return await library.search(q, kind, nutrient)


@router.get("/meals/{meal_id}")
async def meal(meal_id: Annotated[str, Path(pattern=r"^\d+$")]) -> dict:
    result = await library.meal(meal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Meal not found.")
    return result


@router.get("/ingredients/profile")
async def ingredient_profile(name: Annotated[str, Query(min_length=2, max_length=120)]) -> dict:
    return await library.ingredient_profile(name)
