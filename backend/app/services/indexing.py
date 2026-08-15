"""Document indexing orchestration: parse -> split -> embed -> write to the chunk table and ES, while maintaining task state.

By default runs in an in-process background thread (TASK_MODE=thread, suited to local Windows development),
with each thread using its own database session. When ES is unavailable, it degrades to database-only storage;
the task is still marked successful but notes that no vector index was built. On parse errors, both the task and
the document are marked failed.
"""
from __future__ import annotations

import logging
import threading
import uuid

from app.config import settings
from app.database import SessionLocal
from app.models import Chunk, Document, Task
from app.services import es_client
from app.services.embedding import embed_text
from app.services.parsing import extract_pages, split_pages

logger = logging.getLogger("rag.indexing")


def _new_task_id() -> str:
    return "task_" + uuid.uuid4().hex[:12]


def create_index_task(doc_id: int, task_type: str = "Document Indexing", target: str = "") -> str:
    """Create a task record and run indexing asynchronously; return task_id."""
    task_id = _new_task_id()
    with SessionLocal() as db:
        db.add(
            Task(
                task_id=task_id,
                type=task_type,
                target=target,
                state="PENDING",
                progress=0,
                doc_id=doc_id,
            )
        )
        db.commit()
    _dispatch(_run_index, doc_id, task_id)
    return task_id


def _dispatch(fn, *args) -> None:
    if settings.task_mode == "thread":
        threading.Thread(target=fn, args=args, daemon=True).start()
    else:
        # Synchronous execution (fallback / testing)
        fn(*args)


def _set_task(db, task_id: str, **fields) -> None:
    task = db.get(Task, task_id)
    if task:
        for k, v in fields.items():
            setattr(task, k, v)
        db.commit()


def _run_index(doc_id: int, task_id: str) -> None:
    db = SessionLocal()
    try:
        doc = db.get(Document, doc_id)
        if not doc:
            _set_task(db, task_id, state="FAILURE", message="Document not found")
            return

        doc.status = "indexing"
        doc.progress = 5
        _set_task(db, task_id, state="STARTED", progress=5)
        db.commit()

        # Clean up old chunks (reindex/overwrite scenario)
        db.query(Chunk).filter(Chunk.doc_id == doc_id).delete()
        db.commit()
        try:
            es_client.delete_by_doc(doc_id)
        except Exception:  # noqa: BLE001
            logger.warning("Failed to clean up old ES chunks doc_id=%s", doc_id, exc_info=True)

        # Parse
        pages = extract_pages(doc.file_path, doc.file_type)
        doc.progress = 30
        _set_task(db, task_id, state="PROGRESS", progress=30)
        db.commit()

        # Split
        raw_chunks = split_pages(pages, doc.file_type)
        doc.progress = 55
        _set_task(db, task_id, progress=55)
        db.commit()

        tags = list(doc.permission_tags or [])
        es_docs: list[dict] = []
        for rc in raw_chunks:
            cid = f"{doc_id}_{rc['chunk_index']}"
            content = rc["content"]
            db.add(
                Chunk(
                    id=cid,
                    doc_id=doc_id,
                    kb_id=doc.kb_id,
                    chunk_index=rc["chunk_index"],
                    title_path=rc["title_path"],
                    content=content,
                    source_page=rc["source_page"],
                    permission_tags=tags,
                    vector_id=cid,
                )
            )
            es_docs.append(
                {
                    "chunk_id": cid,
                    "content": content,
                    "embedding": embed_text(content),
                    "kb_id": str(doc.kb_id),
                    "doc_id": str(doc_id),
                    "chunk_index": rc["chunk_index"],
                    "title_path": rc["title_path"],
                    "doc_title": doc.title,
                    "permission_tags": tags,
                    "source_page": rc["source_page"],
                }
            )
        db.commit()
        doc.progress = 80
        _set_task(db, task_id, progress=80)
        db.commit()

        # Write to ES (degrade to database-only if unavailable)
        note = ""
        if es_docs:
            try:
                es_client.index_chunks(es_docs)
            except Exception as e:  # noqa: BLE001
                logger.warning("ES indexing failed; degrading to database-only: %s", e)
                note = " (ES unavailable; degraded to database-only, no vector index built)"

        doc.chunk_count = len(raw_chunks)
        doc.status = "ready"
        doc.progress = 100
        db.commit()
        _set_task(
            db,
            task_id,
            state="SUCCESS",
            progress=100,
            message=f"Indexing complete, {len(raw_chunks)} chunks total{note}",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Document indexing failed doc_id=%s", doc_id)
        db.rollback()
        try:
            doc = db.get(Document, doc_id)
            if doc:
                doc.status = "failed"
                doc.progress = 0
                db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        _set_task(db, task_id, state="FAILURE", message=str(e)[:500])
    finally:
        db.close()
