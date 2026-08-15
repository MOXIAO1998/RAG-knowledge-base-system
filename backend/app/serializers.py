"""ORM -> dict serializers: output structure strictly aligned with the frontend src/types.ts."""
from __future__ import annotations

from app.common.response import fmt_dt
from app.models import (
    AuditLog,
    Chunk,
    Citation,
    Conversation,
    Document,
    EvalRun,
    KbMember,
    KnowledgeBase,
    Message,
    Role,
    Task,
    User,
)


def merge_permissions(roles: list[Role]) -> list[str]:
    perms: set[str] = set()
    for r in roles:
        for p in r.permissions or []:
            perms.add(p)
    return sorted(perms)


def user_to_dict(u: User) -> dict:
    roles = list(u.roles)
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "status": u.status,
        "roles": [r.name for r in roles],
        "lastLogin": fmt_dt(u.last_login),
        # Include the merged permission codes for the frontend to control menu/button-level permissions
        "permissions": merge_permissions(roles),
    }


def role_to_dict(r: Role) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "permissions": list(r.permissions or []),
    }


def kb_to_dict(kb: KnowledgeBase, doc_count: int = 0, chunk_count: int = 0) -> dict:
    return {
        "id": kb.id,
        "name": kb.name,
        "description": kb.description,
        "visibility": kb.visibility,
        "ownerName": kb.owner_name,
        "docCount": doc_count,
        "chunkCount": chunk_count,
        "updatedAt": fmt_dt(kb.updated_at),
    }


def doc_to_dict(d: Document) -> dict:
    return {
        "id": d.id,
        "kbId": d.kb_id,
        "title": d.title,
        "fileType": d.file_type,
        "status": d.status,
        "permissionTags": list(d.permission_tags or []),
        "chunkCount": d.chunk_count,
        "sizeKb": d.size_kb,
        "progress": d.progress,
        "updatedAt": fmt_dt(d.updated_at),
    }


def citation_to_dict(c: Citation) -> dict:
    return {"docId": c.doc_id, "title": c.title, "page": c.page, "snippet": c.snippet}


def message_to_dict(m: Message) -> dict:
    citations = [citation_to_dict(c) for c in m.citations]
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "citations": citations or None,
        "createdAt": fmt_dt(m.created_at),
    }


def conversation_to_dict(conv: Conversation, include_messages: bool = False) -> dict:
    msgs = list(conv.messages)
    data = {
        "id": conv.id,
        "userId": conv.user_id,
        "title": conv.title,
        "kbId": conv.kb_id,
        "kbName": conv.kb_name,
        "messageCount": len(msgs),
        "updatedAt": fmt_dt(conv.updated_at),
        "messages": [message_to_dict(m) for m in msgs] if include_messages else [],
    }
    return data


def kbmember_to_dict(m: KbMember) -> dict:
    return {
        "userId": m.user_id,
        "username": m.username,
        "roleName": m.role_name,
        "accessLevel": m.access_level,
    }


def task_to_dict(t: Task) -> dict:
    return {
        "taskId": t.task_id,
        "type": t.type,
        "target": t.target,
        "state": t.state,
        "progress": t.progress,
        "retryCount": t.retry_count,
        "message": t.message,
        "createdAt": fmt_dt(t.created_at),
    }


def eval_to_dict(e: EvalRun) -> dict:
    return {
        "id": e.id,
        "dataset": e.dataset,
        "kbName": e.kb_name,
        "faithfulness": e.faithfulness,
        "answerRelevancy": e.answer_relevancy,
        "contextPrecision": e.context_precision,
        "contextRecall": e.context_recall,
        "status": e.status,
        "createdAt": fmt_dt(e.created_at),
    }


def audit_to_dict(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "username": a.username,
        "action": a.action,
        "resource": a.resource,
        "ip": a.ip,
        "createdAt": fmt_dt(a.created_at),
    }


def chunk_to_dict(c: Chunk) -> dict:
    return {
        "id": c.id,
        "chunkIndex": c.chunk_index,
        "titlePath": c.title_path,
        "content": c.content,
        "sourcePage": c.source_page,
        "permissionTags": list(c.permission_tags or []),
    }
