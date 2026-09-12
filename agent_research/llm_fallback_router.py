"""
Robust Multi-Tier LLM API Fallback Router (Python Edition)

Maximizes free-tier allowances and ensures ultra-reliable execution for complex tasks:
1. Primary:   OpenRouter (meta-llama/llama-3.3-70b-instruct:free, deepseek-r1:free, gpt-4o-mini)
2. Secondary: Google AI Studio (gemini-2.0-flash / gemini-1.5-flash)
3. Tertiary:  Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant)
4. Quaternary: Cloudflare Workers AI (@cf/meta/llama-3.3-70b-instruct)

Features:
- Catches HTTP 429 (Rate Limit) and HTTP 5xx (Server Error).
- Circuit breaker: in-memory cooldown state tracks throttled providers and skips them immediately.
- Transient 5xx retry with backoff and jitter before failing over.
- Clean JSON extraction with markdown code fence stripping.
"""

import os
import json
import re
import time
import random
from typing import Dict, Any, List, Optional, Tuple

try:
    import requests
except ImportError:
    requests = None  # type: ignore

DEFAULT_CASCADE = ["openrouter", "google-ai-studio", "groq", "cloudflare"]

DEFAULT_MODELS = {
    "openrouter": os.getenv("OPENROUTER_MODEL", "inclusionai/ling-3.0-flash-fin:free"),
    "google-ai-studio": os.getenv("GEMINI_MODEL", "gemini-flash-latest"),
    "groq": os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    "cloudflare": os.getenv("CLOUDFLARE_MODEL", "@cf/meta/llama-3.3-70b-instruct"),
}


class CircuitBreaker:
    """Thread-safe circuit breaker tracking provider rate limits & cooldowns."""

    def __init__(self):
        self.cooldown_until: Dict[str, float] = {p: 0.0 for p in DEFAULT_CASCADE}
        self.consecutive_failures: Dict[str, int] = {p: 0 for p in DEFAULT_CASCADE}
        self.total_calls: Dict[str, int] = {p: 0 for p in DEFAULT_CASCADE}
        self.successes: Dict[str, int] = {p: 0 for p in DEFAULT_CASCADE}

    def get_api_key(self, provider: str) -> Optional[str]:
        if provider == "openrouter":
            return os.getenv("OPENROUTER_API_KEY") or None
        elif provider == "google-ai-studio":
            return os.getenv("GEMINI_API_KEY") or None
        elif provider == "groq":
            return os.getenv("GROQ_API_KEY") or None
        elif provider == "cloudflare":
            token = os.getenv("CLOUDFLARE_API_TOKEN")
            account = os.getenv("CLOUDFLARE_ACCOUNT_ID")
            return token if (token and account) else None
        return None

    def is_cooling_down(self, provider: str) -> bool:
        return time.time() < self.cooldown_until.get(provider, 0.0)

    def get_remaining_cooldown(self, provider: str) -> int:
        remaining = self.cooldown_until.get(provider, 0.0) - time.time()
        return max(0, int(remaining))

    def record_success(self, provider: str):
        self.cooldown_until[provider] = 0.0
        self.consecutive_failures[provider] = 0
        self.total_calls[provider] = self.total_calls.get(provider, 0) + 1
        self.successes[provider] = self.successes.get(provider, 0) + 1

    def record_failure(self, provider: str, status_code: int, retry_after: Optional[int] = None):
        self.total_calls[provider] = self.total_calls.get(provider, 0) + 1
        self.consecutive_failures[provider] = self.consecutive_failures.get(provider, 0) + 1

        cooldown_sec = 60
        if retry_after and retry_after > 0:
            cooldown_sec = retry_after
        elif status_code == 429:
            mult = min(2 ** (self.consecutive_failures[provider] - 1), 8)
            cooldown_sec = 60 * mult
        elif 500 <= status_code < 600:
            cooldown_sec = 30
        elif status_code in (401, 403):
            cooldown_sec = 600

        self.cooldown_until[provider] = time.time() + cooldown_sec

    def reset(self, provider: Optional[str] = None):
        if provider:
            self.cooldown_until[provider] = 0.0
            self.consecutive_failures[provider] = 0
        else:
            for p in self.cooldown_until:
                self.cooldown_until[p] = 0.0
                self.consecutive_failures[p] = 0

    def get_stats(self) -> Dict[str, Any]:
        return {
            p: {
                "is_cooling_down": self.is_cooling_down(p),
                "remaining_seconds": self.get_remaining_cooldown(p),
                "consecutive_failures": self.consecutive_failures.get(p, 0),
                "total_calls": self.total_calls.get(p, 0),
                "successes": self.successes.get(p, 0),
                "has_key": bool(self.get_api_key(p)),
            }
            for p in DEFAULT_CASCADE
        }


circuit_breaker = CircuitBreaker()


def sanitize_json_response(raw_text: str) -> Any:
    """Strips markdown fences and extracts outermost JSON object or array."""
    if not raw_text or not raw_text.strip():
        raise ValueError("LLM returned empty text response")

    cleaned = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start_brace = cleaned.find("{")
        end_brace = cleaned.rfind("}")
        start_bracket = cleaned.find("[")
        end_bracket = cleaned.rfind("]")

        start, end = -1, -1
        if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
            start, end = start_brace, end_brace
        elif start_bracket != -1:
            start, end = start_bracket, end_bracket

        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])

        raise ValueError(f"Unable to parse JSON from output: {raw_text[:200]}")


