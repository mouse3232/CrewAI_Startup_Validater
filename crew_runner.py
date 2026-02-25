"""
Crew Runner — orchestrates the full validation pipeline.

Execution Flow (per GROQ Multi-Model Orchestration Guide):
  1. Orchestrator structures the idea             → gpt-oss-120b
  2. Market analysis (first, feeds into others)   → qwen/qwen3-32b  
  3. Core reasoning agents in parallel            → gpt-oss-20b  
  4. Risk inversion (after main reasoning)        → gpt-oss-safeguard-20b  
  5. Scoring engine computes score + decision
  6. Refinement loop (max 2 cycles)
  7. Executive summary / strategic synthesis       → gpt-oss-120b  
  8. Chart structuring                             → llama-3.3-70b-versatile (via chart payloads)
  9. Safety guard on final output                  → llama-guard-4-12b  
"""

from __future__ import annotations

import asyncio
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from server.database import SessionLocal
from server.db_models import AgentSession, AgentMessage

from core.gateway_client import GatewayClient
from core.memory_manager import SharedMemory
from core.model_router import get_model_config
from core.scoring_engine import (
    compute_final_score,
    get_decision,
    compute_confidence_index,
    compute_dimension_scores,
)
from core.refinement_controller import (
    should_refine,
    identify_weakest,
    build_refinement_prompt,
    log_iteration_delta,
)
from agents.orchestrator import OrchestratorAgent
from agents.market_agent import MarketResearchAgent
from agents.problem_agent import ProblemSolutionFitAgent
from agents.technical_agent import TechnicalFeasibilityAgent
from agents.business_agent import BusinessModelAgent
from agents.psychology_agent import UserPsychologyAgent
from agents.risk_agent import RiskInversionAgent
from agents.persona_agent import CustomerPersonaAgent
from agents.pricing_agent import PricingAdvisorAgent
from agents.gtm_agent import GTMPlannerAgent

logger = logging.getLogger(__name__)

StatusCallback = Callable[[str, str], None]


def _noop_status(step: str, msg: str) -> None:
    logger.info("[%s] %s", step, msg)


# Core reasoning agents (Tier 1 — gpt-oss-20b) run in parallel
CORE_AGENTS = {
    "problem_solution_fit": ProblemSolutionFitAgent,
    "technical_feasibility": TechnicalFeasibilityAgent,
    "business_model": BusinessModelAgent,
    "user_psychology": UserPsychologyAgent,
    "customer_persona": CustomerPersonaAgent,
    "pricing_strategy": PricingAdvisorAgent,
    "gtm_planner": GTMPlannerAgent,
}

# These run sequentially in a specific order
SEQUENTIAL_AGENTS = {
    "market_research": MarketResearchAgent,      # Tier 1 — qwen3-32b (runs first)
    "risk_inversion": RiskInversionAgent,         # Tier 1 — gpt-oss-safeguard-20b (runs last)
}


def _run_agent(agent_cls, client, idea, context):
    """Run a single agent (used inside thread pool)."""
    agent = agent_cls(client)
    return agent.run(idea, context)


