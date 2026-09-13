"""Evidence tools for the food-risk ADK app.

The tools are intentionally generic: they contain no list of target compounds or
predefined cooking reactions.  Agents must discover candidates and support them
with local data and literature.
"""

from __future__ import annotations

import difflib
import json
import re
import sqlite3
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_DB = BACKEND_DIR / "dataset" / "processed" / "foodb_compounds.sqlite3"
USER_AGENT = "Hestia-food-risk-research/0.1"


def normalize_name(value: str) -> str:
    """Normalize a food/chemical name for conservative local matching."""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def best_food_match(
    connection: sqlite3.Connection, query: str, min_score: float
) -> tuple[sqlite3.Row | None, float]:
    """Return a safe FooDB text match without collapsing a specific food to a broad one."""
    normalized_query = normalize_name(query)
    if not normalized_query:
        return None, 0.0
    exact = connection.execute(
        "SELECT * FROM food WHERE normalized_name = ? ORDER BY id LIMIT 1",
        (normalized_query,),
    ).fetchone()
    if exact:
        return exact, 1.0

    query_tokens = set(normalized_query.split())
    scored: list[tuple[float, sqlite3.Row, set[str]]] = []
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
    connection: sqlite3.Connection, query: str, limit: int = 5
) -> list[dict[str, Any]]:
    """Return nearest FooDB foods for an unresolved name without auto-accepting one."""
    normalized_query = normalize_name(query)
    query_tokens = set(normalized_query.split())
    scored: list[tuple[float, sqlite3.Row]] = []
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


def _connection() -> sqlite3.Connection:
    if not DEFAULT_DB.is_file():
        raise FileNotFoundError(
            "FooDB/OpenFoodTox index is missing. Build it with "
            "`python experiments/image_to_compounds.py build-index` and `build-hazards`."
        )
    connection = sqlite3.connect(DEFAULT_DB)
    connection.row_factory = sqlite3.Row
    return connection


def _get_json(url: str, timeout: int = 20) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def compound_record(row: sqlite3.Row) -> dict[str, Any]:
    """Return a compound record with a preformatted FooDB compound tag."""
    item = dict(row)
    public_id = item.get("public_id")
    name = item.get("name")
    if public_id and name:
        item["foob_tag"] = f"[<{name}:{public_id}>]"
    return item


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

            total, quantified = connection.execute(
                """
                SELECT COUNT(*), SUM(
                    standard_content IS NOT NULL
                    AND CAST(standard_content AS REAL) > 0
                )
                FROM food_compound WHERE food_id = ?
                """,
                (food["id"],),
            ).fetchone()
            class_rows = connection.execute(
                """
                SELECT COALESCE(c.superclass, c.class_name, c.subclass, 'Unclassified') AS label,
                       COUNT(*) AS count
                FROM food_compound fc
                JOIN compound c ON c.id = fc.compound_id
                WHERE fc.food_id = ? AND fc.standard_content IS NOT NULL
                      AND CAST(fc.standard_content AS REAL) > 0
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
                WHERE fc.food_id = ? AND fc.standard_content IS NOT NULL
                      AND CAST(fc.standard_content AS REAL) > 0
                ORDER BY CASE c.annotation_quality
                           WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                         (fc.citation IS NULL), c.name
                LIMIT ?
                """,
                (food["id"], limit),
            ).fetchall()
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
                    "relation_count": total,
                    "positive_quantified_count": quantified or 0,
                    "quantified_class_coverage": [dict(row) for row in class_rows],
                    "representative_quantified_records": [
                        compound_record(row) for row in rows
                    ],
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
            "AND fc.standard_content IS NOT NULL AND CAST(fc.standard_content AS REAL) > 0"
            if quantified_only
            else ""
        )
        rows = connection.execute(
            f"""
            SELECT c.public_id, c.name, c.annotation_quality, c.cas_number, c.inchikey,
                   c.superclass, c.class_name, c.subclass, fc.standard_content,
                   fc.original_unit, fc.food_part, fc.preparation_type, fc.citation
            FROM food_compound fc JOIN compound c ON c.id = fc.compound_id
            WHERE fc.food_id = ? {quantified_filter}
              AND (LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.superclass, '')) LIKE ?
                   OR LOWER(COALESCE(c.class_name, '')) LIKE ?
                   OR LOWER(COALESCE(c.subclass, '')) LIKE ?)
            ORDER BY CASE c.annotation_quality
                       WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, c.name
            LIMIT ?
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
    properties = (
        "Title,CanonicalSMILES,IsomericSMILES,InChIKey,MolecularFormula,MolecularWeight"
    )
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
                    f"https://europepmc.org/article/{source}/{identifier}"
                    if identifier
                    else None
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
                WHERE normalized_name = ? OR LOWER(COALESCE(cas_number, '')) = LOWER(?)
                      OR UPPER(COALESCE(inchikey, '')) = UPPER(?)
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
                        snippets.append(
                            {"section": " > ".join(next_path[-4:]), "text": text[:600]}
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
        "snippets": snippets,
        "source_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}#section=Safety-and-Hazards",
        "interpretation": "This is hazard information, not a food-serving exposure estimate.",
    }
