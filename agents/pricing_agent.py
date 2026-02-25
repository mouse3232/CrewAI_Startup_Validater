"""
Pricing Advisor Agent — Analyzes willingness to pay, unit economics, and monetization models.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class PricingAdvisorAgent(BaseAgent):
    agent_name = "pricing_strategy"

    def output_schema_description(self) -> str:
        return (
            '{"monetization_models": [], "pricing_tiers": [], '
            '"willingness_to_pay_assessment": "", "unit_economics": "", '
            '"pricing_risks": [], "sources": []}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a SaaS Pricing and Monetization Strategist.\n\n"
            "Analyze the business potential and output ONLY valid JSON with:\n"
            "- monetization_models: list of 2-3 recommended revenue models (e.g. freemium, usage-based, customized for Indian market realities)\n"
            "- pricing_tiers: list of suggested tiers (name, price range in ₹, features, considering UPI/EMI adoption)\n"
            "- willingness_to_pay_assessment: evaluation of target market's budget and Indian price sensitivity (Tier 1 vs Tier 2/3)\n"
            "- unit_economics: brief est. of LTV and CAC considerations (strictly in ₹)\n"
            "- pricing_risks: list of challenges (e.g., race to bottom, perceived value, subscription resistance)\n"
            "- sources: list of any specific real-world trends, statistics, or reports hypothetically cited"
        )
        user = f"Idea:\n{idea}\n\nContext:\n{context.get('structured_idea')}"
        if context.get("improvements"):
            user += f"\n\nImprove following areas: {context['improvements']}"
        return [{"role": "system", "content": system}, {"role": "user", "content": user}]
