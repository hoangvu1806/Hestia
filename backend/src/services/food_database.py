"""PostgreSQL access for the shared food-intelligence schema."""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row

from core.config import get_settings


def connect_food_database() -> psycopg.Connection[dict[str, Any]]:
    return psycopg.connect(
        get_settings().food_database_url,
        row_factory=dict_row,
        options="-c search_path=food_intelligence,public",
        connect_timeout=10,
    )
