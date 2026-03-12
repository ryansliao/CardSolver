# Backend — Credit Card Optimizer API

FastAPI + SQLAlchemy async backend. Exposes a REST API for card management, wallet EV calculation, and the Wallet Tool (user → wallets → wallet cards with SUB overrides and time-frame-based EV and opportunity cost).

---

## Module map

```
backend/
├── app/
│   ├── models.py       ORM table definitions (User, Issuer, Currency, Ecosystem, Card, …)
│   ├── calculator.py   Pure-Python calculation engine — no DB dependency
│   ├── db_helpers.py   DB → calculator dataclass converters
│   ├── schemas.py      Pydantic v2 request/response schemas
│   ├── database.py     Async engine + session factory; Azure Managed Identity support
│   ├── main.py         FastAPI app, all endpoints, React SPA serving
│   └── seed_data.py    One-time seeder — pandas DataFrames + static maps
└── requirements.txt
```

Data flows inward: `main.py` → `db_helpers.py` → `calculator.py` (pure). The calculator has no SQLAlchemy dependency and can be unit-tested without a database.

---

## Data model

### Tables and relationships

```
User ──< Wallet ──< WalletCard >── Card   (Wallet Tool: cards in wallet with added_date, optional SUB overrides)
  └──< UserCurrencyCpp >── Currency       (per-user cents-per-point overrides)

Issuer ──< Currency
       ──< Card

Ecosystem >── Currency (points_currency_id, optional cashback_currency_id)
         ──< EcosystemCurrency >── Currency   (additional currencies that convert when key card in wallet)
         ──< CardEcosystem >── Card          (card membership; key_card = unlocks conversion)

Card >── Issuer
     >── Currency              (default currency, may be cashback)
     ──< CardEcosystem         (ecosystem memberships; key_card flags)
     ──< CardCategoryMultiplier
     ──< CardCredit
     ──< WalletCard
```

### User and Wallet (Wallet Tool)

- **User** — minimal model (id, name). Single-tenant: seed one default user (id=1); all wallets belong to that user.
- **Wallet** — belongs to a user; has name, optional description, optional as_of_date. Replaces ad-hoc “scenario” as the persistent wallet entity for the Wallet Tool.
- **WalletCard** — links a card to a wallet with required `added_date` and optional SUB overrides (`sub`, `sub_min_spend`, `sub_months`, `sub_spend_amount`). Null overrides use the Card’s catalog values. `years_counted` is used for SUB amortization (derived from the UI projection years + months).

### Issuer

Represents a card-issuing institution (Chase, American Express, Citi, …).  Acts as the parent for currencies and ecosystem boosts.

### Currency

A reward currency tied to an issuer, with full metadata:

| Field | Type | Purpose |
|---|---|---|
| `name` | str | e.g. `"Chase UR"`, `"Chase UR Cash"`, `"Amex MR"` |
| `cents_per_point` | float | Dollar value of one point/mile (e.g. 1.5 for Chase UR) |
| `is_cashback` | bool | True for pre-boost cashback variants (e.g. Chase UR Cash) |
| `is_transferable` | bool | True when points can move to airline/hotel partners |

### Ecosystem

A points ecosystem (e.g. Chase UR, Amex MR). When a **key card** is in the wallet, cards in that ecosystem whose currency is the ecosystem’s cashback or an additional currency earn the ecosystem’s **points currency**.

| Field | Purpose |
|---|---|
| `points_currency_id` | The transferable currency cards earn when the ecosystem is active |
| `cashback_currency_id` | Optional; cards on this cashback currency upgrade when a key card is in wallet |
| `ecosystem_currencies` | Additional currencies (e.g. Cash) that convert to points when a key card is in wallet |
| `card_memberships` | CardEcosystem rows: which cards belong to this ecosystem and which are key cards |

**CardEcosystem** links a card to an ecosystem; `key_card=True` means this card being in the wallet unlocks conversion for that ecosystem (e.g. Sapphire Reserve for Chase UR).

### Card

