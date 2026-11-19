"""Tests for outfitmatch.stylist.remote — remote LLM configuration and fallback."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from outfitmatch.stylist.remote import (
    RemoteStylistConfig,
    build_remote_messages,
    make_remote_generate_fn,
    resolve_remote_stylist_config,
    resolve_remote_stylist_configs,
)


def _clear_remote_env(monkeypatch):
    for key in (
        "STYLIST_PROVIDER",
        "STYLIST_FALLBACK",
        "STYLIST_API_BASE",
        "STYLIST_API_KEY",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_MODEL",
        "STYLIST_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)


def test_resolve_remote_config_defaults_none(monkeypatch):
    _clear_remote_env(monkeypatch)
    assert resolve_remote_stylist_config() is None
    assert resolve_remote_stylist_configs() == []


def test_resolve_remote_config_openai_compat(monkeypatch):
    _clear_remote_env(monkeypatch)
    monkeypatch.setenv("STYLIST_PROVIDER", "auto")
    monkeypatch.setenv("STYLIST_API_BASE", "http://localhost:11434/v1/")
    monkeypatch.setenv("STYLIST_MODEL", "qwen3-vl-8b-stylist")

    cfg = resolve_remote_stylist_config()
    assert cfg is not None
    assert cfg.provider == "openai"
    assert cfg.api_base == "http://localhost:11434/v1"
    assert cfg.model == "qwen3-vl-8b-stylist"


def test_resolve_remote_config_gemini(monkeypatch):
    _clear_remote_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    cfg = resolve_remote_stylist_config()
    assert cfg is not None
    assert cfg.provider == "gemini"
    assert cfg.api_key == "test-key"
    assert cfg.model == "gemini-2.5-flash"


def test_resolve_remote_configs_both_providers_with_fallback(monkeypatch):
    _clear_remote_env(monkeypatch)
    monkeypatch.setenv("STYLIST_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("OPENAI_API_KEY", "o-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o-mini")

    cfgs = resolve_remote_stylist_configs()
    assert [c.provider for c in cfgs] == ["gemini", "openai"]
    assert [c.model for c in cfgs] == ["gemini-2.5-flash", "gpt-4o-mini"]


def test_resolve_remote_configs_disable_fallback(monkeypatch):
    _clear_remote_env(monkeypatch)
    monkeypatch.setenv("STYLIST_PROVIDER", "openai")
    monkeypatch.setenv("STYLIST_FALLBACK", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "o-key")
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")

    cfgs = resolve_remote_stylist_configs()
    assert [c.provider for c in cfgs] == ["openai"]


def test_build_remote_messages_wraps_tool_role():
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "<tool_call>{}</tool_call>"},
        {"role": "tool", "content": "OF_00001"},
    ]
    converted = build_remote_messages(msgs)
    assert converted[3]["role"] == "user"
    assert converted[3]["content"].startswith("<tool_response>")
    assert "OF_00001" in converted[3]["content"]


def test_openai_remote_generate_fn_posts_chat_completions():
    cfg = RemoteStylistConfig(
        provider="openai",
        model="test-model",
        api_key="sk-test",
        api_base="https://api.example.com/v1",
    )
    gen_fn = make_remote_generate_fn(cfg)

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"choices": [{"message": {"content": "Gợi ý OF_00001 cho bạn."}}]}
    mock_client = MagicMock()
    mock_client.__enter__.return_value.post.return_value = mock_resp

    with patch("outfitmatch.stylist.remote.httpx.Client", return_value=mock_client):
        out = gen_fn(None, None, [{"role": "user", "content": "đi làm"}])

    assert out == "Gợi ý OF_00001 cho bạn."
    mock_client.__enter__.return_value.post.assert_called_once()


def test_fallback_from_openai_to_gemini_and_vice_versa():
    openai_cfg = RemoteStylistConfig(provider="openai", model="gpt-4o-mini", api_key="o")
    gemini_cfg = RemoteStylistConfig(provider="gemini", model="gemini-2.5-flash", api_key="g")

    gen_fn = make_remote_generate_fn([openai_cfg, gemini_cfg])
    with (
        patch(
            "outfitmatch.stylist.remote._call_openai_compatible",
            side_effect=RuntimeError("429 Too Many Requests"),
        ),
        patch(
            "outfitmatch.stylist.remote._call_gemini",
            return_value="Fallback Gemini OK",
        ),
    ):
        assert gen_fn(None, None, [{"role": "user", "content": "hi"}]) == "Fallback Gemini OK"

    gen_fn_reverse = make_remote_generate_fn([gemini_cfg, openai_cfg])
    with (
        patch(
            "outfitmatch.stylist.remote._call_gemini",
            side_effect=RuntimeError("Gemini quota exhausted"),
        ),
        patch(
            "outfitmatch.stylist.remote._call_openai_compatible",
            return_value="Fallback OpenAI OK",
        ),
    ):
        assert (
            gen_fn_reverse(None, None, [{"role": "user", "content": "hi"}]) == "Fallback OpenAI OK"
        )


def test_all_providers_fail_raises_last_error():
    openai_cfg = RemoteStylistConfig(provider="openai", model="gpt-4o-mini", api_key="o")
    gemini_cfg = RemoteStylistConfig(provider="gemini", model="gemini-2.5-flash", api_key="g")
    gen_fn = make_remote_generate_fn([openai_cfg, gemini_cfg])
    with (
        patch("outfitmatch.stylist.remote._call_openai_compatible", side_effect=RuntimeError("o1")),
        patch("outfitmatch.stylist.remote._call_gemini", side_effect=RuntimeError("g2")),
        pytest.raises(RuntimeError, match="g2"),
    ):
        gen_fn(None, None, [{"role": "user", "content": "hi"}])
