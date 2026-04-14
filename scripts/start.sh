#!/usr/bin/env bash
set -euo pipefail

cd backend

exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout 120 \
  --keep-alive 5 \
  app.main:app
