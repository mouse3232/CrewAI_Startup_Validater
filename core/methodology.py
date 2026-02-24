"""
Methodology — static data module defining every metric, formula, assumption,
and limitation used by the AI Idea Validation platform.

Served via /api/methodology as structured JSON for the Glossary & Methodology page.
"""


METRIC_DEFINITIONS = [
    {
        "id": "demand_score",
        "name": "Demand Score",
        "agent": "Market Research",
        "scale": "0–10",
        "measures": "The strength of market demand for the proposed solution, based on market size, growth trajectory, and unmet needs.",
        "calculation": "Average of demand-related numeric outputs from the Market Research agent, including market size estimates and growth indicators.",
        "strategic_meaning": "A high demand score indicates strong market pull. Scores below 5 suggest the market may be too niche, saturated, or not ready for this solution.",
    },
    {
        "id": "competition_score",
        "name": "Competition Score",
        "agent": "Market Research",
        "scale": "0–10",
        "measures": "The intensity of competitive pressure in the target market. Includes direct competitors, substitutes, and competitive density.",
        "calculation": "Composite of competitive rivalry analysis, substitute threat assessment, and Porter's Five Forces competitive intensity.",
        "strategic_meaning": "Higher scores indicate fiercer competition. Combined with differentiation score, this determines the competitive moat viability.",
    },
    {
        "id": "differentiation_score",
        "name": "Differentiation Score",
        "agent": "Problem-Solution Fit",
        "scale": "0–10",
        "measures": "How uniquely the proposed solution addresses the problem compared to existing alternatives.",
        "calculation": "Evaluation of unique value proposition, feature distinctiveness, and alternatives analysis versus current market solutions.",
        "strategic_meaning": "Scores above 7 indicate strong differentiation. Low scores signal the need for pivoting the value proposition.",
    },
    {
        "id": "build_difficulty_score",
        "name": "Build Difficulty Score",
        "agent": "Technical Feasibility",
        "scale": "0–10",
        "measures": "The technical complexity of building the MVP and scaling the solution.",
        "calculation": "Assessment of architecture complexity, technology maturity, team skill requirements, and infrastructure needs.",
        "strategic_meaning": "Scores above 7 indicate high technical risk. Should be cross-referenced with time-to-MVP and available resources.",
    },
    {
        "id": "failure_probability_score",
        "name": "Risk Probability Score",
        "agent": "Risk Inversion",
        "scale": "0–10",
        "measures": "The likelihood that the startup will fail due to identified risk factors.",
        "calculation": "Composite of critical risks severity, macro economic exposure, operational fragility, and assumption invalidation probability.",
        "strategic_meaning": "This score is INVERTED in the final calculation (10 - score) so that higher resilience contributes positively. High raw scores indicate serious risk exposure.",
    },
    {
        "id": "confidence_index",
        "name": "Confidence Index",
        "agent": "Scoring Engine",
        "scale": "0–100%",
        "measures": "How confident the system is in the accuracy and reliability of the validation result.",
        "calculation": "Formula: (data_completeness - variance_penalty - risk_penalty) × 100. Where data_completeness = agents_reporting / total_agents, variance_penalty = min(stdev / 10, 0.3), risk_penalty = (failure_prob / 10) × 0.2.",
        "strategic_meaning": "Confidence above 70% indicates reliable results. Below 50% suggests insufficient data or high disagreement between agents.",
    },
    {
        "id": "weighted_validation_score",
        "name": "Weighted Validation Score",
        "agent": "Scoring Engine",
        "scale": "0–10",
        "measures": "The final composite score representing overall idea validation strength.",
        "calculation": "Sum of (agent_average × weight) across all 6 dimensions. Risk is inverted before weighting.",
        "strategic_meaning": "8+ = GO (strong validation), 6-8 = IMPROVE (potential with fixes), <6 = KILL (fundamental issues).",
    },
    {
        "id": "refinement_delta",
        "name": "Refinement Delta",
        "agent": "Refinement Controller",
        "scale": "±points",
        "measures": "The change in validation score between refinement iterations.",
        "calculation": "new_score - previous_score after each refinement cycle. Positive delta indicates improvement.",
        "strategic_meaning": "Consistent positive deltas indicate the idea responds well to iteration. Flat or negative deltas suggest structural issues.",
    },
]


