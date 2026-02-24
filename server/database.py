"""
Database — SQLAlchemy engine and session factory.
Supports PostgreSQL (preferred) with automatic SQLite fallback.
"""

import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

# ── Resolve database URL ────────────────────────────────────────────
_configured_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/idea_validator",
)

def _resolve_db_url() -> str:
    """Try PostgreSQL first; fall back to SQLite if unavailable."""
    if _configured_url.startswith("postgresql"):
        try:
            test_engine = create_engine(_configured_url, pool_pre_ping=True)
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            test_engine.dispose()
            logger.info("Connected to PostgreSQL successfully.")
            return _configured_url
        except Exception as exc:
            logger.warning(
                "PostgreSQL unavailable (%s). Falling back to SQLite.", exc
            )

    # Fallback: SQLite in project data/ directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    sqlite_path = os.path.join(data_dir, "ideas.db")
    sqlite_url = f"sqlite:///{sqlite_path}"
    logger.info("Using SQLite database at %s", sqlite_path)
    return sqlite_url


DATABASE_URL = _resolve_db_url()

_engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("postgresql"):
    _engine_kwargs.update(pool_size=5, max_overflow=10)

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency — yields a DB session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables (idempotent)."""
    from server.db_models import Idea, Validation, ChartData, Task, JournalEntry, Experiment, StickyNote  # noqa: F401
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")
    except Exception as exc:
        logger.error("Failed to create tables: %s", exc)
