"""
Business Model Agent — unit economics, CAC/LTV simulation, pricing elasticity,
revenue sustainability, and break-even scenario modeling.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class BusinessModelAgent(BaseAgent):
    agent_name = "business_model"

    def output_schema_description(self) -> str:
        return (
            '{"revenue_strength_score": 0-10, "monetization_risk_score": 0-10, '
            '"pricing_strategy": "", "unit_economics": {}, '
            '"break_even_scenarios": {}, "revenue_sustainability_score": 0-10}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a senior business strategist and financial modeler specializing in "
            "startup revenue architecture, unit economics, and pricing strategy.\n\n"
            "Perform a DEEP business model analysis covering:\n"
            "1. Revenue model viability and strength\n"
            "2. Unit economics modeling (CAC, LTV, LTV/CAC ratio)\n"
            "3. Pricing elasticity reasoning\n"
            "4. Revenue sustainability analysis\n"
            "5. Market Sizing: Calculate TAM, SAM, and SOM based on the target audience.\n"
            "6. Detailed Cost Breakdown: Estimate Fixed Costs, Variable Costs, Infrastructure, and Team Costs.\n"
            "7. Cash Flow Projection: Estimate Monthly Inflow, Monthly Burn, and Break-even points.\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- revenue_strength_score: integer 0-10 (revenue potential)\n"
            "- monetization_risk_score: integer 0-10 (10 = very risky monetization)\n"
            "- pricing_strategy: recommended pricing approach with justification\n"
            "- financial_breakdown: object with:\n"
            "  - revenue_streams: list of objects with 'name' and 'estimated_contribution_pct'\n"
            "  - market_sizing: object with 'tam', 'sam', 'som' (values and reasoning)\n"
            "  - cost_breakdown: object with 'fixed_costs', 'variable_costs', 'cac', 'infrastructure', 'team_costs'\n"
            "  - cash_flow_projection: object with 'monthly_inflow', 'monthly_burn', 'break_even_estimate'\n"
            "- unit_economics: object with:\n"
            "  - estimated_cac: estimated customer acquisition cost with reasoning\n"
            "  - estimated_ltv: estimated lifetime value with reasoning\n"
            "  - ltv_cac_ratio: calculated ratio and health assessment\n"
            "  - gross_margin_estimate: percentage estimate\n"
            "  - payback_period: estimated months to recoup CAC\n"
            "- pricing_elasticity: assessment of price sensitivity (low/medium/high) with reasoning\n"
            "- revenue_sustainability_score: integer 0-10 (long-term revenue durability)\n"
            "- break_even_scenarios: object with:\n"
            "  - optimistic: months to break-even and assumptions\n"
            "  - realistic: months to break-even and assumptions\n"
            "  - pessimistic: months to break-even and assumptions\n"
            "- financial_risks: list of key financial risks\n"
            "- moat_assessment: strength of competitive moat (weak/moderate/strong) with reasoning"
        )
        structured = context.get("structured_idea", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            "Evaluate the business model with investor-grade financial rigor. "
            "Provide specific numbers, ratios, and scenario projections."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