FORMULA_EXPLANATIONS = {
    "weighted_score": {
        "name": "Weighted Validation Score",
        "formula": "Σ(agent_average × weight) for all 6 dimensions",
        "weights": {
            "Market Research": "25%",
            "Problem-Solution Fit": "20%",
            "Business Model": "20%",
            "Technical Feasibility": "15%",
            "User Psychology": "10%",
            "Risk Resilience (inverted)": "10%",
        },
        "explanation": "Each agent produces multiple numeric scores. These are averaged to a single dimension score. The risk dimension is inverted (10 - raw) so that low risk scores contribute positively. All dimension scores are then multiplied by their weight and summed.",
    },
    "confidence_index": {
        "name": "Confidence Index",
        "formula": "(completeness - variance_penalty - risk_penalty) × 100",
        "components": {
            "completeness": "Fraction of agents that reported (0.0 to 1.0)",
            "variance_penalty": "min(stdev_of_agent_avgs / 10, 0.30) — penalizes high disagreement between agents",
            "risk_penalty": "(failure_probability / 10) × 0.20 — penalizes high risk exposure",
        },
        "explanation": "Confidence measures how trustworthy the final score is. High variance between agents suggests uncertainty, while missing agents reduce data completeness.",
    },
    "risk_inversion": {
        "name": "Risk Inversion Logic",
        "formula": "adjusted_risk = 10.0 - raw_failure_probability",
        "explanation": "The risk agent scores failure probability (high = bad). We invert this so that low risk (high resilience) contributes positively to the final score, aligning it with the other dimensions where higher is better.",
    },
    "decision_thresholds": {
        "name": "Decision Thresholds",
        "thresholds": {
            "GO": "Score ≥ 8.0 — Strong validation, proceed with confidence",
            "IMPROVE": "Score 6.0–7.9 — Potential identified, but critical areas need strengthening",
            "KILL": "Score < 6.0 — Fundamental issues present, pivot or abandon",
        },
        "explanation": "Thresholds are calibrated to be conservative. A GO decision requires strong performance across most dimensions. IMPROVE signals viable ideas with fixable weaknesses.",
    },
    "scenario_simulation": {
        "name": "Scenario Simulation",
        "method": "Best case uses each agent's highest score. Realistic uses actual weighted average. Worst case uses each agent's lowest score.",
        "explanation": "Scenario simulation shows the range of possible outcomes. A wide spread between best and worst case indicates high uncertainty. The realistic case is the actual validation result.",
    },
    "sensitivity_analysis": {
        "name": "Sensitivity Analysis",
        "method": "Each dimension's scores are reduced by 2 points, and the resulting impact on the final score is measured.",
        "explanation": "Identifies which dimensions have the most influence on the final outcome. High-impact dimensions should be prioritized for improvement during refinement.",
    },
}


ASSUMPTIONS_AND_LIMITATIONS = {
    "model_assumptions": [
        "Agent outputs are based on LLM reasoning, not empirical market data.",
        "Scoring assumes equal validity across all agent assessments.",
        "Market size estimates are directional, not precise financial projections.",
        "Competitive analysis is based on general knowledge, not real-time market intelligence.",
        "Financial projections (CAC, LTV, break-even) are estimates based on industry patterns.",
    ],
    "estimation_boundaries": [
        "Scores are bounded between 0 and 10 for consistency.",
        "Confidence cannot exceed 100% even with perfect data completeness.",
        "Refinement is limited to 2 cycles to prevent over-fitting.",
        "Scenario simulations assume linear score relationships.",
    ],
    "non_deterministic_areas": [
        "LLM responses may vary between runs for the same input.",
        "Market timing assessments are inherently speculative.",
        "Risk identification depends on the model's training data coverage.",
        "Cultural and regional market dynamics may not be fully captured.",
    ],
}


def get_methodology() -> dict:
    """Return the complete methodology data as a dictionary."""
    return {
        "metric_definitions": METRIC_DEFINITIONS,
        "formula_explanations": FORMULA_EXPLANATIONS,
        "assumptions_and_limitations": ASSUMPTIONS_AND_LIMITATIONS,
    }
