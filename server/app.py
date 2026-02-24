"""
FastAPI Application — main entry point.
"""

import logging
import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from server.database import init_db  # noqa: E402
from server.routes import router      # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)

app = FastAPI(
    title="AI Idea Validator",
    description="Multi-agent startup idea validation orchestrator",
    version="1.0.0",
)

# ── Static files & templates ────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# ── API routes ──────────────────────────────────────────────────────
app.include_router(router)


# ── Direct methodology route (must be BEFORE catch-all) ─────────────
from core.methodology import get_methodology  # noqa: E402

@app.get("/api/methodology")
def methodology_route():
    return get_methodology()


# ── SPA catch-all ───────────────────────────────────────────────────
@app.get("/{path:path}", response_class=HTMLResponse)
async def serve_spa(request: Request, path: str = ""):
    return templates.TemplateResponse("index.html", {"request": request})


# ── Startup events ──────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()
    logging.getLogger(__name__).info("Database initialised — tables created.")
