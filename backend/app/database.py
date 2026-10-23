from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings

settings = get_settings()

_kwargs: dict = {}
if settings.database_url.startswith("sqlite"):
    _kwargs["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.database_url:
        _kwargs["poolclass"] = StaticPool

engine = create_engine(settings.database_url, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns() -> None:
    """Tiny dev-time migration: add new nullable columns to existing tables.

    create_all() only creates missing tables, so an older tirth.db would lack newly added columns.
    This adds them in place (no data loss). Replace with Alembic before production.
    """
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing and column.nullable and column.server_default is None:
                    col_type = column.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))


def backfill_defaults() -> None:
    """Fill values for columns added after rows already existed (dev-time, idempotent)."""
    with engine.begin() as conn:
        # Places from before the admin section were all visible in the app: keep them visible.
        conn.execute(text("UPDATE places SET status = 'live' WHERE status IS NULL"))
        conn.execute(text("UPDATE users SET role = 'pilgrim' WHERE role IS NULL"))
        conn.execute(text("UPDATE users SET login_count = 0 WHERE login_count IS NULL"))
        conn.execute(text("UPDATE users SET token_version = 0 WHERE token_version IS NULL"))
        conn.execute(text("UPDATE users SET is_locked = 0 WHERE is_locked IS NULL"))
