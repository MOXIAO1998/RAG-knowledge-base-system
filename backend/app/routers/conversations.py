"""Conversation history routes: strict user isolation (admins can see all)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.response import ApiError, ok
from app.database import get_db
from app.deps import get_current_user
from app.models import Conversation, User
from app.serializers import conversation_to_dict
from app.services import access

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    q = db.query(Conversation).order_by(Conversation.updated_at.desc())
    if not access.is_admin_user(user):
        q = q.filter(Conversation.user_id == user.id)
    return ok([conversation_to_dict(c) for c in q.all()])


@router.get("/{conv_id}")
def get_conversation(
    conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise ApiError("Conversation not found", code=1, status_code=404)
    if conv.user_id != user.id and not access.is_admin_user(user):
        raise ApiError("No permission to access this conversation", code=1, status_code=403)
    return ok(conversation_to_dict(conv, include_messages=True))


@router.delete("/{conv_id}")
def delete_conversation(
    conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise ApiError("Conversation not found", code=1, status_code=404)
    if conv.user_id != user.id and not access.is_admin_user(user):
        raise ApiError("No permission to delete this conversation", code=1, status_code=403)
    db.delete(conv)
    db.commit()
    return ok(message="Conversation has been deleted")
