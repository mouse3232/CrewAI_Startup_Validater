"""
Model Router — Centralized registry mappings for Groq and Gemini engines.
Includes RPM/TPM limits and automatic escalation/fallback paths.
"""

from dataclasses import dataclass

@dataclass(frozen=True)
class ModelConfig:
    model: str
    max_rpm: int
    max_tpm: int
    fallback: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096
    metadata: dict | None = None

USER_DISABLED_MODELS: set[str] = set()

# ══════════════════════════════════════════════════════════════════════
#  GROQ ENGINE — 14 Models
# ══════════════════════════════════════════════════════════════════════
GROQ_MODELS = {
    "compound-mini": ModelConfig("groq/compound-mini", 30, 70000, fallback="groq/compound", max_tokens=1024, metadata={"reasoning_score": 5, "speed_score": 9, "web_enabled": True}),
    "compound": ModelConfig("groq/compound", 30, 70000, metadata={"reasoning_score": 8, "speed_score": 4, "web_enabled": True}),
    "llama-8b": ModelConfig("llama-3.1-8b-instant", 30, 6000, max_tokens=1024, metadata={"reasoning_score": 3, "speed_score": 10}),
    "llama-70b": ModelConfig("llama-3.3-70b-versatile", 30, 12000, fallback="meta-llama/llama-4-scout-17b-16e-instruct", metadata={"reasoning_score": 8, "speed_score": 7}),
    "llama-maverick": ModelConfig("meta-llama/llama-4-maverick-17b-128e-instruct", 30, 6000, metadata={"reasoning_score": 7, "speed_score": 8}),
    "llama-scout": ModelConfig("meta-llama/llama-4-scout-17b-16e-instruct", 30, 30000, fallback="openai/gpt-oss-20b", metadata={"reasoning_score": 7, "speed_score": 8}),
    "llama-guard": ModelConfig("meta-llama/llama-guard-4-12b", 30, 8000, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 6, "speed_score": 7}),
    "prompt-guard-22m": ModelConfig("meta-llama/llama-prompt-guard-2-22m", 60, 20000, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 4, "speed_score": 10}),
    "prompt-guard-86m": ModelConfig("meta-llama/llama-prompt-guard-2-86m", 60, 20000, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 5, "speed_score": 9}),
    "kimi": ModelConfig("moonshotai/kimi-k2-instruct", 60, 10000, fallback="moonshotai/kimi-k2-instruct-0905", metadata={"reasoning_score": 6, "speed_score": 8}),
    "kimi-backup": ModelConfig("moonshotai/kimi-k2-instruct-0905", 60, 10000, metadata={"reasoning_score": 6, "speed_score": 8}),
    "gpt-20b": ModelConfig("openai/gpt-oss-20b", 30, 8000, fallback="meta-llama/llama-4-scout-17b-16e-instruct", metadata={"reasoning_score": 7, "speed_score": 8}),
    "gpt-120b": ModelConfig("openai/gpt-oss-120b", 30, 8000, fallback="llama-3.3-70b-versatile", temperature=0.5, metadata={"reasoning_score": 10, "speed_score": 3}),
    "gpt-safeguard": ModelConfig("openai/gpt-oss-safeguard-20b", 30, 8000, temperature=0.0, metadata={"safety_model": True, "reasoning_score": 8, "speed_score": 6}),
}

GROQ_ROLE_REGISTRY: dict[str, ModelConfig] = {
    "orchestrator": GROQ_MODELS["gpt-120b"],
    "executive_summary": GROQ_MODELS["gpt-120b"],
    "problem_solution_fit": GROQ_MODELS["gpt-20b"],
    "technical_feasibility": GROQ_MODELS["llama-maverick"],
    "business_model": GROQ_MODELS["gpt-20b"],
    "user_psychology": GROQ_MODELS["llama-maverick"],
    "customer_persona": GROQ_MODELS["llama-scout"],
    "pricing_strategy": GROQ_MODELS["llama-scout"],
    "gtm_planner": GROQ_MODELS["llama-scout"],
    "market_research": GROQ_MODELS["compound-mini"],
    "competitor_analysis": GROQ_MODELS["compound"],
    "canvas_structuring": GROQ_MODELS["llama-70b"],
    "chart_data": GROQ_MODELS["llama-70b"],
    "comparison_synthesis": GROQ_MODELS["llama-scout"],
    "ui_formatting": GROQ_MODELS["llama-8b"],
    "qa_chat": GROQ_MODELS["kimi"],
    "input_guard": GROQ_MODELS["prompt-guard-86m"],
    "output_guard": GROQ_MODELS["llama-guard"],
    "risk_inversion": GROQ_MODELS["gpt-safeguard"],
}


