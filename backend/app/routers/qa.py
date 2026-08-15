"""Q&A router: SSE streaming Q&A (hybrid retrieval + DeepSeek + citations)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.common.response import ApiError
from app.database import get_db
from app.deps import require_permission
from app.models import User
from app.schemas import QaRequest
from app.services import access, rag, redis_client

router = APIRouter(prefix="/qa", tags=["qa"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("/stream")
def qa_stream(
    body: QaRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("qa:ask")),
):
    query = (body.query or "").strip()
    if not query:
        raise ApiError("Question cannot be empty", code=1, status_code=400)
    if not redis_client.rate_limit_ok(f"qa:{user.id}", limit=60, window=60):
        raise ApiError("Too many requests, please try again later", code=429, status_code=429)

    kb_ids = access.accessible_kb_ids(db, user)
    if body.kbId:
        kb_ids = [body.kbId] if body.kbId in kb_ids else []

    generator = rag.stream_answer(
        user_id=user.id,
        query=query,
        conversation_id=body.conversationId,
        kb_ids=kb_ids,
    )
    return StreamingResponse(
        generator, media_type="text/event-stream", headers=SSE_HEADERS
    )