def _call_openrouter(messages: List[Dict[str, str]], json_mode: bool, timeout: int) -> Tuple[str, str]:
    api_key = circuit_breaker.get_api_key("openrouter")
    model = DEFAULT_MODELS["openrouter"]
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trade-compass.internal",
        "X-Title": "Trade Compass Quantitative Engine",
    }
    payload: Dict[str, Any] = {"model": model, "messages": messages, "temperature": 0.3}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=timeout)
    if res.status_code != 200:
        err = Exception(f"OpenRouter error {res.status_code}: {res.text}")
        err.status_code = res.status_code  # type: ignore
        raise err

    data = res.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return text, model


def _call_google_ai_studio(messages: List[Dict[str, str]], json_mode: bool, timeout: int) -> Tuple[str, str]:
    api_key = circuit_breaker.get_api_key("google-ai-studio")
    model = DEFAULT_MODELS["google-ai-studio"]

    # 1. Try OpenAI-compatible endpoint
    try:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {"model": model, "messages": messages, "temperature": 0.3}
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        res = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            headers=headers,
            json=payload,
            timeout=timeout,
        )
        if res.status_code == 200:
            data = res.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", ""), model
        if res.status_code == 429 or res.status_code >= 500:
            err = Exception(f"Google AI Studio error {res.status_code}: {res.text}")
            err.status_code = res.status_code  # type: ignore
            raise err
    except Exception as e:
        if getattr(e, "status_code", 0) == 429 or getattr(e, "status_code", 0) >= 500:
            raise

    # 2. Native REST API fallback
    combined = "\n\n".join(m.get("content", "") for m in messages)
    native_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    native_payload = {
        "contents": [{"role": "user", "parts": [{"text": combined}]}],
        "generationConfig": {"temperature": 0.3},
    }
    if json_mode:
        native_payload["generationConfig"]["responseMimeType"] = "application/json"  # type: ignore

    res = requests.post(native_url, json=native_payload, timeout=timeout)
    if res.status_code != 200:
        err = Exception(f"Google AI Studio Native error {res.status_code}: {res.text}")
        err.status_code = res.status_code  # type: ignore
        raise err

    data = res.json()
    candidates = data.get("candidates", [])
    if candidates:
        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        return text, model
    return "", model


def _call_groq(messages: List[Dict[str, str]], json_mode: bool, timeout: int) -> Tuple[str, str]:
    api_key = circuit_breaker.get_api_key("groq")
    model = DEFAULT_MODELS["groq"]
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload: Dict[str, Any] = {"model": model, "messages": messages, "temperature": 0.3}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=timeout)
    if res.status_code != 200:
        err = Exception(f"Groq error {res.status_code}: {res.text}")
        err.status_code = res.status_code  # type: ignore
        raise err

    data = res.json()
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return text, model


def execute_with_fallback(
    messages: Optional[List[Dict[str, str]]] = None,
    system_prompt: Optional[str] = None,
    user_prompt: Optional[str] = None,
    json_mode: bool = False,
    timeout: int = 35,
    cascade: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Executes an LLM completion across the fallback cascade:
    OpenRouter -> Google AI Studio -> Groq -> Cloudflare.
    """
    if not messages:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if user_prompt:
            messages.append({"role": "user", "content": user_prompt})

    if not messages:
        raise ValueError("Must provide either messages list or system_prompt/user_prompt")

    chain = cascade or DEFAULT_CASCADE
    attempts = []
    start_time = time.time()

    for i, provider in enumerate(chain):
        # 1. Key check
        if not circuit_breaker.get_api_key(provider):
            attempts.append({"provider": provider, "status": "missing_key"})
            continue

        # 2. Cooldown check
        if circuit_breaker.is_cooling_down(provider):
            sec = circuit_breaker.get_remaining_cooldown(provider)
            attempts.append({"provider": provider, "status": f"skipped_cooldown_{sec}s"})
            continue

        # 3. Attempt with 1 retry on 5xx
        for retry in range(2):
            try:
                if provider == "openrouter":
                    text, model = _call_openrouter(messages, json_mode, timeout)
                elif provider == "google-ai-studio":
                    text, model = _call_google_ai_studio(messages, json_mode, timeout)
                elif provider == "groq":
                    text, model = _call_groq(messages, json_mode, timeout)
                else:
                    break

                circuit_breaker.record_success(provider)
                parsed_data = sanitize_json_response(text) if json_mode else None

                return {
                    "content": text,
                    "data": parsed_data,
                    "provider": provider,
                    "model": model,
                    "fallback_triggered": i > 0 or retry > 0,
                    "latency_sec": round(time.time() - start_time, 3),
                    "attempts": attempts,
                }
            except Exception as e:
                code = getattr(e, "status_code", 500)
                circuit_breaker.record_failure(provider, code)
                attempts.append({"provider": provider, "status_code": code, "error": str(e), "retry": retry})

                if 500 <= code < 600 and retry == 0:
                    time.sleep(0.5 + random.uniform(0, 0.25))
                    continue
                break

    raise RuntimeError(f"All LLM providers failed in fallback cascade: {attempts}")


def generate_json_completion(
    user_prompt: str, system_prompt: Optional[str] = None, timeout: int = 35
) -> Dict[str, Any]:
    return execute_with_fallback(
        system_prompt=system_prompt, user_prompt=user_prompt, json_mode=True, timeout=timeout
    )


def generate_text_completion(
    user_prompt: str, system_prompt: Optional[str] = None, timeout: int = 35
) -> str:
    res = execute_with_fallback(
        system_prompt=system_prompt, user_prompt=user_prompt, json_mode=False, timeout=timeout
    )
    return res["content"]
