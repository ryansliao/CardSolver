# Credit Card Optimizer

A full-stack web application that calculates the expected value (EV) of any combination of 26 credit cards. Built with FastAPI, React, and deployed on Azure.

## Features

- **Wallet calculator** — select cards, set your annual spend per category, and compute annual EV, points earned by currency group, and per-card breakdowns
- **Roadmap scenarios** — model future wallet states by assigning cards to date windows (e.g. "add Chase Sapphire Reserve on 2025-07-01")
- **Card library** — browse all 26 cards with their multipliers, credits, and SUB details
- **REST API** — full CRUD for cards, spend categories, and scenarios; interactive docs at `/docs`

---

## Local development

### 1. Prerequisites

- Python 3.11+
- Node.js 18+

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in `DATABASE_URL`. For local dev you can use any PostgreSQL database:

```ini
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/creditcards
```

### 3. Seed the database (one-time)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt openpyxl
cd backend && python -m app.seed_data && cd ..
```

### 4. Start both servers

```bash
./scripts/dev.sh
```

This starts:
- **FastAPI** at `http://localhost:8000` (with `/docs` for Swagger UI)
- **Vite dev server** at `http://localhost:5173` (proxies `/api` → FastAPI)

Open **http://localhost:5173** in your browser.

---

## Azure deployment

### Resources needed

| Resource | Tier | Notes |
|---|---|---|
| Azure App Service Plan | B1 (Linux) | Python 3.12 |
| Azure App Service | — | Hosts FastAPI + built React app |
| Azure Database for PostgreSQL Flexible Server | Burstable B1ms | Sufficient for personal use |

### Step 1 — Provision Azure PostgreSQL

1. In the Azure Portal, create an **Azure Database for PostgreSQL Flexible Server**
2. Note the server name, username, and password
3. Under **Networking**, allow connections from Azure services and your local IP
4. Connection string format:
   ```
   postgresql+asyncpg://[user]@[server]:[password]@[server].postgres.database.azure.com:5432/postgres?ssl=require
   ```

### Step 2 — Seed the database from local machine

Set `DATABASE_URL` in your local `.env` to the Azure connection string, then:

```bash
source .venv/bin/activate
pip install openpyxl
cd backend && python -m app.seed_data && cd ..
```

### Step 3 — Build the React frontend

```bash
cd frontend
npm install
npm run build
```

The built output lands in `frontend/dist/`, which FastAPI serves automatically.

### Step 4 — Deploy to Azure App Service

Using Azure CLI:

```bash
# Create resource group (if needed)
az group create --name credit-card-rg --location eastus

# Create App Service Plan
az appservice plan create \
  --name credit-card-plan \
  --resource-group credit-card-rg \
  --sku B1 \
  --is-linux

# Create Web App (Python 3.12)
az webapp create \
  --name credit-card-optimizer \
  --resource-group credit-card-rg \
  --plan credit-card-plan \
  --runtime "PYTHON:3.12"

# Set environment variables
az webapp config appsettings set \
  --name credit-card-optimizer \
  --resource-group credit-card-rg \
  --settings \
    DATABASE_URL="postgresql+asyncpg://..." \
    ALLOWED_ORIGINS="https://credit-card-optimizer.azurewebsites.net" \
    APP_ENV="production"

# Set startup command
az webapp config set \
  --name credit-card-optimizer \
  --resource-group credit-card-rg \
  --startup-file "bash scripts/azure_startup.sh"

# Deploy (zip deploy from repo root)
zip -r deploy.zip . \
  --exclude ".git/*" \
  --exclude ".venv/*" \
  --exclude "frontend/node_modules/*" \
  --exclude "secrets/*" \
  --exclude "*.pyc" \
  --exclude "__pycache__/*"

az webapp deploy \
  --name credit-card-optimizer \
  --resource-group credit-card-rg \
  --src-path deploy.zip \
  --type zip

rm deploy.zip
```

The app will be live at `https://credit-card-optimizer.azurewebsites.net`.

