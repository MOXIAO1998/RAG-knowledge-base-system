"""Batch-upload the 34 example documents into a single knowledge base, then wait
until every document finishes indexing.

Run this AFTER the backend is up and /api/health shows elasticsearch=true.

    python measure/upload_docs.py

It prints the knowledge-base id it created (or reused) — pass that id to
measure_hit_rate.py via --kb-id, or let that script auto-detect the newest KB.
"""
from __future__ import annotations

import os
import sys
import time

import requests

BASE = os.environ.get("RAG_BASE", "http://127.0.0.1:8000")
USERNAME = os.environ.get("RAG_USER", "admin")
PASSWORD = os.environ.get("RAG_PASS", "admin123")

# 示例文档 lives one level up from this measure/ folder
DOCS_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "示例文档")
KB_NAME = "示例文档评测库"


def login() -> str:
    r = requests.post(f"{BASE}/api/auth/login", json={"username": USERNAME, "password": PASSWORD})
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 0:
        sys.exit(f"Login failed: {data.get('message')}")
    return data["data"]["token"]


def create_kb(token: str) -> int:
    h = {"Authorization": f"Bearer {token}"}
    r = requests.post(
        f"{BASE}/api/kb",
        headers=h,
        json={"name": KB_NAME, "description": "内置示例文档，用于引用命中率实测", "visibility": "private"},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 0:
        sys.exit(f"Create KB failed: {data.get('message')}")
    kb_id = data["data"]["id"]
    print(f"[+] Created knowledge base id={kb_id} name={KB_NAME}")
    return kb_id


def collect_files() -> list[str]:
    files = []
    for root, _dirs, names in os.walk(DOCS_ROOT):
        for n in names:
            if n.startswith(".") or n == ".DS_Store":
                continue
            files.append(os.path.join(root, n))
    files.sort()
    return files


def upload(token: str, kb_id: int, path: str) -> None:
    h = {"Authorization": f"Bearer {token}"}
    fname = os.path.basename(path)
    with open(path, "rb") as f:
        r = requests.post(
            f"{BASE}/api/kb/{kb_id}/documents",
            headers=h,
            files={"file": (fname, f)},
            data={"permissionTags": ""},
        )
    ok = r.status_code == 200 and r.json().get("code") == 0
    print(f"    {'OK ' if ok else 'ERR'} {fname}" + ("" if ok else f"  -> {r.text[:160]}"))


def wait_indexed(token: str, kb_id: int, timeout: int = 900) -> None:
    h = {"Authorization": f"Bearer {token}"}
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{BASE}/api/documents", headers=h, params={"kbId": kb_id})
        docs = r.json().get("data", [])
        pending = [d for d in docs if d["status"] == "indexing"]
        failed = [d for d in docs if d["status"] == "failed"]
        ready = [d for d in docs if d["status"] == "ready"]
        print(f"    indexing… ready={len(ready)} pending={len(pending)} failed={len(failed)}")
        if not pending:
            if failed:
                print(f"[!] {len(failed)} document(s) failed to index: {[d['title'] for d in failed]}")
            print(f"[+] Indexing complete: {len(ready)}/{len(docs)} ready")
            return
        time.sleep(5)
    print("[!] Timed out waiting for indexing to finish")


def main() -> None:
    if not os.path.isdir(DOCS_ROOT):
        sys.exit(f"示例文档 folder not found at {DOCS_ROOT}")
    token = login()
    kb_id = create_kb(token)
    files = collect_files()
    print(f"[+] Uploading {len(files)} files…")
    for p in files:
        upload(token, kb_id, p)
    print("[+] All uploads submitted; waiting for indexing…")
    wait_indexed(token, kb_id)
    print(f"\nDONE. Use this KB id for measurement:  --kb-id {kb_id}")


if __name__ == "__main__":
    main()
