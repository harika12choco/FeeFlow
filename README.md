# FeeFlow — Coaching-institute fee tracking & parent portal

A polished MVP for a coaching institute to track fees, collect payments, send
reminders, calculate refunds, and surface dropout risk — with a dedicated,
mobile-first portal for parents.

> **All data in this app is invented sample data for an assessment demo.** It is
> clearly labelled as such throughout the UI.

---

## What's inside

| Requirement | Where it lives |
|---|---|
| Fee ledger (plan, instalments, discounts, payments, balances, overdue) | `backend/app/services/ledger.py`, Accounts → **Student ledger** |
| Parent portal (dues, next due, history, receipts, attendance, scores) | Parent → **Portal** |
| Payment link + simulated pay → confirm → receipt flow | `payments.py`, `PaymentDialog.tsx`, Parent → **Pay now** |
| Reminders (before/on/after due, EN + HI, stop on payment, history) | `services/reminders.py`, Accounts → **Reminders** |
| Pro-rata refund calculator (configurable, deterministic, labelled assumptions) | `services/refunds.py`, Accounts → **Refund calculator** |
| AI dropout-risk flag (AI with transparent rule-based fallback) | `services/risk.py`, Accounts → **Dropout-risk review** |
| Dues dashboard (totals, collection rate, dues by centre/batch, ageing, risk) | `routers/dashboard.py`, Accounts → **Dashboard** |
| Auth: JWT, password hashing, RBAC, parent-restricted access | `security.py`, `deps.py` |
| Tests (instalments, partial/duplicate payments, reminder cancel, refunds, access, AI fallback) | `backend/tests/` |

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy 2.0, SQLite (PostgreSQL-compatible via `DATABASE_URL`), PyJWT, passlib.
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, lucide-react, React Router, TanStack Query.

PostgreSQL client wasn't available in the build environment, so **SQLite is used
as the documented local fallback**. The data layer is standard SQLAlchemy — point
`DATABASE_URL` at a Postgres instance (e.g. `postgresql+psycopg://…`) and it runs
unchanged.

---

## Prerequisites

