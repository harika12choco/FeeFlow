# FeeFlow — Deployment & Setup Guide

FeeFlow is a coaching-institute fee-tracking system with a parent portal. It has two parts:

- **Backend** — Python / FastAPI / SQLAlchemy (SQLite by default, PostgreSQL-compatible). Runs on **port 8077**.
- **Frontend** — React + TypeScript + Vite. Runs on **port 5173** and proxies API calls to the backend.

This guide is written to be followed step by step, even if you have never run this project before.

> **Note:** All data is invented sample data for an assessment demo. This project runs **locally**; it has **not** been deployed to any hosting platform.

---

## 1. Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Python** | 3.12+ | Backend runtime |
| **Node.js** | 18+ (tested on 22) | Frontend build/dev server |
| **npm** | 9+ (tested on 10) | Frontend package manager |
| **uv** | optional | Faster Python env/installs; scripts fall back to `venv`/`pip` if absent |
| **git** | optional | Only needed to clone / push the repository |

Check what you have:

```bash
python3 --version
node --version
npm --version
```

PostgreSQL is **not required** for local development — the backend uses a SQLite file by default.

---

## 2. Repository structure (actual)

```
software-developer/
├── README.md
├── deployment.md                      # this file
├── Technical_Design_Document.pdf
├── Screenshots/                        # app screenshots (sample data)
├── backend/
│   ├── requirements.txt
│   ├── run.sh                          # one-command backend bootstrap
│   ├── pytest.ini
│   ├── .env.example                    # copy to .env to override config
│   └── app/
│       ├── main.py                     # FastAPI app + router wiring
│       ├── config.py                   # env-driven settings
│       ├── database.py                 # engine/session (SQLite ↔ Postgres)
│       ├── models.py                   # SQLAlchemy models (11 entities)
│       ├── schemas.py                  # Pydantic request/response models
│       ├── security.py                 # password hashing + JWT
│       ├── deps.py                     # auth + role-based access dependencies
│       ├── serializers.py              # ORM → JSON shaping
│       ├── seed.py                     # demo data (run to seed/reset)
│       ├── routers/                    # auth, students, parent, payments,
│       │                               #   reminders, refunds, risk, dashboard
│       └── services/                   # ledger, payments, reminders, refunds, risk
│   └── tests/                          # pytest suite (34 tests)
└── frontend/
    ├── package.json
    ├── vite.config.ts                  # dev proxy /api → backend
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.tsx  App.tsx           # entry + routing
        ├── context/                    # AuthContext
        ├── lib/                        # api client, react-query hooks, types, format
        ├── components/                 # UI primitives, layouts, dialogs, badges
        └── pages/
            ├── Login.tsx  Receipt.tsx
            ├── accounts/               # Dashboard, Students, StudentLedger,
            │                           #   Reminders, Refunds, RiskReview
            └── parent/                 # Portal, Payment
```

---

## 3. Exact local setup

You will use **two terminals**: one for the backend, one for the frontend.

### Quick start

```bash
# Terminal 1 — backend
cd backend
./run.sh

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

`run.sh` creates the virtual environment, installs dependencies, seeds the demo database on first run, and starts the API on port 8077 with auto-reload. The sections below show the manual equivalents.

---

## 4. Backend — setup & run

### Option A — one command (recommended)

```bash
cd backend
./run.sh
```

This script:
1. Creates `.venv` (via `uv` if available, else `python3 -m venv`).
2. Installs `requirements.txt`.
3. Seeds the database **only if `feeflow.db` does not exist yet**.
4. Starts the API at `http://127.0.0.1:8077` (interactive docs at `/docs`).

Change the port with an environment variable: `PORT=9000 ./run.sh`.

### Option B — manual steps

```bash
cd backend

# 1. Create and populate a virtual environment
uv venv .venv --python 3.12                 # or: python3 -m venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
#   (without uv:)  .venv/bin/pip install -r requirements.txt

# 2. Seed the demo database (creates/overwrites feeflow.db)
.venv/bin/python -m app.seed

# 3. Run the API
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8077 --reload
```

Verify the backend is up:

```bash
curl http://127.0.0.1:8077/health
# {"status":"ok","service":"feeflow"}
```

---

## 5. Frontend — setup & run

```bash
cd frontend
npm install        # first time only
npm run dev        # starts Vite on http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend at `http://127.0.0.1:8077` (configurable — see §7), so no CORS setup is needed in development.

Production build (outputs static files to `frontend/dist/`):

