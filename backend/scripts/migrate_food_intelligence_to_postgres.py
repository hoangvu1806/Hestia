"""Synchronize the versioned food-intelligence snapshot into PostgreSQL."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import sqlite3
from pathlib import Path

import asyncpg
import boto3
from botocore.config import Config

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

MIGRATION_LOCK_ID = 4_837_669_142_056_973_553


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_source(path: Path, expected_sha256: str | None) -> bool:
    if not path.is_file():
        return False
    return not expected_sha256 or sha256(path) == expected_sha256.lower()


def download_source(path: Path, key: str, expected_sha256: str | None) -> None:
    settings = get_settings()
    if not all(
        (
            settings.s3_endpoint_url,
            settings.s3_access_key_id,
            settings.s3_secret_access_key,
            settings.s3_bucket,
        )
    ):
        raise RuntimeError("The food snapshot is missing and S3 storage is not configured.")

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.download")
    temporary.unlink(missing_ok=True)
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=120,
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path"},
        ),
    )
    print(f"Downloading s3://{settings.s3_bucket}/{key}...", flush=True)
    try:
        client.download_file(settings.s3_bucket, key, str(temporary))
        if not verify_source(temporary, expected_sha256):
            raise RuntimeError("Downloaded food snapshot failed SHA-256 verification.")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def ensure_source(path: Path, key: str | None, expected_sha256: str | None) -> None:
    if verify_source(path, expected_sha256):
        print(f"Using cached food snapshot: {path}", flush=True)
        return
    if path.exists():
        print("Cached food snapshot is invalid; replacing it.", flush=True)
        path.unlink()
    if not key:
        raise RuntimeError(f"SQLite source does not exist or is invalid: {path}")
    download_source(path, key, expected_sha256)


def source_counts(connection: sqlite3.Connection) -> dict[str, int]:
    return {
        table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        for table in TABLES
    }


async def schema_counts(connection: asyncpg.Connection, schema: str) -> dict[str, int] | None:
    if not await schema_exists(connection, schema):
        return None
    try:
        return {
            table: await connection.fetchval(f'SELECT COUNT(*) FROM "{schema}"."{table}"')
            for table in TABLES
        }
    except asyncpg.PostgresError:
        return None


async def schema_exists(connection: asyncpg.Connection, schema: str) -> bool:
    return bool(
        await connection.fetchval(
            "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = $1)", schema
        )
    )


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
    source = sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True)
    source.row_factory = None
    counts = source_counts(source)
    target = await asyncpg.connect(get_settings().food_database_url, timeout=15)
    try:
        await target.execute("SELECT pg_advisory_lock($1)", MIGRATION_LOCK_ID)
        if await schema_counts(target, "food_intelligence") == counts:
            print(f"Food-intelligence schema is current: {counts}", flush=True)
            return

        await target.execute("DROP SCHEMA IF EXISTS food_intelligence_import CASCADE")
        await target.execute(CREATE_SQL)
        for table, columns in TABLES.items():
            await copy_table(source, target, table, columns, counts[table], chunk_size)

        print("Building constraints and indexes...", flush=True)
        await target.execute(INDEX_SQL)
        imported = await schema_counts(target, "food_intelligence_import")
        if imported != counts:
            raise RuntimeError(f"Count mismatch: source={counts}, imported={imported}")

        async with target.transaction():
            await target.execute("DROP SCHEMA IF EXISTS food_intelligence_previous CASCADE")
            if await schema_exists(target, "food_intelligence"):
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
    parser.add_argument("--s3-key")
    parser.add_argument("--sha256")
    parser.add_argument("--chunk-size", type=int, default=50_000)
    args = parser.parse_args()
    source_path = args.source.resolve()
    ensure_source(source_path, args.s3_key, args.sha256)
    asyncio.run(migrate(source_path, max(1_000, args.chunk_size)))


if __name__ == "__main__":
    main()
