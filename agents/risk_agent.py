"""
Risk Inversion Agent — macro economic exposure, regulatory risk, operational fragility,
systemic vulnerability detection, sensitivity analysis, and failure mode mapping.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class RiskInversionAgent(BaseAgent):
    agent_name = "risk_inversion"

    def output_schema_description(self) -> str:
        return (
            '{"failure_probability_score": 0-10, '
            '"critical_risks": [], "invalid_assumptions": [], '
            '"macro_economic_exposure": {}, "regulatory_risks": [], '
            '"operational_fragility_score": 0-10, "sensitivity_analysis": {}}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a senior risk analyst and red-team strategist. You think in inversions — "
            "instead of asking 'how can this succeed?', you ask 'how can this fail?'.\n\n"
            "Perform a DEEP risk analysis covering:\n"
            "1. Failure mode identification and probability scoring\n"
            "2. Macro economic exposure mapping (specifically Indian economy factors)\n"
            "3. Regulatory and compliance risk detection (RBI policies, Startup India laws, Data Protection Act)\n"
            "4. Operational fragility assessment (infrastructure, supply chain in India)\n"
            "5. Systemic vulnerability detection\n"
            "6. Sensitivity analysis (which variables most affect outcome)\n"
            "7. Moats Assessment: Analyze the strength of Brand, Network Effects, Switching Cost, Data Advantage, Capital Barrier, and Speed Advantage.\n\n"
            "Output ONLY valid JSON with these keys:\n"
            "- failure_probability_score: integer 0-10 (10 = very likely to fail)\n"
            "- critical_risks: list of objects with 'risk', 'severity' (1-10), 'likelihood' (1-10), 'mitigation'\n"
            "- risk_categorization: object with Market, Financial, Execution, Regulatory, and Technology risks (lists of objects)\n"
            "- moats_analysis: object with Brand, NetworkEffects, SwitchingCost, DataAdvantage, CapitalBarrier, SpeedAdvantage (each with 'score' 0-10 and 'reasoning')\n"
            "- invalid_assumptions: list of assumptions that may be wrong with reasoning\n"
            "- worst_case_scenario: description of worst outcome\n"
            "- macro_economic_exposure: object with:\n"
            "  - recession_sensitivity: score 0-10 and explanation\n"
            "  - inflation_impact: score 0-10 and explanation\n"
            "  - interest_rate_sensitivity: score 0-10 and explanation\n"
            "  - currency_risk: score 0-10 and explanation\n"
            "- regulatory_risks: list of objects with 'risk', 'jurisdiction' (e.g. India), 'severity', 'timeline'\n"
            "- operational_fragility_score: integer 0-10 (10 = extremely fragile operations)\n"
            "- operational_risks: list of key operational failure points\n"
            "- systemic_vulnerabilities: list of systemic/structural risks\n"
            "- sensitivity_analysis: object mapping key variables to their impact:\n"
            "  - each key is a variable name, value is object with 'impact_score' (0-10) and 'explanation'\n"
            "- market_timing_risk: is timing right? score 0-10 with reasoning\n"
            "- dependency_risks: critical external dependencies that could fail\n"
            "- risk_mitigation_roadmap: prioritized list of risk mitigation actions"
        )
        structured = context.get("structured_idea", {})
        agent_outputs = context.get("agent_outputs", {})
        user = (
            f"Startup Idea: {idea}\n\n"
            f"Structured Context: {structured}\n\n"
            f"Other Agent Analyses: {agent_outputs}\n\n"
            "Perform a thorough, adversarial risk inversion analysis. "
            "Be brutally honest. Challenge every assumption. Identify every failure mode."
        )
        if context.get("improvements"):
            user += f"\n\nFocus on improving: {context['improvements']}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