---

## Project structure

```
Credit Card Tool/
├── .env.example                    # Template — copy to .env and fill in
├── .gitignore
├── README.md
│
├── backend/                        # Python backend
│   ├── app/                        # FastAPI application package
│   │   ├── main.py                 # API endpoints + static file serving
│   │   ├── calculator.py           # Pure Python formula engine
│   │   ├── models.py               # SQLAlchemy ORM models
│   │   ├── schemas.py              # Pydantic v2 schemas
│   │   ├── database.py             # Async PostgreSQL session factory
│   │   ├── db_helpers.py           # DB → calculator dataclass converters
│   │   └── seed_data.py            # One-time DB seeder (reads docs/Financial.xlsx)
│   └── requirements.txt            # Production Python dependencies
│
├── frontend/                       # React app (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── api/client.ts           # Typed API client
│   │   ├── pages/
│   │   │   ├── Calculator.tsx      # Main wallet calculator
│   │   │   ├── Scenarios.tsx       # Scenario manager
│   │   │   └── Cards.tsx           # Card library browser
│   │   └── components/
│   │       ├── CardGrid.tsx        # Toggleable card selector
│   │       ├── SpendTable.tsx      # Editable spend categories
│   │       └── WalletSummary.tsx   # EV results display
│   └── dist/                       # Built output (served by FastAPI in production)
│
├── scripts/
│   ├── dev.sh                      # Local dev launcher (API + React)
│   ├── azure_startup.sh            # Azure App Service startup command
│   └── requirements-setup.txt      # One-time setup deps (openpyxl for seeding)
│
└── docs/
    └── Financial.xlsx              # Source data for initial DB seeding
```

---

## API reference

### Cards

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cards` | List all 26 cards with multipliers and credits |
| `GET` | `/cards/{id}` | Get a single card |
| `PATCH` | `/cards/{id}` | Update annual fee, CPP, SUB offer, etc. |

### Spend categories

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/spend` | List all 17 spend categories |
| `PUT` | `/spend/{category}` | Update annual spend for a category |

### Calculation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/calculate` | Compute wallet EV for selected cards |

**Example request:**
```json
{
  "years_counted": 2,
  "selected_card_ids": [2, 9],
  "spend_overrides": { "Dining": 9000, "Groceries": 6000 }
}
```

### Scenarios

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scenarios` | List all scenarios |
| `POST` | `/scenarios` | Create a new scenario |
| `GET` | `/scenarios/{id}` | Get a scenario |
| `PATCH` | `/scenarios/{id}` | Update scenario metadata |
| `DELETE` | `/scenarios/{id}` | Delete a scenario |
| `POST` | `/scenarios/{id}/cards` | Add a card (with date window) |
| `DELETE` | `/scenarios/{id}/cards/{card_id}` | Remove a card |
| `GET` | `/scenarios/{id}/results` | Compute wallet EV for the scenario |

---

## Calculation logic

The engine in `calculator.py` mirrors all spreadsheet formulas:

| Formula | Function |
|---------|----------|
| Annual EV | `calc_annual_ev` — SUB-amortized EV over `years_counted` |
| Total Points | cumulative over `years_counted` |
| Annual Point Earn | `calc_annual_point_earn` — category spend × multiplier + annual bonus |
| 2nd Year+ EV | `calc_2nd_year_ev` — steady-state EV (no SUB) |
| Credit Valuation | `calc_credit_valuation` — sum of all benefit credits |
| SUB Extra Spend | `calc_sub_extra_spend` — gap to hit SUB threshold |
| SUB Opp. Cost | `calc_sub_opportunity_cost` — points foregone on redirected spend |

Special rules:
- **Chase Freedom Unlimited / Flex**: earn rates are boosted (cpp = 2.0) when a Chase Sapphire Reserve, Preferred, or Ink Preferred is also in the wallet
- **Delta cobrand cards**: points adjusted by `1/0.85` factor to normalize SkyMiles vs. transferable currencies
