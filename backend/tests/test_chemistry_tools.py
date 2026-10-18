import re

import pytest

from agents.food_risk_agent.food_analysis_agent import food_analysis_agent
from agents.food_risk_agent.tools import (
    get_food_safety_reference,
    normalize_name,
    resolve_food,
    search_nutrient_retention,
    solve_food_chemistry,
)


def test_mass_fraction_uses_total_mixture_mass() -> None:
    result = solve_food_chemistry(
        "mass_fraction",
        {"solute_mass_g": 20, "solvent_mass_g": 180},
    )

    assert result["status"] == "ok"
    assert result["result"]["mass_fraction_percent"] == 10


def test_mass_fraction_accepts_common_key_aliases() -> None:
    result = solve_food_chemistry(
        "mass_fraction",
        {"solute_mass_g": 30, "solution_mass_g": 1000},
    )

    assert result["status"] == "ok"
    assert result["result"]["mass_fraction_percent"] == 3


def test_solute_for_target_brine_reports_strict_and_kitchen_answers() -> None:
    result = solve_food_chemistry(
        "solute_for_mass_fraction",
        {"target_percent": 3, "water_mass_g": 1000},
    )

    assert result["status"] == "ok"
    assert result["result"]["solute_mass_g_kitchen_w_v"] == 30
    assert result["result"]["solute_mass_g_strict_w_w"] == pytest.approx(30.9278, abs=1e-4)


def test_dilution_solves_one_missing_value() -> None:
    result = solve_food_chemistry(
        "dilution",
        {
            "initial_concentration": 10,
            "initial_volume_ml": 50,
            "final_volume_ml": 200,
        },
    )

    assert result["status"] == "ok"
    assert result["solved_for"] == "final_concentration"
    assert result["result"]["final_concentration"] == 2.5


def test_stoichiometry_labels_theoretical_and_expected_yield() -> None:
    result = solve_food_chemistry(
        "stoichiometric_yield",
        {
            "reactant_mass_g": 10,
            "reactant_molar_mass_g_mol": 50,
            "reactant_coefficient": 1,
            "product_molar_mass_g_mol": 25,
            "product_coefficient": 2,
            "yield_fraction": 0.8,
        },
    )

    assert result["status"] == "ok"
    assert result["result"]["theoretical_product_mass_g"] == 10
    assert result["result"]["expected_product_mass_g"] == 8


def test_nutrient_retention_derives_initial_amount_from_per_100g() -> None:
    result = solve_food_chemistry(
        "nutrient_retention",
        {"amount_per_100g": 89, "food_mass_g": 300, "retention_factor_percent": 55},
    )

    assert result["status"] == "ok"
    assert result["result"]["initial_total"] == 267
    assert result["result"]["retained_total"] == pytest.approx(146.85)


def test_first_order_kinetics_from_half_life() -> None:
    result = solve_food_chemistry(
        "first_order_kinetics",
        {"half_life_min": 20, "time_min": 20, "initial_amount": 100},
    )

    assert result["status"] == "ok"
    assert result["result"]["fraction_remaining"] == pytest.approx(0.5)
    assert result["result"]["amount_remaining"] == pytest.approx(50)


def test_arrhenius_ratio_increases_with_temperature() -> None:
    result = solve_food_chemistry(
        "arrhenius_rate_ratio",
        {"activation_energy_kj_mol": 50, "temperature_1_c": 160, "temperature_2_c": 180},
    )

    assert result["status"] == "ok"
    assert result["result"]["rate_ratio_k2_over_k1"] == pytest.approx(1.8455, abs=1e-3)


def test_henderson_hasselbalch_round_trip() -> None:
    ratio = solve_food_chemistry("henderson_hasselbalch", {"pka": 4.76, "ph": 4.0})
    ph = solve_food_chemistry(
        "henderson_hasselbalch",
        {"pka": 4.76, "base_acid_ratio": ratio["result"]["base_acid_ratio"]},
    )

    assert ph["result"]["ph"] == pytest.approx(4.0, abs=1e-3)


def test_invalid_inputs_return_stable_error() -> None:
    result = solve_food_chemistry(
        "moles",
        {"mass_g": 10, "molar_mass_g_mol": 0},
    )

    assert result["status"] == "invalid_input"


