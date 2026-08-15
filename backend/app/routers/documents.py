"""Document routes: upload (triggers indexing task) / list / delete / reindex / view chunks."""
from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from app.common.response import ApiError, ok
from app.config import settings
from app.database import get_db
from app.deps import get_client_ip, get_current_user, require_permission
from app.models import Chunk, Document, KnowledgeBase, User
from app.serializers import chunk_to_dict, doc_to_dict
from app.services import access, audit, es_client, indexing
from app.services.parsing import detect_file_type

router = APIRouter(tags=["documents"])


def _get_doc_or_404(db: Session, doc_id: int) -> Document:
    doc = db.get(Document, doc_id)
    if not doc:
        raise ApiError("Document not found", code=1, status_code=404)
    return doc


@router.get("/documents")
def list_documents(
    kbId: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    allowed = set(access.accessible_kb_ids(db, user))
    q = db.query(Document).order_by(Document.updated_at.desc())
    if kbId is not None:
        if kbId not in allowed:
            raise ApiError("Insufficient permissions", code=1, status_code=403)
        q = q.filter(Document.kb_id == kbId)
    docs = [d for d in q.all() if d.kb_id in allowed]
    return ok([doc_to_dict(d) for d in docs])


@router.post("/kb/{kb_id}/documents")
async def upload_document(
    kb_id: int,
    request: Request,
    file: UploadFile = File(...),
    permissionTags: str = Form(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("document:upload")),
):
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise ApiError("Knowledge base not found", code=1, status_code=404)
    if not access.can_manage_kb(db, user, kb):
        raise ApiError("No write permission for this knowledge base", code=1, status_code=403)

    filename = file.filename or "Untitled Document"
    file_type = detect_file_type(filename)

    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "txt"
    stored = os.path.join(settings.upload_dir, f"{uuid.uuid4().hex}.{ext}")
    content = await file.read()
    with open(stored, "wb") as f:
        f.write(content)

    tags = [t.strip() for t in permissionTags.split(",") if t.strip()]
    doc = Document(
        kb_id=kb_id,
        title=filename,
        file_type=file_type,
        status="indexing",
        permission_tags=tags,
        chunk_count=0,
        size_kb=max(1, len(content) // 1024),
        progress=0,
        file_path=stored,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    task_id = indexing.create_index_task(doc.id, task_type="Document Indexing", target=filename)
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Upload Document",
        resource=f"document:{doc.id}",
        ip=get_client_ip(request),
    )
    return ok({"document": doc_to_dict(doc), "taskId": task_id}, message="Document has been submitted for indexing")


@router.get("/documents/{doc_id}")
def get_document(
    doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    doc = _get_doc_or_404(db, doc_id)
    if doc.kb_id not in set(access.accessible_kb_ids(db, user)):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    return ok(doc_to_dict(doc))


@router.get("/documents/{doc_id}/chunks")
def list_chunks(
    doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    doc = _get_doc_or_404(db, doc_id)
    if doc.kb_id not in set(access.accessible_kb_ids(db, user)):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    chunks = (
        db.query(Chunk)
        .filter(Chunk.doc_id == doc_id)
        .order_by(Chunk.chunk_index)
        .all()
    )
    return ok([chunk_to_dict(c) for c in chunks])


@router.post("/documents/{doc_id}/reindex")
def reindex_document(
    doc_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("document:manage")),
):
    doc = _get_doc_or_404(db, doc_id)
    kb = db.get(KnowledgeBase, doc.kb_id)
    if not kb or not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise ApiError("Original file is missing, cannot reindex", code=1, status_code=400)

    doc.status = "indexing"
    doc.progress = 0
    db.commit()
    task_id = indexing.create_index_task(doc.id, task_type="Reindex", target=doc.title)
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Reindex",
        resource=f"document:{doc.id}",
        ip=get_client_ip(request),
    )
    return ok({"taskId": task_id}, message="Reindexing has been triggered")


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("document:manage")),
):
    doc = _get_doc_or_404(db, doc_id)
    kb = db.get(KnowledgeBase, doc.kb_id)
    if not kb or not access.can_manage_kb(db, user, kb):
        raise ApiError("Insufficient permissions", code=1, status_code=403)
    try:
        es_client.delete_by_doc(doc_id)
    except Exception:  # noqa: BLE001
        pass
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass
    db.query(Chunk).filter(Chunk.doc_id == doc_id).delete()
    db.delete(doc)
    db.commit()
    audit.log(
        db,
        user_id=user.id,
        username=user.username,
        action="Delete Document",
        resource=f"document:{doc_id}",
        ip=get_client_ip(request),
    )
    return ok(message="Document has been deleted")
