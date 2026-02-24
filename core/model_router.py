"""
Model Router — Centralized registry mappings for all 14 authorized models.
Includes RPM/TPM limits and automatic escalation/fallback paths.
"""

from dataclasses import dataclass

@dataclass(frozen=True)
class ModelConfig:
    model: str
    max_rpm: int
    max_tpm: int
    max_rpd: int = 0  # Requests Per Day
    fallback: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096
    metadata: dict | None = None

USER_DISABLED_MODELS: set[str] = set()

# ── Allowed Models Definition ───────────────────────────────────────
MODELS = {
    "compound-mini": ModelConfig("groq/compound-mini", 30, 70000, fallback="groq/compound", max_tokens=1024, metadata={"reasoning_score": 5, "speed_score": 9, "web_enabled": True}),
    "compound": ModelConfig("groq/compound", 30, 70000, metadata={"reasoning_score": 8, "speed_score": 4, "web_enabled": True}),
    "llama-8b": ModelConfig("llama-3.1-8b-instant", 30, 6000, max_tokens=1024, metadata={"reasoning_score": 3, "speed_score": 10}),
    "llama-70b": ModelConfig("llama-3.3-70b-versatile", 30, 12000, fallback="meta-llama/llama-4-scout-17b-16e-instruct", metadata={"reasoning_score": 8, "speed_score": 7}),
    "llama-maverick": ModelConfig("meta-llama/llama-4-maverick-17b-128e-instruct", 30, 6000, metadata={"reasoning_score": 7, "speed_score": 8}),
    "llama-scout": ModelConfig("meta-llama/llama-4-scout-17b-16e-instruct", 30, 30000, fallback="openai/gpt-oss-20b", metadata={"reasoning_score": 7, "speed_score": 8}),
    "llama-guard": ModelConfig("meta-llama/llama-guard-4-12b", 30, 8000, max_tokens=1024, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 6, "speed_score": 7}),
    "prompt-guard-22m": ModelConfig("meta-llama/llama-prompt-guard-2-22m", 60, 20000, max_tokens=512, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 4, "speed_score": 10}),
    "prompt-guard-86m": ModelConfig("meta-llama/llama-prompt-guard-2-86m", 60, 20000, max_tokens=512, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 5, "speed_score": 9}),
    "kimi": ModelConfig("moonshotai/kimi-k2-instruct", 60, 10000, fallback="moonshotai/kimi-k2-instruct-0905", metadata={"reasoning_score": 6, "speed_score": 8}),
    "kimi-backup": ModelConfig("moonshotai/kimi-k2-instruct-0905", 60, 10000, metadata={"reasoning_score": 6, "speed_score": 8}),
    "gpt-20b": ModelConfig("openai/gpt-oss-20b", 30, 8000, fallback="meta-llama/llama-4-scout-17b-16e-instruct", metadata={"reasoning_score": 7, "speed_score": 8}),
    "gpt-120b": ModelConfig("openai/gpt-oss-120b", 30, 8000, fallback="llama-3.3-70b-versatile", temperature=0.5, metadata={"reasoning_score": 10, "speed_score": 3}),
    "gpt-safeguard": ModelConfig("openai/gpt-oss-safeguard-20b", 30, 8000, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 8, "speed_score": 6}),
    
    # Gemini Models (RPM: 5, TPM: 250,000, RPD: 20)
    "gemini-3-flash": ModelConfig("gemini-3-flash-preview", 5, 250000, max_rpd=20, metadata={"reasoning_score": 8, "speed_score": 9, "provider": "google"}),
    "gemini-2.5-pro": ModelConfig("gemini-2.5-pro", 5, 250000, max_rpd=20, metadata={"reasoning_score": 9, "speed_score": 7, "provider": "google"}),
    "gemini-2.5-flash": ModelConfig("gemini-2.5-flash", 5, 250000, max_rpd=20, metadata={"reasoning_score": 8, "speed_score": 9, "provider": "google"}),
    "gemini-2.5-flash-lite": ModelConfig("gemini-2.5-flash-lite", 5, 250000, max_rpd=20, metadata={"reasoning_score": 7, "speed_score": 9, "provider": "google"}),
    "gemini-2-flash": ModelConfig("gemini-2.0-flash", 5, 250000, max_rpd=20, metadata={"reasoning_score": 8, "speed_score": 9, "provider": "google"}),
    "gemini-2-flash-lite": ModelConfig("gemini-2.0-flash-lite", 5, 250000, max_rpd=20, metadata={"reasoning_score": 7, "speed_score": 9, "provider": "google"}),
}


# ── Role Routing Registry ───────────────────────────────────────────
# Roles can now map to a single ModelConfig or a LIST of ModelConfigs for load balancing.
MODEL_REGISTRY: dict[str, ModelConfig | list[ModelConfig]] = {
    # ── High Stakes & Orchestration (OpenAI + Gemini Load Balanced)
    "orchestrator": [MODELS["gpt-120b"], MODELS["gemini-2.5-pro"]],
    "executive_summary": [MODELS["gpt-120b"], MODELS["gemini-2.5-pro"]],
    
    # ── Core Validation Logic (Analytical / Medium)
    "problem_solution_fit": [MODELS["gpt-20b"], MODELS["gemini-2.5-flash"]],
    "technical_feasibility": MODELS["llama-maverick"],
    "business_model": [MODELS["gpt-20b"], MODELS["gemini-2.5-flash"]],
    "user_psychology": MODELS["llama-maverick"],
    
    # ── Specialized Agents (Structured Output)
    "customer_persona": MODELS["llama-scout"],
    "pricing_strategy": MODELS["llama-scout"],
    "gtm_planner": MODELS["llama-scout"],
    
    # ── Web Research & Formatting
    "market_research": MODELS["compound-mini"], # Escalating to compound naturally via fallback
    "competitor_analysis": MODELS["compound"],
    
    # ── Structuring & UI Processing
    "canvas_structuring": MODELS["llama-70b"],
    "chart_data": MODELS["llama-70b"],
    "comparison_synthesis": MODELS["llama-scout"],
    "ui_formatting": MODELS["llama-8b"],
    "qa_chat": MODELS["kimi"], # conversational UI
    
    # ── Safety & Guards
    "input_guard": MODELS["prompt-guard-86m"],
    "output_guard": MODELS["llama-guard"],
    "risk_inversion": [MODELS["gpt-safeguard"], MODELS["gemini-2.5-flash-lite"]],
}

import random

def get_model_config(role_name: str) -> ModelConfig:
    """Retrieve a config for the role. If multiple exist, pick one randomly to balance load."""
    config_or_list = MODEL_REGISTRY.get(role_name, MODELS["gpt-20b"])
    if isinstance(config_or_list, list):
        return random.choice(config_or_list)
    return config_or_list
