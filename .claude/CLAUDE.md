# Credit Card Wallet Evaluator

## Project Overview
A personal finance tool for evaluating credit card wallet combinations. Users configure
their spending profile and a set of cards, then the tool calculates expected annual value
— across points/miles earned, statement credits, and sign-up bonuses — projected over a
user-defined time horizon (1–5 years).

## Architecture
- **Backend**: FastAPI + SQLAlchemy (async), PostgreSQL
- **Frontend**: React 18 + TypeScript + Tailwind CSS, React Query
- **Reference Data**: Cards, currencies, categories, multipliers, and credits are managed
  directly in the DB via admin endpoints (`/admin/*`). Seeding of spend categories and
  issuer application rules happens on startup in `main.py`.
- **Single-tenant**: `DEFAULT_USER_ID = 1` defined in `backend/app/constants.py`; no authentication

## Core Concepts

**Reference Data**
Cards, issuers, currencies, spend categories, multipliers, credits, and issuer application
rules live in the DB. Reference data is created/edited via admin endpoints. There is no
xlsx or file-based import.

**Spend Categories**
`SpendCategory` is a hierarchical table (`parent_id`, `is_system`). These
are the card-level multiplier categories (e.g., "Travel", "Dining", "Hotels"). A locked
"All Other" system category is auto-created and cannot be renamed or deleted (pinned to ID 1;
"Travel" is pinned to ID 2). The hierarchy is seeded via `_seed_spend_category_hierarchy()`
in `main.py` on startup.

**Wallet Spend**
Each wallet has `WalletSpendItem` rows — one per `SpendCategory` — with an annual dollar
amount. This replaced the legacy two-table structure (`WalletSpendCategory` +
`WalletSpendCategoryMapping`), which still exists in the DB but is no longer used.

**Wallet**
A named collection of cards to evaluate together. Each `WalletCard` has `added_date`,
optional `closed_date`, `acquisition_type` (opened/product_change), optional SUB overrides,
and `sub_earned_date`. Cards must be active (added ≤ reference date, not closed) to count
in calculations. Wallet stores its own calc config: `calc_start_date`, `calc_end_date`,
`calc_duration_years`, `calc_duration_months`, `calc_window_mode`.

**EV Calculation**
`calculator.py` computes per-card and wallet-level expected value:
- Annual points earned via category multipliers (including top-N group logic and portal multipliers)
- SUB value amortized over the projection timeframe
- SUB opportunity cost: value lost on other cards by concentrating spend to hit SUB minimum
- Annual credits applied at face value (with per-wallet override support)
- Annual fee deducted (first-year fee for year 1, standard fee thereafter)
- Currency upgrade: cashback currencies auto-convert to points when the target currency is
  also present in the wallet (e.g., UR Cash → Chase UR)

**Roadmap Tracking**
`/wallets/{id}/roadmap` returns:
- 5/24 status (personal cards opened in last 24 months)
- Per-card SUB status (Pending / Earned / Expired / No SUB)
- Days remaining and next eligibility date per card
- Issuer rule violations (Chase 5/24, Amex 1/90, Citi 1/8, Citi 2/65)

## Key Features (Implemented)
- Create/manage wallets; add cards with open dates and optional SUB overrides
- Multi-year EV projection with optional reference date range
- Per-wallet spend items mapped directly to card categories
- Per-wallet CPP (cents per point) overrides per currency
- Point/mile balance tracking with total portfolio value estimate
- Roadmap tab: 5/24 status, SUB tracking, issuer rule violation alerts
- Per-wallet statement credit valuation overrides
- Per-wallet multiplier overrides per card/category

## Data Model (Key Entities)

**Reference (managed via admin endpoints, seeded on startup):**
- `Issuer`, `CoBrand`, `Network`, `NetworkTier`
- `Currency` — reward currency with default CPP, optional `converts_to_currency_id`
- `Card` — annual fee, SUB value/spend/days, issuer, currency, network
- `SpendCategory` — hierarchical card categories (parent_id, is_system); "All Other"=ID 1, "Travel"=ID 2
- `CardCategoryMultiplier` — earn rate per card/category
- `CardMultiplierGroup` — top-N grouped category logic
- `CardCredit` — annual credits with type and dollar value
- `IssuerApplicationRule` — velocity rules (cooldowns, 5/24, etc.)

