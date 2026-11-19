"""Remote LLM backend for StylistService (OpenAI-compatible & Gemini API).

Allows running the conversational AI Stylist against a remote or hosted LLM
(OpenAI-compatible endpoint, Colab/Kaggle tunnel, Groq, OpenRouter, or Gemini
API) with automatic fallback across configured providers, while keeping all
retrieval, reranking, sizing, and hallucination guards grounded in the local
OutfitGraph Knowledge Base.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

import httpx

logger = logging.getLogger(__name__)

RemoteProvider = Literal["openai", "gemini"]

_FALSE_VALUES = {"0", "false", "no", "off", "disabled"}


@dataclass(frozen=True)
class RemoteStylistConfig:
    """Configuration for a remote LLM stylist backend."""

    provider: RemoteProvider
    model: str
    api_key: str = ""
    api_base: str = ""
    timeout_s: float = 60.0


def _resolve_model_for_provider(
    provider: RemoteProvider,
    *,
    is_primary: bool,
) -> str:
    """Pick the model name for ``provider`` without cross-provider leakage."""
    shared = os.getenv("STYLIST_MODEL", "").strip()
    if provider == "openai":
        explicit = os.getenv("OPENAI_MODEL", "").strip()
        if explicit:
            return explicit
        if shared and (is_primary or not shared.lower().startswith("gemini")):
            return shared
        return "gpt-4o-mini"

    explicit = os.getenv("GEMINI_MODEL", "").strip()
    if explicit:
        return explicit
    if shared and (is_primary or shared.lower().startswith("gemini")):
        return shared
    return "gemini-2.5-flash"


def _build_provider_config(
    provider: RemoteProvider,
    *,
    is_primary: bool,
    timeout_s: float,
) -> RemoteStylistConfig | None:
    if provider == "openai":
        openai_base = os.getenv("STYLIST_API_BASE", "").strip().rstrip("/")
        openai_key = (os.getenv("STYLIST_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
        if not (openai_base or openai_key):
            return None
        return RemoteStylistConfig(
            provider="openai",
            model=_resolve_model_for_provider("openai", is_primary=is_primary),
            api_key=openai_key,
            api_base=openai_base or "https://api.openai.com/v1",
            timeout_s=timeout_s,
        )

    gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not gemini_key:
        return None
    return RemoteStylistConfig(
        provider="gemini",
        model=_resolve_model_for_provider("gemini", is_primary=is_primary),
        api_key=gemini_key,
        timeout_s=timeout_s,
    )


def resolve_remote_stylist_configs() -> list[RemoteStylistConfig]:
    """Resolve ordered remote LLM configurations (primary + optional fallbacks).

    ``STYLIST_PROVIDER`` supports:
      - ``auto`` (default): ``openai`` first, then ``gemini`` fallback.
      - ``openai`` / ``remote``: ``openai`` first, then ``gemini`` fallback.
      - ``gemini``: ``gemini`` first, then ``openai`` fallback.
      - Comma-separated order, e.g. ``openai,gemini`` or ``gemini,openai``.
      - ``local`` / ``disabled`` / ``none`` / ``off``: returns ``[]``.

    Set ``STYLIST_FALLBACK=false`` to disable automatic fallback to secondary
    configured providers.
    """
    raw_provider = os.getenv("STYLIST_PROVIDER", "auto").strip().lower()
    if raw_provider in {"local", "disabled", "none", "off"}:
        return []

    timeout_raw = os.getenv("STYLIST_TIMEOUT_S", "60")
    try:
        timeout_s = max(5.0, float(timeout_raw))
    except ValueError:
        timeout_s = 60.0

    allow_fallback = os.getenv("STYLIST_FALLBACK", "true").strip().lower() not in _FALSE_VALUES

    order: list[RemoteProvider] = []
    for token in raw_provider.split(","):
        part = token.strip()
        if part in {"auto", "openai", "remote"} and "openai" not in order:
            order.append("openai")
        elif part == "gemini" and "gemini" not in order:
            order.append("gemini")

    if not order:
        order = ["openai", "gemini"]
    elif allow_fallback:
        for candidate in ("openai", "gemini"):
            if candidate not in order:
                order.append(candidate)

    configs: list[RemoteStylistConfig] = []
    for idx, provider in enumerate(order):
        cfg = _build_provider_config(provider, is_primary=(idx == 0), timeout_s=timeout_s)
        if cfg is not None:
            configs.append(cfg)
    return configs


def resolve_remote_stylist_config() -> RemoteStylistConfig | None:
    """Return the primary remote LLM config, or ``None`` if unconfigured."""
    configs = resolve_remote_stylist_configs()
    return configs[0] if configs else None


def build_remote_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Normalize StylistService messages for standard chat completion APIs.

    Converts bare ``role="tool"`` messages (which lack OpenAI ``tool_call_id``)
    into ``user`` messages wrapped with ``<tool_response>...</tool_response>``
    to match the repo's wire format.
    """
    normalized: list[dict[str, str]] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = str(msg.get("content", ""))
        if role == "tool":
            normalized.append(
                {
                    "role": "user",
                    "content": f"<tool_response>\n{content}\n</tool_response>",
                }
            )
        elif role in {"system", "assistant", "user"}:
            normalized.append({"role": role, "content": content})
        else:
            normalized.append({"role": "user", "content": content})
    return normalized


