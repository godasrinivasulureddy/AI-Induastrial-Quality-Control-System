import re
from typing import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _sqlite_columns(engine: Engine, table_name: str) -> set[str]:
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _clean_username(email: str | None, user_id: int) -> str:
    base = (email or "").split("@", 1)[0].strip().lower()
    base = re.sub(r"[^a-z0-9_]+", "_", base).strip("_")
    if not base:
        base = "user"
    return f"{base}_{user_id}"


def _backfill_usernames(connection, existing_usernames: Iterable[str]) -> None:
    used = {name for name in existing_usernames if name}
    rows = connection.execute(
        text("SELECT id, email, username FROM users WHERE username IS NULL OR username = ''")
    ).mappings()

    for row in rows:
        username = _clean_username(row["email"], row["id"])
        candidate = username
        counter = 2
        while candidate in used:
            candidate = f"{username}_{counter}"
            counter += 1
        used.add(candidate)
        connection.execute(
            text("UPDATE users SET username = :username WHERE id = :user_id"),
            {"username": candidate, "user_id": row["id"]},
        )


def migrate_sqlite_schema(engine: Engine) -> None:
    """Apply lightweight dev migrations for SQLite databases.

    SQLAlchemy create_all() creates missing tables, but it does not add new
    columns to existing tables. This keeps older local SQLite databases usable
    after model fields are added during development.
    """
    if engine.url.get_backend_name() != "sqlite":
        return

    columns = _sqlite_columns(engine, "users")
    if not columns:
        return

    with engine.begin() as connection:
        if "username" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR"))
            columns.add("username")

        if "role" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'student'"))
            columns.add("role")

        if "avatar_url" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
            columns.add("avatar_url")

        if "is_active" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            columns.add("is_active")

        if "is_admin" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            columns.add("is_admin")

        existing_usernames = [
            row[0]
            for row in connection.execute(
                text("SELECT username FROM users WHERE username IS NOT NULL AND username != ''")
            ).all()
        ]
        _backfill_usernames(connection, existing_usernames)

        connection.execute(text("UPDATE users SET role = 'student' WHERE role IS NULL OR role = ''"))
        connection.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
        connection.execute(text("UPDATE users SET is_admin = 0 WHERE is_admin IS NULL"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

    prediction_columns = _sqlite_columns(engine, "predictions")
    if prediction_columns:
        with engine.begin() as connection:
            if "source" not in prediction_columns:
                connection.execute(text("ALTER TABLE predictions ADD COLUMN source VARCHAR DEFAULT 'heuristic'"))
            if "model_version" not in prediction_columns:
                connection.execute(text("ALTER TABLE predictions ADD COLUMN model_version VARCHAR DEFAULT 'fallback-cv-v1'"))
            if "heatmap_path" not in prediction_columns:
                connection.execute(text("ALTER TABLE predictions ADD COLUMN heatmap_path VARCHAR"))
            if "detections_json" not in prediction_columns:
                connection.execute(text("ALTER TABLE predictions ADD COLUMN detections_json TEXT"))
