"""RAG Q&A orchestration: semantic cache -> LangGraph state graph (routing/decomposition/self-correcting retrieval/generation/hallucination check) -> persistence.

Produces SSE data lines (each data line is JSON), with event types:
  {"type":"routing","kbs":[{"id","name"}]}  knowledge bases automatically matched
  {"type":"retrieving"}                      retrieval stage
  {"type":"stage","stage":"..."}             extended stages (grading/rewriting/verifying/regenerating)
  {"type":"generating"}                      generation started
  {"type":"token","delta":"..."}             incremental answer text
  {"type":"restart"}                         hallucination check failed, regenerating; frontend should clear the current answer
  {"type":"citations","citations":[...]}     citation sources
  {"type":"done","conversationId":N,"messageId":N}
  {"type":"error","message":"..."}
When no LLM key is configured, the graph nodes pass through automatically and fall back to a summary-style answer based on retrieved snippets, keeping the pipeline usable.
"""
from __future__ import annotations

import json
import logging
from collections.abc import Iterator

from app.database import SessionLocal
from app.models import Citation, Conversation, KnowledgeBase, Message
from app.services import redis_client
from app.services.embedding import embed_text
from app.services.rag_graph import rag_flow

logger = logging.getLogger("rag.qa")


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _load_history(db, conversation_id: int | None, user_id: int) -> list[dict]:
    if not conversation_id:
        return []
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        return []
    return [{"role": m.role, "content": m.content} for m in conv.messages]


def _chunk_text(text: str, size: int = 4) -> Iterator[str]:
    for i in range(0, len(text), size):
        yield text[i : i + size]


def stream_answer(
    *,
    user_id: int,
    query: str,
    conversation_id: int | None,
    kb_ids: list[int],
) -> Iterator[str]:
    """Generate an SSE event stream. kb_ids is the searchable knowledge-base scope already authorized and filtered by the caller."""
    db = SessionLocal()
    try:
        qvec = embed_text(query)
        history = _load_history(db, conversation_id, user_id)

        # Candidate KB metadata (for the routing node's decision inside the graph)
        kb_catalog: list[dict] = []
        if kb_ids:
            rows = (
                db.query(KnowledgeBase).filter(KnowledgeBase.id.in_(kb_ids)).all()
            )
            kb_catalog = [
                {"id": k.id, "name": k.name, "description": k.description or ""}
                for k in rows
            ]

        # Semantic cache (isolated by candidate KB scope to prevent cross-permission leakage); a hit skips the entire state graph
        scope = "kb_" + "_".join(str(x) for x in sorted(kb_ids)) if kb_ids else "all"
        cached = redis_client.semantic_cache_get(scope, qvec)

        answer = ""
        citations: list[dict] = []
        routed_kbs: list[dict] = []

        if cached:
            redis_client.incr_cache(True)
            yield _sse({"type": "routing", "kbs": []})
            yield _sse({"type": "generating"})
            answer = cached["answer"]
            citations = cached.get("citations") or []
            for piece in _chunk_text(answer):
                yield _sse({"type": "token", "delta": piece})
        else:
            redis_client.incr_cache(False)
            init_state = {
                "original_query": query,
                "kb_ids": kb_ids,
                "kb_catalog": kb_catalog,
                "history": history,
            }
            final_state: dict = {}
            # The custom stream forwards node events from the graph; the values stream tracks final state for persistence
            for mode, chunk in rag_flow.stream(
                init_state, stream_mode=["custom", "values"]
            ):
                if mode == "custom":
                    yield _sse(chunk)
                else:
                    final_state = chunk
            answer = final_state.get("answer", "")
            citations = final_state.get("citations") or []
            routed_kbs = final_state.get("routed_kbs") or []
            if answer:
                redis_client.semantic_cache_set(scope, qvec, answer, citations)

        redis_client.incr_qa()
        yield _sse({"type": "citations", "citations": citations})

        conv_id, msg_id = _persist(
            db, user_id, conversation_id, query, answer, citations, routed_kbs
        )
        yield _sse({"type": "done", "conversationId": conv_id, "messageId": msg_id})
    except Exception as e:  # noqa: BLE001
        logger.exception("Q&A stream processing failed")
        yield _sse({"type": "error", "message": str(e)[:200]})
    finally:
        db.close()


def _persist(
    db,
    user_id: int,
    conversation_id: int | None,
    query: str,
    answer: str,
    citations: list[dict],
    routed_kbs: list[dict],
) -> tuple[int, int]:
    """Save the user question and assistant answer (with citations); return (conversation id, assistant message id)."""
    conv = db.get(Conversation, conversation_id) if conversation_id else None
    if not conv or conv.user_id != user_id:
        kb_name = routed_kbs[0]["name"] if routed_kbs else ""
        kb_id = routed_kbs[0]["id"] if routed_kbs else 0
        conv = Conversation(
            user_id=user_id,
            title=query[:30] or "New Conversation",
            kb_id=kb_id,
            kb_name=kb_name,
        )
        db.add(conv)
        db.flush()

    db.add(Message(conversation_id=conv.id, role="user", content=query))
    assistant = Message(conversation_id=conv.id, role="assistant", content=answer)
    db.add(assistant)
    db.flush()
    for c in citations:
        db.add(
            Citation(
                message_id=assistant.id,
                doc_id=c.get("docId", 0),
                title=c.get("title", ""),
                page=c.get("page", 1),
                snippet=c.get("snippet", ""),
            )
        )
    db.commit()
    return conv.id, assistant.id
