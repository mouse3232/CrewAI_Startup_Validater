"""
Technical Feasibility Agent — build difficulty, time-to-MVP, risk, tech stack.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class TechnicalFeasibilityAgent(BaseAgent):
    agent_name = "technical_feasibility"

    def output_schema_description(self) -> str:
        return (
            '{"build_difficulty_score": 0-10, "time_to_mvp": "", '
            '"risk_index": 0-10, "tech_stack_suggestion": []}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a CTO-level technical architect evaluating startup feasibility. "
            "Assess the technical complexity, development timeline, and risks.\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- build_difficulty_score: integer 0-10 (10 = extremely hard)\n"
            "- time_to_mvp: estimated time to minimum viable product (e.g., '3-4 months')\n"
            "- risk_index: integer 0-10 (technical risk level)\n"
            "- tech_stack_suggestion: list of recommended technologies\n"
            "- architecture_notes: brief architecture recommendation\n"
            "- scalability_assessment: how well the solution can scale\n"
            "- infrastructure_requirements: key infra needs"
        )
        structured = context.get("structured_idea", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            "Provide technical feasibility assessment."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
