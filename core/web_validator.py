"""
Web Validator — two-tier web-backed validation using Groq compound models.

- quick_validate()  → groq/compound-mini  (fast lookups, market checks)
- deep_validate()   → groq/compound       (strategic multi-source synthesis)

Both models have built-in web search. Responses are parsed to extract
source references for the Source Transparency section.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from core.groq_client import GroqClient
from core.model_router import get_model_config

logger = logging.getLogger(__name__)


# ── Intent Detection ─────────────────────────────────────────────────
WEB_TRIGGER_PATTERNS = [
    r"\bwhy\b",
    r"\bvalidate\b",
    r"\bmarket\s*data\b",
    r"\bcompetitor",
    r"\bsource",
    r"\bevidence\b",
    r"\bprove\b",
    r"\bjustif",
    r"\breview\b",
    r"\btrend",
    r"\bstatistic",
    r"\bbenchmark",
    r"\bindustry\b",
    r"\breal[\s-]*world\b",
    r"\bfact[\s-]*check\b",
]

DEEP_TRIGGER_PATTERNS = [
    r"\bstrategic\b",
    r"\binvestor\b",
    r"\bdetail",
    r"\bfull\s*analysis\b",
    r"\bcomprehensive\b",
    r"\bdeep\s*dive\b",
    r"\bexplain\s*in\s*detail\b",
    r"\bwhy\s*this\s*strategy\b",
    r"\brecommend",
]


def detect_intent(question: str) -> str:
    """
    Classify a user question into one of three routing tiers:
      - 'standard'   → llama-3.1-8b-instant (no web needed)
      - 'web_quick'  → groq/compound-mini (fast web lookup)
      - 'web_deep'   → groq/compound (multi-source strategic analysis)
    """
    q = question.lower().strip()

    # Check for deep-research intent first (more specific)
    deep_matches = sum(1 for p in DEEP_TRIGGER_PATTERNS if re.search(p, q))
    if deep_matches >= 2:
        return "web_deep"

    # Check for any web-validation intent
    web_matches = sum(1 for p in WEB_TRIGGER_PATTERNS if re.search(p, q))
    if web_matches >= 1:
        return "web_quick"

    return "standard"


# ── Source Extraction ────────────────────────────────────────────────
def _extract_sources(text: str) -> list[dict]:
    """
    Parse LLM response text to extract cited sources.
    Compound models often include URLs or reference labels in their output.
    """
    sources = []

    # URL pattern
    urls = re.findall(r'https?://[^\s\)\]\,\"\']+', text)
    for url in urls:
        domain = re.sub(r'^https?://(www\.)?', '', url).split('/')[0]
        sources.append({"type": "web", "title": domain, "url": url})

    # "Source:" or "Reference:" labels
    ref_matches = re.findall(
        r'(?:source|reference|citation|according to)[:\s]*([^\n.]+)',
        text, re.IGNORECASE
    )
    for ref in ref_matches:
        ref = ref.strip().strip('"\'')
        if ref and len(ref) > 5 and not ref.startswith('http'):
            sources.append({"type": "web", "title": ref, "url": None})

    # Deduplicate by title
    seen = set()
    unique = []
    for s in sources:
        key = s["title"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return unique


# ── Quick Validation (compound-mini) ─────────────────────────────────
def quick_validate(
    question: str,
    context: dict[str, Any],
    client: GroqClient | None = None,
) -> dict[str, Any]:
    """
    Fast web-backed validation using groq/compound-mini.
    Good for: market size checks, competitor discovery, trend validation.
    """
    client = client or GroqClient()
    cfg = get_model_config("web_quick")

    system_prompt = (
        "You are a market research assistant with web search capability. "
        "Provide concise, fact-based answers backed by real-world data.\n\n"
        "IMPORTANT: Always include specific sources, URLs, or references "
        "for any data points you cite. Format sources clearly.\n\n"
        "Response format:\n"
        "1. Direct Answer (2-3 sentences)\n"
        "2. Key Data Points (bullet list with sources)\n"
        "3. Sources Used (list URLs or reference names)"
    )

    idea_context = json.dumps({
        k: v for k, v in context.items()
        if k in ("idea_title", "idea_description", "section", "section_content")
    }, indent=2)

    user_msg = (
        f"Context:\n{idea_context}\n\n"
        f"Question: {question}\n\n"
        "Search the web for current, accurate data to answer this question. "
        "Include source URLs where possible."
    )

    raw = client.chat_completion(
        model=cfg.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
    )

    sources = _extract_sources(raw)
    # Always include internal sources
    internal_sources = [
        {"type": "internal", "title": "Business Validation Canvas", "url": None},
        {"type": "internal", "title": f"Idea: {context.get('idea_title', 'N/A')}", "url": None},
    ]

    return {
        "answer": raw.strip(),
        "sources": internal_sources + sources,
        "model_used": cfg.model,
        "validation_tier": "web_quick",
        "validation_confidence": min(70 + len(sources) * 5, 95),
    }


# ── Deep Validation (compound) ───────────────────────────────────────
def deep_validate(
    question: str,
    context: dict[str, Any],
    client: GroqClient | None = None,
) -> dict[str, Any]:
    """
    Deep web-backed strategic analysis using groq/compound.
    Good for: full canvas validation, investor-grade reasoning, multi-source synthesis.
    """
    client = client or GroqClient()
    cfg = get_model_config("web_research")

    system_prompt = (
        "You are a senior startup strategy consultant with access to real-time web data. "
        "Provide comprehensive, investment-grade analysis backed by multiple sources.\n\n"
        "IMPORTANT: For every claim, include the source. Use specific data points, "
        "market numbers, competitor details, and industry benchmarks.\n\n"
        "Response format:\n"
        "1. Strategic Assessment (detailed analysis)\n"
        "2. Web-Validated Evidence (data points with sources)\n"
        "3. Competitive Context (how this compares to market reality)\n"
        "4. Strategic Recommendation (actionable next steps)\n"
        "5. Sources (complete list of all references used)"
    )

    idea_context = json.dumps({
        k: v for k, v in context.items()
        if k in ("idea_title", "idea_description", "section", "section_content",
                  "business_model_canvas", "agent_outputs")
    }, indent=2)

    user_msg = (
        f"Context:\n{idea_context}\n\n"
        f"Strategic Question: {question}\n\n"
        "Perform a thorough web-backed analysis. Include market data, "
        "competitor intelligence, industry benchmarks, and trend analysis. "
        "Cite all sources with URLs."
    )

    raw = client.chat_completion(
        model=cfg.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
    )

    sources = _extract_sources(raw)
    internal_sources = [
        {"type": "internal", "title": "Business Validation Canvas", "url": None},
        {"type": "internal", "title": "Market Analysis Report", "url": None},
        {"type": "internal", "title": f"Idea: {context.get('idea_title', 'N/A')}", "url": None},
    ]

    return {
        "answer": raw.strip(),
        "sources": internal_sources + sources,
        "model_used": cfg.model,
        "validation_tier": "web_deep",
        "validation_confidence": min(75 + len(sources) * 4, 98),
    }
