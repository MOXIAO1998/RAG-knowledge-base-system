"""Knowledge base router: CRUD + member authorization."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.common.response import ApiError, ok
from app.database import get_db
from app.deps import get_client_ip, get_current_user, require_permission
from app.models import Chunk, Document, KbMember, KnowledgeBase, User
from app.schemas import KbCreate, KbMemberCreate, KbUpdate
from app.serializers import kb_to_dict, kbmember_to_dict
from app.services import access, audit, es_client

router = APIRouter(prefix="/kb", tags=["kb"])


def _counts(db: Session, kb_id: int) -> tuple[int, int]:
    doc_count = db.query(func.count(Document.id)).filter(Document.kb_id == kb_id).scalar() or 0
    chunk_count = (
        db.query(func.coalesce(func.sum(Document.chunk_count), 0))
        .filter(Document.kb_id == kb_id)
        .scalar()
        or 0
    )
    return int(doc_count), int(chunk_count)


def _get_kb_or_404(db: Session, kb_id: int) -> KnowledgeBase:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise ApiError("Knowledge base not found", code=1, status_code=404)
    return kb


@router.get("")
def list_kb(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = set(access.accessible_kb_ids(db, user))
    result = []
    for kb in db.query(KnowledgeBase).order_by(KnowledgeBase.id).all():
        if kb.id not in ids:
            continue
        dc, cc = _counts(db, kb.id)
        result.append(kb_to_dict(kb, dc, cc))
    return ok(result)


@router.post("")
def create_kb(
    body: KbCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("kb:manage")),
):
    kb = KnowledgeBase(
        name=body.name,
        description=body.description,
        visibility=body.visibility,
        owner_id=user.id,
        owner_name=user.username,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Create knowledge base",
        resource=f"kb:{kb.id}",
        ip=get_client_ip(request),
    )
    return ok(kb_to_dict(kb, 0, 0), message="Knowledge base created")


@router.put("/{kb_id}")
def update_kb(
    kb_id: int,
    body: KbUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kb = _get_kb_or_404(db, kb_id)
    if not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    if body.name is not None:
        kb.name = body.name
    if body.description is not None:
        kb.description = body.description
    if body.visibility is not None:
        kb.visibility = body.visibility
    db.commit()
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Update knowledge base",
        resource=f"kb:{kb.id}",
        ip=get_client_ip(request),
    )
    dc, cc = _counts(db, kb.id)
    return ok(kb_to_dict(kb, dc, cc), message="Knowledge base updated")


@router.delete("/{kb_id}")
def delete_kb(
    kb_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kb = _get_kb_or_404(db, kb_id)
    if not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    # Clean up the ES index (ignore if unavailable); DB cascade deletes documents/chunks/members
    try:
        es_client.delete_by_kb(kb_id)
    except Exception:  # noqa: BLE001
        pass
    db.query(Chunk).filter(Chunk.kb_id == kb_id).delete()
    db.delete(kb)
    db.commit()
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Delete knowledge base",
        resource=f"kb:{kb_id}",
        ip=get_client_ip(request),
    )
    return ok(message="Knowledge base deleted")


@router.get("/{kb_id}/members")
def list_members(
    kb_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    kb = _get_kb_or_404(db, kb_id)
    if not access.can_read_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    members = db.query(KbMember).filter(KbMember.kb_id == kb_id).all()
    return ok([kbmember_to_dict(m) for m in members])


@router.post("/{kb_id}/members")
def add_member(
    kb_id: int,
    body: KbMemberCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kb = _get_kb_or_404(db, kb_id)
    if not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    target = db.get(User, body.userId)
    if not target:
        raise ApiError("User not found", code=1, status_code=404)
    member = (
        db.query(KbMember)
        .filter(KbMember.kb_id == kb_id, KbMember.user_id == body.userId)
        .first()
    )
    role_name = target.roles[0].name if target.roles else ""
    if member:
        member.access_level = body.accessLevel
        member.username = target.username
        member.role_name = role_name
    else:
        member = KbMember(
            kb_id=kb_id,
            user_id=target.id,
            username=target.username,
            role_name=role_name,
            access_level=body.accessLevel,
        )
        db.add(member)
    db.commit()
    return ok(kbmember_to_dict(member), message="Member saved")


@router.delete("/{kb_id}/members/{user_id}")
def remove_member(
    kb_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    kb = _get_kb_or_404(db, kb_id)
    if not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    db.query(KbMember).filter(
        KbMember.kb_id == kb_id, KbMember.user_id == user_id
    ).delete()
    db.commit()
    return ok(message="Member removed")
