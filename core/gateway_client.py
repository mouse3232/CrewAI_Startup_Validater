"""
Gateway Client — Resilient multi-model API client.
Handles RPM/TPM tracking, 429 backoffs, automatic fallback cascades,
and dual-engine support (Groq / Gemini).
"""

import os
import time
import logging
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI, APITimeoutError, RateLimitError, APIStatusError

from core.token_tracker import tracker
from core.model_router import ModelConfig, USER_DISABLED_MODELS, get_active_models
from core.replacement_engine import get_replacement_model

_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

logger = logging.getLogger(__name__)


class GatewayClient:
    """Intelligent client that routes requests across Groq or Gemini engines."""

    MAX_RETRIES = 3

    def __init__(self):
        from core.engine_config import ACTIVE_ENGINE
        self._engine = ACTIVE_ENGINE

        if self._engine == "gemini":
            self._init_gemini()
        else:
            self._init_groq()

    def _init_groq(self):
        self.api_key = os.getenv("GATEWAY_API_KEY") or os.getenv("GROQ_API_KEY")
        if not self.api_key or self.api_key.startswith("your_"):
            raise EnvironmentError("GATEWAY_API_KEY or GROQ_API_KEY must be set in .env.")
        default_base = "https://api.openai.com/v1" if os.getenv("GATEWAY_API_KEY") else "https://api.groq.com/openai/v1"
        self.base_url = os.getenv("GATEWAY_BASE_URL", default_base)
        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self._gemini_client = None
        logger.info("Gateway client initialized [GROQ] against %s", self.base_url)

    def _init_gemini(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key or self.api_key.startswith("your_"):
            raise EnvironmentError("GEMINI_API_KEY must be set in .env.")
        try:
            from google import genai
            self._gemini_client = genai.Client(api_key=self.api_key)
        except ImportError:
            raise EnvironmentError("google-genai package is required for Gemini mode. Install with: pip install google-genai")
        self._client = None
        logger.info("Gateway client initialized [GEMINI]")

    # ── Gemini completion path ───────────────────────────────────────
    def _gemini_completion(self, config: ModelConfig, messages: list[dict]) -> tuple[str, int]:
        """Execute a Gemini API call using google-genai SDK."""
        from google import genai
        from google.genai import types

        # Convert OpenAI-style messages to Gemini content format
        system_instruction = None
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            text = msg.get("content", "")
            if role == "system":
                system_instruction = text
            else:
                contents.append(types.Content(
                    role="user" if role == "user" else "model",
                    parts=[types.Part.from_text(text=text)]
                ))

        gen_config = types.GenerateContentConfig(
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            system_instruction=system_instruction,
        )

        response = self._gemini_client.models.generate_content(
            model=config.model,
            contents=contents,
            config=gen_config,
        )

        content = response.text or ""
        # Approximate token count from usage metadata if available
        toks = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            toks = getattr(response.usage_metadata, 'total_token_count', 0)

        return content, toks

    # ── Core execution with fallback ─────────────────────────────────
    def _execute_with_fallback(
        self,
        config: ModelConfig,
        messages: list[dict],
        task_type: str = "general",
        is_fallback: bool = False
    ) -> tuple[str, int]:
        """Attempt to execute a completion, falling back iteratively if throttled."""

        models = get_active_models()
        original_key = next((k for k, v in models.items() if v == config), None)

        needs_fallback = False
        if original_key in USER_DISABLED_MODELS:
            logger.info("[%s] manually disabled. Finding replacement...", original_key)
            needs_fallback = True
        elif not is_fallback and tracker.is_near_limit(config.model, config.max_rpm, config.max_tpm):
            logger.warning("[%s] Tracker threshold reached. Finding replacement...", config.model)
            needs_fallback = True

        if needs_fallback and original_key:
            rep_key, rep_config = get_replacement_model(
                original_key, models, USER_DISABLED_MODELS, tracker.get_all_metrics(), task_type
            )
            if rep_config:
                logger.info("[%s] replaced with %s", original_key, rep_key)
                return self._execute_with_fallback(rep_config, messages, task_type, is_fallback=True)
            elif original_key in USER_DISABLED_MODELS and config.metadata and config.metadata.get("safety_model"):
                raise RuntimeError("Safety layer disabled. Please enable at least one safeguard model.")

        tracker.record_usage(config.model, tokens=0)  # Record an RPM tick

        last_error = None
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                if self._engine == "gemini":
                    content, toks = self._gemini_completion(config, messages)
                else:
                    response = self._client.chat.completions.create(
                        model=config.model,
                        messages=messages,
                        temperature=config.temperature,
                        max_tokens=config.max_tokens,
                    )
                    content = response.choices[0].message.content
                    toks = response.usage.total_tokens if response.usage else 0

                tracker.record_usage(config.model, tokens=toks)
                logger.info(
                    "Success %s — %s tokens (attempt %d)%s [%s]",
                    config.model, toks, attempt,
                    " [FALLBACK]" if is_fallback else "",
                    self._engine.upper()
                )
                return content, toks

            except (APITimeoutError, RateLimitError) as exc:
                last_error = exc
                wait = 2 ** attempt
                logger.warning("Throttled %s (attempt %d/%d): %s — waiting %ds", config.model, attempt, self.MAX_RETRIES, exc, wait)
                time.sleep(wait)

            except APIStatusError as exc:
                if exc.status_code == 401:
                    raise RuntimeError("API Gateway returned 401 Unauthorized. Check your API key.") from exc
                elif exc.status_code >= 500:
                    last_error = exc
                    wait = 2 ** attempt
                    logger.warning("Gateway 5xx %s (attempt %d/%d) — waiting %ds", config.model, attempt, self.MAX_RETRIES, wait)
                    time.sleep(wait)
                else:
                    raise

            except Exception as exc:
                # Catch Gemini SDK errors generically
                last_error = exc
                if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                    wait = 2 ** attempt
                    logger.warning("Rate limited %s (attempt %d/%d): %s — waiting %ds", config.model, attempt, self.MAX_RETRIES, exc, wait)
                    time.sleep(wait)
                else:
                    raise

        # Exhausted retries — try smart fallback
        if not is_fallback and original_key:
            logger.error("[%s] Repeatedly failed. Triggering smart fallback.", config.model)
            rep_key, rep_config = get_replacement_model(
                original_key, models, USER_DISABLED_MODELS, tracker.get_all_metrics(), task_type
            )
            if rep_config:
                return self._execute_with_fallback(rep_config, messages, task_type, is_fallback=True)

        raise RuntimeError(f"Gateway request failed on {config.model} after {self.MAX_RETRIES} attempts: {last_error}")

    def chat_completion(
        self,
        config: ModelConfig,
        messages: list[dict],
        task_type: str = "general"
    ) -> str:
        """Main entry point for agent orchestration."""
        content, _ = self._execute_with_fallback(config, messages, task_type)
        return content

