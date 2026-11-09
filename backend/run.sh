#!/usr/bin/env bash
# One-command backend bootstrap: create venv, install deps, seed if needed, run API.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8077}"

# 1. Virtual environment
if [ ! -d .venv ]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv .venv --python 3.12
  else
    python3 -m venv .venv
  fi
fi

# 2. Dependencies
if command -v uv >/dev/null 2>&1; then
  uv pip install --python .venv/bin/python -r requirements.txt
else
  .venv/bin/pip install --upgrade pip >/dev/null
  .venv/bin/pip install -r requirements.txt
fi

# 3. Seed the database on first run
if [ ! -f feeflow.db ]; then
  echo "Seeding demo database..."
  .venv/bin/python -m app.seed
fi

# 4. Run
echo "FeeFlow API → http://127.0.0.1:${PORT}  (docs at /docs)"
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT}" --reload
