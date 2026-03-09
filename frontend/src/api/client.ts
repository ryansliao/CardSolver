// Typed API client — all calls go through /api which Vite proxies to FastAPI in dev.
// In production the React build is served by FastAPI directly, so /api is the same origin.

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ─── Types (mirror Pydantic schemas) ─────────────────────────────────────────

export interface CardMultiplier {
  category: string
  multiplier: number
}

export interface CardCredit {
  credit_name: string
  credit_value: number
}

export interface Card {
  id: number
  name: string
  issuer: string
  currency: string
  annual_fee: number
  cents_per_point: number
  sub_points: number
  sub_min_spend: number | null
  sub_months: number | null
  sub_spend_points: number
  annual_bonus_points: number
  boosted_by_chase_premium: boolean
  points_adjustment_factor: number
  multipliers: CardMultiplier[]
  credits: CardCredit[]
}

export interface SpendCategory {
  id: number
  category: string
  annual_spend: number
}

export interface CardResult {
  card_id: number
  card_name: string
  selected: boolean
  annual_ev: number
  second_year_ev: number
  total_points: number
  annual_point_earn: number
  credit_valuation: number
  annual_fee: number
  sub_points: number
  annual_bonus_points: number
  sub_extra_spend: number
  sub_spend_points: number
  sub_opportunity_cost: number
  opp_cost_abs: number
  avg_spend_multiplier: number
  cents_per_point: number
}

export interface WalletResult {
  years_counted: number
  total_annual_ev: number
  total_points_earned: number
  total_annual_pts: number
  amex_mr_pts: number
  chase_ur_pts: number
  capital_one_pts: number
  citi_ty_pts: number
  bilt_pts: number
  delta_pts: number
  hilton_pts: number
  card_results: CardResult[]
}

export interface ScenarioCard {
  id: number
  scenario_id: number
  card_id: number
  card_name: string | null
  start_date: string | null
  end_date: string | null
  years_counted: number
}

export interface Scenario {
  id: number
  name: string
  description: string | null
  as_of_date: string | null
  scenario_cards: ScenarioCard[]
}

export interface ScenarioResult {
  scenario_id: number
  scenario_name: string
  as_of_date: string | null
  wallet: WalletResult
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export const cardsApi = {
  list: () => request<Card[]>('/cards'),
  get: (id: number) => request<Card>(`/cards/${id}`),
  update: (id: number, data: Partial<Card>) =>
    request<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ─── Spend categories ─────────────────────────────────────────────────────────

export const spendApi = {
  list: () => request<SpendCategory[]>('/spend'),
  update: (category: string, annual_spend: number) =>
    request<SpendCategory>(`/spend/${encodeURIComponent(category)}`, {
      method: 'PUT',
      body: JSON.stringify({ annual_spend }),
    }),
}

// ─── Calculation ──────────────────────────────────────────────────────────────

export interface CalculateRequest {
  years_counted: number
  selected_card_ids: number[]
  spend_overrides: Record<string, number>
}

export const calcApi = {
  calculate: (payload: CalculateRequest) =>
    request<WalletResult>('/calculate', { method: 'POST', body: JSON.stringify(payload) }),
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export interface CreateScenarioPayload {
  name: string
  description?: string
  as_of_date?: string
  cards?: { card_id: number; start_date?: string; end_date?: string; years_counted?: number }[]
}

export interface AddCardToScenarioPayload {
  card_id: number
  start_date?: string
  end_date?: string
  years_counted?: number
}

export const scenariosApi = {
  list: () => request<Scenario[]>('/scenarios'),
  get: (id: number) => request<Scenario>(`/scenarios/${id}`),
  create: (payload: CreateScenarioPayload) =>
    request<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<CreateScenarioPayload>) =>
    request<Scenario>(`/scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id: number) => request<void>(`/scenarios/${id}`, { method: 'DELETE' }),
  addCard: (scenarioId: number, payload: AddCardToScenarioPayload) =>
    request<ScenarioCard>(`/scenarios/${scenarioId}/cards`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeCard: (scenarioId: number, cardId: number) =>
    request<void>(`/scenarios/${scenarioId}/cards/${cardId}`, { method: 'DELETE' }),
  results: (id: number, referenceDate?: string) => {
    const qs = referenceDate ? `?reference_date=${referenceDate}` : ''
    return request<ScenarioResult>(`/scenarios/${id}/results${qs}`)
  },
}
