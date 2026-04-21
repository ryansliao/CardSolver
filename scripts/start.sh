#!/usr/bin/env bash
set -euo pipefail

cd backend

python -c "import asyncio; from app.database import create_tables; asyncio.run(create_tables())"
python -m app.seed load

exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout 120 \
  --keep-alive 5 \
  app.main:app
