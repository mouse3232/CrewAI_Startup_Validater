"""
Gateway Client — Resilient multi-model API client.
Handles RPM/TPM tracking, 429 backoffs, and automatic fallback cascades.
Assumes a unified OpenRouter-style gateway.
"""

import os
import time
import logging
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI, APITimeoutError, RateLimitError, APIStatusError
import google.generativeai as genai

from core.token_tracker import tracker
from core.model_router import ModelConfig, MODELS, USER_DISABLED_MODELS
from core.replacement_engine import get_replacement_model

_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

logger = logging.getLogger(__name__)


class GatewayClient:
    """Intelligent client that routes requests and manages API rate limits dynamically."""

    MAX_RETRIES = 3

    def __init__(self):
        # OpenAI / Gateway Configuration
        self.api_key = os.getenv("GATEWAY_API_KEY") or os.getenv("GROQ_API_KEY")
        if not self.api_key or self.api_key == "your_groq_api_key_here":
            raise EnvironmentError("GATEWAY_API_KEY or GROQ_API_KEY must be set in .env.")
        
        default_base = "https://api.openai.com/v1" if os.getenv("GATEWAY_API_KEY") else "https://api.groq.com/openai/v1"
        self.base_url = os.getenv("GATEWAY_BASE_URL", default_base)
        
        self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        # Gemini Configuration
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        if self.gemini_key and self.gemini_key != "your_gemini_api_key_here":
            genai.configure(api_key=self.gemini_key)
            logger.info("Gemini initialized.")
        else:
            logger.warning("GEMINI_API_KEY missing or placeholder. Gemini models will be unavailable.")
            self.gemini_key = None

        logger.info("Gateway client initialized against %s", self.base_url)

    def _execute_gemini(self, config: ModelConfig, messages: list[dict]) -> tuple[str, int]:
        """Execute a completion using Google Generative AI SDK."""
        if not self.gemini_key:
            raise RuntimeError("Gemini API key not configured.")
            
        model = genai.GenerativeModel(config.model)
        
        # Convert messages to Gemini format
        system_instruction = ""
        history = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                system_instruction += content + "\n"
            elif role == "user":
                history.append({"role": "user", "parts": [content]})
            elif role == "assistant":
                history.append({"role": "model", "parts": [content]})

        if system_instruction:
            model = genai.GenerativeModel(config.model, system_instruction=system_instruction)

        # Use the last user message as the prompt
        last_msg = history.pop() if history and history[-1]["role"] == "user" else {"parts": [""]}
        
        chat = model.start_chat(history=history)
        response = chat.send_message(
            last_msg["parts"][0],
            generation_config=genai.GenerationConfig(
                temperature=config.temperature,
                max_output_tokens=config.max_tokens,
            )
        )
        
        content = response.text
        # Gemini SDK doesn't always provide usage in a simple way for non-streamed calls in some versions, 
        # but we can estimate or check response.usage_metadata
        toks = 0
        try:
            if hasattr(response, 'usage_metadata'):
                toks = response.usage_metadata.total_token_count
        except Exception:
            pass
            
        return content, toks

    def _execute_with_fallback(
        self,
        config: ModelConfig,
        messages: list[dict],
        task_type: str = "general",
        is_fallback: bool = False
    ) -> tuple[str, int]:
        """Attempt to execute a completion, falling back iteratively if throttled."""
        
        original_key = next((k for k, v in MODELS.items() if v == config), None)
        
        needs_fallback = False
        if original_key in USER_DISABLED_MODELS:
            logger.info("[%s] manually disabled. Finding replacement...", original_key)
            needs_fallback = True
        elif not is_fallback and tracker.is_near_limit(config.model, config.max_rpm, config.max_tpm, config.max_rpd):
            logger.warning("[%s] Tracker threshold reached. Finding replacement...", config.model)
            needs_fallback = True
        elif config.metadata and config.metadata.get("provider") == "google" and not self.gemini_key:
            logger.warning("[%s] Gemini not configured. Finding replacement...", config.model)
            needs_fallback = True
            
        if needs_fallback and original_key:
            rep_key, rep_config = get_replacement_model(
                original_key, MODELS, USER_DISABLED_MODELS, tracker.get_all_metrics(), task_type
            )
            if rep_config:
                logger.info("[%s] replaced with %s", original_key, rep_key)
                return self._execute_with_fallback(rep_config, messages, task_type, is_fallback=True)
            elif original_key in USER_DISABLED_MODELS and config.metadata and config.metadata.get("safety_model"):
                raise RuntimeError("Safety layer disabled. Please enable at least one safeguard model.")

        tracker.record_usage(config.model, tokens=0) # Record an RPM/RPD tick 
        
        last_error = None
        is_google = False
        if config.metadata and config.metadata.get("provider") == "google":
            is_google = True

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                if is_google:
                    content, toks = self._execute_gemini(config, messages)
                else:
                    response = self._client.chat.completions.create(
                        model=config.model,
                        messages=messages,
                        temperature=config.temperature,
                        max_tokens=config.max_tokens,
                    )
                    content = response.choices[0].message.content
                    toks = response.usage.total_tokens if response.usage else 0
                
                # Record the TPM tick
                tracker.record_usage(config.model, tokens=toks)
                
                logger.info(
                    "Success %s — %s tokens (attempt %d)%s",
                    config.model,
                    toks,
                    attempt,
                    " [FALLBACK]" if is_fallback else ""
                )
                return content, toks

            except Exception as exc:
                # Handle both OpenAI and Gemini errors
                last_error = exc
                if isinstance(exc, (APITimeoutError, RateLimitError)) or "429" in str(exc) or "quota" in str(exc).lower():
                    wait = 2 ** attempt
                    logger.warning(
                        "Throttled %s (attempt %d/%d): %s — waiting %ds",
                        config.model, attempt, self.MAX_RETRIES, exc, wait
                    )
                    time.sleep(wait)
                elif isinstance(exc, APIStatusError):
                    if exc.status_code == 401:
                        raise RuntimeError("API Gateway returned 401 Unauthorized. Check your API key.") from exc
                    elif exc.status_code >= 500:
                        wait = 2 ** attempt
                        logger.warning("Gateway 5xx %s (attempt %d/%d) — waiting %ds", config.model, attempt, self.MAX_RETRIES, wait)
                        time.sleep(wait)
                    else:
                        raise
                else:
                    # Try one more time if it's a generic error, otherwise raise
                    if attempt == self.MAX_RETRIES:
                        break
                    wait = 1
                    time.sleep(wait)

        # If we exhausted retries on the primary model, try the fallback path exactly once
        if not is_fallback and original_key:
            logger.error("[%s] Repeatedly failed. Triggering smart fallback.", config.model)
            rep_key, rep_config = get_replacement_model(
                original_key, MODELS, USER_DISABLED_MODELS, tracker.get_all_metrics(), task_type
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
