#!/usr/bin/env bash
# start.sh — set up and run the Credit Card Optimizer API
# Usage: ./start.sh [--port 8000]
#
#   --port N  Listen on port N (default: 8000)
#
# First-time setup (run once, in order):
#   1. cp .env.example .env && fill in values
#   2. python -m credit_cards.seed_data      ← imports data/Financial.xlsx into DB
#   3. python scripts/create_sheet.py        ← creates the Google Sheet
#   4. ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8000

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── 1. Virtual environment ──────────────────────────────────────────────────
if [[ ! -d ".venv" ]]; then
  echo "→ Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# ─── 2. Install / sync dependencies ─────────────────────────────────────────
echo "→ Checking dependencies..."
pip install -q -r credit_cards/requirements.txt

# ─── 3. Environment file ─────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    echo ""
    echo "⚠️  No .env found."
    echo "   Copy .env.example to .env and fill in:"
    echo "     DATABASE_URL                 — your Supabase connection string"
    echo "     GOOGLE_CLIENT_SECRETS_FILE   — path to your OAuth client secret JSON"
    echo ""
    echo "   Then re-run: ./start.sh"
    exit 1
  fi
fi

# ─── 4. Start the API server ─────────────────────────────────────────────────
echo ""
echo "→ Starting Credit Card Optimizer API on http://localhost:${PORT}"
echo "   Docs: http://localhost:${PORT}/docs"
echo "   Press Ctrl+C to stop."
echo ""

exec uvicorn credit_cards.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --reload \
  --reload-dir credit_cards
