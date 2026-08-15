"""Local hash embedding: maps text into fixed-dimension dense vectors.

Requires no external service or model weights and runs fully locally; based on
character 1/2-gram feature hashing + TF weighting + L2 normalization, it provides
usable semantic similarity for short Chinese texts, satisfying the demo and
integration needs of Elasticsearch kNN vector retrieval. If a real Embedding
service is integrated later, simply replace the embed_text implementation while
keeping the index dimension consistent.
"""
from __future__ import annotations

import hashlib
import math
import re

from app.config import settings

DIM = settings.embedding_dim

_token_re = re.compile(r"[0-9a-zA-Z]+|[\u4e00-\u9fff]")


def _tokens(text: str) -> list[str]:
    text = (text or "").lower()
    base = _token_re.findall(text)
    grams = list(base)
    # Append Chinese/general 2-grams to enhance semantic discrimination
    for i in range(len(base) - 1):
        grams.append(base[i] + base[i + 1])
    return grams


def _bucket(token: str) -> int:
    h = hashlib.md5(token.encode("utf-8")).hexdigest()
    return int(h, 16) % DIM


def embed_text(text: str) -> list[float]:
    """Return a DIM-dimensional vector after L2 normalization."""
    vec = [0.0] * DIM
    for tok in _tokens(text):
        vec[_bucket(tok)] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
