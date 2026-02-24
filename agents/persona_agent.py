"""
Customer Persona Agent — Profiles the target audience, psychographics, and day-to-day workflow.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class CustomerPersonaAgent(BaseAgent):
    agent_name = "customer_persona"

    def output_schema_description(self) -> str:
        return (
            '{"ideal_customer_profiles": [], "psychographics": {}, '
            '"primary_pain_points": [], "daily_workflow_impact": "", '
            '"objections_to_adoption": [], "sources": []}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a UX Researcher and Customer Persona Expert specializing in "
            "startup targeting.\n\n"
            "Analyze the target audience and output ONLY valid JSON with:\n"
            "- ideal_customer_profiles: list of 2-3 specific profiles (demographics, job title, etc)\n"
            "- psychographics: object with values, motivations, and fears\n"
            "- primary_pain_points: list of 3-5 acute pains the user faces\n"
            "- daily_workflow_impact: description of how this product fits into their day\n"
            "- objections_to_adoption: list of reasons they might say 'no'\n"
            "- sources: list of any specific real-world trends, statistics, or reports hypothetically cited"
        )
        user = f"Idea:\n{idea}\n\nContext:\n{context.get('structured_idea')}"
        if context.get("improvements"):
            user += f"\n\nImprove following areas: {context['improvements']}"
        return [{"role": "system", "content": system}, {"role": "user", "content": user}]
