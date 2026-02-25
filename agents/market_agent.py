"""
Market Research Agent — deep market intelligence with Porter's Five Forces,
industry lifecycle analysis, competitive density, and market saturation scoring.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class MarketResearchAgent(BaseAgent):
    agent_name = "market_research"

    def output_schema_description(self) -> str:
        return (
            '{"demand_score": 0-10, "competition_score": 0-10, '
            '"market_summary": "", "opportunity_gap": "", '
            '"market_size_estimate": "", "growth_trajectory": "", '
            '"industry_forces": {}, "market_saturation_index": 0-10, '
            '"entry_barriers": [], "substitute_threats": [], '
            '"trend_lifecycle_position": ""}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a world-class market intelligence analyst specializing in startup "
            "market validation, industry force modeling, and competitive landscape mapping.\n\n"
            "Perform a DEEP market analysis covering:\n"
            "1. Market demand strength and growth trajectory in the Indian sub-continent (or specified region)\n"
            "2. Porter's Five Forces analysis for this industry\n"
            "3. Entry barrier estimation (including Indian regulatory constraints, Startup India/MSME policies)\n"
            "4. Competitive density (prioritize finding Indian competitors and alternatives first)\n"
            "5. Trend lifecycle positioning (Emerging / Growth / Mature / Declining)\n"
            "6. Market saturation index\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- demand_score: integer 0-10 (market demand strength)\n"
            "- competition_score: integer 0-10 (10 = extremely competitive)\n"
            "- market_summary: detailed market analysis (3-4 sentences)\n"
            "- opportunity_gap: specific gap this idea fills\n"
            "- market_size_estimate: TAM/SAM/SOM estimates with numbers\n"
            "- growth_trajectory: projected market growth rate and timeline\n"
            "- key_competitors: list of 3-5 main competitors with their strengths\n"
            "- distribution_channels: recommended go-to-market channels\n"
            "- industry_forces: object with Porter's Five Forces:\n"
            "  - competitive_rivalry: score 0-10 and explanation\n"
            "  - supplier_power: score 0-10 and explanation\n"
            "  - buyer_power: score 0-10 and explanation\n"
            "  - threat_of_substitution: score 0-10 and explanation\n"
            "  - threat_of_new_entry: score 0-10 and explanation\n"
            "- market_saturation_index: integer 0-10 (10 = fully saturated)\n"
            "- entry_barriers: list of barriers with severity (low/medium/high)\n"
            "- substitute_threats: list of substitute products/services\n"
            "- trend_lifecycle_position: one of Emerging/Growth/Mature/Declining\n"
            "- market_timing_assessment: is the timing favorable and why"
        )
        structured = context.get("structured_idea", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            "Provide a thorough, consultant-grade market analysis with specific numbers and data points."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