# ══════════════════════════════════════════════════════════════════════
#  GEMINI ENGINE — 5 Models
# ══════════════════════════════════════════════════════════════════════
GEMINI_MODELS = {
    "gemini-3-flash": ModelConfig("gemini-3-flash-preview", 30, 40000, fallback="gemini-2.5-flash", max_tokens=4096, metadata={"reasoning_score": 4, "speed_score": 10}),
    "gemini-25-flash": ModelConfig("gemini-2.5-flash", 30, 40000, fallback="gemini-3-flash-preview", max_tokens=4096, metadata={"reasoning_score": 5, "speed_score": 9}),
    "gemini-3-pro": ModelConfig("gemini-3-pro-preview", 30, 40000, fallback="gemini-2.5-pro", max_tokens=8192, metadata={"reasoning_score": 8, "speed_score": 7}),
    "gemini-25-pro": ModelConfig("gemini-2.5-pro", 30, 40000, fallback="gemini-3-pro-preview", max_tokens=8192, metadata={"reasoning_score": 8, "speed_score": 6, "web_enabled": True}),
    "gemini-31-pro": ModelConfig("gemini-3.1-pro-preview", 30, 40000, fallback="gemini-3-pro-preview", temperature=0.5, max_tokens=8192, metadata={"reasoning_score": 10, "speed_score": 4}),
}

GEMINI_ROLE_REGISTRY: dict[str, ModelConfig] = {
    "orchestrator": GEMINI_MODELS["gemini-31-pro"],
    "executive_summary": GEMINI_MODELS["gemini-31-pro"],
    "problem_solution_fit": GEMINI_MODELS["gemini-3-pro"],
    "technical_feasibility": GEMINI_MODELS["gemini-3-pro"],
    "business_model": GEMINI_MODELS["gemini-3-pro"],
    "user_psychology": GEMINI_MODELS["gemini-3-pro"],
    "customer_persona": GEMINI_MODELS["gemini-25-pro"],
    "pricing_strategy": GEMINI_MODELS["gemini-25-pro"],
    "gtm_planner": GEMINI_MODELS["gemini-25-pro"],
    "market_research": GEMINI_MODELS["gemini-25-flash"],
    "competitor_analysis": GEMINI_MODELS["gemini-25-pro"],
    "canvas_structuring": GEMINI_MODELS["gemini-3-pro"],
    "chart_data": GEMINI_MODELS["gemini-3-pro"],
    "comparison_synthesis": GEMINI_MODELS["gemini-3-pro"],
    "ui_formatting": GEMINI_MODELS["gemini-3-flash"],
    "qa_chat": GEMINI_MODELS["gemini-3-flash"],
    "input_guard": GEMINI_MODELS["gemini-3-pro"],
    "output_guard": GEMINI_MODELS["gemini-3-pro"],
    "risk_inversion": GEMINI_MODELS["gemini-3-pro"],
}


# ══════════════════════════════════════════════════════════════════════
#  Dynamic Accessors — Engine-aware
# ══════════════════════════════════════════════════════════════════════

# Legacy alias — always points to the active engine's models
MODELS = GROQ_MODELS  # Will be swapped by get_active_models()


def get_active_models() -> dict[str, ModelConfig]:
    from core.engine_config import ACTIVE_ENGINE
    return GEMINI_MODELS if ACTIVE_ENGINE == "gemini" else GROQ_MODELS


def get_active_registry() -> dict[str, ModelConfig]:
    from core.engine_config import ACTIVE_ENGINE
    return GEMINI_ROLE_REGISTRY if ACTIVE_ENGINE == "gemini" else GROQ_ROLE_REGISTRY


def get_model_config(role_name: str) -> ModelConfig:
    registry = get_active_registry()
    models = get_active_models()
    default = list(models.values())[0]  # first model as fallback
    return registry.get(role_name, default)

