"""
Token Tracker — Thread-safe, in-memory sliding window rate limiter.
Monitors Requests Per Minute (RPM) and Tokens Per Minute (TPM).
"""

import time
import threading
from typing import Dict, List, Tuple
from dataclasses import dataclass, field

@dataclass
class UsageWindow:
    requests: List[float] = field(default_factory=list)
    tokens: List[Tuple[float, int]] = field(default_factory=list)
    daily_requests: List[float] = field(default_factory=list)

class TokenTracker:
    def __init__(self, window_seconds: int = 60, day_seconds: int = 86400):
        self.window_seconds = window_seconds
        self.day_seconds = day_seconds
        self._lock = threading.Lock()
        self._usage: Dict[str, UsageWindow] = {}

    def _cleanup(self, model: str, now: float):
        """Remove events older than relevant windows."""
        cutoff_min = now - self.window_seconds
        cutoff_day = now - self.day_seconds
        
        if model in self._usage:
            w = self._usage[model]
            w.requests = [ts for ts in w.requests if ts > cutoff_min]
            w.tokens = [(ts, tok) for ts, tok in w.tokens if ts > cutoff_min]
            w.daily_requests = [ts for ts in w.daily_requests if ts > cutoff_day]

    def record_usage(self, model: str, tokens: int = 0):
        """Record a single request and its token consumption."""
        now = time.time()
        with self._lock:
            if model not in self._usage:
                self._usage[model] = UsageWindow()
            self._cleanup(model, now)
            self._usage[model].requests.append(now)
            self._usage[model].daily_requests.append(now)
            if tokens > 0:
                self._usage[model].tokens.append((now, tokens))

    def get_current_usage(self, model: str) -> tuple[int, int, int]:
        """Return (current_rpm, current_tpm, current_rpd) for a model."""
        now = time.time()
        with self._lock:
            if model not in self._usage:
                return (0, 0, 0)
            self._cleanup(model, now)
            w = self._usage[model]
            current_rpm = len(w.requests)
            current_tpm = sum(tok for _, tok in w.tokens)
            current_rpd = len(w.daily_requests)
            return (current_rpm, current_tpm, current_rpd)

    def is_near_limit(self, model: str, max_rpm: int, max_tpm: int, max_rpd: int = 0, threshold: float = 0.8) -> bool:
        """Check if current usage is above the warning threshold for fallback switching."""
        rpm, tpm, rpd = self.get_current_usage(model)
        if max_rpm > 0 and rpm >= (max_rpm * threshold):
            return True
        if max_tpm > 0 and tpm >= (max_tpm * threshold):
            return True
        if max_rpd > 0 and rpd >= (max_rpd * threshold):
            return True
        return False
        
    def get_all_metrics(self) -> dict:
        """Export all current metrics for the Dashboard."""
        now = time.time()
        metrics = {}
        with self._lock:
            for model, w in self._usage.items():
                self._cleanup(model, now)
                rpm = len(w.requests)
                tpm = sum(tok for _, tok in w.tokens)
                metrics[model] = {"rpm": rpm, "tpm": tpm}
        return metrics

# Singleton instance for the application
tracker = TokenTracker()
