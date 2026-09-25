from __future__ import annotations

import asyncio
import difflib
import time
from typing import Any

import httpx

from agents.food_risk_agent.tools import get_food_chemical_profile, normalize_name
from core.config import Settings
from services.food_database import connect_food_database

THEMEALDB = "https://www.themealdb.com/api/json/v1"
USDA_FDC = "https://api.nal.usda.gov/fdc/v1"

NUTRIENT_ALIASES = {
    "energy": ("Energy", "kcal"),
    "protein": ("Protein", "g"),
    "fat": ("Total lipid (fat)", "g"),
    "carbohydrate": ("Carbohydrate, by difference", "g"),
    "fiber": ("Fiber, total dietary", "g"),
    "sugars": ("Sugars, total including NLEA", "g"),
    "sodium": ("Sodium, Na", "mg"),
    "potassium": ("Potassium, K", "mg"),
    "calcium": ("Calcium, Ca", "mg"),
    "iron": ("Iron, Fe", "mg"),
    "vitamin c": ("Vitamin C, total ascorbic acid", "mg"),
}


class FoodLibrary:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._cache: dict[str, tuple[float, Any]] = {}

    async def _json(self, url: str, *, params: dict[str, Any] | None = None) -> dict:
        key = f"{url}:{sorted((params or {}).items())}"
        cached = self._cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            async with httpx.AsyncClient(timeout=14, follow_redirects=True) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError):
            return {}
        self._cache[key] = (time.monotonic() + 900, payload)
        return payload

    @property
    def meal_base(self) -> str:
        return f"{THEMEALDB}/{self.settings.themealdb_api_key}"

    async def discover(self) -> dict[str, Any]:
        categories_task = self._json(f"{self.meal_base}/categories.php")
        meal_tasks = [
            self._json(f"{self.meal_base}/filter.php", params={"c": category})
            for category in ("Seafood", "Vegetarian", "Chicken", "Dessert")
        ]
        categories, *collections = await asyncio.gather(categories_task, *meal_tasks)
        if not categories.get("categories"):
            categories = await self._json(f"{self.meal_base}/categories.php")
        featured: list[dict[str, Any]] = []
        for payload in collections:
            for meal in (payload.get("meals") or [])[:2]:
                featured.append(self._meal_card(meal))
        return {
            "featured": featured,
            "categories": [
                {
                    "name": item.get("strCategory"),
                    "image": item.get("strCategoryThumb"),
                    "description": item.get("strCategoryDescription"),
                }
                for item in (categories.get("categories") or [])
            ],
            "sources": self.sources(),
        }

    async def search(
        self, query: str, kind: str = "all", nutrient: str | None = None
    ) -> dict[str, Any]:
        query = query.strip()[:120]
        meal_task = (
            self._json(f"{self.meal_base}/search.php", params={"s": query})
            if kind in {"all", "meals"}
            else asyncio.sleep(0, result={})
        )
        usda_task = (
            self._usda_search(query, nutrient)
            if kind in {"all", "foods", "nutrients"}
            else asyncio.sleep(0, result=[])
        )
        chemistry_task = (
            asyncio.to_thread(self._foodb_search, query)
            if kind in {"all", "foods", "chemistry"}
            else asyncio.sleep(0, result={"foods": [], "compounds": []})
        )
        meals, foods, chemistry = await asyncio.gather(meal_task, usda_task, chemistry_task)
        return {
            "query": query,
            "kind": kind,
            "nutrient": nutrient,
            "meals": [self._meal_card(item) for item in (meals.get("meals") or [])[:12]],
            "foods": foods,
            "chemistry": chemistry,
            "sources": self.sources(),
        }

    async def meal(self, meal_id: str) -> dict[str, Any] | None:
        payload = await self._json(f"{self.meal_base}/lookup.php", params={"i": meal_id})
        items = payload.get("meals") or []
        if not items:
            return None
        meal = items[0]
        ingredients = []
        for index in range(1, 21):
            name = (meal.get(f"strIngredient{index}") or "").strip()
            if name:
                ingredients.append(
                    {"name": name, "measure": (meal.get(f"strMeasure{index}") or "").strip()}
                )
        primary = ingredients[0]["name"] if ingredients else meal.get("strMeal")
        profile = await self.ingredient_profile(primary)
        return {
            "id": meal.get("idMeal"),
            "name": meal.get("strMeal"),
            "image": meal.get("strMealThumb"),
            "area": meal.get("strArea"),
            "category": meal.get("strCategory"),
            "tags": [tag.strip() for tag in (meal.get("strTags") or "").split(",") if tag.strip()],
            "instructions": meal.get("strInstructions"),
            "video": meal.get("strYoutube"),
            "source_url": meal.get("strSource"),
            "ingredients": ingredients,
            "primary_ingredient": profile,
            "sources": self.sources(),
        }

    async def ingredient_profile(self, name: str) -> dict[str, Any]:
        usda_task = self._usda_search(name, None, page_size=4)
        foodb_task = asyncio.to_thread(get_food_chemical_profile, [name], 10)
        foods, chemistry = await asyncio.gather(usda_task, foodb_task)
        return {
            "name": name,
            "image": (
                "https://www.themealdb.com/images/ingredients/"
                f"{name.replace(' ', '_')}.png/medium"
            ),
            "nutrition_matches": foods,
            "chemistry": chemistry,
        }

    async def _usda_search(
        self, query: str, nutrient: str | None, page_size: int = 12
    ) -> list[dict[str, Any]]:
        payload, ingredient_payload = await asyncio.gather(
            self._json(
                f"{USDA_FDC}/foods/search",
                params={
                    "api_key": self.settings.usda_api_key,
                    "query": query,
                    "pageSize": max(1, min(page_size, 20)),
                },
            ),
            self._json(f"{self.meal_base}/list.php", params={"i": "list"}),
        )
        ingredient_catalog = ingredient_payload.get("meals") or []
        raw_foods = payload.get("foods") or []
        preferred = [
            item
            for item in raw_foods
            if item.get("dataType") in {"Foundation", "SR Legacy", "Survey (FNDDS)"}
        ]
        foods = [
            self._usda_food(item, nutrient, ingredient_catalog)
            for item in (preferred or raw_foods)
        ]
        if nutrient:
            foods.sort(
                key=lambda item: item.get("focus_nutrient", {}).get("value") or -1,
                reverse=True,
            )
        return foods

    def _usda_food(
        self,
        item: dict[str, Any],
        focus: str | None,
        ingredient_catalog: list[dict[str, Any]],
    ) -> dict[str, Any]:
        nutrients: dict[str, dict[str, Any]] = {}
        for nutrient in item.get("foodNutrients") or []:
            name = nutrient.get("nutrientName")
            if name in {value[0] for value in NUTRIENT_ALIASES.values()}:
                key = next(key for key, value in NUTRIENT_ALIASES.items() if value[0] == name)
                nutrients[key] = {
                    "label": name,
                    "value": nutrient.get("value"),
                    "unit": nutrient.get("unitName"),
                }
        focus_key = normalize_name(focus or "")
        artwork = self._ingredient_artwork(item.get("description") or "", ingredient_catalog)
        return {
            "fdc_id": item.get("fdcId"),
            "name": item.get("description"),
            "data_type": item.get("dataType"),
            "food_category": item.get("foodCategory"),
            "brand": item.get("brandOwner"),
            "nutrients": nutrients,
            "focus_nutrient": nutrients.get(focus_key),
            "source_url": f"https://fdc.nal.usda.gov/food-details/{item.get('fdcId')}/nutrients",
            "basis": "Values are typically reported per 100 g. Confirm the source record.",
            **artwork,
        }

    @staticmethod
    def _ingredient_artwork(
        description: str, ingredient_catalog: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Map a USDA description to a real TheMealDB ingredient artwork entry."""
        normalized = normalize_name(description)
        primary = normalize_name(description.split(",", 1)[0])
        tokens = set(normalized.split())
        preferred = ""
        if {"green", "onion"} <= tokens or {"green", "onions"} <= tokens:
            preferred = "spring onions"
        elif {"scallion"} <= tokens or {"scallions"} <= tokens:
            preferred = "spring onions"

        best_name = ""
        best_score = 0.0
        for ingredient in ingredient_catalog:
            name = str(ingredient.get("strIngredient") or "").strip()
            candidate = normalize_name(name)
            if not candidate:
                continue
            candidate_tokens = set(candidate.split())
            score = difflib.SequenceMatcher(None, primary, candidate).ratio()
            if candidate == primary:
                score = 1.0
            elif candidate_tokens and candidate_tokens <= tokens:
                score = max(score, 0.76 + min(len(candidate_tokens), 4) * 0.04)
            if preferred and candidate == preferred:
                score = 1.1
            if score > best_score:
                best_name, best_score = name, score

        if not best_name or best_score < 0.58:
            return {"image": None, "image_label": None, "image_match_score": 0.0}
        filename = best_name.replace(" ", "_")
        return {
            "image": f"https://www.themealdb.com/images/ingredients/{filename}.png/medium",
            "image_label": best_name,
            "image_match_score": round(min(best_score, 1.0), 3),
            "image_source": "TheMealDB ingredient artwork",
        }

    def _foodb_search(self, query: str) -> dict[str, list[dict[str, Any]]]:
        normalized = normalize_name(query)
        if not normalized:
            return {"foods": [], "compounds": []}
        pattern = f"%{normalized}%"
        with connect_food_database() as connection:
            foods = connection.execute(
                """
                SELECT f.id, f.public_id, f.name, f.scientific_name,
                       f.food_group, f.food_subgroup,
                       COUNT(fc.*) AS relation_count,
                       COUNT(*) FILTER (
                           WHERE fc.standard_content IS NOT NULL
                             AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0
                       ) AS quantified_count
                FROM food f
                LEFT JOIN food_compound fc ON fc.food_id = f.id
                WHERE f.normalized_name LIKE %s
                GROUP BY f.id
                ORDER BY CASE WHEN f.normalized_name = %s THEN 0 ELSE 1 END,
                         LENGTH(f.name)
                LIMIT 10
                """,
                (pattern, normalized),
            ).fetchall()
            direct_compounds = connection.execute(
                """
                SELECT public_id, name, annotation_quality, superclass, class_name, subclass
                FROM compound
                WHERE LOWER(name) LIKE %s OR LOWER(COALESCE(superclass, '')) LIKE %s
                ORDER BY CASE annotation_quality WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
                LIMIT 10
                """,
                (pattern, pattern),
            ).fetchall()

            associated_compounds: list[dict[str, Any]] = []
            food_ids = [food["id"] for food in foods]
            if food_ids:
                associated_compounds = connection.execute(
                    """
                    SELECT c.public_id, c.name, c.annotation_quality,
                           c.superclass, c.class_name, c.subclass,
                           COUNT(*) AS relation_count,
                           COUNT(DISTINCT fc.food_id) AS food_match_count,
                           ARRAY_AGG(DISTINCT f.name ORDER BY f.name) AS food_names,
                           'quantified_food_relation' AS evidence_type
                    FROM food_compound fc
                    JOIN compound c ON c.id = fc.compound_id
                    JOIN food f ON f.id = fc.food_id
                    WHERE fc.food_id = ANY(%s)
                      AND fc.standard_content IS NOT NULL
                      AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0
                      AND c.name NOT LIKE '%%' || CHR(65533) || '%%'
                    GROUP BY c.id
                    ORDER BY COUNT(DISTINCT fc.food_id) DESC,
                             COUNT(*) DESC,
                             CASE c.annotation_quality
                               WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2
                             END,
                             c.name
                    LIMIT 16
                    """,
                    (food_ids,),
                ).fetchall()

                if not associated_compounds:
                    associated_compounds = connection.execute(
                        """
                        SELECT c.public_id, c.name, c.annotation_quality,
                               c.superclass, c.class_name, c.subclass,
                               COUNT(*) AS relation_count,
                               COUNT(DISTINCT fc.food_id) AS food_match_count,
                               ARRAY_AGG(DISTINCT f.name ORDER BY f.name) AS food_names,
                               'reported_food_relation' AS evidence_type
                        FROM food_compound fc
                        JOIN compound c ON c.id = fc.compound_id
                        JOIN food f ON f.id = fc.food_id
                        WHERE fc.food_id = ANY(%s)
                          AND c.name NOT LIKE '%%' || CHR(65533) || '%%'
                        GROUP BY c.id
                        ORDER BY CASE c.annotation_quality
                                   WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2
                                 END,
                                 COUNT(DISTINCT fc.food_id) DESC,
                                 c.name
                        LIMIT 16
                        """,
                        (food_ids,),
                    ).fetchall()

        compounds = [dict(row) for row in associated_compounds]
        seen = {compound["public_id"] for compound in compounds}
        for row in direct_compounds:
            compound = dict(row)
            if compound["public_id"] in seen:
                continue
            compound["evidence_type"] = "direct_compound_match"
            compounds.append(compound)
            seen.add(compound["public_id"])
            if len(compounds) >= 18:
                break

        public_foods = []
        for row in foods:
            food = dict(row)
            food.pop("id", None)
            public_foods.append(food)
        return {
            "foods": public_foods,
            "compounds": compounds,
        }

    @staticmethod
    def _meal_card(meal: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": meal.get("idMeal"),
            "name": meal.get("strMeal"),
            "image": meal.get("strMealThumb"),
            "area": meal.get("strArea"),
            "category": meal.get("strCategory"),
        }

    @staticmethod
    def sources() -> list[dict[str, str]]:
        return [
            {"name": "TheMealDB", "role": "Recipes and imagery", "url": "https://www.themealdb.com/"},
            {"name": "USDA FoodData Central", "role": "Nutrient records", "url": "https://fdc.nal.usda.gov/"},
            {"name": "FooDB", "role": "Food compounds", "url": "https://foodb.ca/"},
        ]
