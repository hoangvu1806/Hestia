from agents.food_risk_agent.tools import (
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


def test_retention_search_returns_source_and_valid_factor() -> None:
    result = search_nutrient_retention("cheese baked", "calcium", limit=3)

    assert result["status"] == "ok"
    assert result["source_url"].startswith("https://")
    assert result["matches"]
    assert result["matches"][0]["nutrient"] == "Calcium, Ca"
    assert 0 <= result["matches"][0]["retention_factor_percent"] <= 100


def test_invalid_inputs_return_stable_error() -> None:
    result = solve_food_chemistry(
        "moles",
        {"mass_g": 10, "molar_mass_g_mol": 0},
    )

    assert result["status"] == "invalid_input"