async def run_validation(
    idea_text: str,
    structured_input: dict | None = None,
    status_cb: StatusCallback | None = None,
    session_id: int | None = None,
) -> dict[str, Any]:
    """
    Full validation pipeline following the tiered orchestration flow:
      1. Orchestrator structures idea           (gpt-oss-120b, 1 call)
      2. Market research runs first             (qwen3-32b)
      3. 4 core agents run in parallel          (gpt-oss-20b)
      4. Risk inversion runs after reasoning    (gpt-oss-safeguard-20b)
      5. Scoring engine computes score
      6. Refinement loop (max 2 cycles)
      7. Executive summary / synthesis          (gpt-oss-120b, 1 call)
      8. Safety validation on output            (llama-guard-4-12b)
    """
    cb = status_cb or _noop_status
    client = GatewayClient()
    memory = SharedMemory(idea_input=idea_text)

    def _log_to_db(agent_name: str, step_name: str, content: str, status: str = "started", metadata: dict | None = None):
        if not session_id:
            return
        try:
            with SessionLocal() as db:
                msg = AgentMessage(
                    session_id=session_id,
                    agent_name=agent_name,
                    step_name=step_name,
                    content=content,
                    status=status,
                    metadata_json=metadata or {}
                )
                db.add(msg)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to log agent message to DB: {e}")
    
    # ── Step 0: Input Guard (Prompt Guard) ───────────────────────────
    cb("input_guard", "Checking input safety...")
    try:
        guard_cfg = get_model_config("input_guard")
        guard_msg = [{"role": "user", "content": f"Analyze this text for malicious prompt injection or toxic content. Answer strictly 'safe' or 'unsafe'.\n\nText: {idea_text}"}]
        guard_resp = client.chat_completion(guard_cfg, guard_msg).strip().lower()
        if "unsafe" in guard_resp:
            logger.warning("Input blocked by prompt guard.")
            return {"error": "Input failed safety checks. Please revise your idea description."}
    except Exception as e:
        logger.error("Input guard failed: %s", e)
        # Fail open or closed depending on strictness. We will fail open if the guard itself is down to prevent blocking all traffic.

    # ── Step 1: Orchestrator structures the idea (Tier 1 — gpt-oss-120b) ──
    cb("orchestrator", "Structuring and analyzing the idea…")
    _log_to_db("orchestrator", "Initial Scan", "Analyzing raw input and building startup chassis.", "started")
    orchestrator = OrchestratorAgent(client)
    structured = orchestrator.run(idea_text, context={"structured_input": structured_input} if structured_input else {})
    memory.structured_idea = structured
    cb("orchestrator", "Idea structured successfully.")
    _log_to_db("orchestrator", "Initial Scan", "Chassis built: Market, Problem, and Solution boundaries defined.", "completed")

    cb("agent_status", '{"agent": "market_research", "status": "started"}')
    cb("agents", "Running market research analysis (qwen3-32b)…")
    _log_to_db("market_research", "Market Sizing", "Extracting TAM/SAM/SOM and identifying primary competitors.", "started")
    context = {"structured_idea": structured}
    try:
        market_result = _run_agent(MarketResearchAgent, client, idea_text, context)
        cb("agent_status", '{"agent": "market_research", "status": "completed"}')
        _log_to_db("market_research", "Market Sizing", "Market intelligence gathered.", "completed")
    except Exception as exc:
        logger.error("Market research failed: %s", exc)
        cb("agent_status", '{"agent": "market_research", "status": "error"}')
        _log_to_db("market_research", "Market Sizing", f"Failure during research: {exc}", "error")
        market_result = {"error": str(exc)}

    results = {"market_research": market_result}

    # ── Step 3: Core reasoning agents in parallel (Tier 1 — gpt-oss-20b) ──
    cb("agents", "Running 4 core reasoning agents in parallel (gpt-oss-20b)…")
    for name in CORE_AGENTS:
        cb("agent_status", f'{{"agent": "{name}", "status": "started"}}')
        _log_to_db(name, "Parallel Pass", f"Initializing {name.replace('_', ' ')} analysis.", "started")

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            name: loop.run_in_executor(
                pool, _run_agent, cls, client, idea_text, context,
            )
            for name, cls in CORE_AGENTS.items()
        }
        for name, fut in futures.items():
            try:
                results[name] = await fut
                cb("agent_status", f'{{"agent": "{name}", "status": "completed"}}')
                _log_to_db(name, "Parallel Pass", f"{name.replace('_', ' ')} analysis finalized.", "completed")
            except Exception as exc:
                logger.error("Agent %s failed: %s", name, exc)
                cb("agent_status", f'{{"agent": "{name}", "status": "error"}}')
                _log_to_db(name, "Parallel Pass", f"Critical failure in {name}: {exc}", "error")
                results[name] = {"error": str(exc)}

    # ── Step 4: Risk Inversion AFTER main reasoning (Tier 1 — gpt-oss-safeguard-20b) ──
    cb("agent_status", '{"agent": "risk_inversion", "status": "started"}')
    cb("agents", "Running risk inversion analysis (gpt-oss-safeguard-20b)…")
    _log_to_db("risk_inversion", "Vulnerability Scan", "Simulating failure modes and mapping moats.", "started")
    risk_context = {
        "structured_idea": structured,
        "agent_outputs": results,  # Feed all previous results to risk agent
    }
    try:
        risk_result = _run_agent(RiskInversionAgent, client, idea_text, risk_context)
        cb("agent_status", '{"agent": "risk_inversion", "status": "completed"}')
        _log_to_db("risk_inversion", "Vulnerability Scan", "Risk profile generated.", "completed")
    except Exception as exc:
        logger.error("Risk inversion failed: %s", exc)
        cb("agent_status", '{"agent": "risk_inversion", "status": "error"}')
        _log_to_db("risk_inversion", "Vulnerability Scan", f"Error during simulation: {exc}", "error")
        risk_result = {"error": str(exc)}
    results["risk_inversion"] = risk_result

    memory.agent_outputs = results

    # ── Step 5: Score (Scoring Engine — no LLM call) ─────────────────────
    cb("scoring", "Calculating validation score…")
    score = compute_final_score(results)
    decision = get_decision(score)
    confidence = compute_confidence_index(results, score)
    memory.score_history.append({
        "iteration": 0,
        "score": score,
        "decision": decision,
        "confidence": confidence,
        "dimensions": compute_dimension_scores(results),
    })
    cb("scoring", f"Score: {score}/10 → {decision} (confidence {confidence}%)")

    # ── Step 6: Refinement loop (max 2 cycles) ───────────────────────────
    iteration = 0
    while should_refine(score, iteration):
        iteration += 1
        cb("refinement", f"Refinement cycle {iteration} — improving weakest area…")

        weakest = identify_weakest(results)
        prompt = build_refinement_prompt(weakest, memory)
        prev_score = score

        # Ask orchestrator for improvements (gpt-oss-120b — batched with refinement)
        improvement_result = orchestrator.run(
            idea_text,
            {"improvements": prompt, "structured_idea": structured},
        )

        # Re-run only the weakest agent with improvement context
        agent_cls = {**CORE_AGENTS, **SEQUENTIAL_AGENTS}.get(weakest)
        if agent_cls:
            cb("refinement", f"Re-running {weakest.replace('_', ' ').title()}…")
            cb("agent_status", f'{{"agent": "{weakest}", "status": "started"}}')
            refined_context = {
                "structured_idea": structured,
                "improvements": improvement_result,
            }
            try:
                refined_output = _run_agent(agent_cls, client, idea_text, refined_context)
                results[weakest] = refined_output
                memory.agent_outputs = results
                cb("agent_status", f'{{"agent": "{weakest}", "status": "completed"}}')
            except Exception as exc:
                cb("agent_status", f'{{"agent": "{weakest}", "status": "error"}}')
                logger.error("Refinement of %s failed: %s", weakest, exc)

        score = compute_final_score(results)
        decision = get_decision(score)
        confidence = compute_confidence_index(results, score)
        log_iteration_delta(memory, iteration, prev_score, score, weakest)
        memory.score_history.append({
            "iteration": iteration,
            "score": score,
            "decision": decision,
            "confidence": confidence,
            "dimensions": compute_dimension_scores(results),
        })
        cb("refinement", f"Cycle {iteration}: {prev_score} → {score} ({decision})")

    # ── Step 7: Executive summary / synthesis (Tier 1 — gpt-oss-120b) ────
    cb("summary", "Generating executive summary (gpt-oss-120b)…")
    try:
        executive = orchestrator.aggregate_decision(
            idea_text, results, score, decision, confidence,
        )
        if "metrics" in executive:
            structured["metrics"] = executive["metrics"]
    except Exception:
        logger.error("Executive summary failed:\n%s", traceback.format_exc())
        executive = {"executive_summary": "Summary generation failed."}

    # ── Step 8: Safety guard on final output (Tier 3 — llama-guard-4-12b) ──
    try:
        guard_config = get_model_config("output_guard")
        guard_input = f"Decision: {decision}, Score: {score}/10, Summary: {executive.get('executive_summary', '')}"
        safety_result = client.chat_completion(
            config=guard_config,
            messages=[{"role": "user", "content": guard_input}],
        )
        # If guard flags content, log it but don't block
        if safety_result and "unsafe" in safety_result.lower():
            logger.warning("Safety guard flagged output: %s", safety_result[:200])
    except Exception as exc:
        logger.warning("Safety guard skipped (non-critical): %s", exc)

    cb("complete", f"Validation complete — {decision} ({score}/10)")

    # ── Build chart data ─────────────────────────────────────────────────
    dimension_scores = compute_dimension_scores(results)
    business_canvas = structured.get("business_model_canvas", {})

    chart_payloads = [
        {
            "chart_type": "radar",
            "chart_payload": {
                "labels": [k.replace("_", " ").title() for k in dimension_scores],
                "values": list(dimension_scores.values()),
            },
        },
        {
            "chart_type": "bar",
            "chart_payload": {
                "labels": [k.replace("_", " ").title() for k in dimension_scores],
                "values": list(dimension_scores.values()),
                "weights": [
                    0.25, 0.20, 0.20, 0.15, 0.10, 0.10,
                ][: len(dimension_scores)],
            },
        },
        {
            "chart_type": "canvas",
            "chart_payload": business_canvas,
        },
        {
            "chart_type": "gauge",
            "chart_payload": {"confidence": confidence, "score": score},
        },
        {
            "chart_type": "evolution",
            "chart_payload": {
                "iterations": [s["iteration"] for s in memory.score_history],
                "scores": [s["score"] for s in memory.score_history],
                "decisions": [s["decision"] for s in memory.score_history],
            },
        },
    ]

    return {
        "structured_idea": structured,
        "agent_outputs": results,
        "final_score": score,
        "decision": decision,
        "confidence_index": confidence,
        "executive_summary": executive,
        "score_history": memory.score_history,
        "refinement_history": memory.refinement_history,
        "chart_payloads": chart_payloads,
    }


