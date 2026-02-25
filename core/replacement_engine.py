"""
Replacement Engine — Handles dynamic fallback matrices and smart model selection.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# This will receive `MODELS` and `USER_DISABLED_MODELS` from model_router
# to prevent circular imports if it were the other way, but we will put it alongside model_router logically.

def get_replacement_model(original_key: str, models_registry: dict, disabled_models: set, usage_metrics: dict, task_type: str = "general"):
    """
    Finds the best replacement model based on matrix or smart selection.
    """
    fallback_matrix = {
        "gpt-120b": ["llama-70b", "llama-scout", "llama-maverick", "kimi"],
        "gpt-20b": ["llama-70b", "llama-maverick", "kimi", "llama-8b"],
        "gpt-safeguard": ["llama-guard", "prompt-guard-86m", "prompt-guard-22m"],
        "llama-70b": ["llama-scout", "gpt-20b", "kimi", "llama-maverick"]
    }

    # 1. Use manual fallback list if defined
    if original_key in fallback_matrix:
        for candidate_key in fallback_matrix[original_key]:
            if candidate_key in models_registry and candidate_key not in disabled_models:
                candidate = models_registry[candidate_key]
                # Check RPM/TPM
                usage = usage_metrics.get(candidate.model, {"rpm": 0, "tpm": 0})
                rpm_ratio = usage["rpm"] / candidate.max_rpm if candidate.max_rpm else 0
                tpm_ratio = usage["tpm"] / candidate.max_tpm if candidate.max_tpm else 0
                if rpm_ratio < 0.9 and tpm_ratio < 0.9:
                    return candidate_key, candidate

    # 2. Smart Selection if matrix failed or undefined
    weight_reasoning = 1.0
    weight_speed = 0.5
    weight_capacity = 1.0
    
    if task_type in ("deep_strategy", "orchestrator", "executive_summary"):
        weight_reasoning = 2.0
        weight_speed = 0.2
    elif task_type in ("safety_check", "input_guard", "output_guard", "risk_inversion"):
        weight_reasoning = 1.0
        weight_speed = 1.0
    elif task_type in ("formatting", "ui_formatting", "chart_data"):
        weight_reasoning = 0.5
        weight_speed = 2.0
        
    best_score = -1
    best_candidate_key = None
    best_candidate = None
    
    for key, model in models_registry.items():
        if key in disabled_models:
            continue
            
        is_safety = model.metadata.get("safety_model", False) if model.metadata else False
        if task_type in ("safety_check", "input_guard", "output_guard", "risk_inversion") and not is_safety:
            continue
        if task_type not in ("safety_check", "input_guard", "output_guard", "risk_inversion") and is_safety:
            continue # Don't use safety models for reasoning
        
        # Check capacity
        usage = usage_metrics.get(model.model, {"rpm": 0, "tpm": 0})
        rpm_ratio = usage["rpm"] / model.max_rpm if model.max_rpm else 0
        tpm_ratio = usage["tpm"] / model.max_tpm if model.max_tpm else 0
        if rpm_ratio >= 1.0 or tpm_ratio >= 1.0:
            continue # Rate limited
            
        available_quota = 1.0 - max(rpm_ratio, tpm_ratio)
        
        reasoning = model.metadata.get("reasoning_score", 5) if model.metadata else 5
        speed = model.metadata.get("speed_score", 5) if model.metadata else 5
        
        score = (weight_reasoning * reasoning) + (weight_capacity * available_quota * 10) + (weight_speed * speed)
        
        if score > best_score:
            best_score = score
            best_candidate_key = key
            best_candidate = model
            
    return best_candidate_key, best_candidate
