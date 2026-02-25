"""
Orchestrator Agent — parses idea, structures problem, generates strategic canvas
with per-block intelligence (strength/weakness/risk), cross-block dependency mapping,
and produces the final executive decision.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class OrchestratorAgent(BaseAgent):
    agent_name = "orchestrator"

    def output_schema_description(self) -> str:
        return (
            '{"structured_idea": {}, "summary": "", '
            '"key_assumptions": [], "target_market": "", '
            '"value_proposition": "", "business_model_canvas": {}, '
            '"canvas_intelligence": {}, "cross_block_dependencies": []}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a senior startup strategist, venture advisor, and orchestrator. "
            "Your job is to deeply analyze a raw startup idea and produce a "
            "comprehensive, investor-grade structured breakdown.\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- structured_idea: object with fields: problem, solution, target_audience, "
            "  unique_value, revenue_model, key_metrics\n"
            "- summary: one-paragraph executive summary\n"
            "- key_assumptions: list of critical assumptions to validate\n"
            "- target_market: description of primary market segment\n"
            "- value_proposition: clear value proposition statement\n"
            "- business_model_canvas: object with keys: key_partners, key_activities, "
            "  key_resources, value_propositions, customer_relationships, channels, "
            "  customer_segments, cost_structure, revenue_streams\n"
            "  (each key should be a list of specific, actionable items)\n"
            "- canvas_intelligence: object with same keys as canvas, each containing:\n"
            "  - strength: assessment of this block's strength (weak/moderate/strong)\n"
            "  - weakness: key weakness or gap\n"
            "  - risk_exposure: integer 0-10\n"
            "  - strategic_commentary: 1-2 sentence strategic insight\n"
            "  - optimization_recommendation: specific improvement suggestion\n"
            "- cross_block_dependencies: list of objects with:\n"
            "  - from_block: source canvas block\n"
            "  - to_block: dependent canvas block\n"
            "  - relationship: description of dependency\n"
            "  - impact_strength: integer 1-10\n"
            "- industry_context: object with:\n"
            "  - industry_maturity: Emerging/Growth/Mature/Declining\n"
            "  - competitive_density: Low/Medium/High\n"
            "  - market_forces: list of key forces affecting this market"
        )
        user = f"Analyze this startup idea:\n\n{idea}"
        if context.get("structured_input"):
            import json
            user += f"\n\nHere is the exact structured input provided by the founder:\n{json.dumps(context['structured_input'], indent=2)}"
            
        if context.get("improvements"):
            user += (
                f"\n\nPrevious analysis had weaknesses. Consider these improvements:\n"
                f"{context['improvements']}"
            )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    # ── Aggregation helper (called outside normal run) ───────────────
    def aggregate_decision(
        self,
        idea: str,
        agent_outputs: dict[str, Any],
        final_score: float,
        decision: str,
        confidence: float,
    ) -> dict[str, Any]:
        """Generate a narrative summary of the final decision."""
        system = (
            "You are the lead analyst producing an investor-grade executive report. "
            "Synthesize all validation results into a comprehensive strategic summary.\n\n"
            "Output JSON with keys:\n"
            "- executive_summary: 2-3 paragraph narrative covering the overall assessment\n"
            "- strengths: list of top 5 strengths with supporting evidence\n"
            "- weaknesses: list of key weaknesses with severity rating\n"
            "- recommendations: list of 5 prioritized, actionable next steps\n"
            "- market_forces: key market dynamics identified\n"
            "- key_trends: emerging trends relevant to the idea\n"
            "- industry_forces: competitive and regulatory forces\n"
            "- macro_economic_forces: broader economic factors\n"
            "- scenario_projections: object with:\n"
            "  - best_case: description and probability\n"
            "  - realistic: description and probability\n"
            "  - worst_case: description and probability\n"
            "- investor_readiness_score: integer 0-10 (how ready for investment)\n"
            "- key_metrics_to_track: list of 5 critical KPIs to monitor\n"
            "- metrics: object with fields: tam (Total Addressable Market size string), sam (Serviceable string), som (Obtainable string), margins (Margin est string). Use 'TBD' if unclear."
        )
        user = (
            f"Idea: {idea}\n\n"
            f"Final Score: {final_score}/10\n"
            f"Decision: {decision}\n"
            f"Confidence: {confidence}%\n\n"
            f"Agent Outputs:\n{agent_outputs}"
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        raw = self.client.chat_completion(
            model=self.config.model,
            messages=messages,
            temperature=0.5,
            max_tokens=4096,
        )
        return self._parse_json(raw)