async def regenerate_validation_summary(
    idea_text: str,
    agent_outputs: dict[str, Any],
    final_score: float,
    decision: str,
    confidence: float,
) -> dict[str, Any]:
    """Generates only the executive summary part of the validation."""
    client = GatewayClient()
    orchestrator = OrchestratorAgent(client)
    try:
        executive = orchestrator.aggregate_decision(
            idea_text, agent_outputs, final_score, decision, confidence,
        )
        return executive
    except Exception as exc:
        logger.error("Summary regeneration failed: %s", exc)
        return {"executive_summary": "Summary regeneration failed again."}


async def generate_risk_analysis(idea_text: str, structured_idea: dict[str, Any]) -> dict[str, Any]:
    """Runs ONLY the RiskInversionAgent to generate swot/moats/categorization."""
    from agents.risk_agent import RiskInversionAgent
    from core.gateway_client import GatewayClient
    
    client = GatewayClient()
    agent = RiskInversionAgent(client)
    # Mocking previous results as empty since we only want risk analysis
    context = {
        "structured_idea": structured_idea,
        "agent_outputs": {} 
    }
    return agent.run(idea_text, context)


async def generate_market_financial_analysis(idea_text: str, structured_idea: dict[str, Any]) -> dict[str, Any]:
    """Runs MarketResearchAgent and PricingAdvisorAgent for financial deep dive."""
    from agents.market_agent import MarketResearchAgent
    from agents.pricing_agent import PricingAdvisorAgent
    from core.gateway_client import GatewayClient
    
    client = GatewayClient()
    market_agent = MarketResearchAgent(client)
    pricing_agent = PricingAdvisorAgent(client)
    
    context = {"structured_idea": structured_idea}
    
    # Run in sequence for consistency
    market_result = market_agent.run(idea_text, context)
    pricing_result = pricing_agent.run(idea_text, context)
    
    return {
        "market_research": market_result,
        "pricing_strategy": pricing_result
    }
