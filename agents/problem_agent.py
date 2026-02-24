"""
Problem-Solution Fit Agent — pain, clarity, differentiation scoring.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class ProblemSolutionFitAgent(BaseAgent):
    agent_name = "problem_solution_fit"

    def output_schema_description(self) -> str:
        return (
            '{"pain_score": 0-10, "clarity_score": 0-10, '
            '"differentiation_score": 0-10, "problem_summary": ""}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a product-market fit analyst. Evaluate how well the proposed solution "
            "addresses a real, painful problem and how differentiated it is.\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- pain_score: integer 0-10 (severity of the problem)\n"
            "- clarity_score: integer 0-10 (clarity of problem definition)\n"
            "- differentiation_score: integer 0-10 (uniqueness vs existing solutions)\n"
            "- problem_summary: detailed analysis of problem-solution fit\n"
            "- target_persona: ideal customer profile\n"
            "- alternatives_analysis: how users currently solve this problem"
        )
        structured = context.get("structured_idea", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            "Evaluate the problem-solution fit."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