```bash
npm run build      # runs: tsc && vite build
npm run preview    # optional: preview the production build locally
```

> The production build expects `/api` to be reverse-proxied to the backend (see §12). For the demo, prefer `npm run dev`.

---

## 6. Database setup, migrations & seeding

- **Default store:** a local SQLite file at `backend/feeflow.db`. Tables are created automatically on backend startup (`Base.metadata.create_all`).
- **Migrations:** none required for local use (the schema is created on startup). For production schema evolution you would add Alembic (not currently included).
- **Seeding / reset:** the seed script drops and recreates all tables and loads fresh demo data:

```bash
cd backend
.venv/bin/python -m app.seed
```

Seeded data includes the required records (STU-0412 *Aarav Meena* — paid; STU-0587 *Ishita Sharma* — part-paid/overdue; STU-0219 *Mohit Gurjar* — upcoming) plus additional invented students across three centres and three programs. All are flagged `is_sample = true`.

**Using PostgreSQL instead of SQLite:** set `DATABASE_URL` (see §7) to a PostgreSQL URL before starting the backend or seeding, e.g. `postgresql+psycopg://user:pass@localhost:5432/feeflow`. You will also need the matching driver installed (e.g. `psycopg`).

---

## 7. Environment variables

### Backend (`backend/.env`)

Copy the template and edit it:

```bash
cd backend
cp .env.example .env
```

| Variable | Description | Example / safe placeholder |
|----------|-------------|----------------------------|
| `DATABASE_URL` | SQLAlchemy connection URL. SQLite file by default; use a PostgreSQL URL in production. | `sqlite:///./feeflow.db` or `postgresql+psycopg://user:pass@host:5432/feeflow` |
| `JWT_SECRET` | Secret used to sign JWTs. **Must be a strong random value in production.** | `<SET_YOUR_SECRET>` |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes. | `720` |
| `CORS_ORIGINS` | Comma-separated allowed origins for the browser. | `http://localhost:5173,http://127.0.0.1:5173` |
| `OPENAI_API_KEY` | *Optional.* Enables the LLM path for dropout-risk. If unset, FeeFlow uses the transparent rule-based engine. | `<SET_YOUR_OPENAI_API_KEY>` (leave unset to stay rule-based) |
| `OPENAI_BASE_URL` | *Optional.* OpenAI-compatible base URL. | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | *Optional.* Model name for the LLM path. | `gpt-4o-mini` |

> **Never commit real secrets.** `backend/.env` is git-ignored. If `.env` is absent, the backend falls back to the development defaults in `config.py` (including an **insecure** default `JWT_SECRET` that must be overridden before any real deployment).

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE` | Base path/URL the app calls for the API. | `/api` |
| `VITE_API_PROXY` | Where the Vite dev server forwards `/api` (dev only). | `http://127.0.0.1:8077` |

To point the frontend at a backend on another host/port in dev, set `VITE_API_PROXY` (e.g. `VITE_API_PROXY=http://127.0.0.1:9000 npm run dev`).

---

## 8. How to configure environment variables

Two equivalent ways:

**A. `.env` file (persistent):**
```bash
cd backend
cp .env.example .env
# edit .env, e.g. set JWT_SECRET to a strong random string:
#   JWT_SECRET=<SET_YOUR_SECRET>
```

**B. Inline for one run (temporary):**
```bash
cd backend
DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/feeflow" \
JWT_SECRET="<SET_YOUR_SECRET>" \
.venv/bin/python -m uvicorn app.main:app --port 8077
```

Generate a strong secret:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 9. Demo login details

Both demo accounts use the password shown below and access **fictional sample data only**.

| Role | Email | Password |
|------|-------|----------|
| **Accounts Executive** | `accounts@feeflow.app` | `Passw0rd!` |
| **Parent** (linked to Ishita Sharma, STU-0587) | `parent@feeflow.app` | `Passw0rd!` |

On the login screen you can click a demo-account card to auto-fill the email and password.

---

## 10. Accessing the application locally

1. Backend running (Terminal 1): `http://127.0.0.1:8077` — health at `/health`, interactive API docs at `/docs`.
2. Frontend running (Terminal 2): open **http://localhost:5173** in a browser.
3. Sign in with a demo account from §9.
   - Accounts Executive → lands on the dues dashboard.
   - Parent → lands on the parent portal.

---

## 11. Testing

Backend test suite (pytest + FastAPI TestClient, isolated throwaway database):

```bash
cd backend
.venv/bin/python -m pytest          # quiet
.venv/bin/python -m pytest -v       # verbose
```

