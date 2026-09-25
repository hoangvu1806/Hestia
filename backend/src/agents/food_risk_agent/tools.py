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


def normalize_name(value: str) -> str:
    """Normalize a food/chemical name for conservative local matching."""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def best_food_match(
    connection: Connection[dict[str, Any]], query: str, min_score: float
) -> tuple[dict[str, Any] | None, float]:
    """Return a safe FooDB text match without collapsing a specific food to a broad one."""
    normalized_query = normalize_name(query)
    if not normalized_query:
        return None, 0.0
    exact = connection.execute(
        "SELECT * FROM food WHERE normalized_name = %s ORDER BY id LIMIT 1",
        (normalized_query,),
    ).fetchone()
    if exact:
        return exact, 1.0

    query_tokens = set(normalized_query.split())
    scored: list[tuple[float, dict[str, Any], set[str]]] = []
    for food in connection.execute("SELECT * FROM food").fetchall():
        candidate = food["normalized_name"]
        candidate_tokens = set(candidate.split())
        score = difflib.SequenceMatcher(None, normalized_query, candidate).ratio()
        if query_tokens and query_tokens <= candidate_tokens:
            score = max(score, 0.9 + 0.1 * len(query_tokens) / len(candidate_tokens))
        scored.append((score, food, candidate_tokens))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return None, 0.0

    best_score, best_row, best_tokens = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    margin = best_score - second_score
    if best_tokens < query_tokens:
        return None, best_score
    if query_tokens < best_tokens:
        accepted = best_score >= max(min_score, 0.9) and margin >= 0.05
        return (best_row, best_score) if accepted else (None, best_score)
    accepted = best_score >= max(min_score, 0.84) and margin >= 0.05
    return (best_row, best_score) if accepted else (None, best_score)


def food_candidates(
    connection: Connection[dict[str, Any]], query: str, limit: int = 5
) -> list[dict[str, Any]]:
    """Return nearest FooDB foods for an unresolved name without auto-accepting one."""
    normalized_query = normalize_name(query)
    query_tokens = set(normalized_query.split())
    scored: list[tuple[float, dict[str, Any]]] = []
    for food in connection.execute("SELECT * FROM food").fetchall():
        candidate = food["normalized_name"]
        candidate_tokens = set(candidate.split())
        score = difflib.SequenceMatcher(None, normalized_query, candidate).ratio()
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
            "scientific_name": food["scientific_name"],
            "group": food["food_group"],
            "subgroup": food["food_subgroup"],
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
    """Return a compound record with a preformatted FooDB compound tag."""
    item = dict(row)
    public_id = item.get("public_id")
    name = item.get("name")
    if public_id and name:
        item["foob_tag"] = f"[<{name}:{public_id}>]"
    return item


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


