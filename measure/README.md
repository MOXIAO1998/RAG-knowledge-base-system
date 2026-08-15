# Citation Hit Rate — Measurement Runbook

Goal: To answer the following
> Built-in 34 multi-format sample documents across 7 major categories for end-to-end validation; hybrid retrieval combined with self-correction mechanism achieves a question-answering citation hit rate of **[xx%]**


**Metric definition (document-level citation recall):** each test question is
written to be answerable from exactly one known source document. We call the Q&A
API, read the `citations` it returns, and count a **HIT** when the expected
document's title appears in the citation list. `hit rate = hits / 34`.

> Why not the built-in Evaluation Center? `backend/app/routers/eval.py` returns
> **random** RAGAS-style scores (it says so in its own docstring) — it is a UI
> demo, not a real measurement. The scripts here exercise the actual retrieval +
> self-correction graph, so the number is real.

---

## 0. Prerequisites (must be running)

The pipeline needs **MySQL, Redis, Elasticsearch**, and the **DeepSeek** key
(already set in `backend/.env`). Elasticsearch is what actually stores/searches
the vectors — if it is down, every question misses.

Bring up infra however you like (Docker example):

```bash
# MySQL 8
docker run -d --name rag-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=rag_kb mysql:8

# Redis 7
docker run -d --name rag-redis -p 6379:6379 redis:7

# Elasticsearch 8 (single node, security off to match http:// + no certs)
docker run -d --name rag-es -p 9200:9200 \
  -e discovery.type=single-node -e xpack.security.enabled=false \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.4
```

> The credentials in `backend/.env` are `root:123456` (MySQL) and
> `elastic/changeme` (ES). If you disable ES security as above, the username/
> password are ignored — that's fine. Otherwise make them match `.env`.

## 1. Initialize the database

```bash
mysql -h127.0.0.1 -uroot -p123456 rag_kb < "backend/sql/rag_kb.sql"
```

## 2. Set a known admin password

All seeded users share one bcrypt hash whose plaintext we don't know. Set it to
`admin123` (matches the scripts' defaults):

```bash
cd backend
python -c "import bcrypt; print(bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode())"
# copy the printed hash into:
mysql -h127.0.0.1 -uroot -p123456 rag_kb \
  -e "UPDATE user SET password_hash='<PASTE_HASH>' WHERE username='admin';"
```

(Or set `RAG_USER` / `RAG_PASS` env vars before running the scripts if you
already know a working login.)

## 3. Start the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install requests            # only needed by the measure scripts
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verify the stack is healthy — **all three must be true**:

```bash
curl -s http://127.0.0.1:8000/api/health
# {"code":0,"data":{"elasticsearch":true,"redis":true,"llm":true}}
```

If `elasticsearch:false`, fix ES before continuing or the hit rate will be 0.

## 4. Upload & index the 34 example documents

From the project root (`rag/`), with the backend running:

```bash
python measure/upload_docs.py
```

It creates a KB, uploads all 34 files from `示例文档/`, and waits until every
document reaches `ready`. Note the printed `--kb-id <ID>`.

## 5. Run the measurement

```bash
python measure/measure_hit_rate.py --kb-id <ID>
```

It prints a per-question HIT/MISS table, writes `measure/results.csv`, and ends
with:

```
  Citation hit rate = NN/34 = XX.X%
  ->  Replace [xx%] with: XX.X%
```

## 6. Fill in the number

Put that `XX.X%` into the `[xx%]` placeholder in your description. Keep
`measure/results.csv` as evidence.

---

### Tuning / notes
- **Rate limit** is 60 req/min per user; the script sleeps 1.2s between calls.
  Raise `--sleep` if you hit HTTP 429.
- **Semantic cache** (Redis) caches by question; since every test question is
  distinct this doesn't affect a single run. `FLUSHALL` Redis between runs if you
  want a fully cold measurement.
- Want a stricter metric? The script also records `rank` (position of the
  expected doc among citations). You can redefine a hit as `rank == 1` (top-1)
  by filtering `results.csv`.
- Want more questions per document? Add entries to `questions.json` (same
  `{"expected","query"}` shape) — `expected` must equal the uploaded filename.
```
