"""Migrate ADK sessions from the local SQLite service to the configured database."""

from __future__ import annotations

import argparse
import asyncio
import sqlite3
from pathlib import Path

from google.adk.sessions.database_session_service import DatabaseSessionService
from google.adk.sessions.sqlite_session_service import SqliteSessionService

from core.config import get_settings


def source_scopes(path: Path) -> list[tuple[str, str]]:
    with sqlite3.connect(path) as connection:
        rows = connection.execute(
            "SELECT DISTINCT app_name, user_id FROM sessions ORDER BY app_name, user_id"
        ).fetchall()
    return [(row[0], row[1]) for row in rows]


async def migrate(*, source_path: Path, dry_run: bool) -> dict[str, int]:
    settings = get_settings()
    source_path = source_path.resolve()
    if not source_path.is_file():
        raise RuntimeError(f"SQLite source does not exist: {source_path}")

    scopes = source_scopes(source_path)
    source = SqliteSessionService(str(source_path))
    target = DatabaseSessionService(
        settings.session_database_url,
        pool_size=2,
        max_overflow=0,
        pool_timeout=10,
        connect_args={"timeout": 10, "command_timeout": 60},
    )
    counts = {"scopes": len(scopes), "sessions": 0, "events": 0, "skipped": 0}
    try:
        for app_name, user_id in scopes:
            listed = await source.list_sessions(
                app_name=app_name,
                user_id=user_id,
            )
            for summary in listed.sessions:
                session = await source.get_session(
                    app_name=app_name,
                    user_id=user_id,
                    session_id=summary.id,
                )
                if session is None:
                    continue
                existing = await target.get_session(
                    app_name=app_name,
                    user_id=user_id,
                    session_id=session.id,
                )
                if existing is not None:
                    counts["skipped"] += 1
                    continue
                counts["sessions"] += 1
                counts["events"] += len(session.events)
                if dry_run:
                    continue
                target_session = await target.create_session(
                    app_name=app_name,
                    user_id=user_id,
                    session_id=session.id,
                    state=session.state,
                )
                for event in sorted(session.events, key=lambda item: item.timestamp):
                    await target.append_event(session=target_session, event=event)
        return counts
    finally:
        await target.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    result = asyncio.run(migrate(source_path=args.source, dry_run=args.dry_run))
    print(
        "Migration summary: "
        f"scopes={result['scopes']} sessions={result['sessions']} "
        f"events={result['events']} skipped={result['skipped']}"
    )


if __name__ == "__main__":
    main()