- Python 3.12+  (and optionally [`uv`](https://docs.astral.sh/uv/) — the scripts use it if present, else fall back to `venv`/`pip`)
- Node.js 18+ and npm

## Run it (two terminals)

### 1) Backend (API on http://127.0.0.1:8077)

```bash
cd backend
./run.sh
```

`run.sh` creates the virtualenv, installs dependencies, seeds the demo database on
first run, and starts the API with auto-reload. Interactive API docs: http://127.0.0.1:8077/docs

<details>
<summary>Manual steps (if you prefer)</summary>

```bash
cd backend
uv venv .venv --python 3.12           # or: python3 -m venv .venv
uv pip install --python .venv/bin/python -r requirements.txt   # or: .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed          # seed demo data (resets the DB)
.venv/bin/python -m uvicorn app.main:app --port 8077 --reload
```
</details>

### 2) Frontend (app on http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the backend at `127.0.0.1:8077`
(configurable via `VITE_API_PROXY`), so there are no CORS issues in development.
Then open **http://localhost:5173**.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Accounts executive | `accounts@feeflow.app` | `Passw0rd!` |
| Parent (Ishita Sharma, STU-0587) | `parent@feeflow.app` | `Passw0rd!` |

The login screen has one-click buttons to fill either account.

## Tests

```bash
cd backend
.venv/bin/python -m pytest        # 34 tests
```

Covered: instalment calculations, partial payments, duplicate-payment prevention,
reminder cancellation after payment, refund calculations, parent access
restrictions, and AI rule-based fallback (plus the no-side-effects guardrail).

---

## Sample data

Seeded by `backend/app/seed.py`, all flagged `is_sample=True` and shown with a
**"Sample data"** badge. The three required records are included verbatim:

- **STU-0412 — Aarav Meena** — JEE 2027 Morning — ₹30,000 due / ₹30,000 paid — **Paid**
- **STU-0587 — Ishita Sharma** — JEE 2027 Evening — ₹30,000 due / ₹15,000 paid — **Part paid, overdue**
- **STU-0219 — Mohit Gurjar** — NEET 2027 Morning — ₹40,000 due / ₹0 paid — **Upcoming**

Six more students across three centres, three programs and two batches populate the
dashboard with a realistic spread of statuses and risk levels.

## Key design decisions & assumptions

- **Refund policy is an explicit assumption.** The brief doesn't define one, so the
  calculator ships **three configurable policies** (standard linear pro-rata; pro-rata
  with a non-refundable registration portion; slab-based by elapsed time). Every result
  lists its assumptions (prefixed `ASSUMPTION:`) and an itemised breakdown. **No AI is ever
  used for financial math.**
- **Payments are simulated but backend-authoritative.** `initiate` creates a *pending*
  record; nothing is "paid" until `confirm`. A unique idempotency key + an already-confirmed
  short-circuit prevent duplicate processing. Over-payment beyond an instalment balance is rejected.
- **Reminders:** external SMS/WhatsApp/email providers are **mocked**, but creation,
  scheduling (−3 / 0 / +3 days around the due date), dispatch, persistence and
  cancellation are real. A fully-paid instalment auto-cancels its scheduled reminders.
  Messages are generated in **English and Hindi**.
- **AI dropout-risk:** uses missed instalments, days overdue, attendance % and test-score
  trend. If an LLM is configured (`OPENAI_API_KEY`) and reachable it's used and labelled
  `AI`; otherwise a deterministic engine runs, labelled `rule-based`. A flag **only ever
  creates a counsellor review task** — it never changes fees, adds penalties, messages
  parents, or makes financial decisions. Staff can mark a flag as a false positive.

## Security

- Passwords hashed with `pbkdf2_sha256` (passlib); never stored in plaintext.
- JWT bearer auth; role-based dependencies (`require_accounts`, `require_parent`).
- Parents can access **only their linked student**; every sensitive route enforces this on the backend.
- Request bodies validated with Pydantic.
- No secrets in the repo — configuration via `.env` (see `.env.example`); `.env` and `*.db` are git-ignored.

## Configuration

Backend (`backend/.env`, see `.env.example`):

```
DATABASE_URL=sqlite:///./feeflow.db      # or postgresql+psycopg://user:pass@host/db
JWT_SECRET=change-me
CORS_ORIGINS=http://localhost:5173
# OPENAI_API_KEY=...                      # optional; enables the AI path
```

Frontend (`frontend/.env`, see `.env.example`): `VITE_API_BASE` (default `/api`) and
`VITE_API_PROXY` (default `http://127.0.0.1:8077`).

## Project structure

```
backend/
  app/
    main.py            # app + router wiring
    config.py          # env settings
    database.py        # engine/session (SQLite ↔ Postgres)
    models.py          # SQLAlchemy models
    schemas.py         # Pydantic request bodies
    security.py deps.py # hashing, JWT, RBAC
    serializers.py     # ORM → API dicts
    services/          # ledger, payments, reminders, refunds, risk
    routers/           # auth, students, parent, payments, reminders, refunds, risk, dashboard
    seed.py            # demo data
  tests/               # pytest suite
frontend/
  src/
    pages/             # Login, accounts/*, parent/*, Receipt
    components/        # ui primitives, layouts, dialogs, badges
    context/           # AuthContext
    lib/               # api client, react-query hooks, types, formatters
```

## Limitations (scoped for the assessment)

- Payments and messaging are simulated/mocked by design (no real gateway or SMS provider).
- SQLite is the default store; swap `DATABASE_URL` for PostgreSQL in production.
- The frontend production build expects `/api` to be reverse-proxied to the API; use `npm run dev` for the demo.