**Wallet-owned:**
- `Wallet` — calc config fields + metadata
- `WalletCard` — card in wallet with dates, acquisition_type, SUB overrides
- `WalletSpendItem` — annual spend amount per SpendCategory (current model)
- `WalletCurrencyCpp` — per-wallet CPP override per currency
- `WalletCurrencyBalance` — tracked point balances
- `WalletCardCredit` — per-wallet statement credit valuation overrides
- `WalletCardMultiplier` — per-wallet multiplier overrides per card/category

**Legacy (still in DB, no longer used in code):**
- `WalletSpendCategory` / `WalletSpendCategoryMapping` — replaced by `WalletSpendItem`

## Frontend Structure

```
frontend/src/
  App.tsx                            # Root: ErrorBoundary, QueryClient, Router
  main.tsx                           # Entry point
  api/client.ts                      # Typed API client (all endpoints)
  components/
    ModalBackdrop.tsx                # Shared modal backdrop (Escape key, backdrop click)
  utils/
    format.ts                        # formatMoney(), formatPoints(), today()
  pages/WalletTool/
    index.tsx                        # Main page (wallet selector, layout, tabs)
    constants.ts                     # DEFAULT_USER_ID, LOCKED_USER_SPEND_CATEGORY_NAME
    hooks/
      useCardLibrary.ts              # Card library query
      useSpendCategories.ts          # Wallet spend items query
      useAppSpendCategories.ts       # Hierarchical spend category tree query
      useWalletSpendCategoriesTable.ts # Legacy spend categories (unused)
    lib/
      queryKeys.ts                   # Centralised React Query key arrays
      walletCardForm.ts              # Form validation and payload building utilities
    components/
      cards/
        CardsListPanel.tsx           # Cards list with SUB badges and quick actions
        WalletCardModal.tsx          # Add/edit wallet card (SUB, fees, dates)
        CardLibraryInfoModal.tsx     # Read-only card reference data
        StatementCreditsModal.tsx    # Edit statement credit valuations per wallet card
      spend/
        AnnualSpendPanel.tsx         # Spend items table with inline editing
        AddSpendCategoryPicker.tsx   # Picker for adding a spend category
        SpendCategoryMappingModal.tsx # Legacy: create/edit spend category with allocations
      summary/
        WalletResultsAndCurrenciesPanel.tsx  # Annual EV, fees, currency balances
        CurrencySettingsModal.tsx    # CPP overrides, initial balances, currency tracking
      wallet/
        CreateWalletModal.tsx        # Create new wallet
      roadmap/
        ApplicationRuleWarningModal.tsx  # Issuer rule violation alerts
```

## Backend Structure

```
backend/app/
  constants.py       # DEFAULT_USER_ID, ALL_OTHER_CATEGORY, ALLOCATION_SUM_TOLERANCE
  main.py            # FastAPI app, all endpoints, spend category seed
  models.py          # SQLAlchemy ORM models
  schemas.py         # Pydantic v2 request/response schemas
  calculator.py      # Pure calculation engine (no DB dependency)
  db_helpers.py      # DB → calculator bridge: load_card_data, load_spend, etc.
  database.py        # Engine setup, session factory, idempotent migrations
```

## Known Conventions

**React Query keys** — always use `queryKeys.*` from `lib/queryKeys.ts`:
- `['wallets', userId]`, `['cards']`, `['spend', walletId]`, `['app-spend-categories']`
- `['wallet-currency-balances', walletId]`, `['wallet-currencies', walletId]`
- `['roadmap', walletId]`

**Shared hooks** — avoid inline `useQuery` for data that multiple components need:
- Use `useCardLibrary()`, `useSpendCategories()`, `useAppSpendCategories()` from `hooks/`

**Format utilities** — use `formatMoney`, `formatPoints`, `today()` from `utils/format.ts`;
do not re-define them per component.

**Modal pattern** — wrap all modal dialogs with `<ModalBackdrop>` from
`components/ModalBackdrop.tsx` for consistent Escape-key handling and backdrop dismiss.

**Constants** — shared backend constants live in `backend/app/constants.py`; import from
there rather than re-defining in `main.py`, `schemas.py`, etc.

## What Does NOT Exist
- No Library/card-editing UI — card and reference data is managed via admin endpoints
- No xlsx import — data.xlsx and xlsx_loader.py have been removed
- No side-by-side wallet comparison view
- No optimization/recommendation engine (best card for each category)
- No multi-user support or authentication
- No export (CSV/PDF)

## What This Project Is NOT
- Not a live card database — reference data is manually maintained via admin endpoints
- Not a credit score tool
- Not connected to any bank or financial institution
