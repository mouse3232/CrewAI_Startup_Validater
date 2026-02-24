"""
Refinement Controller — identifies weakest dimension, proposes improvements,
manages iteration limits.
"""

from __future__ import annotations

import logging
from typing import Any

from core.memory_manager import SharedMemory
from core.scoring_engine import compute_dimension_scores

logger = logging.getLogger(__name__)

MAX_REFINEMENT_CYCLES = 2


def should_refine(score: float, iteration: int) -> bool:
    return score < 8.0 and iteration < MAX_REFINEMENT_CYCLES


def identify_weakest(agent_outputs: dict[str, dict[str, Any]]) -> str:
    dims = compute_dimension_scores(agent_outputs)
    if not dims:
        return "market_research"
    return min(dims, key=dims.get)


def build_refinement_prompt(weakest: str, memory: SharedMemory) -> str:
    """Construct a prompt that asks the orchestrator how to improve the weakest area."""
    idea = memory.structured_idea or {"description": memory.idea_input}
    prev_output = memory.agent_outputs.get(weakest, {})

    label = weakest.replace("_", " ").title()
    return (
        f"The startup idea scored lowest on **{label}**.\n\n"
        f"Previous analysis for this dimension:\n```json\n{prev_output}\n```\n\n"
        f"Idea context:\n```json\n{idea}\n```\n\n"
        "Suggest specific, actionable improvements that would raise this dimension's "
        "score.  Output a JSON object with keys: `improvements` (list of strings) and "
        "`revised_context` (any extra information the re-analysis should consider)."
    )


def log_iteration_delta(
    memory: SharedMemory,
    iteration: int,
    prev_score: float,
    new_score: float,
    weakest: str,
) -> None:
    delta = round(new_score - prev_score, 2)
    entry = {
        "iteration": iteration,
        "weakest_dimension": weakest,
        "prev_score": prev_score,
        "new_score": new_score,
        "delta": delta,
    }
    memory.add_refinement_entry(entry)
    logger.info("Refinement #%d  Δ=%+.2f  (weakest=%s)", iteration, delta, weakest)