def _call_openai_compatible(
    config: RemoteStylistConfig,
    messages: list[dict[str, str]],
    *,
    max_new_tokens: int = 512,
    temperature: float = 0.4,
) -> str:
    url = f"{config.api_base}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"

    payload: dict[str, Any] = {
        "model": config.model,
        "messages": build_remote_messages(messages),
        "temperature": temperature,
        "max_tokens": max_new_tokens,
    }
    with httpx.Client(timeout=config.timeout_s) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Remote LLM returned no choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Remote LLM returned empty content")
    return content.strip()


def _call_gemini(
    config: RemoteStylistConfig,
    messages: list[dict[str, str]],
    *,
    max_new_tokens: int = 512,
    temperature: float = 0.4,
) -> str:
    from google import genai
    from google.genai import types

    normalized = build_remote_messages(messages)
    system_parts = [m["content"] for m in normalized if m["role"] == "system" and m["content"]]
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in normalized
        if m["role"] != "system"
    ]
    if not contents:
        contents = [types.Content(role="user", parts=[types.Part.from_text(text="")])]

    client = genai.Client(
        api_key=config.api_key,
        http_options=types.HttpOptions(api_version="v1beta"),
    )
    gen_config = types.GenerateContentConfig(
        system_instruction="\n\n".join(system_parts) if system_parts else None,
        temperature=temperature,
        max_output_tokens=max(max_new_tokens, 4096),
        thinking_config=types.ThinkingConfig(thinking_budget=256),
    )
    response = client.models.generate_content(
        model=config.model,
        contents=contents,
        config=gen_config,
    )
    text = getattr(response, "text", None) or ""
    if not text.strip():
        raise RuntimeError("Gemini returned empty response")
    return text.strip()


def _invoke_provider(
    config: RemoteStylistConfig,
    messages: list[dict[str, str]],
    *,
    max_new_tokens: int,
    temperature: float,
) -> str:
    if config.provider == "openai":
        return _call_openai_compatible(
            config,
            messages,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        )
    if config.provider == "gemini":
        return _call_gemini(
            config,
            messages,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        )
    raise ValueError(f"Unsupported remote stylist provider: {config.provider}")


def make_remote_generate_fn(
    configs: RemoteStylistConfig | Sequence[RemoteStylistConfig],
) -> Callable[..., str]:
    """Create a ``StylistService``-compatible ``generate_fn`` with fallback.

    Tries each configured provider in order; if a provider fails (e.g. quota /
    429 / network / empty response), automatically falls back to the next one.
    """
    ordered = [configs] if isinstance(configs, RemoteStylistConfig) else list(configs)
    if not ordered:
        raise ValueError("At least one RemoteStylistConfig is required")

    def generate_fn(
        model: Any,
        processor: Any,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> str:
        max_new_tokens = int(kwargs.get("max_new_tokens", 512))
        temperature = float(kwargs.get("temperature", 0.4))
        last_exc: Exception | None = None
        for idx, cfg in enumerate(ordered):
            try:
                return _invoke_provider(
                    cfg,
                    messages,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                )
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if idx + 1 < len(ordered):
                    nxt = ordered[idx + 1]
                    logger.warning(
                        "Remote stylist provider=%s model=%s failed (%s); falling back to %s (%s)",
                        cfg.provider,
                        cfg.model,
                        exc,
                        nxt.provider,
                        nxt.model,
                    )
        assert last_exc is not None
        raise last_exc

    return generate_fn
