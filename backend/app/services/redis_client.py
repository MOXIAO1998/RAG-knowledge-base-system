"""Redis client: semantic cache, API rate limiting, and Q&A metrics.

All features degrade silently when Redis is unavailable (without blocking the main flow).
"""
from __future__ import annotations

import json
import logging
import time
from datetime import date

import redis

from app.config import settings
from app.services.embedding import cosine

logger = logging.getLogger("rag.redis")

_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    global _client
    if _client is None:
        try:
            _client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            _client.ping()
        except Exception as e:  # noqa: BLE001
            logger.warning("Redis unavailable: %s", e)
            _client = None
    return _client


def is_available() -> bool:
    r = get_redis()
    if not r:
        return False
    try:
        return bool(r.ping())
    except Exception:  # noqa: BLE001
        return False


# ---------------- Q&A metrics (used by the Dashboard) ----------------
def _today_key(suffix: str) -> str:
    return f"rag:metrics:{date.today().isoformat()}:{suffix}"


def incr_qa() -> None:
    r = get_redis()
    if not r:
        return
    try:
        k = _today_key("qa")
        r.incr(k)
        r.expire(k, 3 * 24 * 3600)
    except Exception:  # noqa: BLE001
        pass


def incr_cache(hit: bool) -> None:
    r = get_redis()
    if not r:
        return
    try:
        k = _today_key("cache_hit" if hit else "cache_miss")
        r.incr(k)
        r.expire(k, 3 * 24 * 3600)
    except Exception:  # noqa: BLE001
        pass


def get_qa_metrics() -> dict:
    r = get_redis()
    today_qas, hit, miss = 0, 0, 0
    if r:
        try:
            today_qas = int(r.get(_today_key("qa")) or 0)
            hit = int(r.get(_today_key("cache_hit")) or 0)
            miss = int(r.get(_today_key("cache_miss")) or 0)
        except Exception:  # noqa: BLE001
            pass
    total = hit + miss
    rate = (hit / total) if total else 0.0
    return {"todayQAs": today_qas, "cacheHitRate": round(rate, 3)}


# ---------------- semantic cache ----------------
def _cache_key(scope: str) -> str:
    return f"rag:semcache:{scope}"


def semantic_cache_get(scope: str, vector: list[float], threshold: float = 0.95):
    """Hit the cache by query-vector similarity, returning the cached answer and citations; return None on a miss."""
    r = get_redis()
    if not r:
        return None
    try:
        entries = r.lrange(_cache_key(scope), 0, 49)
        for raw in entries:
            item = json.loads(raw)
            if cosine(vector, item["vector"]) >= threshold:
                return {"answer": item["answer"], "citations": item.get("citations", [])}
    except Exception:  # noqa: BLE001
        return None
    return None


def semantic_cache_set(scope: str, vector: list[float], answer: str, citations: list, ttl: int = 3600):
    r = get_redis()
    if not r:
        return
    try:
        key = _cache_key(scope)
        r.lpush(key, json.dumps({"vector": vector, "answer": answer, "citations": citations}))
        r.ltrim(key, 0, 49)
        r.expire(key, ttl)
    except Exception:  # noqa: BLE001
        pass


def invalidate_cache(scope_prefix: str) -> None:
    r = get_redis()
    if not r:
        return
    try:
        for k in r.scan_iter(f"rag:semcache:{scope_prefix}*"):
            r.delete(k)
    except Exception:  # noqa: BLE001
        pass


# ---------------- rate limiting (sliding window) ----------------
def rate_limit_ok(bucket: str, limit: int, window: int = 60) -> bool:
    """Return True when the limit has not been exceeded. Allow by default when Redis is unavailable."""
    r = get_redis()
    if not r:
        return True
    try:
        key = f"rag:rl:{bucket}:{int(time.time() // window)}"
        cnt = r.incr(key)
        if cnt == 1:
            r.expire(key, window)
        return cnt <= limit
    except Exception:  # noqa: BLE001
        return True
