"""
Scoring Engine — weighted formula, decision thresholds, confidence index,
scenario simulation (best/realistic/worst), and sensitivity scoring.
"""

from __future__ import annotations

import statistics
from typing import Any


# ── Weights ──────────────────────────────────────────────────────────
WEIGHTS = {
    "market_research": 0.25,
    "problem_solution_fit": 0.20,
    "business_model": 0.20,
    "technical_feasibility": 0.15,
    "user_psychology": 0.10,
    "risk_inversion": 0.10,      # inverted: 10 - failure_probability
}

WEIGHT_LABELS = {
    "market_research": "Market Research",
    "problem_solution_fit": "Problem-Solution Fit",
    "business_model": "Business Model",
    "technical_feasibility": "Technical Feasibility",
    "user_psychology": "User Psychology",
    "risk_inversion": "Risk Resilience",
}


def _agent_avg(output: dict[str, Any]) -> float:
    """Average of all numeric fields in an agent output dict."""
    nums = [v for v in output.values() if isinstance(v, (int, float))]
    return sum(nums) / len(nums) if nums else 5.0


# ── Public API ───────────────────────────────────────────────────────
def compute_final_score(agent_outputs: dict[str, dict[str, Any]]) -> float:
    """Weighted score across all agents.  Risk is inverted (10 - score)."""

    total = 0.0
    for agent_name, weight in WEIGHTS.items():
        output = agent_outputs.get(agent_name)
        if output is None:
            continue
        avg = _agent_avg(output)
        if agent_name == "risk_inversion":
            avg = 10.0 - avg
        total += weight * avg

    return round(total, 2)


def get_decision(score: float) -> str:
    if score >= 8.0:
        return "GO"
    elif score >= 6.0:
        return "IMPROVE"
    else:
        return "KILL"


def compute_confidence_index(
    agent_outputs: dict[str, dict[str, Any]],
    final_score: float,
) -> float:
    """0–100 confidence based on variance, risk, and data completeness."""

    # 1. Data completeness — how many of 6 agents reported?
    expected = len(WEIGHTS)
    present = sum(1 for k in WEIGHTS if k in agent_outputs)
    completeness = present / expected  # 0..1

    # 2. Score variance across agent averages
    avgs = []
    for name in WEIGHTS:
        out = agent_outputs.get(name)
        if out:
            a = _agent_avg(out)
            if name == "risk_inversion":
                a = 10.0 - a
            avgs.append(a)
    variance_penalty = 0.0
    if len(avgs) >= 2:
        std = statistics.stdev(avgs)
        variance_penalty = min(std / 10.0, 0.3)  # max 30% penalty

    # 3. Risk penalty
    risk_out = agent_outputs.get("risk_inversion", {})
    failure_prob = risk_out.get("failure_probability_score", 5)
    risk_penalty = (failure_prob / 10.0) * 0.2  # max 20% penalty

    confidence = max(0.0, (completeness - variance_penalty - risk_penalty)) * 100
    return round(min(confidence, 100.0), 1)


def compute_dimension_scores(agent_outputs: dict[str, dict[str, Any]]) -> dict[str, float]:
    """Return per-dimension average scores (risk inverted) for charting."""
    dims: dict[str, float] = {}
    for name in WEIGHTS:
        out = agent_outputs.get(name)
        if out:
            avg = _agent_avg(out)
            if name == "risk_inversion":
                avg = 10.0 - avg
            dims[name] = round(avg, 2)
    return dims


# ── Weighted Breakdown ───────────────────────────────────────────────
def compute_weighted_breakdown(agent_outputs: dict[str, dict[str, Any]]) -> list[dict]:
    """Return per-dimension weighted contribution to final score."""
    breakdown = []
    for name, weight in WEIGHTS.items():
        out = agent_outputs.get(name)
        if not out:
            continue
        raw = _agent_avg(out)
        adjusted = (10.0 - raw) if name == "risk_inversion" else raw
        contribution = round(weight * adjusted, 2)
        breakdown.append({
            "dimension": name,
            "label": WEIGHT_LABELS.get(name, name),
            "weight": weight,
            "weight_pct": round(weight * 100),
            "raw_score": round(raw, 2),
            "adjusted_score": round(adjusted, 2),
            "contribution": contribution,
        })
    return breakdown


# ── Scenario Simulation ─────────────────────────────────────────────
def compute_scenario_scores(agent_outputs: dict[str, dict[str, Any]]) -> dict:
    """
    Simulate Best / Realistic / Worst case scores.
    - Best case: each agent's highest numeric value (capped at 10)
    - Realistic: current weighted average (actual score)
    - Worst case: each agent's lowest numeric value
    """
    realistic = compute_final_score(agent_outputs)

    best_total = 0.0
    worst_total = 0.0

    for agent_name, weight in WEIGHTS.items():
        output = agent_outputs.get(agent_name)
        if output is None:
            continue
        nums = [v for v in output.values() if isinstance(v, (int, float))]
        if not nums:
            continue

        best = min(max(nums), 10.0)
        worst = max(min(nums), 0.0)

        if agent_name == "risk_inversion":
            best = 10.0 - worst   # low risk = best case
            worst = 10.0 - max(nums)

        best_total += weight * best
        worst_total += weight * worst

    return {
        "best_case": {
            "score": round(min(best_total, 10.0), 2),
            "decision": get_decision(min(best_total, 10.0)),
        },
        "realistic": {
            "score": realistic,
            "decision": get_decision(realistic),
        },
        "worst_case": {
            "score": round(max(worst_total, 0.0), 2),
            "decision": get_decision(max(worst_total, 0.0)),
        },
    }


# ── Sensitivity Analysis ────────────────────────────────────────────
def compute_sensitivity(agent_outputs: dict[str, dict[str, Any]]) -> list[dict]:
    """
    For each dimension, measure how much the final score changes
    if that dimension's score drops by 2 points (simulates underperformance).
    """
    baseline = compute_final_score(agent_outputs)
    results = []

    for name, weight in WEIGHTS.items():
        out = agent_outputs.get(name)
        if not out:
            continue

        # Create modified outputs with this agent scoring 2 lower
        modified = {}
        for k, v in agent_outputs.items():
            if k == name:
                modified[k] = {
                    mk: (max(mv - 2, 0) if isinstance(mv, (int, float)) else mv)
                    for mk, mv in v.items()
                }
            else:
                modified[k] = v

        new_score = compute_final_score(modified)
        delta = round(baseline - new_score, 2)

        results.append({
            "dimension": name,
            "label": WEIGHT_LABELS.get(name, name),
            "weight": weight,
            "impact_if_drops_2": delta,
            "impact_pct": round((delta / baseline * 100) if baseline else 0, 1),
        })

    results.sort(key=lambda x: x["impact_if_drops_2"], reverse=True)
    return results
