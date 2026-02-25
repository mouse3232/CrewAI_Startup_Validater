"""
Database — SQLAlchemy engine and session factory.
Supports PostgreSQL (preferred) with automatic SQLite fallback.
"""

import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables early
load_dotenv()

logger = logging.getLogger(__name__)

# ── Resolve database URL ────────────────────────────────────────────
_configured_url = os.getenv(
    "DATABASE_URL",
    "sqlite:///data/ideas.db",  # Fallback only to SQLite for local dev
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
    """Create all tables (idempotent) and run lightweight migrations."""
    from server.db_models import (  # noqa: F401
        User, Workspace, WorkspaceMember,
        Idea, Validation, ChartData, Task, JournalEntry,
        Experiment, StickyNote, ChatMessage, Meeting, Expense,
        UserPreference, ActivityLog, AgentSession, AgentMessage,
        ProjectTab, ContentBlock, BlockRevision,
    )
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")
    except Exception as exc:
        logger.error("Failed to create tables: %s", exc)

    # Lightweight column migrations for existing tables
    _safe_add_columns()


def _safe_add_columns():
    """Add missing columns to existing tables (SQLite/Postgres safe)."""
    migrations = [
        ("ideas", "workspace_id", "INTEGER REFERENCES workspaces(id) ON DELETE CASCADE"),
        ("sticky_notes", "color", "VARCHAR(20) DEFAULT 'yellow'"),
        ("sticky_notes", "is_pinned", "INTEGER DEFAULT 0"),
        ("sticky_notes", "width", "INTEGER DEFAULT 220"),
        ("sticky_notes", "height", "INTEGER DEFAULT 200"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                logger.info("Added column %s.%s", table, column)
            except Exception:
                # Column already exists or table doesn't exist yet — safe to ignore
                try:
                    conn.rollback()
                except Exception:
                    pass