| Field | Notes |
|---|---|
| `issuer_id` | FK to Issuer |
| `currency_id` | Default currency (cashback variant when applicable) |
| `annual_fee`, `first_year_fee`, `sub`, `sub_min_spend`, `sub_months`, `sub_spend_amount`, `annual_bonus` | Standard card attributes |
| `ecosystem_memberships` | CardEcosystem rows: which ecosystems this card belongs to and whether it is a key card |

---

## Calculation engine (`calculator.py`)

The engine is a set of pure functions operating on `CardData` and `CurrencyData` dataclasses. It has no database import.

### Key dataclasses

```python
CurrencyData       # Snapshot of one Currency row for the engine
CardData           # All static card data including nested CurrencyData;
                   # holds ecosystem membership and effective currency
                   # for the key-card upgrade logic
CardResult         # Per-card outputs (EV, points, opportunity cost, …)
WalletResult       # Aggregated wallet outputs including dynamic currency_pts dict
```

### Ecosystem / key-card resolution

When a key card for an ecosystem is in the wallet, cards in that ecosystem use the ecosystem’s points currency; otherwise they use their default (e.g. cashback) currency. The engine resolves effective currency and cents-per-point per card from the selected set.

### Per-card formulas

| Function | What it computes |
|---|---|
| `calc_annual_point_earn` | Σ(spend × multiplier) + annual_bonus |
| `calc_credit_valuation` | Σ(credit values) |
| `calc_2nd_year_ev` | Steady-state annual EV: earn/100 × cpp + credits − fee |
| `calc_annual_ev` | SUB-amortized EV over `years_counted` |
| `calc_total_points` | Cumulative points over `years` |
| `calc_sub_extra_spend` | Gap between SUB threshold and natural spend on this card |
| `calc_sub_opportunity_cost` | Dollar cost of redirecting extra spend (see below) |
| `calc_avg_spend_multiplier` | Spend-weighted average multiplier across categories |

### Opportunity cost

`calc_sub_opportunity_cost` returns a `(gross, net)` pair in **dollars** rather than raw points:

- **gross** — `sub_extra_spend × best_wallet_earn_rate` where the best rate is the spend-weighted maximum earn rate (multiplier × cpp) across all other selected cards, computed per category. Cross-currency aware.
- **net** — `max(0, gross − sub_spend_amount_value)` — the true cost after crediting back what the new card earns on that same extra spend.

Using dollars and best-alternative rates (instead of average multipliers) produces a meaningful cross-currency comparison: redirecting spend from a 4x Amex MR card to a 1x cashback card carries a much higher cost than redirecting from a 1x UR card.

### Wallet aggregation

`compute_wallet` iterates all cards, resolves effective currencies, and builds:
- `currency_pts: dict[str, float]` — dynamic map of currency name → annual points. Boosted cards accumulate under the target currency (e.g. `"Chase UR"`, not `"Chase UR Cash"`).
- Per-card `CardResult` objects with all computed metrics.

---

## API endpoints

Interactive docs available at `http://localhost:8000/docs` when running locally.

### Issuers

| Method | Path | Description |
|---|---|---|
| `GET` | `/issuers` | List all issuers |
| `POST` | `/issuers` | Create an issuer |
| `PATCH` | `/issuers/{id}` | Update an issuer |
| `DELETE` | `/issuers/{id}` | Delete an issuer |

### Currencies

| Method | Path | Description |
|---|---|---|
| `GET` | `/currencies` | List all currencies (no user). Optional query `user_id` for user CPP overrides in response. |
| `POST` | `/currencies` | Create a currency |
| `PATCH` | `/currencies/{id}` | Update name, issuer_id, CPP, flags |
| `DELETE` | `/currencies/{id}` | Delete a currency |

### Ecosystems

| Method | Path | Description |
|---|---|---|
| `GET` | `/ecosystems` | List all ecosystems with points/cashback currency and memberships |
| `GET` | `/ecosystems/{id}` | Get one ecosystem |
| `POST` | `/ecosystems` | Create an ecosystem |
| `PATCH` | `/ecosystems/{id}` | Update name, points_currency_id, additional currencies |
| `DELETE` | `/ecosystems/{id}` | Delete an ecosystem |

