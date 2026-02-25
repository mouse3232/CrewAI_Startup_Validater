"""
Base Agent — abstract interface for all validation agents.
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Any

from core.gateway_client import GatewayClient
from core.model_router import get_model_config

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Every agent inherits from this and implements *run()*."""

    agent_name: str = "base"

    def __init__(self, client: GatewayClient):
        self.client = client
        self.config = get_model_config(self.agent_name)

    # ── Subclass contract ────────────────────────────────────────────
    @abstractmethod
    def build_messages(self, idea: str, context: dict[str, Any]) -> list[dict]:
        """Return the system + user messages for the LLM call."""

    @abstractmethod
    def output_schema_description(self) -> str:
        """Human-readable description of expected JSON output."""

    # ── Default run implementation ───────────────────────────────────
    def run(self, idea: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        context = context or {}
        messages = self.build_messages(idea, context)
        
        # Inject India-First rule into the system prompt universally
        india_rule = (
            "\n\nINDIA-FIRST & INR MANDATE:\n"
            "Unless the user explicitly specifies a different country in the input data, you MUST assume the target market is India. "
            "All currency outputs, pricing calculations, financial metrics, CAC, LTV, revenue models, and capital requirements MUST be strictly in INR (₹) formatted as '₹X'. "
            "Consider Indian market realities, compliance limits, and consumer behavior by default."
        )
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] += india_rule

        raw = self.client.chat_completion(
            config=self.config,
            messages=messages,
        )
        parsed = self._parse_json(raw)
        logger.info("[%s] completed — keys: %s", self.agent_name, list(parsed.keys()))
        return parsed

    # ── JSON helpers ─────────────────────────────────────────────────
    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        """Extract JSON from LLM output, tolerant of markdown fences."""
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strip markdown code fences
        match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Last resort: find first { … }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass

        logger.warning("Failed to parse JSON from LLM output, returning raw text")
        return {"raw_output": text}