Last executed result: **34 passed**. Coverage includes instalment calculations, partial/duplicate payments, reminder cancellation after payment, refund calculations, parent access restrictions, and AI rule-based fallback.

Frontend production build (also acts as a type-check):

```bash
cd frontend
npm run build
```

---

## 12. Deployment

> **Status: not deployed.** This project ships **no hosting-platform configuration** (no Dockerfile, Procfile, or CI pipeline) and has **not** been deployed or verified on any platform. The steps below are the standard, manual way to run it on a server. Do not advertise a live URL unless you have actually deployed and verified it.

A typical self-hosted production setup:

1. **Database** — provision PostgreSQL and set `DATABASE_URL` accordingly. Install the driver (e.g. `psycopg`) and seed or migrate.
2. **Backend** — install dependencies into a venv and run with a production server, e.g.:
   ```bash
   .venv/bin/pip install -r requirements.txt "uvicorn[standard]" gunicorn
   DATABASE_URL="postgresql+psycopg://..." JWT_SECRET="<SET_YOUR_SECRET>" \
   CORS_ORIGINS="https://your-domain" \
   .venv/bin/gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8077
   ```
3. **Frontend** — build static assets: `npm run build` → serve `frontend/dist/` from your web server / CDN.
4. **Reverse proxy** (e.g. Nginx) — serve the SPA and forward `/api` to the backend, for example:
   ```nginx
   server {
     listen 443 ssl;
     server_name your-domain;
     root /path/to/frontend/dist;
     location / { try_files $uri /index.html; }
     location /api/ { proxy_pass http://127.0.0.1:8077/; }
   }
   ```
   (With this layout the frontend's default `VITE_API_BASE=/api` works unchanged.)
5. **TLS & secrets** — terminate HTTPS at the proxy; inject `JWT_SECRET`, `DATABASE_URL`, and `CORS_ORIGINS` via the platform's secret manager, never in the repo.

---

## 13. Production configuration notes

- **Set a strong `JWT_SECRET`.** The default in `config.py` is an insecure development placeholder and must be overridden.
- **Use PostgreSQL**, not SQLite, for concurrent production traffic. Add Alembic if you need schema migrations over time.
- **Lock down CORS** to your real frontend origin via `CORS_ORIGINS`.
- **Payments and messaging are simulated/mocked** by design — integrate a real payment gateway and SMS/WhatsApp/email provider before production use.
- **Keep all secrets out of the repo** — `.env` and `*.db` are git-ignored; supply configuration through environment variables or a secret manager.
- **Money is stored as Float** (rounded in the service layer); for a hardened financial system, migrate to integer minor units or `Numeric`.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `curl /health` fails / `address already in use` on 8077 | Another process holds the port | Run on another port (`PORT=9000 ./run.sh`) and set `VITE_API_PROXY` to match, or stop the other process. |
| Frontend loads but API calls fail / network error | Backend not running, or proxy target wrong | Start the backend first; confirm `curl http://127.0.0.1:8077/health`; check `VITE_API_PROXY` in `frontend/.env`. |
| `401 Unauthorized` right after login, or stuck on login | Expired/invalid token | Sign in again; the app clears the token automatically on 401. |
| Login fails with "value is not a valid email address" | The address uses a reserved TLD (e.g. `.test`) | Use the provided demo emails (`@feeflow.app`) or a normal domain. |
| `ModuleNotFoundError` / packages missing | Dependencies not installed in the venv | Re-run `./run.sh`, or `uv pip install --python .venv/bin/python -r requirements.txt`. |
| Database looks empty or stale | Not seeded, or you want a clean slate | Run `.venv/bin/python -m app.seed` (this resets all data). |
| Risk flags all say "Rule-based" | No `OPENAI_API_KEY` configured | Expected — the rule-based engine is the default. Set `OPENAI_API_KEY` to enable the (optional) AI path. |
| `npm run dev` port 5173 busy | Another Vite instance | Stop it, or run `npm run dev -- --port 5174`. |
| Bundle-size warning on `npm run build` | Recharts is large | Informational only; the build still succeeds. |

---

### Quick reference

```bash
# Backend
cd backend && ./run.sh                      # http://127.0.0.1:8077  (docs: /docs)
.venv/bin/python -m app.seed                # reset demo data
.venv/bin/python -m pytest                  # run tests (34 passed)

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
npm run build                               # production build → dist/
```

Demo logins: `accounts@feeflow.app` / `Passw0rd!` · `parent@feeflow.app` / `Passw0rd!`
