from core.config import Settings
from services.food_library import FoodLibrary


def test_usda_record_keeps_source_identity_and_selected_nutrients() -> None:
    library = FoodLibrary(Settings(environment="test"))
    record = library._usda_food(
        {
            "fdcId": 123,
            "description": "Lentils, cooked",
            "dataType": "Foundation",
            "foodCategory": "Legumes",
            "foodNutrients": [
                {"nutrientName": "Protein", "value": 9.02, "unitName": "G"},
                {"nutrientName": "Fiber, total dietary", "value": 7.9, "unitName": "G"},
                {"nutrientName": "Unrelated laboratory field", "value": 1, "unitName": "X"},
            ],
        },
        "protein",
        [{"strIngredient": "Lentils"}],
    )

    assert record["fdc_id"] == 123
    assert record["focus_nutrient"]["value"] == 9.02
    assert set(record["nutrients"]) == {"protein", "fiber"}
    assert record["source_url"].endswith("/123/nutrients")
    assert record["image_label"] == "Lentils"


def test_usda_artwork_uses_each_records_primary_food() -> None:
    catalog = [
        {"strIngredient": "Onions"},
        {"strIngredient": "Bread"},
        {"strIngredient": "Spring Onions"},
    ]

    assert FoodLibrary._ingredient_artwork("Onions, raw", catalog)["image_label"] == "Onions"
    assert FoodLibrary._ingredient_artwork("Bread, onion", catalog)["image_label"] == "Bread"
    assert (
        FoodLibrary._ingredient_artwork("Onions, green, cooked", catalog)["image_label"]
        == "Spring Onions"
    )


def test_meal_card_is_source_agnostic_and_compact() -> None:
    card = FoodLibrary._meal_card(
        {
            "idMeal": "42",
            "strMeal": "Tomato supper",
            "strMealThumb": "https://example.test/tomato.jpg",
            "strArea": "Mediterranean",
            "strCategory": "Vegetarian",
            "strInstructions": "Large field intentionally excluded",
        }
    )

    assert card == {
        "id": "42",
        "name": "Tomato supper",
        "image": "https://example.test/tomato.jpg",
        "area": "Mediterranean",
        "category": "Vegetarian",
    }
