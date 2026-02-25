"""
Engine Config — Global AI engine mode selector.
Manages switching between Gemini and Groq execution stacks.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

logger = logging.getLogger(__name__)

# ── Active Engine State ─────────────────────────────────────────────
ACTIVE_ENGINE: str = "groq"  # "groq" | "gemini"


def get_engine() -> str:
    return ACTIVE_ENGINE


def switch_engine(mode: str) -> dict:
    """
    Switch the active AI engine. Validates API key, resets tracker, 
    and swaps the model registry.
    Returns {"status": "success"} or raises RuntimeError.
    """
    global ACTIVE_ENGINE

    mode = mode.lower().strip()
    if mode not in ("groq", "gemini"):
        raise ValueError(f"Invalid engine mode: {mode}. Must be 'groq' or 'gemini'.")

    if mode == ACTIVE_ENGINE:
        return {"status": "success", "message": f"Already in {mode} mode.", "mode": mode}

    # Validate API key for the target engine
    if mode == "gemini":
        key = os.getenv("GEMINI_API_KEY")
        if not key or key.startswith("your_"):
            raise RuntimeError("GEMINI_API_KEY is not set in .env. Please add it before switching.")
    else:
        key = os.getenv("GATEWAY_API_KEY") or os.getenv("GROQ_API_KEY")
        if not key or key.startswith("your_"):
            raise RuntimeError("GROQ_API_KEY is not set in .env. Please add it before switching.")

    # Reset the token tracker sliding window
    from core.token_tracker import tracker
    tracker.reset()

    # Swap engine
    ACTIVE_ENGINE = mode
    logger.info("AI Engine switched to %s mode.", mode.upper())

    return {"status": "success", "message": f"AI Engine switched to {mode.capitalize()} Mode.", "mode": mode}
