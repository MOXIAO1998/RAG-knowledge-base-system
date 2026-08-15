# Enterprise RAG Knowledge Base System — Deployment & Startup Guide

> This guide works on **Windows / macOS / Linux**. Follow the steps in order to get the system running from scratch.
> Commands are given in both PowerShell (Windows) and Bash (macOS/Linux); pick the one for your OS.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Install the Base Software](#2-install-the-base-software)
3. [Get the Project Code](#3-get-the-project-code)
4. [Initialize the MySQL Database](#4-initialize-the-mysql-database)
5. [Start the Middleware (Redis / Elasticsearch)](#5-start-the-middleware-redis--elasticsearch)
6. [Configure and Start the Backend](#6-configure-and-start-the-backend)
7. [Start the Frontend](#7-start-the-frontend)
8. [Verify and Try It Out](#8-verify-and-try-it-out)
9. [(Optional) Connect an LLM](#9-optional-connect-an-llm)
10. [Troubleshooting (FAQ)](#10-troubleshooting-faq)
11. [(Optional) Production Deployment Tips](#11-optional-production-deployment-tips)

---

## 1. Requirements

| Software | Version | Purpose | Required |
| --- | --- | --- | --- |
| Python | 3.10 or later | Backend runtime | ✅ Required |
| Node.js | 20 or later | Frontend build & dev server | ✅ Required |
| MySQL | 8.x | Business database | ✅ Required |
| Elasticsearch | 8.x | Full-text + vector search engine | ✅ Required (Q&A retrieval is unavailable without it, but the app still starts) |
| Redis | 5.0+ (any stable release) | Semantic cache / dashboard metrics | ⭕ Recommended (skipped automatically if missing; does not affect the main flow) |
| DeepSeek API Key | — | LLM-powered Q&A | ⭕ Optional (falls back to retrieval-summary answers if not configured) |

> 💡 This system **does not require downloading any AI model weights**. Vectorization uses a built-in local hash embedding, so it runs fully offline.

Default ports (change the config if any are already in use):

| Service | Default Port |
| --- | --- |
| MySQL | 3306 |
| Redis | 6379 |
| Elasticsearch | 9200 |
| Backend (FastAPI) | 8000 |
| Frontend (Vite) | 5173 |

---

## 2. Install the Base Software

### 2.1 Python 3.10+

- **Windows**: Download the installer from [python.org/downloads](https://www.python.org/downloads/); be sure to check **"Add Python to PATH"** during installation.
- **macOS**: `brew install python@3.12`
- **Linux (Ubuntu/Debian)**: `sudo apt install python3 python3-venv python3-pip`

Verify:

```bash
python --version    # Windows
python3 --version   # macOS / Linux
```

### 2.2 Node.js 20+

- **Windows / macOS**: Download the LTS installer from [nodejs.org](https://nodejs.org/).
- **Linux**: Install with [nvm](https://github.com/nvm-sh/nvm) (recommended): `nvm install 20`

Verify:

```bash
node -v    # should print v20.x or higher
npm -v
```

### 2.3 MySQL 8.x

- **Windows**: Use the graphical [MySQL Installer](https://dev.mysql.com/downloads/installer/); remember the root password.
- **macOS**: `brew install mysql && brew services start mysql`
- **Linux**: `sudo apt install mysql-server && sudo systemctl start mysql`

Verify:

```bash
mysql --version
```

### 2.4 Redis

- **Windows**: There is no official Windows build; choose one of:
  - Option A: Download the community-maintained [Redis for Windows](https://github.com/tporadowski/redis/releases) (extract and run `redis-server.exe`).
  - Option B: Use Docker (see 2.6).
- **macOS**: `brew install redis && brew services start redis`
- **Linux**: `sudo apt install redis-server && sudo systemctl start redis`

Verify:

```bash
redis-cli ping    # returns PONG if healthy
```

### 2.5 Elasticsearch 8.x

Download the archive for your platform from [elastic.co/downloads/elasticsearch](https://www.elastic.co/downloads/elasticsearch) and extract it (no installation needed).

**⚠️ Important: to simplify local deployment, it is recommended to disable ES security.** Edit `config/elasticsearch.yml` in the extracted directory and add at the end of the file:

```yaml
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false
```

Start:

```powershell
# Windows (PowerShell, from the extracted directory)
.\bin\elasticsearch.bat
```

```bash
# macOS / Linux (from the extracted directory)
./bin/elasticsearch
```

Verify (in a separate terminal):

```bash
curl http://127.0.0.1:9200
# healthy if it returns JSON containing "cluster_name"
```

> 💡 If you keep security enabled, note the `elastic` user's password and later fill it into the backend `.env` under `ELASTICSEARCH_USERNAME / ELASTICSEARCH_PASSWORD`, change `ELASTICSEARCH_URL` to `https://...`, and set `ES_VERIFY_CERTS=false`.

### 2.6 (Alternative) Start All Three with Docker

If you have Docker installed, you can skip 2.3–2.5 and run:

```bash
docker run -d --name rag-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8 --character-set-server=utf8mb4
docker run -d --name rag-redis -p 6379:6379 redis:7
docker run -d --name rag-es -p 9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false -e ES_JAVA_OPTS="-Xms512m -Xmx512m" docker.elastic.co/elasticsearch/elasticsearch:8.17.0
```

---

## 3. Get the Project Code

Place the project folder anywhere (**a path without Chinese characters or spaces is recommended** to avoid compatibility issues with some toolchains; this guide refers to it as `<PROJECT_ROOT>`).

Confirm the project structure:

```
<PROJECT_ROOT>/
├── backend/          # Backend
│   ├── app/
│   ├── sql/          # schema.sql (create tables) + seed.sql (seed data)
│   ├── .env.example  # Config template
│   └── requirements.txt
├── frontend/         # Frontend
└── 示例文档/          # 34 sample documents you can upload to try it out
```

---

## 4. Initialize the MySQL Database

> The commands are the same on all platforms. After `-p`, press Enter and you'll be prompted for the root password.

```bash
# 1) Create the database (utf8mb4 encoding, full Chinese support)
mysql -u root -p --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS rag_kb DEFAULT CHARACTER SET utf8mb4"

# 2) Create the tables (run from <PROJECT_ROOT>)
mysql -u root -p --default-character-set=utf8mb4 rag_kb < backend/sql/rag_kb.sql
```

> On Windows PowerShell, if the `<` redirection errors out, use:
>
> ```powershell
> Get-Content backend/sql/rag_kb.sql -Raw | mysql -u root -p --default-character-set=utf8mb4 rag_kb
> ```

Verify:

```bash
mysql -u root -p --default-character-set=utf8mb4 rag_kb -e "SHOW TABLES;"
# You should see 14 tables: user / role / knowledge_base / document / chunk / conversation ...
```

---

## 5. Start the Middleware (Redis / Elasticsearch)

> ⚠️ **Startup order matters: Elasticsearch must start before the backend**, otherwise index initialization is skipped at backend startup (it can retry automatically later, but for the first run, starting in order is recommended).

Recommended order:

```
① MySQL (usually already running as a system service)
② Redis
③ Elasticsearch (wait ~30 seconds until fully ready)
④ Backend
⑤ Frontend
```

Confirm all three middleware services are ready:

```bash
redis-cli ping                # PONG
curl http://127.0.0.1:9200    # returns cluster info JSON
mysql -u root -p --default-character-set=utf8mb4 -e "SELECT 1"
```

---

## 6. Configure and Start the Backend

### 6.1 Create the Config File

```powershell
# Windows PowerShell
cd <PROJECT_ROOT>\backend
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cd <PROJECT_ROOT>/backend
cp .env.example .env
```

Open `.env` in any editor and **change the following to match your machine** (leave the rest at their defaults):

```ini
# MySQL: change root:root to your username:password
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@127.0.0.1:3306/rag_kb?charset=utf8mb4

# Elasticsearch: if you disabled security per 2.5, the defaults below are fine
ELASTICSEARCH_URL=http://127.0.0.1:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Redis: no change needed for a local default install
REDIS_URL=redis://127.0.0.1:6379/0

# LLM: can be left empty (auto fallback); see Section 9 for setup
LLM_API_KEY=
```

### 6.2 Create a Virtual Environment and Install Dependencies

```powershell
# Windows PowerShell (in the backend directory)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> If PowerShell reports "running scripts is disabled", first run:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then re-activate the virtual environment.

```bash
# macOS / Linux (in the backend directory)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> On slow networks, you can use a mirror:
> `pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`

### 6.3 Start the Backend

```bash
# Same command on both platforms (make sure the venv is active and you're in the backend directory)
python -m uvicorn app.main:app --reload --port 8000
```

Startup succeeded when you see output like:

```
INFO:  Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:  Application startup complete.
```

Health check (in a separate terminal or your browser):

```
http://127.0.0.1:8000/api/health
```

The returned JSON reports the availability of the three dependencies `es / redis / llm`; all `true` means the environment is fully set up.

> API docs (auto-generated by FastAPI): `http://127.0.0.1:8000/docs`

---

## 7. Start the Frontend

**Open a new terminal** (keep the backend terminal running):

```powershell
# Windows PowerShell
cd <PROJECT_ROOT>\frontend
npm install
npm run dev
```

```bash
# macOS / Linux
cd <PROJECT_ROOT>/frontend
npm install
npm run dev
```

> If `npm install` is slow, switch to a mirror: `npm install --registry=https://registry.npmmirror.com`

Success when you see:

```
VITE v5.x  ready in xxx ms
➜  Local:   http://127.0.0.1:5173/
```

Open **http://127.0.0.1:5173** in your browser to enter the system.

---

## 8. Verify and Try It Out

### 8.1 Default Accounts

The seed data includes the following demo accounts (change the passwords promptly after logging in):

| Username | Password | Role |
| --- | --- | --- |
| admin | admin123 | System Administrator (all features) |
| zhangsan | 123456 | Knowledge Base Administrator |
| lisi | 123456 | Regular User |
| wangwu | 123456 | Knowledge Base Administrator |

### 8.2 End-to-End Self-Test (about 3 minutes)

1. Log in as `admin / admin123` and open the **Dashboard** to confirm the page loads normally.
2. Go to **Document Management**, select the knowledge base "考勤与假期制度" (Attendance & Leave Policy), and upload `示例文档/01-考勤与假期制度/考勤管理制度.md`.
3. Watch the document status change from `indexing` to `ready` (you can track indexing progress in the **Task Center**).
4. Go to **Intelligent Q&A** and ask: "迟到多久算旷工？" (How long being late counts as absenteeism?)
5. Confirm that the page shows "Routing → Retrieving → Generating" in sequence, streams the answer, and attaches citation sources.
6. Go to **Conversation History** and confirm the conversation was saved under your account.

If all steps pass, the deployment is successful ✅.

---

## 9. (Optional) Connect an LLM

The system runs without an LLM (it falls back to "retrieval-summary answers"); once configured, you get the full intelligent pipeline (automatic KB routing, query decomposition, hallucination check, natural-language answers).

1. Register at the [DeepSeek Open Platform](https://platform.deepseek.com/) and create an API Key.
2. Edit `backend/.env`:

   ```ini
   LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
   LLM_BASE_URL=https://api.deepseek.com
   LLM_MODEL=deepseek-v4-pro
   LLM_ENABLED=true
   ```

3. Restart the backend and check `/api/health` for `llm: true`.

> Any OpenAI-compatible service (e.g. a local Ollama model, a Tongyi Qianwen-compatible endpoint, etc.) can be connected by changing `LLM_BASE_URL` and `LLM_MODEL`.

---

## 10. Troubleshooting (FAQ)

### Q1: The backend log says ES index initialization failed / Q&A retrieves nothing

**Cause**: Elasticsearch is not running, or started after the backend.
**Fix**: Start ES first and wait until it's fully ready (`curl http://127.0.0.1:9200` returns a response), then start the backend. If the backend is already running, restart it or upload a document to trigger an automatic index rebuild.

### Q2: `ModuleNotFoundError: No module named 'pypdf'` (or another package)

**Cause**: Dependencies were installed into the system Python while you're running from the virtual environment (or vice versa) — the two environments are out of sync.
**Fix**: Make sure the terminal prompt shows the `(.venv)` prefix before running `pip install -r requirements.txt` and the startup command; or use `pip -V` to check which environment pip belongs to.

### Q3: On Windows, Python in the venv reports `ImportError: DLL load failed while importing _socket`

**Cause**: The Windows environment has a leftover `PYTHONHOME/PYTHONPATH` pointing to another Python installation, or the registry Python path doesn't match reality, causing the venv to load the wrong DLL.
**Fix**: Check whether `PYTHONHOME` or `PYTHONPATH` exist in the system environment variables; delete them if present and reopen the terminal. If that doesn't help, delete the `.venv` directory and recreate it using the full path to the target Python (e.g. `D:\Python312\python.exe -m venv .venv`).

### Q4: Garbled Chinese in MySQL / emoji fail to write

**Cause**: The connection or database isn't using utf8mb4.
**Fix**: Ensure `DATABASE_URL` ends with `?charset=utf8mb4`; always pass `--default-character-set=utf8mb4` when using the command line; and confirm the CREATE DATABASE statement includes `DEFAULT CHARACTER SET utf8mb4`.

### Q5: The frontend loads but all requests fail / CORS errors

**Check, in order**:
1. Is the backend running on port 8000 (visit `http://127.0.0.1:8000/api/health`)?
2. Are you using `http://127.0.0.1:5173` or `http://localhost:5173` to access the frontend? Other addresses (e.g. a LAN IP) must be added to `CORS_ORIGINS` in `.env`.
3. If the browser console shows 401, log out and log back in (the token expired).

### Q6: Port already in use (8000 / 5173 / 9200, etc.)

```powershell
# Windows: find the process using the port
netstat -ano | findstr :8000
```

```bash
# macOS / Linux
lsof -i :8000
```

Kill the occupying process, or start on a different port: backend `--port 8001` (also update the proxy target in the frontend `vite.config.ts`), frontend `npm run dev -- --port 5174` (also add the new address to `CORS_ORIGINS`).

### Q7: Elasticsearch exits right after starting / out of memory

**Fix**: Edit `config/jvm.options` in the ES directory and add two lines to cap heap memory:

```
-Xms512m
-Xmx512m
```

On Linux, if you see `max virtual memory areas vm.max_map_count [65530] is too low`:

```bash
sudo sysctl -w vm.max_map_count=262144
```

### Q8: A document stays in `indexing` or turns to `failed` after upload

**Check**: Open the **Task Center** to view the task's error message; common causes are ES being unavailable (see Q1) or the file itself failing to parse. After fixing the environment, click **Retry** in the Task Center, or use **Reindex** in the document list.

### Q9: `pip install` or `npm install` is very slow / times out

Use a domestic mirror:

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
npm install --registry=https://registry.npmmirror.com
```

---

## 11. (Optional) Production Deployment Tips

Development mode (`--reload` + the Vite dev server) is only suitable for local use. For serving externally, we recommend:

### 11.1 Build the Frontend + Serve with Nginx

```bash
cd frontend
npm run build        # output goes to frontend/dist
```

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static assets
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;   # support frontend-router refresh
    }

    # Reverse proxy for the backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Required for SSE streaming: disable buffering
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

> ⚠️ The `/api/` location block must disable `proxy_buffering`, otherwise SSE streaming Q&A will be buffered by Nginx into a single burst of output.

### 11.2 Backend Process Management

```bash
# Start with multiple workers (drop --reload)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

- Linux: write a systemd service unit for auto-start on boot and automatic restart on crash.
- Windows: use NSSM to register it as a Windows service.

### 11.3 Security Hardening Checklist

- [ ] Change `APP_SECRET_KEY` in `.env` to a long random string.
- [ ] Change all default account passwords (admin/admin123, etc.).
- [ ] Restrict `CORS_ORIGINS` to your actual frontend domain.
- [ ] Do not expose MySQL / Redis / ES ports to the public internet; allow access only from the backend host.
- [ ] Enable authentication and TLS for ES in production, and update the ES settings in `.env` accordingly.
- [ ] Back up MySQL regularly (the ES index can be rebuilt from the MySQL `chunk` table at any time, so it needs no separate backup).

---

## Appendix: Quick-Start Cheat Sheet

Once the environment is set up, daily startup is just 4 steps (run in order):

| Step | Windows PowerShell | macOS / Linux |
| --- | --- | --- |
| 1. Start Redis | `redis-server.exe` | `brew services start redis` / `systemctl start redis` |
| 2. Start ES (wait 30s) | `ES_DIR\bin\elasticsearch.bat` | `ES_DIR/bin/elasticsearch` |
| 3. Start backend | `cd backend; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload --port 8000` | `cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000` |
| 4. Start frontend | `cd frontend; npm run dev` | `cd frontend && npm run dev` |

Open `http://127.0.0.1:5173`, log in with `admin / admin123`.
