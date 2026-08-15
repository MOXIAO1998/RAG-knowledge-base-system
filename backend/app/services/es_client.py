"""Elasticsearch client: index management + hybrid search (kNN vectors + BM25 + RRF fusion).

Uses a single index `{prefix}_chunks`, distinguishing knowledge bases via the kb_id field and
carrying document-level permission filtering in the permission_tags field. Hybrid search runs the
kNN and BM25 paths separately and fuses them with RRF (Reciprocal Rank Fusion) at the application
layer, avoiding dependence on a specific ES license level for stable availability.
"""
from __future__ import annotations

import logging

from elasticsearch import Elasticsearch, helpers

from app.config import settings
from app.services.embedding import DIM

logger = logging.getLogger("rag.es")

INDEX = f"{settings.es_index_prefix}_chunks"

_client: Elasticsearch | None = None


def get_client() -> Elasticsearch:
    global _client
    if _client is None:
        _client = Elasticsearch(
            settings.elasticsearch_url,
            basic_auth=(settings.elasticsearch_username, settings.elasticsearch_password),
            verify_certs=settings.es_verify_certs,
            request_timeout=15,
        )
    return _client


def is_available() -> bool:
    try:
        return bool(get_client().ping())
    except Exception as e:  # noqa: BLE001
        logger.warning("Elasticsearch unavailable: %s", e)
        return False


def ensure_index() -> None:
    """Ensure the index exists (idempotent)."""
    es = get_client()
    if es.indices.exists(index=INDEX):
        return
    es.indices.create(
        index=INDEX,
        mappings={
            "properties": {
                "chunk_id": {"type": "keyword"},
                "content": {"type": "text", "analyzer": "standard"},
                "embedding": {
                    "type": "dense_vector",
                    "dims": DIM,
                    "index": True,
                    "similarity": "cosine",
                },
                "kb_id": {"type": "keyword"},
                "doc_id": {"type": "keyword"},
                "chunk_index": {"type": "integer"},
                "title_path": {"type": "text"},
                "doc_title": {"type": "keyword"},
                "permission_tags": {"type": "keyword"},
                "source_page": {"type": "integer"},
            }
        },
    )
    logger.info("Created ES index %s", INDEX)


def index_chunks(chunks: list[dict]) -> int:
    """Bulk-write chunk documents. Each item in chunks contains the mapping fields plus embedding."""
    ensure_index()
    es = get_client()
    actions = [
        {"_index": INDEX, "_id": c["chunk_id"], "_source": c} for c in chunks
    ]
    ok_count, _ = helpers.bulk(es, actions, refresh=True)
    return ok_count


def delete_by_doc(doc_id: int) -> None:
    es = get_client()
    if not es.indices.exists(index=INDEX):
        return
    es.delete_by_query(
        index=INDEX,
        query={"term": {"doc_id": str(doc_id)}},
        refresh=True,
        conflicts="proceed",
    )


def delete_by_kb(kb_id: int) -> None:
    es = get_client()
    if not es.indices.exists(index=INDEX):
        return
    es.delete_by_query(
        index=INDEX,
        query={"term": {"kb_id": str(kb_id)}},
        refresh=True,
        conflicts="proceed",
    )


def _filters(kb_ids: list[int] | None, allowed_tags: list[str] | None) -> list[dict]:
    filters: list[dict] = []
    if kb_ids:
        filters.append({"terms": {"kb_id": [str(k) for k in kb_ids]}})
    if allowed_tags is not None:
        # Allow chunks with no tags or those matching the allowed tags
        filters.append(
            {
                "bool": {
                    "should": [
                        {"terms": {"permission_tags": allowed_tags}},
                        {"bool": {"must_not": {"exists": {"field": "permission_tags"}}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        )
    return filters


def _rrf_merge(bm25_ids: list[str], knn_ids: list[str], k: int = 60) -> list[str]:
    scores: dict[str, float] = {}
    for rank, cid in enumerate(bm25_ids):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
    for rank, cid in enumerate(knn_ids):
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda c: scores[c], reverse=True)


def hybrid_search(
    query: str,
    query_vector: list[float],
    kb_ids: list[int] | None = None,
    allowed_tags: list[str] | None = None,
    top_k: int = 6,
    top_n: int = 30,
) -> list[dict]:
    """Hybrid search: recall via both BM25 and kNN, fuse with RRF, then take Top-K. Returns a list of _source."""
    es = get_client()
    if not es.indices.exists(index=INDEX):
        return []
    filters = _filters(kb_ids, allowed_tags)

    # BM25 keyword search
    bm25 = es.search(
        index=INDEX,
        size=top_n,
        query={"bool": {"must": {"match": {"content": query}}, "filter": filters}},
        _source=True,
    )
    bm25_hits = {h["_id"]: h["_source"] for h in bm25["hits"]["hits"]}

    # kNN vector search
    knn = es.search(
        index=INDEX,
        size=top_n,
        knn={
            "field": "embedding",
            "query_vector": query_vector,
            "k": top_n,
            "num_candidates": max(top_n * 2, 50),
            "filter": {"bool": {"filter": filters}} if filters else None,
        },
        _source=True,
    )
    knn_hits = {h["_id"]: h["_source"] for h in knn["hits"]["hits"]}

    merged_ids = _rrf_merge(list(bm25_hits.keys()), list(knn_hits.keys()))
    pool = {**bm25_hits, **knn_hits}
    return [pool[cid] for cid in merged_ids[:top_k] if cid in pool]