def test_retention_search_returns_source_and_valid_factor() -> None:
    result = search_nutrient_retention("cheese baked", "calcium", limit=3)

    assert result["status"] == "ok"
    assert result["source_url"].startswith("https://")
    assert result["matches"]
    assert result["matches"][0]["nutrient"] == "Calcium, Ca"
    assert 0 <= result["matches"][0]["retention_factor_percent"] <= 100


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("boiled broccoli", "VEG"),
        ("vegetables boiled", "VEG"),
        ("fried potatoes", "POTATOES"),
        ("grilled pork", "PORK"),
    ],
)
def test_retention_search_understands_usda_abbreviations(query: str, expected: str) -> None:
    result = search_nutrient_retention(query, "vitamin C", limit=3)

    assert result["matches"]
    assert all(expected in match["process"] for match in result["matches"])
    assert all("ascorbic" in match["nutrient"].lower() for match in result["matches"])


def test_food_safety_reference_matches_keywords_and_returns_urls() -> None:
    result = get_food_safety_reference(["grilling", "leftovers"])

    topics = {item["topic"] for item in result["references"]}
    assert {"grilled_meat_hca_pah", "leftovers"} <= topics
    assert all(item["source_url"].startswith("https://") for item in result["references"])


@pytest.mark.parametrize(
    ("topics", "expected"),
    [
        (["green beans", "beef"], "legume_lectins"),
        (["bitter cassava"], "plant_toxins_overview"),
        (["puffer fish"], "natural_toxins_animal_and_wild"),
    ],
)
def test_food_safety_reference_routes_foods_to_official_toxin_sources(
    topics: list[str], expected: str
) -> None:
    result = get_food_safety_reference(topics)

    assert expected in {item["topic"] for item in result["references"]}


def test_specialist_instruction_has_no_adk_state_placeholders() -> None:
    assert re.findall(r"\{[^{}]+\}", food_analysis_agent.instruction) == []


class _Rows:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def fetchone(self) -> dict | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict]:
        return self.rows


class _FakeFoodDb:
    def __init__(self, names: list[str]) -> None:
        self.foods = [
            {"id": index, "name": name, "normalized_name": normalize_name(name)}
            for index, name in enumerate(names)
        ]

    def execute(self, sql: str, params: tuple = ()) -> _Rows:
        if "WHERE normalized_name = %s" in sql:
            return _Rows([food for food in self.foods if food["normalized_name"] == params[0]])
        return _Rows(self.foods)


FOODS = [
    "Domestic pig", "Pigeon pea", "Pollock", "Eggs", "Egg roll", "Garden tomato",
    "Cherry tomato", "Garden tomato (var.)", "Green onion", "Garden onion", "Red onion",
    "Common mushroom", "Mushrooms", "Sweet basil", "Lemon grass", "Chicken",
]


@pytest.mark.parametrize(
    ("query", "expected", "has_note"),
    [
        ("pork", "Domestic pig", False),
        ("pork belly", "Domestic pig", True),
        ("egg", "Eggs", False),
        ("tomatoes", "Garden tomato", False),
        ("scallion", "Green onion", False),
        ("onion", "Garden onion", False),
        ("basil", "Sweet basil", False),
        ("lemongrass", "Lemon grass", False),
        ("chicken breast", "Chicken", True),
    ],
)
def test_resolve_food_maps_culinary_names(query: str, expected: str, has_note: bool) -> None:
    row, score, note = resolve_food(_FakeFoodDb(FOODS), query, 0.72)

    assert row is not None and row["name"] == expected
    assert score >= 0.95
    assert (note is not None) is has_note


def test_resolve_food_rejects_weak_matches() -> None:
    row, _, _ = resolve_food(_FakeFoodDb(FOODS), "galangal", 0.72)

    assert row is None


def test_resolve_food_ignores_preparation_words() -> None:
    row, _, note = resolve_food(_FakeFoodDb(FOODS), "boiled chicken egg", 0.72)

    assert row is not None and row["name"] == "Eggs"
    assert note is None


def test_resolve_food_reports_stripped_variety_qualifier() -> None:
    row, _, note = resolve_food(_FakeFoodDb([*FOODS, "Cassava"]), "bitter cassava", 0.72)

    assert row is not None and row["name"] == "Cassava"
    assert note is not None and "bitter" in note


def test_resolve_food_never_maps_wild_species_to_cultivated() -> None:
    row, _, _ = resolve_food(_FakeFoodDb(FOODS), "wild mushroom", 0.72)

    assert row is None
