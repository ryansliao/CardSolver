#!/usr/bin/env bash
# start.sh — set up and run the Credit Card Optimizer API
# Usage: ./start.sh [--seed] [--port 8000]
#
#   --seed    Re-run the database seeder before starting the server
#   --port N  Listen on port N (default: 8000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8000
RUN_SEED=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) RUN_SEED=true; shift ;;
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
if [[ ! -f "credit_cards/.env" ]]; then
  if [[ -f "credit_cards/.env.example" ]]; then
    echo ""
    echo "⚠️  No credit_cards/.env found."
    echo "   Copy credit_cards/.env.example to credit_cards/.env and fill in:"
    echo "     DATABASE_URL              — your Supabase (or other PostgreSQL) connection string"
    echo "     GOOGLE_CREDENTIALS_PATH   — path to your service account JSON file"
    echo ""
    echo "   Then re-run: ./start.sh"
    exit 1
  fi
fi

# ─── 4. Seed the database (optional) ─────────────────────────────────────────
if [[ "$RUN_SEED" == true ]]; then
  echo "→ Seeding database from Financial.xlsx..."
  python -m credit_cards.seed_data
fi

# ─── 5. Start the API server ─────────────────────────────────────────────────
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
