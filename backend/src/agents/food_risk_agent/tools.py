"""Evidence tools for the food-risk ADK app.

The tools are intentionally generic: they contain no list of target compounds or
predefined cooking reactions.  Agents must discover candidates and support them
with local data and literature.
"""

from __future__ import annotations

import csv
import difflib
import json
import math
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any

from psycopg import Connection

from services.food_database import connect_food_database

BACKEND_DIR = Path(__file__).resolve().parents[3]
RETENTION_DATA = BACKEND_DIR / "dataset" / "NutrientRetention.csv"
USER_AGENT = "Hestia-food-risk-research/0.1"
USDA_RETENTION_URL = (
    "https://catalog.data.gov/dataset/usda-table-of-nutrient-retention-factors-release-6-2007"
)
GAS_CONSTANT = 8.314462618

CUT_NOTE = "Species-level FooDB record. Composition of this specific cut or part may differ."
PRODUCT_NOTE = "Closest FooDB base food. The processed product's composition may differ."
SPECIES_NOTE = "FooDB has no generic record. A representative species was used."

# Common culinary names that FooDB stores under a scientific, generic or species name.
FOOD_ALIASES: dict[str, tuple[str, str | None]] = {
    **{
        key: ("Domestic pig", None if key == "pork" else CUT_NOTE)
        for key in (
            "pork", "pig", "pork meat", "pork belly", "pork shoulder", "pork loin", "pork chop",
            "pork rib", "pork leg", "spare rib", "ground pork", "minced pork", "pork tenderloin",
        )
    },
    **{
        key: ("Chicken", CUT_NOTE)
        for key in (
            "chicken breast", "chicken thigh", "chicken wing", "chicken drumstick", "chicken leg",
            "ground chicken", "minced chicken", "whole chicken", "chicken meat",
        )
    },
    **{
        key: ("Cattle (Beef, Veal)", CUT_NOTE)
        for key in (
            "beef brisket", "ground beef", "minced beef", "beef steak", "steak", "beef shank",
            "beef tenderloin", "beef sirloin", "veal",
        )
    },
    "mutton": ("Sheep (Mutton, Lamb)", None),
    **{key: ("Mallard duck", SPECIES_NOTE) for key in ("duck", "duck meat", "duck breast")},
    **{
        key: ("Eggs", None if key in {"egg", "chicken egg"} else CUT_NOTE)
        for key in ("egg", "chicken egg", "whole egg", "egg white", "hen egg")
    },
    "tomato": ("Garden tomato", None),
    **{key: ("Garden onion", None) for key in ("onion", "yellow onion", "brown onion")},
    **{key: ("Green onion", None) for key in ("spring onion", "scallion", "green onion")},
    **{key: ("Pepper (Capsicum)", None) for key in ("bell pepper", "sweet pepper", "capsicum")},
    **{key: ("Pepper (Spice)", None) for key in ("black pepper", "white pepper", "peppercorn")},
    **{key: ("Pak choy", None) for key in ("bok choy", "pak choi")},
    **{key: ("Soy bean", None) for key in ("soybean", "soya bean")},
    **{
        key: ("Common bean", None)
        for key in ("kidney bean", "black bean", "pinto bean", "navy bean", "haricot bean")
    },
    **{key: ("Ginkgo nuts", None) for key in ("ginkgo", "ginkgo seed", "ginkgo nut")},
    **{key: ("Green bean", None) for key in ("string bean", "snap bean", "french bean")},
    **{key: ("Adzuki bean", None) for key in ("red bean", "azuki bean")},
    **{key: ("Common mushroom", None) for key in ("mushroom", "button mushroom")},
    **{key: ("Enokitake", None) for key in ("enoki", "enoki mushroom")},
    **{key: ("Jew's ear", None) for key in ("wood ear", "wood ear mushroom", "black fungus")},
    "oyster": ("True oyster", None),
    "mussel": ("Blue mussel", SPECIES_NOTE),
    "salmon": ("Atlantic salmon", SPECIES_NOTE),
    "tuna": ("Scombridae (Bonito, Mackerel, Tuna)", SPECIES_NOTE),
    "mackerel": ("Scombridae (Bonito, Mackerel, Tuna)", SPECIES_NOTE),
    "sardine": ("Clupeinae (Herring, Sardine, Sprat)", SPECIES_NOTE),
    "herring": ("Clupeinae (Herring, Sardine, Sprat)", SPECIES_NOTE),
    "cod": ("Atlantic cod", SPECIES_NOTE),
    "octopus": ("Common octopus", None),
    "lobster": ("American lobster", SPECIES_NOTE),
    "goose": ("Greylag goose", SPECIES_NOTE),
    "frog": ("True frog", None),
    "prawn": ("Shrimp", None),
    **{key: ("Milk (Cow)", None) for key in ("milk", "cow milk", "whole milk", "fresh milk")},
    "vegetable oil": ("Cooking oil", None),
    "bitter melon": ("Bitter gourd", None),
    **{key: ("Common pea", None) for key in ("pea", "green pea", "garden pea")},
    "orange": ("Sweet orange", None),
    "wine": ("Grape wine", None),
    "mint": ("Spearmint", SPECIES_NOTE),
    **{key: ("Domestic pig", PRODUCT_NOTE) for key in ("bacon", "ham", "pork sausage")},
    **{
        key: ("Rice", PRODUCT_NOTE)
        for key in (
            "rice noodle", "rice vermicelli", "pho noodle", "glutinous rice", "sticky rice",
            "jasmine rice", "white rice", "cooked rice",
        )
    },
    **{key: ("Flour", None) for key in ("wheat flour", "all purpose flour", "plain flour")},
    "bread": ("White bread", None),
    **{key: ("Pasta", PRODUCT_NOTE) for key in ("noodle", "egg noodle", "wheat noodle")},
    **{key: ("Mung bean", PRODUCT_NOTE) for key in ("bean sprout", "mung bean sprout")},
}

# Extra qualifiers FooDB adds to otherwise generic food names.
GENERIC_QUALIFIERS = {"garden", "common", "domestic", "sweet", "true", "var"}
# Preparation or state words that do not change which food is meant.
FOOD_STATE_WORDS = {
    "raw", "fresh", "boiled", "fried", "grilled", "roasted", "baked", "steamed", "cooked",
    "smoked", "sliced", "chopped", "minced", "diced", "peeled", "frozen", "canned", "leftover",
    "meat", "organic", "hard", "soft", "ripe", "unripe",
}
# Variety or condition words. Stripped only as a last resort and always reported, because they
# can change composition (a bitter variety, a sprouted tuber). "wild" is deliberately absent:
# an unidentified wild species must never be mapped onto a cultivated one.
VARIETY_QUALIFIERS = {
    "bitter", "sprouted", "sprouting", "green", "red", "white", "yellow", "black", "young",
    "baby", "old", "dry", "dried",
}
QUALIFIER_NOTE = (
    "Matched the base food after removing '{removed}'. That variety or condition can change "
    "composition and toxicant levels."
)

COMPOUND_SYNONYMS: dict[str, tuple[str, ...]] = {
    "vitamin c": ("ascorbic acid", "ascorbate"),
    "vitamin e": ("tocopherol", "tocotrienol"),
    "vitamin a": ("retinol", "carotene"),
    "vitamin b1": ("thiamin",),
    "vitamin b2": ("riboflavin",),
    "vitamin b3": ("niacin", "nicotinic acid", "nicotinamide"),
    "vitamin b6": ("pyridox",),
    "vitamin b9": ("folic acid", "folate"),
    "folate": ("folic acid", "folate"),
    "vitamin b12": ("cobalamin",),
    "vitamin d": ("calciferol",),
    "vitamin k": ("phylloquinone", "menaquinone"),
    "omega 3": ("linolenic", "eicosapentaenoic", "docosahexaenoic"),
    "reducing sugar": ("glucose", "fructose", "maltose", "lactose"),
    "sugar": ("sucrose", "glucose", "fructose"),
    "caffeine": ("caffeine",),
}


def normalize_name(value: str) -> str:
    """Normalize a food/chemical name for conservative local matching."""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _singular(token: str) -> str:
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 4 and token.endswith(("ches", "shes", "xes", "oes")):
        return token[:-2]
    if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def _food_key(value: str) -> str:
    return " ".join(_singular(token) for token in normalize_name(value).split())


