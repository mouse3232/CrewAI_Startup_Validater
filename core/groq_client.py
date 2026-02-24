"""
GROQ LLM Client — OpenAI-compatible wrapper with retry logic.
"""

import os
import time
import logging
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI, APITimeoutError, RateLimitError, APIStatusError

# Ensure .env is loaded from the project root regardless of cwd
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

logger = logging.getLogger(__name__)


class GroqClient:
    """Thin wrapper around the OpenAI SDK targeting the GROQ endpoint."""

    BASE_URL = "https://api.groq.com/openai/v1"
    MAX_RETRIES = 3
    BACKOFF_BASE = 2  # seconds

    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key or api_key == "your_groq_api_key_here":
            raise EnvironmentError(
                "GROQ_API_KEY environment variable is not set or still has the placeholder value. "
                "Please add your real GROQ API key to the .env file."
            )
        logger.info("GROQ client initialised (key: %s…%s)", api_key[:8], api_key[-4:])
        self._client = OpenAI(api_key=api_key, base_url=self.BASE_URL)

    # ------------------------------------------------------------------
    def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion request with automatic retry on transient errors."""

        last_error = None
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                response = self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                content = response.choices[0].message.content
                logger.info(
                    "GROQ %s — %s tokens (attempt %d)",
                    model,
                    response.usage.total_tokens if response.usage else "?",
                    attempt,
                )
                return content

            except (APITimeoutError, RateLimitError) as exc:
                last_error = exc
                wait = self.BACKOFF_BASE ** attempt
                logger.warning(
                    "Transient GROQ error (attempt %d/%d): %s — retrying in %ds",
                    attempt,
                    self.MAX_RETRIES,
                    exc,
                    wait,
                )
                time.sleep(wait)

            except APIStatusError as exc:
                if exc.status_code == 401:
                    raise RuntimeError(
                        "GROQ API returned 401 Unauthorized. Your API key may be "
                        "invalid or expired. Please check GROQ_API_KEY in your .env file."
                    ) from exc
                elif exc.status_code >= 500:
                    last_error = exc
                    wait = self.BACKOFF_BASE ** attempt
                    logger.warning(
                        "GROQ 5xx (attempt %d/%d): %s — retrying in %ds",
                        attempt,
                        self.MAX_RETRIES,
                        exc,
                        wait,
                    )
                    time.sleep(wait)
                else:
                    raise

        raise RuntimeError(
            f"GROQ request failed after {self.MAX_RETRIES} attempts: {last_error}"
        )
