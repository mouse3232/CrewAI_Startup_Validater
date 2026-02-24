"""
GTM Planner Agent — Outlines go-to-market channels, early adopter targets, and viral loops.
"""

from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent


class GTMPlannerAgent(BaseAgent):
    agent_name = "gtm_planner"

    def output_schema_description(self) -> str:
        return (
            '{"acquisition_channels": [], "launch_strategy": "", '
            '"early_adopter_targets": [], "marketing_hooks": [], '
            '"viral_loops": "", "sources": []}'
        )

    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        system = (
            "You are a Go-To-Market (GTM) and Growth Marketing Executive.\n\n"
            "Outline a growth strategy and output ONLY valid JSON with:\n"
            "- acquisition_channels: prioritized list of 3-5 marketing channels with estimated CAC profile\n"
            "- launch_strategy: step-by-step 30-day launch plan summary\n"
            "- early_adopter_targets: where exactly to find the first 100 users\n"
            "- marketing_hooks: 3-5 specific copywriting angles or hooks\n"
            "- viral_loops: how the product can naturally spread\n"
            "- sources: list of any specific real-world trends, statistics, or reports hypothetically cited"
        )
        user = f"Idea:\n{idea}\n\nContext:\n{context.get('structured_idea')}"
        if context.get("improvements"):
            user += f"\n\nImprove following areas: {context['improvements']}"
        return [{"role": "system", "content": system}, {"role": "user", "content": user}]
