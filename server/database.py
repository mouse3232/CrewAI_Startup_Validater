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
    is_pg = DATABASE_URL.startswith("postgresql")
    json_type = "JSON" if is_pg else "TEXT"
    json_default_dict = "DEFAULT '{}'::json" if is_pg else "DEFAULT '{}'"
    json_default_list = "DEFAULT '[]'::json" if is_pg else "DEFAULT '[]'"

    migrations = [
        # ── ideas table ──────────────────────────────────────────────
        ("ideas", "workspace_id", "INTEGER REFERENCES workspaces(id) ON DELETE CASCADE"),
        ("ideas", "structured_input", f"{json_type} {json_default_dict}"),
        ("ideas", "updated_at", "TIMESTAMP"),
        # ── validations table ────────────────────────────────────────
        ("validations", "structured_idea", f"{json_type} {json_default_dict}"),
        ("validations", "confidence_index", "FLOAT"),
        ("validations", "executive_summary", f"{json_type} {json_default_dict}"),
        ("validations", "score_history", f"{json_type} {json_default_list}"),
        ("validations", "refinement_history", f"{json_type} {json_default_list}"),
        # ── sticky_notes table ───────────────────────────────────────
        ("sticky_notes", "color", "VARCHAR(20) DEFAULT 'yellow'"),
        ("sticky_notes", "is_visible", "INTEGER DEFAULT 1"),
        ("sticky_notes", "is_pinned", "INTEGER DEFAULT 0"),
        ("sticky_notes", "position_x", "INTEGER DEFAULT 0"),
        ("sticky_notes", "position_y", "INTEGER DEFAULT 0"),
        ("sticky_notes", "width", "INTEGER DEFAULT 220"),
        ("sticky_notes", "height", "INTEGER DEFAULT 200"),
        ("sticky_notes", "assigned_user", "VARCHAR(100)"),
        ("sticky_notes", "deadline", "TIMESTAMP"),
        # ── tasks table ──────────────────────────────────────────────
        ("tasks", "priority", "VARCHAR(20) DEFAULT 'medium'"),
        ("tasks", "related_section", "VARCHAR(100)"),
        ("tasks", "assigned_agent", "VARCHAR(100)"),
        ("tasks", "start_date", "TIMESTAMP"),
        ("tasks", "deadline", "TIMESTAMP"),
        ("tasks", "progress", "INTEGER DEFAULT 0"),
        ("tasks", "updated_at", "TIMESTAMP"),
        # ── experiments table ────────────────────────────────────────
        ("experiments", "timeframe", "VARCHAR(50)"),
        ("experiments", "updated_at", "TIMESTAMP"),
        # ── meetings table ───────────────────────────────────────────
        ("meetings", "decisions", "TEXT"),
        ("meetings", "tasks_assigned", f"{json_type} {json_default_list}"),
        ("meetings", "attachments", f"{json_type} {json_default_list}"),
        ("meetings", "updated_at", "TIMESTAMP"),
        # ── expenses table ───────────────────────────────────────────
        ("expenses", "actual_cost", "FLOAT DEFAULT 0"),
        ("expenses", "date", "TIMESTAMP"),
        ("expenses", "notes", "TEXT"),
        ("expenses", "updated_at", "TIMESTAMP"),
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
