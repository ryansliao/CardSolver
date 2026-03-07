# Credit Card Optimizer

A Python FastAPI application that replicates the credit card wallet optimizer spreadsheet, backed by PostgreSQL (Supabase), with Google Sheets integration and a roadmap scenario planner.

## Features

- **Wallet calculator** — replicates all spreadsheet formulas: Annual EV, 2nd-Year EV, SUB opportunity cost, points earned by currency group
- **Google Sheets sync** — reads inputs (card selection, spend, years) from your sheet; writes computed results back
- **Roadmap scenarios** — model future wallet states by assigning cards to date windows (e.g. "add Chase Sapphire Reserve on 2025-07-01, cancel Amex Gold on 2026-01-01")
- **REST API** — full CRUD for cards, spend categories, and scenarios; direct `/calculate` endpoint with no Sheets dependency

---

## First-time setup

### 1. Supabase (PostgreSQL)

1. Create a free project at [supabase.com](https://supabase.com)
2. In **Project Settings → Database**, find your connection string
3. Use the **Session mode** URI (port `5432`) for asyncpg:
   ```
   postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```

### 2. Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project
2. Enable these two APIs:
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
3. Go to **APIs & Services → OAuth consent screen**:
   - Set User Type to **External**, fill in app name and support email
   - Add scopes: `spreadsheets` and `drive`
   - Under **Test users**, add your Google account email
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Under **Authorized redirect URIs**, add: `http://localhost:8765/`
   - Click **Save**, then **Download JSON**
5. Save the downloaded file into the `secrets/` folder:
   ```bash
   mv ~/Downloads/client_secret_*.json secrets/
   ```

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```ini
# Required
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
GOOGLE_CLIENT_SECRETS_FILE=secrets/client_secret_YOUR_ID.apps.googleusercontent.com.json
```

### 4. Python environment

```bash
cd "Credit Cards"
python3 -m venv .venv
source .venv/bin/activate
pip install -r credit_cards/requirements.txt
```

### 5. Seed the database

**One-time only.** Populates all 26 cards, multipliers, credits, and default spend categories into Supabase. The DB is the source of truth from this point forward.

```bash
python -m credit_cards.seed_data
```

### 6. Create the Google Sheet

```bash
python scripts/create_sheet.py
```

This will:
1. Open a browser window asking you to authorize Google Sheets + Drive access
2. Create a new spreadsheet named **"Credit Card Tool"** pre-populated with all card names, row labels, and default spend amounts
3. Print the spreadsheet URL and ID
4. Cache the OAuth token in `secrets/.oauth_token.json` (never committed)

The spreadsheet ID is automatically saved to `.env` as `SPREADSHEET_ID`.

> **Note:** On the Google authorization screen you may see "Google hasn't verified this app". Click **Advanced → Go to [app name] (unsafe)** — this is expected for personal OAuth apps in test mode.

### 7. Start the API

```bash
./start.sh
```

The server starts at **http://localhost:8000** — open [/docs](http://localhost:8000/docs) for the interactive Swagger UI.

```bash
./start.sh --port 8080    # custom port
```

---

## Day-to-day usage

### Updating your spend or card selection

Edit cells directly in the [Google Sheet](https://docs.google.com/spreadsheets/d/10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw):

| What to change | Where in the sheet |
|---|---|
| Years to count | Cell **C1** |
| Select / deselect a card | Row 1 flag column next to the card name (set `TRUE` or `FALSE`) |
| Annual spend per category | Column **E**, rows 19–35 |

Then call the sync endpoints to push changes to the DB and pull results back:

```bash
# Pull spend + card selection from sheet → update DB
curl -X POST http://localhost:8000/sync/read \
  -H "Content-Type: application/json" \
  -d '{"spreadsheet_id": "10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw", "sheet_name": "Credit Card Tool"}'

# Compute results and write them back to the sheet
curl -X POST http://localhost:8000/sync/write \
  -H "Content-Type: application/json" \
  -d '{"spreadsheet_id": "10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw", "sheet_name": "Credit Card Tool"}'
```

Or use the Swagger UI at [/docs](http://localhost:8000/docs).

### Resetting the sheet structure

If you accidentally break the sheet layout, recreate it in place (preserves the same spreadsheet ID):

```bash
python scripts/create_sheet.py --id 10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw
```

This clears and rewrites the structure without creating a new spreadsheet.

### Re-authorizing Google (if the token expires)

```bash
rm secrets/.oauth_token.json
python scripts/create_sheet.py --id 10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw
```

---

## API Reference

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

### Direct calculation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/calculate` | Run wallet calculator without Google Sheets |

**Example request body:**
```json
{
  "years_counted": 2,
  "selected_card_ids": [2, 9],
  "spend_overrides": {
    "Dining": 9000,
    "Groceries": 6000
  }
}
```

### Google Sheets sync

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sync/read` | Pull inputs from sheet → update DB spend categories |
| `POST` | `/sync/write` | Read sheet inputs, compute, and write results back |

**Example body for both sync endpoints:**
```json
{
  "spreadsheet_id": "10HPAiTRfF_JMtcQ-Pt3Pv45XRwEHo-pBsfzzYxwJRAw",
  "sheet_name": "Credit Card Tool"
}
```

### Roadmap scenarios

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scenarios` | List all scenarios |
| `POST` | `/scenarios` | Create a new scenario |
| `GET` | `/scenarios/{id}` | Get a scenario |
| `PATCH` | `/scenarios/{id}` | Update scenario metadata |
| `DELETE` | `/scenarios/{id}` | Delete a scenario |
| `POST` | `/scenarios/{id}/cards` | Add a card to a scenario |
| `DELETE` | `/scenarios/{id}/cards/{card_id}` | Remove a card from a scenario |
| `GET` | `/scenarios/{id}/results` | Compute wallet EV for the scenario |

**Example: create a 2-year roadmap scenario**
```json
POST /scenarios
{
  "name": "Add CSR July 2025",
  "description": "Upgrade wallet by adding Chase Sapphire Reserve mid-year",
  "as_of_date": "2025-07-01",
  "cards": [
    { "card_id": 7, "start_date": null, "end_date": null, "years_counted": 2 },
    { "card_id": 5, "start_date": "2025-07-01", "end_date": null, "years_counted": 2 }
  ]
}
```

**Get scenario results at a specific date:**
```
GET /scenarios/1/results?reference_date=2025-07-01
```

---

## Project structure

```
Credit Cards/
├── .env                            # Local secrets (gitignored)
├── .env.example                    # Template — copy to .env and fill in
├── .gitignore
├── README.md
├── start.sh                        # One-command dev server launcher
│
├── secrets/                        # Gitignored — all credential files live here
│   ├── client_secret_*.json        # OAuth client secret (downloaded from Google Cloud)
│   └── .oauth_token.json           # OAuth token cache (written after first login)
│
├── scripts/
│   └── create_sheet.py             # One-time script to create the Google Sheet
│
└── credit_cards/                   # FastAPI application package
    ├── __init__.py
    ├── main.py                     # FastAPI app + all endpoints
    ├── calculator.py               # Pure Python formula engine
    ├── sheets.py                   # Google Sheets read/write adapter
    ├── models.py                   # SQLAlchemy ORM models
    ├── schemas.py                  # Pydantic v2 request/response schemas
    ├── database.py                 # Async PostgreSQL session factory
    ├── db_helpers.py               # DB → calculator dataclass converters
    ├── seed_data.py                # One-time DB seeder
    └── requirements.txt
```

---

## Calculation logic

The engine in `calculator.py` mirrors all spreadsheet formulas:

| Spreadsheet row | Function |
|----------------|----------|
| Row 2: Annual EV | `calc_annual_ev` — SUB-amortized EV over `years_counted` |
| Row 3: Points Earned | `calc_total_points` — cumulative over `years_counted` |
| Row 4: Annual Point Earn | `calc_annual_point_earn` — category spend × multiplier + annual bonus |
| Row 5: 2nd Year+ EV | `calc_2nd_year_ev` — steady-state (no SUB) |
| Row 6: Credit Valuation | `calc_credit_valuation` — sum of all benefit credits |
| Row 13: SUB Extra Spend | `calc_sub_extra_spend` — gap to hit SUB threshold |
| Row 15: SUB Opp. Cost | `calc_sub_opportunity_cost` — points foregone on redirected spend |
| Row 16: Opp. Cost Abs. | `calc_opp_cost_abs` — absolute cross-card opportunity cost |
| Row 17: Avg. Multiplier | `calc_avg_spend_multiplier` — weighted average earn rate |

Special rules:
- **Chase Freedom Unlimited / Flex**: earn rates are boosted (cpp = 2.0) when a Chase Sapphire Reserve, Preferred, or Ink Preferred is also selected
- **Delta cobrand cards**: points adjusted by `1/0.85` factor to normalize SkyMiles vs transferable currency
