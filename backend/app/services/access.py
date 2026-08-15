"""Knowledge base access control: permission decisions based on visibility, ownership, and membership.

- public / department: readable by all logged-in users;
- private: readable only by the owner, members, and administrators;
- write/manage: administrators, the owner, write-level members, or those with the kb:manage permission.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import KbMember, KnowledgeBase, User
from app.serializers import merge_permissions


def user_permissions(user: User) -> list[str]:
    return merge_permissions(list(user.roles))


def is_admin_user(user: User) -> bool:
    return "admin" in user_permissions(user)


def accessible_kb_ids(db: Session, user: User) -> list[int]:
    """Return the list of knowledge base ids readable by the current user."""
    if is_admin_user(user):
        return [k.id for k in db.query(KnowledgeBase).all()]
    ids: set[int] = set()
    for kb in db.query(KnowledgeBase).all():
        if kb.visibility in ("public", "department") or kb.owner_id == user.id:
            ids.add(kb.id)
    for m in db.query(KbMember).filter(KbMember.user_id == user.id).all():
        ids.add(m.kb_id)
    return sorted(ids)


def can_read_kb(db: Session, user: User, kb: KnowledgeBase) -> bool:
    if is_admin_user(user):
        return True
    if kb.visibility in ("public", "department") or kb.owner_id == user.id:
        return True
    m = (
        db.query(KbMember)
        .filter(KbMember.kb_id == kb.id, KbMember.user_id == user.id)
        .first()
    )
    return m is not None


def can_manage_kb(db: Session, user: User, kb: KnowledgeBase) -> bool:
    perms = user_permissions(user)
    if "admin" in perms:
        return True
    if kb.owner_id == user.id:
        return True
    m = (
        db.query(KbMember)
        .filter(KbMember.kb_id == kb.id, KbMember.user_id == user.id)
        .first()
    )
    return bool(m and m.access_level == "write")
