#!/usr/bin/env bash
# One-shot citation-hit-rate measurement:
#   1) reset admin password to admin123
#   2) upload + index the 34 example documents
#   3) run the measurement and print XX.X%
#
# Usage:  bash measure/run_all.sh
# The backend (port 8000), MySQL, Redis and Elasticsearch must already be running.

set -euo pipefail

# --- configurable paths (override via env if needed) -----------------------
PY="${RAG_PY:-/opt/anaconda3/envs/RAG/bin/python3}"
MYSQL_BIN="${RAG_MYSQL:-/usr/local/mysql-9.7.2-macos15-arm64/bin/mysql}"
MYSQL_USER="${RAG_MYSQL_USER:-root}"
MYSQL_PASS="${RAG_MYSQL_PASS:-123456}"
MYSQL_DB="${RAG_MYSQL_DB:-rag_kb}"
BASE="${RAG_BASE:-http://127.0.0.1:8000}"
export RAG_BASE

# resolve project root (parent of this script's dir) and cd into it
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
cd "$ROOT"

echo "==> 0. Health check"
if ! curl -sf "$BASE/api/health" | grep -q '"elasticsearch":true'; then
  echo "ERROR: backend not healthy or Elasticsearch down. Check: curl $BASE/api/health" >&2
  exit 1
fi
curl -s "$BASE/api/health"; echo

echo
echo "==> 1. Reset admin password to admin123"
HASH="$("$PY" -c "import bcrypt;print(bcrypt.hashpw(b'admin123',bcrypt.gensalt()).decode())")"
"$MYSQL_BIN" -h127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" \
  -e "UPDATE user SET password_hash='$HASH' WHERE username='admin';"
echo "    admin password set."

echo
echo "==> 2. Upload + index the 34 example documents"
UPLOAD_LOG="$(mktemp)"
"$PY" measure/upload_docs.py | tee "$UPLOAD_LOG"
KB_ID="$(grep -Eo -- '--kb-id [0-9]+' "$UPLOAD_LOG" | tail -1 | awk '{print $2}')"
rm -f "$UPLOAD_LOG"
if [ -z "${KB_ID:-}" ]; then
  echo "ERROR: could not determine KB id from upload output." >&2
  exit 1
fi
echo "    using KB id = $KB_ID"

echo
echo "==> 3. Measure citation hit rate"
"$PY" measure/measure_hit_rate.py --kb-id "$KB_ID"