def solve_food_chemistry(operation: str, inputs: dict[str, float]) -> dict[str, Any]:
    """Run a deterministic, unit-explicit calculation selected by the agent.

    Args:
        operation: One of mass_fraction, dilution, moles, stoichiometric_yield,
            nutrient_retention, or thermal_equivalent_time.
        inputs: Numeric values using the canonical keys documented in the returned error when
            an operation is invalid. Concentrations must use one consistent unit; masses are in
            grams; volumes are in millilitres; temperatures are degrees Celsius; times are minutes.

    Returns:
        Formula, substituted values, result, units, assumptions and limitations. This tool performs
        arithmetic only; it does not establish that a reaction occurs or that a serving is safe.
    """
    kind = normalize_name(operation).replace(" ", "_")
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

        if kind == "dilution":
            known = {
                key: float(value)
                for key, value in inputs.items()
                if key
                in {
                    "initial_concentration",
                    "initial_volume_ml",
                    "final_concentration",
                    "final_volume_ml",
                }
            }
            missing = [
                key
                for key in (
                    "initial_concentration",
                    "initial_volume_ml",
                    "final_concentration",
                    "final_volume_ml",
                )
                if key not in known
            ]
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
            initial = _number(inputs, "initial_amount")
            factor = _number(inputs, "retention_factor_percent")
            yield_factor = float(inputs.get("edible_yield_fraction", 1.0))
            servings = float(inputs.get("servings", 1.0))
            if initial < 0 or not 0 <= factor <= 100 or not 0 < yield_factor <= 1 or servings <= 0:
                raise ValueError(
                    "Require initial_amount >= 0, retention 0..100, edible yield 0..1, "
                    "and servings > 0"
                )
            retained = initial * factor / 100 * yield_factor
            return {
                "status": "ok",
                "operation": kind,
                "formula": "retained amount = initial amount × retention factor × edible yield",
                "result": {
                    "retained_total": round(retained, 6),
                    "retained_per_serving": round(retained / servings, 6),
                },
                "units": "Results retain the unit of initial_amount.",
                "limitations": [
                    "A retention factor is a category-level estimate, not a laboratory "
                    "measurement of this dish."
                ],
            }

        if kind == "thermal_equivalent_time":
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
    except (TypeError, ValueError) as exc:
        return {"status": "invalid_input", "operation": kind, "message": str(exc)}

    return {
        "status": "unsupported_operation",
        "operation": kind,
        "supported_operations": [
            "mass_fraction",
            "dilution",
            "moles",
            "stoichiometric_yield",
            "nutrient_retention",
            "thermal_equivalent_time",
        ],
    }


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
    process_query: str, nutrient_query: str = "", limit: int = 12
) -> dict[str, Any]:
    """Find USDA nutrient-retention factors by flexible process and nutrient descriptions.

    Args:
        process_query: Preparation or food-category terms, for example boiled vegetables
            or baked fish.
        nutrient_query: Optional nutrient name such as vitamin C, calcium, or folate.
        limit: Maximum matched rows to return.

    Returns:
        Ranked USDA Release 6 rows. Factors are category estimates and require a separate initial
        nutrient amount before an amount retained can be calculated.
    """
    process = normalize_name(process_query)
    nutrient = normalize_name(nutrient_query)
    if not process:
        return {"status": "invalid_input", "message": "process_query cannot be empty"}

    process_tokens = set(process.split())
    nutrient_tokens = set(nutrient.split())
    scored: list[tuple[float, dict[str, Any]]] = []
    for row in _retention_rows():
        row_process = normalize_name(str(row["process"]))
        row_nutrient = normalize_name(str(row["nutrient"]))
        process_score = difflib.SequenceMatcher(None, process, row_process).ratio()
        if process_tokens:
            overlap = len(process_tokens & set(row_process.split())) / len(process_tokens)
            process_score = max(process_score, overlap)
        nutrient_score = 1.0
        if nutrient:
            nutrient_score = difflib.SequenceMatcher(None, nutrient, row_nutrient).ratio()
            if nutrient_tokens:
                overlap = len(nutrient_tokens & set(row_nutrient.split())) / len(nutrient_tokens)
                nutrient_score = max(nutrient_score, overlap)
        score = 0.72 * process_score + 0.28 * nutrient_score
        if process_score >= 0.35 and (not nutrient or nutrient_score >= 0.45):
            scored.append((score, row))

    scored.sort(key=lambda item: (-item[0], item[1]["process"], item[1]["nutrient"]))
    matches = [
        {"match_score": round(score, 3), **row}
        for score, row in scored[: max(1, min(int(limit), 30))]
    ]
    return {
        "status": "ok",
        "query": {"process": process_query, "nutrient": nutrient_query or None},
        "matches": matches,
        "source": "USDA Table of Nutrient Retention Factors, Release 6",
        "source_url": USDA_RETENTION_URL,
        "interpretation": (
            "Retention factors are category-level percentages. Use a close process/food match, "
            "show the match uncertainty, and do not present the result as a measured value."
        ),
    }