### Cards

| Method | Path | Description |
|---|---|---|
| `GET` | `/cards` | List all cards (nested issuer, currency, ecosystem memberships) |
| `GET` | `/cards/{id}` | Get a single card |
| `POST` | `/cards` | Create a card |
| `PATCH` | `/cards/{id}` | Update fee, SUB, currency_id, ecosystem_memberships, multipliers, etc. |
| `DELETE` | `/cards/{id}` | Delete a card |

### Spend categories

| Method | Path | Description |
|---|---|---|
| `GET` | `/spend` | List all spend categories with current annual spend |
| `POST` | `/spend` | Create a category (body: category, annual_spend) |
| `PUT` | `/spend/{category}` | Update annual spend for a category |
| `DELETE` | `/spend/{category}` | Delete a category |

### Calculation

| Method | Path | Description |
|---|---|---|
| `POST` | `/calculate` | Run wallet EV for selected cards + optional spend overrides |

**Request body:**
```json
{
  "years_counted": 2,
  "selected_card_ids": [3, 7, 12],
  "spend_overrides": { "Dining": 9000, "Groceries": 6000 }
}
```

### Scenarios

| Method | Path | Description |
|---|---|---|
| `GET` | `/scenarios` | List all scenarios |
| `POST` | `/scenarios` | Create a scenario |
| `GET` | `/scenarios/{id}` | Get a scenario |
| `PATCH` | `/scenarios/{id}` | Update name / description / as_of_date |
| `DELETE` | `/scenarios/{id}` | Delete a scenario |
| `POST` | `/scenarios/{id}/cards` | Add a card with optional date window and years_counted |
| `DELETE` | `/scenarios/{id}/cards/{card_id}` | Remove a card from a scenario |
| `GET` | `/scenarios/{id}/results` | Compute wallet EV for active cards at a reference date |

### Wallets (Wallet Tool)

| Method | Path | Description |
|---|---|---|
| `GET` | `/wallets` | List wallets for the given user (default `user_id=1`) |
| `POST` | `/wallets` | Create a wallet (body: `user_id`, `name`, optional `description`, `as_of_date`) |
| `GET` | `/wallets/{id}` | Get a wallet with its wallet_cards (and card names) |
| `PATCH` | `/wallets/{id}` | Update wallet name / description / as_of_date |
| `DELETE` | `/wallets/{id}` | Delete a wallet |
| `POST` | `/wallets/{id}/cards` | Add a card (body: `card_id`, `added_date`, optional SUB overrides, `years_counted`) |
| `DELETE` | `/wallets/{id}/cards/{card_id}` | Remove a card from the wallet |
| `GET` | `/wallets/{id}/results` | Compute EV and opportunity cost. Query params: `reference_date`, `projection_years`, `projection_months`, optional `spend_overrides` (JSON). Cards with `added_date` ≤ reference date are active; SUB amortization uses years derived from projection. |

---

## Seeding the database

Seeding is a one-time operation that uses the DataFrames and static maps in `seed_data.py` and populates all tables in dependency order:

```
User (default id=1) → Issuers → Currencies → Ecosystems → EcosystemCurrencies → SpendCategories
→ Cards → CardEcosystems (memberships + key cards) → CardCategoryMultipliers → CardCredits
```

```bash
cd backend
python3 -m app.seed_data
```

Re-running seed is safe — all upserts are idempotent.

### Adding a new issuer ecosystem

1. Add the issuer to `ISSUERS` (if new) in `seed_data.py`
2. Add cashback and transferable `Currency` rows
3. Add an `Ecosystem` with `points_currency_id` (and optional `cashback_currency_id`), then add `EcosystemCurrency` rows for any additional currencies that convert (e.g. Cash)
4. For each card in the ecosystem, add a `CardEcosystem` row; set `key_card=True` for anchor cards (e.g. Sapphire Reserve)
5. Re-run `python -m app.seed_data`

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://user:pass@host:5432/db` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:5173`) |

For Azure, if the URL contains `azure.com`, `database.py` automatically enables SSL and attempts Azure Managed Identity token auth as a fallback when no password is present.
