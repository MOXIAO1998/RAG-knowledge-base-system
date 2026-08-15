"""DeepSeek large language model client (OpenAI-compatible protocol).

- When LLM_API_KEY is configured, calls the real DeepSeek with streaming
  token-by-token output;
- When not configured or a call fails, falls back to the built-in mock answer to
  keep the Q&A pipeline always available.
"""
from __future__ import annotations

import logging
from collections.abc import Iterator

from app.config import settings

logger = logging.getLogger("rag.llm")

_client = None


def llm_available() -> bool:
    return settings.llm_ready


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
    return _client


SYSTEM_PROMPT = (
    "You are an intelligent Q&A assistant for an enterprise knowledge base. Answer the user's "
    "question strictly based on the provided [Context], keeping your answer well organized. "
    "If the context is insufficient to answer, truthfully state that no relevant content was "
    "found in the knowledge base, and do not fabricate."
)


def build_messages(query: str, context: str, history: list[dict] | None = None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in (history or [])[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    user_content = f"[Context]\n{context}\n\n[Question]\n{query}" if context else query
    messages.append({"role": "user", "content": user_content})
    return messages


def chat_once(messages: list[dict], max_tokens: int = 512) -> str:
    """Non-streaming single call, used for short decision tasks such as routing/evaluation/rewriting. Raises an exception on failure for the upper layer to degrade."""
    client = _get_client()
    resp = client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.1,
    )
    return (resp.choices[0].message.content or "").strip()


def stream_chat(messages: list[dict]) -> Iterator[str]:
    """Stream text increments. Raises an exception when the real call fails, letting the upper layer decide on fallback."""
    client = _get_client()
    resp = client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        stream=True,
    )
    for chunk in resp:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
