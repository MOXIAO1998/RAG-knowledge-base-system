"""Measure the citation hit rate (引用命中率) of the RAG pipeline.

Definition used here (document-level citation recall):
  For each test question — written to be answerable from ONE known source
  document — call /api/qa/stream, read the `citations` SSE event, and count a
  HIT when the expected document's title appears among the returned citations.
      citation hit rate = hits / total_questions

Run AFTER upload_docs.py reports indexing complete:
    python measure/measure_hit_rate.py --kb-id <ID>
  (omit --kb-id to search across all accessible knowledge bases)

Outputs a per-question table, writes results.csv, and prints the final
percentage to paste into the "[xx%]" placeholder.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time

import requests

BASE = os.environ.get("RAG_BASE", "http://127.0.0.1:8000")
USERNAME = os.environ.get("RAG_USER", "admin")
PASSWORD = os.environ.get("RAG_PASS", "admin123")
HERE = os.path.dirname(os.path.abspath(__file__))


def login() -> str:
    r = requests.post(f"{BASE}/api/auth/login", json={"username": USERNAME, "password": PASSWORD})
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 0:
        sys.exit(f"Login failed: {data.get('message')}")
    return data["data"]["token"]


def ask(token: str, query: str, kb_id: int | None) -> list[dict]:
    """POST the question, parse the SSE stream, return the citation list."""
    h = {"Authorization": f"Bearer {token}", "Accept": "text/event-stream"}
    body: dict = {"query": query}
    if kb_id:
        body["kbId"] = kb_id
    citations: list[dict] = []
    with requests.post(f"{BASE}/api/qa/stream", headers=h, json=body, stream=True, timeout=120) as r:
        r.raise_for_status()
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            try:
                evt = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if evt.get("type") == "citations":
                citations = evt.get("citations") or []
            elif evt.get("type") == "error":
                print(f"      [server error] {evt.get('message')}")
    return citations


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kb-id", type=int, default=None, help="restrict search to this KB (recommended)")
    ap.add_argument("--questions", default=os.path.join(HERE, "questions.json"))
    ap.add_argument("--sleep", type=float, default=1.2, help="seconds between questions (rate limit is 60/min)")
    args = ap.parse_args()

    with open(args.questions, encoding="utf-8") as f:
        cases = json.load(f)

    token = login()
    print(f"[+] Running {len(cases)} questions against {BASE} (kbId={args.kb_id})\n")

    rows = []
    hits = 0
    for i, c in enumerate(cases, 1):
        query, expected = c["query"], c["expected"]
        try:
            citations = ask(token, query, args.kb_id)
        except Exception as e:  # noqa: BLE001
            citations = []
            print(f"  {i:>2}. REQUEST FAILED: {e}")
        cited_titles = [c.get("title", "") for c in citations]
        hit = expected in cited_titles
        # rank of the expected doc among citations (1-based), 0 if absent
        rank = cited_titles.index(expected) + 1 if hit else 0
        hits += 1 if hit else 0
        mark = "HIT " if hit else "MISS"
        print(f"  {i:>2}. [{mark}] rank={rank} expected={expected}")
        if not hit:
            print(f"        got: {cited_titles}")
        rows.append({
            "query": query,
            "expected": expected,
            "hit": hit,
            "rank": rank,
            "cited_titles": " | ".join(cited_titles),
        })
        time.sleep(args.sleep)

    total = len(cases)
    rate = hits / total * 100 if total else 0.0
    out = os.path.join(HERE, "results.csv")
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["query", "expected", "hit", "rank", "cited_titles"])
        w.writeheader()
        w.writerows(rows)

    print("\n" + "=" * 56)
    print(f"  Citation hit rate = {hits}/{total} = {rate:.1f}%")
    print(f"  Detailed results written to {out}")
    print("=" * 56)
    print(f"\n  ->  Replace [xx%] with: {rate:.1f}%")


if __name__ == "__main__":
    main()
