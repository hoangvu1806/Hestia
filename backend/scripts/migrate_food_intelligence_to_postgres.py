"""Import the local FooDB/OpenFoodTox SQLite index into PostgreSQL."""

from __future__ import annotations

import argparse
import asyncio
import sqlite3
from pathlib import Path

import asyncpg

from core.config import get_settings

TABLES = {
    "food": (
        "id",
        "public_id",
        "name",
        "normalized_name",
        "scientific_name",
        "food_group",
        "food_subgroup",
    ),
    "compound": (
        "id",
        "public_id",
        "name",
        "annotation_quality",
        "cas_number",
        "inchikey",
        "kingdom",
        "superclass",
        "class_name",
        "subclass",
    ),
    "food_compound": (
        "food_id",
        "compound_id",
        "standard_content",
        "original_unit",
        "food_part",
        "preparation_type",
        "citation",
    ),
    "openfoodtox_substance": (
        "sub_uuid",
        "ref_uuid",
        "name",
        "normalized_name",
        "cas_number",
        "inchikey",
        "reference_value_count",
        "endpoint_summary_count",
        "high_signal_count",
        "watch_signal_count",
        "signals_json",
    ),
}

CREATE_SQL = """
CREATE SCHEMA food_intelligence_import;

CREATE TABLE food_intelligence_import.food (
    id BIGINT PRIMARY KEY,
    public_id TEXT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    scientific_name TEXT,
    food_group TEXT,
    food_subgroup TEXT
);

CREATE TABLE food_intelligence_import.compound (
    id BIGINT PRIMARY KEY,
    public_id TEXT,
    name TEXT NOT NULL,
    annotation_quality TEXT,
    cas_number TEXT,
    inchikey TEXT,
    kingdom TEXT,
    superclass TEXT,
    class_name TEXT,
    subclass TEXT
);

CREATE TABLE food_intelligence_import.food_compound (
    food_id BIGINT NOT NULL,
    compound_id BIGINT NOT NULL,
    standard_content TEXT,
    original_unit TEXT,
    food_part TEXT,
    preparation_type TEXT,
    citation TEXT
);

CREATE TABLE food_intelligence_import.openfoodtox_substance (
    sub_uuid TEXT PRIMARY KEY,
    ref_uuid TEXT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    cas_number TEXT,
    inchikey TEXT,
    reference_value_count INTEGER NOT NULL,
    endpoint_summary_count INTEGER NOT NULL,
    high_signal_count INTEGER NOT NULL,
    watch_signal_count INTEGER NOT NULL,
    signals_json TEXT NOT NULL
);
"""

INDEX_SQL = """
ALTER TABLE food_intelligence_import.food_compound
    ADD PRIMARY KEY (food_id, compound_id);
CREATE INDEX food_compound_food_idx
    ON food_intelligence_import.food_compound(food_id);
CREATE INDEX food_compound_compound_idx
    ON food_intelligence_import.food_compound(compound_id);
CREATE INDEX food_normalized_name_idx
    ON food_intelligence_import.food(normalized_name);
CREATE INDEX compound_name_lower_idx
    ON food_intelligence_import.compound(LOWER(name));
CREATE INDEX openfoodtox_normalized_name_idx
    ON food_intelligence_import.openfoodtox_substance(normalized_name);
CREATE INDEX openfoodtox_cas_lower_idx
    ON food_intelligence_import.openfoodtox_substance(LOWER(cas_number));
CREATE INDEX openfoodtox_inchikey_upper_idx
    ON food_intelligence_import.openfoodtox_substance(UPPER(inchikey));
ANALYZE food_intelligence_import.food;
ANALYZE food_intelligence_import.compound;
ANALYZE food_intelligence_import.food_compound;
ANALYZE food_intelligence_import.openfoodtox_substance;
"""


def source_counts(connection: sqlite3.Connection) -> dict[str, int]:
    return {
        table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        for table in TABLES
    }


async def copy_table(
    source: sqlite3.Connection,
    target: asyncpg.Connection,
    table: str,
    columns: tuple[str, ...],
    total: int,
    chunk_size: int,
) -> None:
    cursor = source.execute(f'SELECT {", ".join(columns)} FROM "{table}"')
    copied = 0
    while rows := cursor.fetchmany(chunk_size):
        await target.copy_records_to_table(
            table,
            records=rows,
            columns=columns,
            schema_name="food_intelligence_import",
        )
        copied += len(rows)
        print(f"{table}: {copied:,}/{total:,}", flush=True)


async def migrate(source_path: Path, chunk_size: int) -> None:
    if not source_path.is_file():
        raise RuntimeError(f"SQLite source does not exist: {source_path}")

    source = sqlite3.connect(source_path)
    source.row_factory = None
    counts = source_counts(source)
    target = await asyncpg.connect(get_settings().food_database_url, timeout=15)
    try:
        staging_exists = await target.fetchval(
            "SELECT EXISTS(SELECT 1 FROM pg_namespace "
            "WHERE nspname = 'food_intelligence_import')"
        )
        imported: dict[str, int] = {}
        if staging_exists:
            try:
                imported = {
                    table: await target.fetchval(
                        f'SELECT COUNT(*) FROM food_intelligence_import."{table}"'
                    )
                    for table in TABLES
                }
            except asyncpg.PostgresError:
                imported = {}

        if imported == counts:
            print("Reusing the complete staged import.", flush=True)
        else:
            await target.execute("DROP SCHEMA IF EXISTS food_intelligence_import CASCADE")
            await target.execute(CREATE_SQL)
            for table, columns in TABLES.items():
                await copy_table(source, target, table, columns, counts[table], chunk_size)

        print("Building constraints and indexes...", flush=True)
        await target.execute(INDEX_SQL)
        imported = {
            table: await target.fetchval(
                f'SELECT COUNT(*) FROM food_intelligence_import."{table}"'
            )
            for table in TABLES
        }
        if imported != counts:
            raise RuntimeError(f"Count mismatch: source={counts}, imported={imported}")

        async with target.transaction():
            await target.execute("DROP SCHEMA IF EXISTS food_intelligence_previous CASCADE")
            exists = await target.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'food_intelligence')"
            )
            if exists:
                await target.execute(
                    "ALTER SCHEMA food_intelligence RENAME TO food_intelligence_previous"
                )
            await target.execute(
                "ALTER SCHEMA food_intelligence_import RENAME TO food_intelligence"
            )
        print(f"Migration complete: {imported}", flush=True)
    finally:
        source.close()
        await target.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--chunk-size", type=int, default=50_000)
    args = parser.parse_args()
    asyncio.run(migrate(args.source.resolve(), max(1_000, args.chunk_size)))


if __name__ == "__main__":
    main()
