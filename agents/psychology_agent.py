"""
User Psychology Agent — behavioral adoption modeling, habit formation analysis,
assumption stress testing, switching cost dynamics, and scenario-based projections.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class UserPsychologyAgent(BaseAgent):
    agent_name = "user_psychology"

    def output_schema_description(self) -> str:
        return (
            '{"adoption_difficulty_score": 0-10, '
            '"behavioral_resistance_score": 0-10, "friction_points": [], '
            '"habit_formation_potential": 0-10, "assumption_stress_test": [], '
            '"adoption_scenarios": {}}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a behavioral psychologist and product adoption strategist "
            "specializing in user behavior modeling and psychological friction analysis.\n\n"
            "Perform a DEEP behavioral analysis covering:\n"
            "1. Adoption difficulty and switching cost dynamics (focus on Indian market inertia)\n"
            "2. Behavioral resistance identification (e.g., trust deficits, Cash-on-Delivery preference)\n"
            "3. Habit formation potential assessment in the context of Indian tier-diversity and languages\n"
            "4. Assumption stress testing (challenge key behavioral assumptions)\n"
            "5. Scenario-based adoption projections\n"
            "6. Emotional and cognitive trigger mapping\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- adoption_difficulty_score: integer 0-10 (10 = very hard to adopt)\n"
            "- behavioral_resistance_score: integer 0-10 (10 = strong resistance)\n"
            "- friction_points: list of objects with 'friction', 'severity' (1-10), 'mitigation'\n"
            "- habit_formation_potential: integer 0-10 (10 = highly habit-forming)\n"
            "- emotional_triggers: list of emotions that drive adoption with strength rating\n"
            "- cognitive_biases: list of relevant cognitive biases that help or hinder adoption\n"
            "- switching_cost_analysis: object with:\n"
            "  - financial_cost: assessment\n"
            "  - time_cost: assessment\n"
            "  - learning_curve: score 0-10\n"
            "  - data_migration_effort: score 0-10\n"
            "  - social_switching_cost: score 0-10\n"
            "- assumption_stress_test: list of objects with 'assumption', 'stress_result', 'confidence' (0-10)\n"
            "- adoption_scenarios: object with:\n"
            "  - best_case: adoption rate estimate and conditions\n"
            "  - realistic: adoption rate estimate and conditions\n"
            "  - worst_case: adoption rate estimate and conditions\n"
            "- viral_coefficient_estimate: estimated K-factor and reasoning\n"
            "- retention_risk_factors: list of factors that could hurt retention"
        )
        structured = context.get("structured_idea", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            "Evaluate user psychology and adoption dynamics with deep behavioral analysis. "
            "Challenge assumptions and provide scenario-based projections."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