def get_food_chemical_profile(
    food_names: list[str], max_compounds_per_food: int = 12
) -> dict[str, Any]:
    """Retrieve measured/reported compounds and chemical classes from local FooDB.

    Args:
        food_names: English common food or ingredient names inferred from the image.
        max_compounds_per_food: Maximum example records returned for each matched food.

    Returns:
        FooDB matches, reported compound records, class coverage and unresolved names.
        Records are compositional evidence, not proof of a hazardous dose.
    """
    names = list(dict.fromkeys(name.strip() for name in food_names if name.strip()))[:16]
    limit = max(5, min(int(max_compounds_per_food), 20))
    matched: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    with _connection() as connection:
        for name in names:
            food, score = best_food_match(connection, name, min_score=0.72)
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
                SELECT c.public_id, c.name, c.annotation_quality, c.cas_number, c.inchikey,
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
            representative_records = rows
            record_evidence = "quantified"
            if not representative_records:
                representative_records = connection.execute(
                    """
                    SELECT public_id, name, annotation_quality, cas_number, inchikey,
                           superclass, class_name, subclass, standard_content,
                           original_unit, food_part, preparation_type, citation
                    FROM (
                        SELECT DISTINCT ON (c.id)
                               c.id AS compound_id, c.public_id, c.name,
                               c.annotation_quality, c.cas_number, c.inchikey,
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
            matched.append(
                {
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
                    "representative_quantified_records": [compound_record(row) for row in rows],
                    "representative_records": [
                        compound_record(row) for row in representative_records
                    ],
                    "record_evidence": record_evidence,
                }
            )

    return {
        "source": "FooDB local index",
        "source_url": "https://foodb.ca/",
        "matched": matched,
        "unresolved": unresolved,
        "interpretation": (
            "The returned records are reported food-compound relations. Units and food parts "
            "vary, so records must not be ranked across units or treated as exposure estimates."
        ),
    }


def search_food_compounds(
    food_name: str, chemical_query: str, quantified_only: bool = True, limit: int = 15
) -> dict[str, Any]:
    """Search a matched food for a candidate compound or chemical class in FooDB.

    Args:
        food_name: English common food name.
        chemical_query: Candidate compound, superclass, class or subclass to verify.
        quantified_only: If true, require a positive reported content value.
        limit: Maximum records to return.
    """
    query = chemical_query.strip()
    if not query:
        return {"status": "error", "message": "chemical_query cannot be empty"}
    row_limit = max(1, min(int(limit), 30))
    with _connection() as connection:
        food, score = best_food_match(connection, food_name, min_score=0.72)
        if food is None:
            return {
                "status": "unresolved_food",
                "food_name": food_name,
                "candidates": food_candidates(connection, food_name, limit=5),
            }
        pattern = f"%{query.casefold()}%"
        quantified_filter = (
            "AND fc.standard_content IS NOT NULL "
            "AND CAST(fc.standard_content AS DOUBLE PRECISION) > 0"
            if quantified_only
            else ""
        )
        rows = connection.execute(
            f"""
            SELECT c.public_id, c.name, c.annotation_quality, c.cas_number, c.inchikey,
                   c.superclass, c.class_name, c.subclass, fc.standard_content,
                   fc.original_unit, fc.food_part, fc.preparation_type, fc.citation
            FROM food_compound fc JOIN compound c ON c.id = fc.compound_id
            WHERE fc.food_id = %s {quantified_filter}
              AND (LOWER(c.name) LIKE %s OR LOWER(COALESCE(c.superclass, '')) LIKE %s
                   OR LOWER(COALESCE(c.class_name, '')) LIKE %s
                   OR LOWER(COALESCE(c.subclass, '')) LIKE %s)
            ORDER BY CASE c.annotation_quality
                       WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, c.name
            LIMIT %s
            """,
            (food["id"], pattern, pattern, pattern, pattern, row_limit),
        ).fetchall()
    return {
        "status": "ok",
        "food": food["name"],
        "foodb_id": food["public_id"],
        "match_score": round(score, 3),
        "chemical_query": query,
        "records": [compound_record(row) for row in rows],
        "source_url": "https://foodb.ca/",
    }


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


def search_reaction_literature(query: str, max_results: int = 5) -> dict[str, Any]:
    """Search Europe PMC for experimental evidence about a proposed transformation.

    Args:
        query: A focused literature query containing substrate/food, process conditions,
            and proposed product or transformation.
        max_results: Maximum papers to return.
    """
    query = query.strip()[:600]
    if not query:
        return {"status": "error", "message": "query cannot be empty"}
    params = urllib.parse.urlencode(
        {
            "query": query,
            "format": "json",
            "resultType": "core",
            "pageSize": max(1, min(int(max_results), 8)),
        }
    )
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{params}"
    try:
        payload = _get_json(url, timeout=25)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return {"status": "unavailable", "query": query}

    papers = []
    for item in payload.get("resultList", {}).get("result", []):
        pmid = item.get("pmid")
        pmcid = item.get("pmcid")
        identifier = pmcid or pmid
        source = "PMC" if pmcid else "MED"
        papers.append(
            {
                "title": item.get("title"),
                "abstract": (item.get("abstractText") or "")[:3000],
                "year": item.get("pubYear"),
                "journal": item.get("journalTitle"),
                "doi": item.get("doi"),
                "pmid": pmid,
                "pmcid": pmcid,
                "is_open_access": item.get("isOpenAccess"),
                "source_url": (
                    f"https://europepmc.org/article/{source}/{identifier}" if identifier else None
                ),
            }
        )
    return {
        "status": "ok",
        "query": query,
        "hit_count": payload.get("hitCount", 0),
        "papers": papers,
        "source_url": "https://europepmc.org/",
    }


def lookup_openfoodtox(identifiers: list[str]) -> dict[str, Any]:
    """Look up arbitrary names, CAS numbers or InChIKeys in local EFSA OpenFoodTox.

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
            if row is None:
                missing.append(query)
                continue
            item = dict(row)
            item["signals"] = json.loads(item.pop("signals_json"))[:10]
            found.append({"query": query, **item})
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
                    if text:
                        snippets.append({"section": " > ".join(next_path[-4:]), "text": text[:600]})
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
        "snippets": snippets,
        "source_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}#section=Safety-and-Hazards",
        "interpretation": "This is hazard information, not a food-serving exposure estimate.",
    }