def resolve_food(
    connection: Connection[dict[str, Any]], query: str, min_score: float
) -> tuple[dict[str, Any] | None, float, str | None]:
    """Resolve a culinary name to one FooDB food, returning (row, score, match note)."""
    row, score, note = _resolve_food_name(connection, query, min_score)
    if row is not None:
        return row, score, note
    tokens = _food_key(query).split()
    core = [token for token in tokens if token not in FOOD_STATE_WORDS]
    if core and len(core) < len(tokens):
        stripped = _resolve_food_name(connection, " ".join(core), min_score)
        if stripped[0] is not None:
            return stripped
    removed = [token for token in core if token in VARIETY_QUALIFIERS]
    base = [token for token in core if token not in VARIETY_QUALIFIERS]
    if removed and base:
        found, found_score, found_note = _resolve_food_name(connection, " ".join(base), min_score)
        if found is not None:
            qualifier = QUALIFIER_NOTE.format(removed=" ".join(removed))
            return found, found_score, " ".join(filter(None, (qualifier, found_note)))
    return row, score, note


def _resolve_food_name(
    connection: Connection[dict[str, Any]], query: str, min_score: float
) -> tuple[dict[str, Any] | None, float, str | None]:
    normalized_query = normalize_name(query)
    if not normalized_query:
        return None, 0.0, None
    exact = connection.execute(
        "SELECT * FROM food WHERE normalized_name = %s ORDER BY id LIMIT 1",
        (normalized_query,),
    ).fetchone()
    if exact:
        return exact, 1.0, None

    key = _food_key(query)
    foods = connection.execute("SELECT * FROM food").fetchall()
    by_name = {food["normalized_name"]: food for food in foods}
    alias = FOOD_ALIASES.get(key)
    if alias and (row := by_name.get(normalize_name(alias[0]))):
        return row, 1.0, alias[1]

    compact_key = key.replace(" ", "")
    for food in foods:
        candidate_key = _food_key(food["normalized_name"])
        if candidate_key == key or candidate_key.replace(" ", "") == compact_key:
            return food, 0.99, None

    query_tokens = set(key.split())
    generic = [
        food
        for food in foods
        if query_tokens < (tokens := set(_food_key(food["normalized_name"]).split()))
        and tokens - query_tokens <= GENERIC_QUALIFIERS
    ]
    if generic:
        return min(generic, key=lambda food: len(food["name"])), 0.97, None

    scored: list[tuple[float, dict[str, Any], set[str]]] = []
    for food in foods:
        candidate = _food_key(food["normalized_name"])
        candidate_tokens = set(candidate.split())
        score = difflib.SequenceMatcher(None, key, candidate).ratio()
        if query_tokens and query_tokens <= candidate_tokens:
            score = max(score, 0.9 + 0.1 * len(query_tokens) / len(candidate_tokens))
        scored.append((score, food, candidate_tokens))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return None, 0.0, None

    best_score, best_row, best_tokens = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    margin = best_score - second_score
    if best_tokens < query_tokens:
        return None, best_score, None
    if query_tokens < best_tokens:
        accepted = best_score >= max(min_score, 0.9) and margin >= 0.05
        return (best_row, best_score, None) if accepted else (None, best_score, None)
    accepted = best_score >= max(min_score, 0.84) and margin >= 0.05
    return (best_row, best_score, None) if accepted else (None, best_score, None)


def best_food_match(
    connection: Connection[dict[str, Any]], query: str, min_score: float
) -> tuple[dict[str, Any] | None, float]:
    """Return a safe FooDB text match without collapsing a specific food to a broad one."""
    row, score, _ = resolve_food(connection, query, min_score)
    return row, score


def food_candidates(
    connection: Connection[dict[str, Any]], query: str, limit: int = 5
) -> list[dict[str, Any]]:
    """Return nearest FooDB foods for an unresolved name without auto-accepting one."""
    key = _food_key(query)
    query_tokens = set(key.split())
    scored: list[tuple[float, dict[str, Any]]] = []
    for food in connection.execute("SELECT * FROM food").fetchall():
        candidate = _food_key(food["normalized_name"])
        candidate_tokens = set(candidate.split())
        score = difflib.SequenceMatcher(None, key, candidate).ratio()
        if query_tokens and query_tokens <= candidate_tokens:
            score = max(score, 0.9 + 0.1 * len(query_tokens) / len(candidate_tokens))
        elif candidate_tokens and candidate_tokens <= query_tokens:
            score = max(score, 0.8 + 0.1 * len(candidate_tokens) / len(query_tokens))
        scored.append((score, food))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "foodb_id": food["public_id"],
            "name": food["name"],
            "group": food["food_group"],
        }
        for _, food in scored[: max(1, min(limit, 10))]
    ]


def _connection() -> Connection[dict[str, Any]]:
    return connect_food_database()


def _get_json(url: str, timeout: int = 20) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def compound_record(row: dict[str, Any]) -> dict[str, Any]:
    """Return a compact compound record with a ready-to-localize library tag."""
    item = {
        key: row.get(key)
        for key in (
            "public_id", "name", "superclass", "class_name", "cas_number", "standard_content",
            "original_unit", "food_part", "preparation_type", "citation",
        )
        if row.get(key) not in (None, "")
    }
    content = row.get("standard_content")
    try:
        quantified = content is not None and float(content) > 0
    except (TypeError, ValueError):
        quantified = False
    item["evidence"] = "quantified" if quantified else "reported"
    public_id = row.get("public_id")
    name = row.get("name")
    if public_id and name:
        item["library_tag"] = f"[compound:{name}|{name.casefold()}|{public_id}]"
    return item


