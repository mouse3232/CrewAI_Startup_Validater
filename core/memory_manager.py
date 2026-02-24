"""
Shared Memory Manager — in-memory state for a single validation run.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class SharedMemory(BaseModel):
    """Holds all state for one idea-validation lifecycle."""

    idea_input: str = ""
    structured_idea: dict[str, Any] = Field(default_factory=dict)
    agent_outputs: dict[str, dict[str, Any]] = Field(default_factory=dict)
    score_history: list[dict[str, Any]] = Field(default_factory=list)
    refinement_history: list[dict[str, Any]] = Field(default_factory=list)

    # ── Helpers ──────────────────────────────────────────────────────
    def get_weakest_dimension(self) -> tuple[str, float]:
        """Return (category_name, avg_score) of the lowest-scoring agent."""
        averages = self._dimension_averages()
        if not averages:
            return ("unknown", 0.0)
        return min(averages.items(), key=lambda kv: kv[1])

    def get_iteration_count(self) -> int:
        return len(self.refinement_history)

    def add_refinement_entry(self, entry: dict[str, Any]) -> None:
        self.refinement_history.append(entry)

    # ── Internal ─────────────────────────────────────────────────────
    def _dimension_averages(self) -> dict[str, float]:
        """Compute the average numeric score per agent output group."""
        avgs: dict[str, float] = {}
        for agent_name, output in self.agent_outputs.items():
            scores = [v for v in output.values() if isinstance(v, (int, float))]
            if scores:
                avgs[agent_name] = sum(scores) / len(scores)
        return avgs