def _same_species_foods(
    connection: Connection[dict[str, Any]], food: dict[str, Any], limit: int = 8
) -> list[dict[str, str]]:
    """List other FooDB foods of the same species, then genus, so hazards can be linked."""
    scientific = (food.get("scientific_name") or "").strip()
    genus = scientific.split()[0] if scientific else ""
    if len(genus) < 3:
        return []
    rows = connection.execute(
        """
        SELECT name, scientific_name,
               CASE WHEN scientific_name = %s THEN 'same species' ELSE 'same genus' END AS link
        FROM food
        WHERE id <> %s AND (scientific_name = %s OR scientific_name LIKE %s)
        ORDER BY (scientific_name <> %s), length(name)
        LIMIT %s
        """,
        (scientific, food["id"], scientific, f"{genus} %", scientific, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def _compound_patterns(query: str) -> list[str]:
    key = normalize_name(query)
    terms = [query.strip().casefold(), *COMPOUND_SYNONYMS.get(key, ())]
    return [f"%{term}%" for term in dict.fromkeys(terms) if term]


def _find_compounds(
    connection: Connection[dict[str, Any]],
    food_id: int,
    query: str,
    *,
    quantified_only: bool,
    limit: int,
) -> list[dict[str, Any]]:
    patterns = _compound_patterns(query)
    clauses = " OR ".join(
        "LOWER(c.name) LIKE %s OR LOWER(COALESCE(c.superclass, '')) LIKE %s "
        "OR LOWER(COALESCE(c.class_name, '')) LIKE %s "
        "OR LOWER(COALESCE(c.subclass, '')) LIKE %s"
        for _ in patterns
    )
    quantified_filter = (
        "AND fc.standard_content IS NOT NULL "
        "AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0"
        if quantified_only
        else ""
    )
    params: list[Any] = [food_id]
    for pattern in patterns:
        params.extend([pattern] * 4)
    params.append(limit)
    return connection.execute(
        f"""
        SELECT * FROM (
            SELECT DISTINCT ON (c.id)
                   c.public_id, c.name, c.annotation_quality, c.cas_number,
                   c.superclass, c.class_name, c.subclass, fc.standard_content,
                   fc.original_unit, fc.food_part, fc.preparation_type, fc.citation
            FROM food_compound fc JOIN compound c ON c.id = fc.compound_id
            WHERE fc.food_id = %s {quantified_filter} AND ({clauses})
            ORDER BY c.id,
                     (fc.standard_content IS NULL
                      OR CAST(fc.standard_content AS DOUBLE PRECISION) <= 0),
                     (fc.citation IS NULL)
        ) AS hits
        ORDER BY (standard_content IS NULL
                  OR CAST(standard_content AS DOUBLE PRECISION) <= 0),
                 CASE annotation_quality WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 length(name)
        LIMIT %s
        """,
        params,
    ).fetchall()


def _number(inputs: dict[str, float], key: str, *, positive: bool = False) -> float:
    """Read a finite numeric tool input and return a stable public error on invalid values."""
    if key not in inputs:
        raise ValueError(f"Missing required input: {key}")
    value = float(inputs[key])
    if not math.isfinite(value):
        raise ValueError(f"Input must be finite: {key}")
    if positive and value <= 0:
        raise ValueError(f"Input must be greater than zero: {key}")
    return value


INPUT_ALIASES = {
    "solution_mass_g": "total_mass_g",
    "mixture_mass_g": "total_mass_g",
    "solute_g": "solute_mass_g",
    "salt_mass_g": "solute_mass_g",
    "solvent_g": "solvent_mass_g",
    "water_mass_g": "solvent_mass_g",
    "water_volume_ml": "solvent_volume_ml",
    "target_mass_fraction_percent": "target_percent",
    "percent": "target_percent",
    "molar_mass": "molar_mass_g_mol",
    "mass": "mass_g",
    "initial_nutrient_mg": "initial_amount",
    "initial_amount_mg": "initial_amount",
    "initial_mg": "initial_amount",
    "retention_percent": "retention_factor_percent",
    "retention_factor": "retention_factor_percent",
    "nutrient_per_100g": "amount_per_100g",
    "amount_per_100_g": "amount_per_100g",
    "food_mass": "food_mass_g",
    "temperature_c": "actual_temperature_c",
    "z_value": "z_value_c",
    "z_c": "z_value_c",
    "k_per_min": "rate_constant_per_min",
    "half_life": "half_life_min",
    "ea_kj_mol": "activation_energy_kj_mol",
    "t1_c": "temperature_1_c",
    "t2_c": "temperature_2_c",
    "ratio_base_acid": "base_acid_ratio",
}

SUPPORTED_OPERATIONS = (
    "mass_fraction",
    "solute_for_mass_fraction",
    "dilution",
    "moles",
    "stoichiometric_yield",
    "nutrient_retention",
    "thermal_equivalent_time",
    "first_order_kinetics",
    "arrhenius_rate_ratio",
    "henderson_hasselbalch",
)


def solve_food_chemistry(operation: str, inputs: dict[str, float]) -> dict[str, Any]:
    """Run a deterministic, unit-explicit chemistry calculation.

    Operations and their input keys (masses g, volumes mL, temperatures °C, times min):
    - mass_fraction: solute_mass_g and either total_mass_g or solvent_mass_g.
    - solute_for_mass_fraction: target_percent and one of solvent_mass_g (water mass, returns
      both strict w/w and kitchen w/v answers), total_mass_g, or solvent_volume_ml (w/v).
    - dilution: exactly three of initial_concentration, initial_volume_ml,
      final_concentration, final_volume_ml (C1V1 = C2V2).
    - moles: mass_g, molar_mass_g_mol.
    - stoichiometric_yield: reactant_mass_g, reactant_molar_mass_g_mol, reactant_coefficient,
      product_molar_mass_g_mol, product_coefficient, optional purity_fraction and
      yield_fraction (0..1).
    - nutrient_retention: retention_factor_percent and either initial_amount or
      amount_per_100g plus food_mass_g. Optional edible_yield_fraction, servings.
    - thermal_equivalent_time: actual_time_min, actual_temperature_c,
      reference_temperature_c, z_value_c.
    - first_order_kinetics: rate_constant_per_min or half_life_min, plus time_min to get the
      remaining fraction, or target_fraction_remaining to get the time. Optional
      initial_amount.
    - arrhenius_rate_ratio: activation_energy_kj_mol, temperature_1_c, temperature_2_c.
    - henderson_hasselbalch: pka and either base_acid_ratio (returns pH) or ph (returns
      the base/acid ratio).

    Returns the formula, substitution, result with units, assumptions and limitations. This
    tool performs arithmetic only. It does not establish that a reaction occurs or that a
    serving is safe.
    """
    kind = normalize_name(operation).replace(" ", "_")
    inputs = {
        INPUT_ALIASES.get(normalize_name(str(key)).replace(" ", "_"), str(key)): value
        for key, value in (inputs or {}).items()
    }
    try:
        if kind == "mass_fraction":
            solute = _number(inputs, "solute_mass_g")
            total = inputs.get("total_mass_g")
            if total is None:
                total = solute + _number(inputs, "solvent_mass_g")
            total = float(total)
            if total <= 0 or solute < 0 or solute > total:
                raise ValueError("Require 0 <= solute_mass_g <= total_mass_g")
            result = 100 * solute / total
            return {
                "status": "ok",
                "operation": kind,
                "formula": "mass fraction (%) = solute mass / total mixture mass × 100",
                "substitution": f"{solute:g} g / {total:g} g × 100",
                "result": {"mass_fraction_percent": round(result, 6)},
                "assumptions": ["Masses refer to the final mixture on the same basis."],
                "limitations": ["This does not estimate water activity or microbial safety."],
            }

        if kind == "solute_for_mass_fraction":
            percent = _number(inputs, "target_percent", positive=True)
            if percent >= 100:
                raise ValueError("target_percent must be below 100")
            if "solvent_mass_g" in inputs:
                solvent = _number(inputs, "solvent_mass_g", positive=True)
                strict = percent * solvent / (100 - percent)
                kitchen = percent * solvent / 100
                return {
                    "status": "ok",
                    "operation": kind,
                    "formula": "w/w: m_solute = p × m_solvent / (100 − p) | kitchen w/v: "
                    "m_solute = p × V / 100",
                    "substitution": (
                        f"{percent:g} × {solvent:g} / (100 − {percent:g}) and "
                        f"{percent:g} × {solvent:g} / 100"
                    ),
                    "result": {
                        "solute_mass_g_strict_w_w": round(strict, 4),
                        "total_mass_g_strict_w_w": round(solvent + strict, 4),
                        "solute_mass_g_kitchen_w_v": round(kitchen, 4),
                        "actual_w_w_percent_of_kitchen_rule": round(
                            100 * kitchen / (solvent + kitchen), 4
                        ),
                    },
                    "assumptions": [
                        "The kitchen w/v rule treats 1 mL water as 1 g and counts grams of "
                        "solute per 100 mL of water."
                    ],
                    "limitations": ["Ignores solute already present in the food."],
                }
            if "total_mass_g" in inputs:
                total = _number(inputs, "total_mass_g", positive=True)
                solute = percent * total / 100
                return {
                    "status": "ok",
                    "operation": kind,
                    "formula": "m_solute = p × m_total / 100",
                    "substitution": f"{percent:g} × {total:g} / 100",
                    "result": {
                        "solute_mass_g": round(solute, 4),
                        "solvent_mass_g": round(total - solute, 4),
                    },
                }
            volume = _number(inputs, "solvent_volume_ml", positive=True)
            solute = percent * volume / 100
            return {
                "status": "ok",
                "operation": kind,
                "formula": "w/v: m_solute (g) = p × V (mL) / 100",
                "substitution": f"{percent:g} × {volume:g} / 100",
                "result": {"solute_mass_g_w_v": round(solute, 4)},
                "assumptions": ["Percent means grams of solute per 100 mL of liquid."],
            }

        if kind == "dilution":
            fields = (
                "initial_concentration",
                "initial_volume_ml",
                "final_concentration",
                "final_volume_ml",
            )
            known = {key: float(inputs[key]) for key in fields if key in inputs}
            missing = [key for key in fields if key not in known]
            if len(missing) != 1:
                raise ValueError(
                    "Provide exactly three concentration/volume values; "
                    "leave only the value to solve for absent"
                )
            if any(value <= 0 for value in known.values()):
                raise ValueError("Dilution inputs must be greater than zero")
            key = missing[0]
            if key == "initial_concentration":
                value = (
                    known["final_concentration"]
                    * known["final_volume_ml"]
                    / known["initial_volume_ml"]
                )
            elif key == "initial_volume_ml":
                value = (
                    known["final_concentration"]
                    * known["final_volume_ml"]
                    / known["initial_concentration"]
                )
            elif key == "final_concentration":
                value = (
                    known["initial_concentration"]
                    * known["initial_volume_ml"]
                    / known["final_volume_ml"]
                )
            else:
                value = (
                    known["initial_concentration"]
                    * known["initial_volume_ml"]
                    / known["final_concentration"]
                )
            return {
                "status": "ok",
                "operation": kind,
                "formula": "C₁V₁ = C₂V₂",
                "solved_for": key,
                "result": {key: round(value, 6)},
                "units": "Concentrations retain the caller's shared unit; volumes are mL.",
                "assumptions": [
                    "The same concentration basis is used on both sides.",
                    "Volumes are additive.",
                ],
                "limitations": [
                    "Not valid for buffered-food pH prediction or non-ideal volume contraction."
                ],
            }

        if kind == "moles":
            mass = _number(inputs, "mass_g")
            molar_mass = _number(inputs, "molar_mass_g_mol", positive=True)
            moles = mass / molar_mass
            return {
                "status": "ok",
                "operation": kind,
                "formula": "n = m / M",
                "substitution": f"{mass:g} g / {molar_mass:g} g·mol⁻¹",
                "result": {"amount_mol": round(moles, 9)},
                "limitations": [
                    "Purity and hydration state must already be reflected in the input "
                    "mass or molar mass."
                ],
            }

        if kind == "stoichiometric_yield":
            reactant_mass = _number(inputs, "reactant_mass_g")
            reactant_molar_mass = _number(inputs, "reactant_molar_mass_g_mol", positive=True)
            reactant_coefficient = _number(inputs, "reactant_coefficient", positive=True)
            product_molar_mass = _number(inputs, "product_molar_mass_g_mol", positive=True)
            product_coefficient = _number(inputs, "product_coefficient", positive=True)
            purity = float(inputs.get("purity_fraction", 1.0))
            expected_yield = float(inputs.get("yield_fraction", 1.0))
            if not 0 <= purity <= 1 or not 0 <= expected_yield <= 1:
                raise ValueError("purity_fraction and yield_fraction must be between 0 and 1")
            reactant_mol = reactant_mass * purity / reactant_molar_mass
            product_mol = reactant_mol * product_coefficient / reactant_coefficient
            theoretical_mass = product_mol * product_molar_mass
            return {
                "status": "ok",
                "operation": kind,
                "formula": (
                    "m(product) = m(reactant) × purity / M(reactant) × "
                    "ν(product)/ν(reactant) × M(product)"
                ),
                "result": {
                    "reactant_amount_mol": round(reactant_mol, 9),
                    "theoretical_product_mass_g": round(theoretical_mass, 6),
                    "expected_product_mass_g": round(theoretical_mass * expected_yield, 6),
                },
                "assumptions": [
                    "The supplied reactant is limiting.",
                    "Stoichiometric coefficients describe the intended reaction.",
                ],
                "limitations": [
                    "This arithmetic does not prove that the reaction occurs in the food matrix."
                ],
            }

        if kind == "nutrient_retention":
            if "initial_amount" in inputs:
                initial = _number(inputs, "initial_amount")
                initial_note = None
            else:
                per_100g = _number(inputs, "amount_per_100g")
                food_mass = _number(inputs, "food_mass_g", positive=True)
                initial = per_100g * food_mass / 100
                initial_note = f"{per_100g:g} × {food_mass:g} g / 100 g"
            factor = _number(inputs, "retention_factor_percent")
            yield_factor = float(inputs.get("edible_yield_fraction", 1.0))
            servings = float(inputs.get("servings", 1.0))
            if initial < 0 or not 0 <= factor <= 100 or not 0 < yield_factor <= 1 or servings <= 0:
                raise ValueError(
                    "Require initial_amount >= 0, retention 0..100, edible yield 0..1, "
                    "and servings > 0"
                )
            retained = initial * factor / 100 * yield_factor
            result = {
                "initial_total": round(initial, 6),
                "retained_total": round(retained, 6),
                "lost_total": round(initial - retained, 6),
                "retained_per_serving": round(retained / servings, 6),
            }
            return {
                "status": "ok",
                "operation": kind,
                "formula": "retained amount = initial amount × retention factor × edible yield",
                "substitution": (
                    (f"initial = {initial_note}, " if initial_note else "")
                    + f"{initial:g} × {factor:g}% × {yield_factor:g}"
                ),
                "result": result,
                "units": "Results retain the unit of the initial amount.",
                "limitations": [
                    "A retention factor is a category-level estimate, not a laboratory "
                    "measurement of this dish."
                ],
            }

        if kind == "thermal_equivalent_time":
            if "actual_time_min" not in inputs and "time_min" in inputs:
                inputs["actual_time_min"] = inputs["time_min"]
            actual_time = _number(inputs, "actual_time_min")
            actual_temperature = _number(inputs, "actual_temperature_c")
            reference_temperature = _number(inputs, "reference_temperature_c")
            z_value = _number(inputs, "z_value_c", positive=True)
            equivalent = actual_time * 10 ** (
                (actual_temperature - reference_temperature) / z_value
            )
            return {
                "status": "ok",
                "operation": kind,
                "formula": "F_ref = t × 10^((T − T_ref) / z)",
                "substitution": (
                    f"{actual_time:g} × 10^(({actual_temperature:g} − "
                    f"{reference_temperature:g}) / {z_value:g})"
                ),
                "result": {"equivalent_time_at_reference_min": round(equivalent, 9)},
                "assumptions": [
                    "Temperature is constant and the supplied z-value applies to the "
                    "target process."
                ],
                "limitations": [
                    "Do not use for food-safety validation without an authoritative "
                    "target process and measured product temperature."
                ],
            }

        if kind == "first_order_kinetics":
            if "rate_constant_per_min" in inputs:
                k = _number(inputs, "rate_constant_per_min", positive=True)
            else:
                k = math.log(2) / _number(inputs, "half_life_min", positive=True)
            half_life = math.log(2) / k
            if "target_fraction_remaining" in inputs:
                target = _number(inputs, "target_fraction_remaining", positive=True)
                if target >= 1:
                    raise ValueError("target_fraction_remaining must be between 0 and 1")
                time_needed = -math.log(target) / k
                return {
                    "status": "ok",
                    "operation": kind,
                    "formula": "t = −ln(C/C₀) / k",
                    "substitution": f"−ln({target:g}) / {k:.6g} min⁻¹",
                    "result": {
                        "time_min": round(time_needed, 6),
                        "rate_constant_per_min": round(k, 9),
                        "half_life_min": round(half_life, 6),
                    },
                    "assumptions": ["First-order kinetics at constant temperature."],
                }
            time = _number(inputs, "time_min")
            if time < 0:
                raise ValueError("time_min must be >= 0")
            fraction = math.exp(-k * time)
            result = {
                "fraction_remaining": round(fraction, 9),
                "percent_remaining": round(100 * fraction, 6),
                "rate_constant_per_min": round(k, 9),
                "half_life_min": round(half_life, 6),
            }
            if "initial_amount" in inputs:
                result["amount_remaining"] = round(_number(inputs, "initial_amount") * fraction, 6)
            return {
                "status": "ok",
                "operation": kind,
                "formula": "C = C₀ × e^(−k t), t½ = ln 2 / k",
                "substitution": f"e^(−{k:.6g} × {time:g})",
                "result": result,
                "assumptions": ["First-order kinetics at constant temperature."],
                "limitations": ["k must come from a source matching this food and process."],
            }

        if kind == "arrhenius_rate_ratio":
            ea = _number(inputs, "activation_energy_kj_mol", positive=True)
            t1 = _number(inputs, "temperature_1_c") + 273.15
            t2 = _number(inputs, "temperature_2_c") + 273.15
            if t1 <= 0 or t2 <= 0:
                raise ValueError("Temperatures must be above absolute zero")
            ratio = math.exp(ea * 1000 / GAS_CONSTANT * (1 / t1 - 1 / t2))
            return {
                "status": "ok",
                "operation": kind,
                "formula": "k₂/k₁ = exp[(Ea/R) × (1/T₁ − 1/T₂)]",
                "substitution": (
                    f"exp[({ea:g} × 1000 / 8.314) × (1/{t1:.2f} − 1/{t2:.2f})]"
                ),
                "result": {"rate_ratio_k2_over_k1": round(ratio, 6)},
                "assumptions": ["Ea is constant across the temperature range."],
                "limitations": ["Ea must come from a source matching this reaction and matrix."],
            }

        if kind == "henderson_hasselbalch":
            pka = _number(inputs, "pka")
            if "base_acid_ratio" in inputs:
                ratio = _number(inputs, "base_acid_ratio", positive=True)
                ph = pka + math.log10(ratio)
                return {
                    "status": "ok",
                    "operation": kind,
                    "formula": "pH = pKa + log₁₀([A⁻]/[HA])",
                    "substitution": f"{pka:g} + log₁₀({ratio:g})",
                    "result": {"ph": round(ph, 4)},
                    "assumptions": ["Dilute ideal buffer, activity effects ignored."],
                }
            ph = _number(inputs, "ph")
            ratio = 10 ** (ph - pka)
            return {
                "status": "ok",
                "operation": kind,
                "formula": "[A⁻]/[HA] = 10^(pH − pKa)",
                "substitution": f"10^({ph:g} − {pka:g})",
                "result": {
                    "base_acid_ratio": round(ratio, 6),
                    "percent_ionized": round(100 * ratio / (1 + ratio), 4),
                },
                "assumptions": ["Dilute ideal buffer, activity effects ignored."],
            }
    except (TypeError, ValueError) as exc:
        return {
            "status": "invalid_input",
            "operation": kind,
            "message": str(exc),
            "received_keys": sorted(inputs),
        }

    return {
        "status": "unsupported_operation",
        "operation": kind,
        "supported_operations": list(SUPPORTED_OPERATIONS),
    }


RETENTION_TOKEN_MAP = {
    "veg": "vegetable", "ckd": "cooked", "cook": "cooked", "bld": "boiled", "boild": "boiled",
    "boil": "boiled", "boiling": "boiled", "simmrd": "simmered", "simr": "simmered",
    "simmr": "simmered", "simrd": "simmered", "simm": "simmered", "simmer": "simmered",
    "simmering": "simmered", "poach": "simmered", "poached": "simmered", "brwn": "browned",
    "brown": "browned", "bkd": "baked", "bake": "baked", "baking": "baked", "frsh": "fresh",
    "drnd": "drained", "draind": "drained", "drain": "drained", "frzn": "frozen",
    "frn": "frozen", "brld": "broiled", "broil": "broiled", "grilled": "broiled",
    "grill": "broiled", "grilling": "broiled", "brais": "braised", "brsd": "braised",
    "braise": "braised", "fryd": "fried", "fry": "fried", "frying": "fried",
    "stuffd": "stuffed", "wtr": "water", "drip": "drippings", "dripping": "drippings",
    "drippng": "drippings", "drippngs": "drippings", "sweetpotaotes": "sweetpotato",
    "steam": "steamed", "steaming": "steamed", "roast": "roasted", "roasting": "roasted",
    "stew": "stewed", "stewing": "stewed", "saute": "sauteed", "sauteing": "sauteed",
    "reheat": "reheated", "reheating": "reheated", "w": "with", "wo": "without",
}
RETENTION_STOPWORDS = {"with", "without", "etc", "and", "in", "the", "of", "a", "approx", "o"}
RETENTION_PROCESS_WORDS = {
    *RETENTION_TOKEN_MAP.values(), "cooked", "used", "cover", "little", "raw", "heated",
    "canned", "dried", "stored", "hot", "liquid", "flamed", "overnight", "hr", "min",
}
RETENTION_FOOD_HINTS = {
    **{
        name: ("vegetable", "green")
        for name in (
            "spinach", "kale", "lettuce", "chard", "collard", "green", "mustard", "watercress",
            "bok", "choy", "morning", "glory",
        )
    },
    **{
        name: ("vegetable", "root")
        for name in ("carrot", "beet", "turnip", "radish", "parsnip", "taro", "cassava")
    },
    **{
        name: ("vegetable",)
        for name in (
            "vegetable", "broccoli", "cauliflower", "cabbage", "zucchini", "squash", "pumpkin",
            "eggplant", "pepper", "tomato", "okra", "asparagus", "celery", "corn", "onion",
            "mushroom", "bean", "pea",
        )
    },
    **{
        name: ("finfish",)
        for name in ("fish", "salmon", "tuna", "cod", "tilapia", "mackerel", "catfish", "carp")
    },
    **{
        name: ("shellfish", "seafood")
        for name in ("shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "squid")
    },
    **{name: ("legume",) for name in ("lentil", "chickpea", "legume", "soybean")},
    "sweet": ("sweetpotato",),
    "noodle": ("pasta",),
    "duck": ("chicken",),
}


def _retention_tokens(text: str) -> set[str]:
    tokens = set()
    for raw in normalize_name(text).split():
        token = RETENTION_TOKEN_MAP.get(raw, raw)
        token = _singular(RETENTION_TOKEN_MAP.get(token, token))
        if token and token not in RETENTION_STOPWORDS:
            tokens.add(token)
    return tokens


def _nutrient_key(text: str) -> str:
    return re.sub(r"\b([a-z]) (\d+)\b", r"\1\2", normalize_name(text))


@lru_cache(maxsize=1)
def _retention_rows() -> tuple[dict[str, Any], ...]:
    if not RETENTION_DATA.is_file():
        raise FileNotFoundError(f"USDA retention dataset is missing: {RETENTION_DATA}")
    rows: list[dict[str, Any]] = []
    with RETENTION_DATA.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            try:
                factor = float(row.get("Retn_Factor") or "")
            except ValueError:
                continue
            if not 0 <= factor <= 100:
                continue
            rows.append(
                {
                    "retention_code": row.get("Retn_Code"),
                    "food_group_code": row.get("FdGrp_CD"),
                    "process": row.get("RetnDesc") or "",
                    "nutrient_number": row.get("Nutr_No"),
                    "nutrient": row.get("NutrDesc") or "",
                    "retention_factor_percent": factor,
                }
            )
    return tuple(rows)


def search_nutrient_retention(
    process_query: str, nutrient_query: str = "", limit: int = 8
) -> dict[str, Any]:
    """Find USDA nutrient-retention factors by food category, cooking process and nutrient.

    Args:
        process_query: Food plus preparation, for example "boiled broccoli", "baked fish" or
            "fried potatoes". USDA groups foods into categories such as vegetable greens,
            vegetable roots, potatoes, finfish, shellfish, pork, beef, chicken and legumes.
        nutrient_query: Optional nutrient name such as vitamin C, calcium, or folate.
        limit: Maximum matched rows to return.

    Returns:
        Ranked USDA Release 6 rows. Factors are category estimates and require a separate initial
        nutrient amount before an amount retained can be calculated.
    """
    process_tokens = _retention_tokens(process_query)
    for token in list(process_tokens):
        process_tokens.update(RETENTION_FOOD_HINTS.get(token, ()))
    nutrient = _nutrient_key(nutrient_query)
    if not process_tokens:
        return {"status": "invalid_input", "message": "process_query cannot be empty"}
    nutrient_terms = (
        [nutrient, *(_nutrient_key(term) for term in COMPOUND_SYNONYMS.get(nutrient, ()))]
        if nutrient
        else []
    )

    def weight(tokens: set[str]) -> float:
        return sum(1.0 if token in RETENTION_PROCESS_WORDS else 2.0 for token in tokens)

    query_weight = weight(process_tokens)
    scored: list[tuple[float, dict[str, Any]]] = []
    for row in _retention_rows():
        row_tokens = _retention_tokens(str(row["process"]))
        shared = process_tokens & row_tokens
        if not shared:
            continue
        process_score = weight(shared) / query_weight + 0.15 * len(shared) / max(
            len(row_tokens), 1
        )
        nutrient_score = 1.0
        if nutrient_terms:
            row_tokens_nutrient = set(_nutrient_key(str(row["nutrient"])).split())
            if not any(set(term.split()) <= row_tokens_nutrient for term in nutrient_terms):
                continue
        score = 0.72 * process_score + 0.28 * nutrient_score
        if process_score >= 0.3:
            scored.append((score, row))

    scored.sort(key=lambda item: (-item[0], item[1]["process"], item[1]["nutrient"]))
    matches = [
        {"match_score": round(score, 3), **row}
        for score, row in scored[: max(1, min(int(limit), 30))]
    ]
    return {
        "status": "ok" if matches else "no_match",
        "query": {"process": process_query, "nutrient": nutrient_query or None},
        "matched_terms": sorted(process_tokens),
        "matches": matches,
        "source": "USDA Table of Nutrient Retention Factors, Release 6",
        "source_url": USDA_RETENTION_URL,
        "interpretation": (
            "Retention factors are category-level percentages. Pick the closest category and "
            "process (for example water used vs drained), name the category mismatch, and do "
            "not present the result as a measured value."
        ),
    }


def get_food_chemical_profile(
    food_names: list[str],
    max_compounds_per_food: int = 8,
    focus_compounds: list[str] | None = None,
) -> dict[str, Any]:
    """Retrieve measured/reported compounds from local FooDB for one or more foods.

    Args:
        food_names: English culinary names, for example ["pork belly", "potato", "garlic"].
            Common names, cuts and plurals are resolved to the closest FooDB food.
        max_compounds_per_food: Maximum representative records per food (5..20).
        focus_compounds: Optional candidate compounds or classes to verify in every food in
            the same call, for example ["asparagine", "reducing sugar", "creatine"].

    Returns:
        FooDB matches with class coverage, representative records, focus hits, and unresolved
        names with candidates. Records are compositional evidence, not proof of a hazardous dose.
    """
    names = list(dict.fromkeys(name.strip() for name in food_names if name.strip()))[:16]
    limit = max(5, min(int(max_compounds_per_food), 20))
    focus = list(dict.fromkeys(term.strip() for term in (focus_compounds or []) if term.strip()))
    matched: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    with _connection() as connection:
        for name in names:
            food, score, note = resolve_food(connection, name, min_score=0.72)
            if food is None:
                unresolved.append(
                    {
                        "query": name,
                        "best_text_score": round(score, 3),
                        "candidates": food_candidates(connection, name, limit=5),
                    }
                )
                continue

            totals = connection.execute(
                """
                SELECT COUNT(*) AS total,
                       COUNT(*) FILTER (
                           WHERE standard_content IS NOT NULL
                             AND CAST(standard_content AS DOUBLE PRECISION) > 0
                       ) AS quantified
                FROM food_compound WHERE food_id = %s
                """,
                (food["id"],),
            ).fetchone()
            class_rows = connection.execute(
                """
                SELECT COALESCE(c.superclass, c.class_name, c.subclass, 'Unclassified') AS label,
                       COUNT(*) AS count
                FROM food_compound fc
                JOIN compound c ON c.id = fc.compound_id
                WHERE fc.food_id = %s AND fc.standard_content IS NOT NULL
                      AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0
                GROUP BY label ORDER BY count DESC LIMIT 8
                """,
                (food["id"],),
            ).fetchall()
            rows = connection.execute(
                """
                SELECT c.public_id, c.name, c.annotation_quality, c.cas_number,
                       c.superclass, c.class_name, c.subclass, fc.standard_content,
                       fc.original_unit, fc.food_part, fc.preparation_type, fc.citation
                FROM food_compound fc
                JOIN compound c ON c.id = fc.compound_id
                WHERE fc.food_id = %s AND fc.standard_content IS NOT NULL
                      AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0
                ORDER BY CASE c.annotation_quality
                           WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                         (fc.citation IS NULL), c.name
                LIMIT %s
                """,
                (food["id"], limit),
            ).fetchall()
            record_evidence = "quantified"
            if not rows:
                rows = connection.execute(
                    """
                    SELECT public_id, name, annotation_quality, cas_number,
                           superclass, class_name, subclass, standard_content,
                           original_unit, food_part, preparation_type, citation
                    FROM (
                        SELECT DISTINCT ON (c.id)
                               c.id AS compound_id, c.public_id, c.name,
                               c.annotation_quality, c.cas_number,
                               c.superclass, c.class_name, c.subclass, fc.standard_content,
                               fc.original_unit, fc.food_part, fc.preparation_type, fc.citation
                        FROM food_compound fc
                        JOIN compound c ON c.id = fc.compound_id
                        WHERE fc.food_id = %s
                          AND c.name NOT LIKE '%%' || CHR(65533) || '%%'
                        ORDER BY c.id, (fc.citation IS NULL)
                    ) AS representative
                    ORDER BY CASE annotation_quality
                               WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                             (citation IS NULL), name
                    LIMIT %s
                    """,
                    (food["id"], limit),
                ).fetchall()
                record_evidence = "reported"
            entry: dict[str, Any] = {
                "query": name,
                "match_score": round(score, 3),
                "food": {
                    "foodb_id": food["public_id"],
                    "name": food["name"],
                    "scientific_name": food["scientific_name"],
                    "group": food["food_group"],
                    "subgroup": food["food_subgroup"],
                },
                "relation_count": totals["total"],
                "positive_quantified_count": totals["quantified"] or 0,
                "quantified_class_coverage": [dict(row) for row in class_rows],
                "representative_records": [compound_record(row) for row in rows],
                "record_evidence": record_evidence,
            }
            if note:
                entry["match_note"] = note
            relatives = _same_species_foods(connection, food)
            if relatives:
                entry["same_species_foods"] = relatives
            if focus:
                hits: dict[str, list[dict[str, Any]]] = {}
                for term in focus:
                    found = _find_compounds(
                        connection, food["id"], term, quantified_only=False, limit=3
                    )
                    if found:
                        hits[term] = [compound_record(row) for row in found]
                entry["focus_hits"] = hits
                entry["focus_not_found"] = [term for term in focus if term not in hits]
            matched.append(entry)

    return {
        "source": "FooDB local index",
        "source_url": "https://foodb.ca/",
        "matched": matched,
        "unresolved": unresolved,
        "interpretation": (
            "Records are reported food-compound relations. Units and food parts vary, so do "
            "not rank records across units or treat them as exposure estimates. A focus term "
            "that is not found means FooDB lacks the record, not that the food lacks it. "
            "Unresolved names are absent from the FooDB index. Continue with other evidence."
        ),
    }


def search_food_compounds(
    food_name: str, chemical_query: str, quantified_only: bool = False, limit: int = 10
) -> dict[str, Any]:
    """Search one food for a candidate compound or chemical class in FooDB.

    Args:
        food_name: English common food name.
        chemical_query: Candidate compound, nutrient, superclass, class or subclass to verify.
            Common nutrient names such as "vitamin C" are expanded to chemical names.
        quantified_only: If true, require a positive reported content value. Quantified
            records are always listed first.
        limit: Maximum records to return.
    """
    query = chemical_query.strip()
    if not query:
        return {"status": "error", "message": "chemical_query cannot be empty"}
    row_limit = max(1, min(int(limit), 30))
    with _connection() as connection:
        food, score, note = resolve_food(connection, food_name, min_score=0.72)
        if food is None:
            return {
                "status": "unresolved_food",
                "food_name": food_name,
                "candidates": food_candidates(connection, food_name, limit=5),
            }
        rows = _find_compounds(
            connection, food["id"], query, quantified_only=quantified_only, limit=row_limit
        )
    result: dict[str, Any] = {
        "status": "ok" if rows else "not_found_in_foodb",
        "food": food["name"],
        "foodb_id": food["public_id"],
        "match_score": round(score, 3),
        "chemical_query": query,
        "records": [compound_record(row) for row in rows],
        "source_url": "https://foodb.ca/",
    }
    if note:
        result["match_note"] = note
    return result


def lookup_chemical_identity(query: str) -> dict[str, Any]:
    """Resolve an arbitrary chemical name to PubChem structure and identifiers."""
    encoded = urllib.parse.quote(query.strip(), safe="")
    properties = "Title,CanonicalSMILES,IsomericSMILES,InChIKey,MolecularFormula,MolecularWeight"
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{encoded}/property/{properties}/JSON"
    try:
        payload = _get_json(url)
        item = payload["PropertyTable"]["Properties"][0]
    except (KeyError, IndexError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {"status": "not_found", "query": query}
    cid = item.get("CID")
    return {
        "status": "ok",
        "query": query,
        "compound": item,
        "source_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}" if cid else None,
    }


LITERATURE_FILLER = {
    "study", "studies", "review", "effect", "effects", "evidence", "analysis", "role", "the",
    "of", "and", "in", "on", "for", "during", "with", "a", "an", "to", "by", "its", "their",
}


def _europe_pmc(query: str, size: int) -> dict[str, Any]:
    params = urllib.parse.urlencode(
        {
            "query": f"({query}) AND HAS_ABSTRACT:y",
            "format": "json",
            "resultType": "core",
            "pageSize": size,
        }
    )
    return _get_json(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{params}", 25)


def search_reaction_literature(query: str, max_results: int = 4) -> dict[str, Any]:
    """Search Europe PMC for experimental evidence about a proposed transformation.

    Args:
        query: 3-7 keywords, most decisive first: food, process or condition, product or
            hazard, for example "pork grilling heterocyclic amines marinade". Long queries
            are relaxed automatically when they return nothing.
        max_results: Maximum papers to return (1..8).
    """
    query = query.strip()[:600]
    if not query:
        return {"status": "error", "message": "query cannot be empty"}
    size = max(1, min(int(max_results), 8))
    keywords = [
        word
        for word in re.findall(r"[\w\-\[\]()]+", query)
        if word.casefold() not in LITERATURE_FILLER
    ]
    attempts = list(
        dict.fromkeys(
            q for q in (query, " ".join(keywords[:6]), " ".join(keywords[:4])) if q.strip()
        )
    )
    items: dict[str, dict[str, Any]] = {}
    used: list[str] = []
    hit_count = 0
    for attempt in attempts:
        try:
            payload = _europe_pmc(attempt, size)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if not used:
                return {"status": "unavailable", "query": query}
            break
        used.append(attempt)
        hit_count = max(hit_count, int(payload.get("hitCount") or 0))
        for item in payload.get("resultList", {}).get("result", []):
            if len(item.get("title") or "") >= 12 and item.get("abstractText"):
                items.setdefault(item.get("id") or item["title"], item)
        if len(items) >= min(2, size):
            break

    papers = []
    for item in list(items.values())[:size]:
        pmid = item.get("pmid")
        pmcid = item.get("pmcid")
        identifier = pmcid or pmid
        source = "PMC" if pmcid else "MED"
        papers.append(
            {
                "title": item.get("title"),
                "abstract": (item.get("abstractText") or "")[:1800],
                "year": item.get("pubYear"),
                "journal": item.get("journalTitle"),
                "doi": item.get("doi"),
                "is_open_access": item.get("isOpenAccess"),
                "source_url": (
                    f"https://europepmc.org/article/{source}/{identifier}" if identifier else None
                ),
            }
        )
    return {
        "status": "ok" if papers else "no_results",
        "query": query,
        "query_used": used[-1] if used else query,
        "hit_count": hit_count,
        "papers": papers,
        "source_url": "https://europepmc.org/",
    }


def lookup_openfoodtox(identifiers: list[str]) -> dict[str, Any]:
    """Look up chemical names, CAS numbers or InChIKeys in local EFSA OpenFoodTox.

    Args:
        identifiers: Chemical names or stable identifiers to assess after reaction review.
    """
    queries = list(dict.fromkeys(item.strip() for item in identifiers if item.strip()))[:20]
    found: list[dict[str, Any]] = []
    missing: list[str] = []
    with _connection() as connection:
        for query in queries:
            normalized = normalize_name(query)
            row = connection.execute(
                """
                SELECT * FROM openfoodtox_substance
                WHERE normalized_name = %s OR LOWER(COALESCE(cas_number, '')) = LOWER(%s)
                      OR UPPER(COALESCE(inchikey, '')) = UPPER(%s)
                ORDER BY high_signal_count DESC, watch_signal_count DESC LIMIT 1
                """,
                (normalized, query, query),
            ).fetchone()
            match_type = "exact"
            if row is None and len(normalized) >= 5:
                row = connection.execute(
                    """
                    SELECT * FROM openfoodtox_substance
                    WHERE normalized_name LIKE %s OR normalized_name LIKE %s
                    ORDER BY length(name), high_signal_count DESC LIMIT 1
                    """,
                    (f"% {normalized}", f"{normalized} %"),
                ).fetchone()
                match_type = "partial_name"
            if row is None:
                missing.append(query)
                continue
            item = dict(row)
            signals = json.loads(item.pop("signals_json"))
            unique = list(
                {
                    (s.get("level"), s.get("endpoint"), s.get("summary")): s for s in signals
                }.values()
            )
            item["signals"] = unique[:8]
            for key in ("sub_uuid", "ref_uuid", "normalized_name"):
                item.pop(key, None)
            found.append({"query": query, "match_type": match_type, **item})
    return {
        "source": "EFSA OpenFoodTox 3.0 local index",
        "source_url": (
            "https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox"
        ),
        "found": found,
        "missing": missing,
        "interpretation": (
            "Hazard records do not establish serving-level risk without formed amount, intake, "
            "exposure and a compatible reference value. A missing record is not proof of safety."
        ),
    }


def get_pubchem_hazard_summary(query: str) -> dict[str, Any]:
    """Retrieve hazard/toxicology text for an arbitrary compound from PubChem PUG View."""
    identity = lookup_chemical_identity(query)
    if identity.get("status") != "ok":
        return identity
    cid = identity["compound"].get("CID")
    params = urllib.parse.urlencode({"heading": "Safety and Hazards"})
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?{params}"
    try:
        payload = _get_json(url, timeout=25)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {"status": "unavailable", "query": query, "cid": cid}

    snippets: list[dict[str, str]] = []

    def walk(value: Any, path: tuple[str, ...] = ()) -> None:
        if len(snippets) >= 6:
            return
        if isinstance(value, dict):
            heading = value.get("TOCHeading")
            next_path = path + ((str(heading),) if heading else ())
            strings = value.get("StringWithMarkup")
            if isinstance(strings, list):
                for entry in strings:
                    text = entry.get("String") if isinstance(entry, dict) else None
                    if text and text.strip():
                        snippets.append(
                            {"section": " > ".join(next_path[-4:]), "text": text.strip()[:600]}
                        )
                        if len(snippets) >= 6:
                            return
            for child in value.values():
                walk(child, next_path)
        elif isinstance(value, list):
            for child in value:
                walk(child, path)

    walk(payload.get("Record", {}))
    return {
        "status": "ok",
        "query": query,
        "cid": cid,
        "formula": identity["compound"].get("MolecularFormula"),
        "molecular_weight": identity["compound"].get("MolecularWeight"),
        "snippets": snippets,
        "source_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}#section=Safety-and-Hazards",
        "interpretation": "This is hazard information, not a food-serving exposure estimate.",
    }


FSIS_TEMPERATURES_URL = (
    "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/"
    "food-safety-basics/safe-temperature-chart"
)
FOOD_SAFETY_REFERENCES: dict[str, dict[str, Any]] = {
    "safe_internal_temperature": {
        "title": "USDA FSIS — Safe Minimum Internal Temperature Chart",
        "source_url": FSIS_TEMPERATURES_URL,
        "facts": [
            "Poultry (whole, parts, ground): 74°C (165°F).",
            "Ground beef, pork, veal, lamb: 71°C (160°F).",
            "Whole cuts of beef, pork, veal, lamb (steaks, roasts, chops): 63°C (145°F) "
            "with a 3-minute rest.",
            "Fresh raw ham: 63°C (145°F) with a 3-minute rest.",
            "Fish and shellfish: 63°C (145°F).",
            "Egg dishes: 71°C (160°F).",
            "Leftovers and casseroles: 74°C (165°F).",
            "Measure with a food thermometer in the thickest part. Color is not a reliable "
            "indicator of doneness.",
        ],
        "keywords": ("temperature", "doneness", "internal", "core", "thermometer", "cook"),
    },
    "temperature_danger_zone": {
        "title": "USDA FSIS — Danger Zone (40°F–140°F)",
        "source_url": (
            "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/"
            "food-safety-basics/danger-zone-40f-140f"
        ),
        "facts": [
            "Bacteria grow most rapidly between 4°C and 60°C (40°F–140°F).",
            "Do not leave perishable food out of refrigeration for more than 2 hours, or more "
            "than 1 hour when the temperature is above 32°C (90°F).",
        ],
        "keywords": ("danger", "zone", "room", "hold", "marinat", "thaw"),
    },
    "leftovers": {
        "title": "USDA FSIS — Leftovers and Food Safety",
        "source_url": (
            "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/"
            "food-safety-basics/leftovers-and-food-safety"
        ),
        "facts": [
            "Refrigerate leftovers within 2 hours of cooking.",
            "Refrigerated leftovers keep 3 to 4 days.",
            "Reheat leftovers to 74°C (165°F).",
        ],
        "keywords": ("leftover", "storage", "store", "reheat", "fridge", "refrigerate"),
    },
    "four_steps": {
        "title": "FDA — Safe Food Handling",
        "source_url": "https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling",
        "facts": [
            "Four steps: clean, separate, cook, chill.",
            "Separate raw meat, poultry, seafood and eggs from ready-to-eat food, including "
            "cutting boards, plates and utensils.",
            "Keep the refrigerator at 4°C (40°F) or below and the freezer at -18°C (0°F).",
        ],
        "keywords": ("cross", "contamination", "separate", "clean", "hygiene", "raw", "chill"),
    },
    "acrylamide": {
        "title": "EFSA — Acrylamide",
        "source_url": "https://www.efsa.europa.eu/en/topics/topic/acrylamide",
        "facts": [
            "Acrylamide forms from sugars and the amino acid asparagine during high-temperature "
            "processing such as frying, roasting and baking, typically above 120°C.",
            "EFSA concluded that acrylamide in food potentially increases the risk of "
            "developing cancer for consumers in all age groups.",
            "Frying or baking to a lighter golden color rather than dark brown reduces formation.",
        ],
        "keywords": ("acrylamide", "fry", "fried", "fries", "potato", "bake", "toast", "browning"),
    },
    "grilled_meat_hca_pah": {
        "title": "National Cancer Institute — Chemicals in Meat Cooked at High Temperatures",
        "source_url": (
            "https://www.cancer.gov/about-cancer/causes-prevention/risk/diet/cooked-meats-fact-sheet"
        ),
        "facts": [
            "Heterocyclic amines (HCAs) form when muscle meat is cooked at high temperatures, "
            "such as pan-frying or grilling, from amino acids, sugars and creatine.",
            "Polycyclic aromatic hydrocarbons (PAHs) form when fat and juices drip onto a fire "
            "and the resulting flames and smoke deposit on the meat surface.",
            "Lower exposure by avoiding direct flame contact and prolonged high-heat cooking, "
            "turning meat frequently, removing charred portions, and not using drippings "
            "from charred meat for gravy.",
        ],
        "keywords": ("grill", "barbecue", "bbq", "char", "smoke", "hca", "pah", "meat", "sear"),
    },
    "legume_lectins": {
        "title": "CFS Hong Kong — Natural Toxins in Raw/Undercooked Beans",
        "source_url": (
            "https://www.cfs.gov.hk/english/multimedia/multimedia_pub/multimedia_pub_fsf_139_04.html"
        ),
        "facts": [
            "Common beans such as green beans and French beans, and other beans such as red and "
            "white kidney beans, contain lectins such as phytohaemagglutinins when not properly "
            "processed.",
            "Undercooked beans cause vomiting, diarrhoea and abdominal pain. In late 2017 about "
            "100 students and staff in Mainland China were hospitalised after eating undercooked "
            "common beans at a school canteen.",
            "Cook beans at 100°C for 10-20 minutes after soaking to denature the lectins. Slow "
            "cookers and casseroles at lower temperatures may not destroy them. Do not use raw "
            "or underdone beans in salads.",
        ],
        "related_sources": [
            {
                "title": "BfR — Only enjoy cooked beans (2021)",
                "source_url": "https://www.bfr.bund.de/en/press-release/only-enjoy-cooked-beans/",
                "facts": [
                    "Seeds and pods of green French beans contain the lectin phasin, which "
                    "causes gastrointestinal disorders. Symptoms usually begin 2-3 hours after "
                    "eating. Children are particularly at risk.",
                    "Phasin is only destroyed by high temperatures. Gentle stewing or steaming is "
                    "not suitable for beans.",
                ],
            },
            {
                "title": "EFSA — Lectins in food: undercooked beans pose health risk (2026)",
                "source_url": (
                    "https://www.efsa.europa.eu/en/news/"
                    "lectins-food-undercooked-beans-pose-health-risk-says-efsa"
                ),
                "facts": [
                    "PHA is the most toxic lectin in commonly consumed edible plants. Exposure "
                    "from undercooked beans is a health concern for all age groups.",
                    "Most effective: soak 6-12 hours, change the water, boil at least 30 minutes "
                    "at 100°C until soft. Steaming, microwaving and roasting are less effective.",
                ],
            },
        ],
        "keywords": (
            "bean", "legume", "pulse", "lectin", "phytohaem", "phytohem", "phasin", "kidney",
            "phaseolus",
        ),
    },
    "plant_toxins_overview": {
        "title": "CFS Hong Kong — Risk Assessment Report No. 27: Natural Toxins in Food Plants",
        "source_url": (
            "https://www.cfs.gov.hk/english/programme/programme_rafs/"
            "programme_rafs_fc_01_17_report.html"
        ),
        "facts": [
            "Potato glycoalkaloids (α-solanine, α-chaconine) concentrate in the peel and rise in "
            "greened, damaged or sprouted potatoes. They are not decomposed by cooking, steaming, "
            "baking, frying or microwaving. Poisoning causes gastrointestinal upset and, in "
            "severe cases, drowsiness, confusion and weakness. Discard sprouted, green, damaged "
            "or rotting potatoes.",
            "Cyanogenic glycosides occur in bitter apricot seed, bamboo shoot (taxiphyllin, "
            "highest at the tip), cassava (linamarin, bitter much higher than sweet) and "
            "flaxseed. Cutting into small pieces and boiling reduces cyanide by over 90 percent: "
            "bitter apricot seed 15 min (98%), sliced bamboo shoot 15 min (91%), peeled cubed "
            "cassava 20 min (97%). Dry oven heating of flaxseed removed only about 10 percent.",
            "Ginkgo seeds contain heat-stable 4'-methoxypyridoxine and cyanogenic glycosides. "
            "Poisoning causes vomiting, irritability and convulsions 1-12 hours after eating, "
            "after 10-50 cooked seeds. Children are especially susceptible and should not eat "
            "more than a few seeds at a time.",
            "Lectins in beans are reduced by moist heat. Low-temperature cooking may not destroy "
            "them. Soak, then boil thoroughly in fresh water.",
            "Saponins in soybeans, potatoes and spinach can irritate the gut in large amounts. "
            "Pyrrolizidine alkaloids from weeds or herbal products cause chronic liver toxicity.",
        ],
        "keywords": (
            "potato", "solanin", "chaconin", "glycoalkaloid", "cyan", "apricot", "bamboo",
            "cassava", "manioc", "flax", "linseed", "ginkgo", "saponin", "pyrrolizidine",
            "sprout", "natural toxin", "plant toxin",
        ),
    },
    "natural_toxins_animal_and_wild": {
        "title": "CFS Hong Kong — An Overview of Natural Toxins in Food",
        "source_url": (
            "https://www.cfs.gov.hk/english/multimedia/multimedia_pub/multimedia_pub_fsf_11_02.html"
        ),
        "facts": [
            "Tetrodotoxin occurs in over 90 species of puffer fish and can be lethal after a "
            "small amount.",
            "Ciguatoxin occurs in more than 300 species of coral reef fish. Marine toxins from "
            "microalgae in shellfish and finfish cause acute symptoms within hours.",
            "Histamine forms in scombroid fish through bacterial spoilage.",
            "The gall bladder of grass carp causes food poisoning. About 1,200 poisonous animal "
            "species carry toxins in glands or tissues that must be avoided.",
            "Wild mushrooms, wild berries and other wild plants cause acute poisoning. Avoid "
            "eating wild species. Children and the elderly are more susceptible.",
            "Enzyme inhibitors and lectins in soya beans, green beans and other legumes are "
            "destroyed by thorough cooking.",
        ],
        "keywords": (
            "puffer", "fugu", "tetrodotoxin", "ciguat", "reef", "shellfish", "marine",
            "histamin", "scombro", "tuna", "mackerel", "carp", "gall", "wild", "mushroom",
            "poisonous animal", "venom", "berry", "soy", "trypsin", "enzyme inhibitor",
        ),
    },
}


def get_food_safety_reference(topics: list[str]) -> dict[str, Any]:
    """Search curated official food-safety guidance (USDA, FDA, EFSA, BfR, NCI, CFS Hong Kong).

    Args:
        topics: Topic keys, food names, or hazard names. Pass every food in the case and every
            suspected toxin or process, for example ["green beans", "lectin", "doneness"].
            Keys: safe_internal_temperature, temperature_danger_zone, leftovers, four_steps,
            acrylamide, grilled_meat_hca_pah, legume_lectins, plant_toxins_overview,
            natural_toxins_animal_and_wild.

    Returns:
        Official facts and citable source URLs for doneness temperatures, storage and holding,
        cross-contamination, process toxicants, and natural toxins in plants, fungi and animals.
    """
    selected: list[str] = []
    for topic in topics:
        key = normalize_name(topic).replace(" ", "_")
        if key in FOOD_SAFETY_REFERENCES:
            selected.append(key)
            continue
        text = normalize_name(topic)
        for name, entry in FOOD_SAFETY_REFERENCES.items():
            if any(keyword in text for keyword in entry["keywords"]):
                selected.append(name)
    selected = list(dict.fromkeys(selected))
    if not selected:
        return {"status": "no_match", "available_topics": list(FOOD_SAFETY_REFERENCES)}
    return {
        "status": "ok",
        "references": [
            {
                "topic": name,
                **{k: v for k, v in FOOD_SAFETY_REFERENCES[name].items() if k != "keywords"},
            }
            for name in selected
        ],
        "interpretation": "General official guidance. It does not verify a specific dish.",
    }
