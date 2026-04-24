import type { CardResult } from '../api/client'

/** Per-card per-active-year earn (for single-card display).
 *
 * Pairs `annual_point_earn` (active-year basis — earn averaged over the
 * card's own open window) with `card_sub_eaf_contribution` (also active-year
 * basis) so the display stays consistent. Use for showing the card's own
 * earning pace, not for summing across cards.
 */
export function cardAnnualPointIncomeActive(
  c: CardResult | null | undefined,
  includeSubs: boolean,
): number | null {
  if (!c) return null
  if (!includeSubs) return c.annual_point_earn
  const subDollars = c.card_sub_eaf_contribution ?? 0
  if (!subDollars || !c.cents_per_point) return c.annual_point_earn
  return c.annual_point_earn + (subDollars * 100) / c.cents_per_point
}

/** Per-card window-basis earn (for wallet/currency-group aggregation).
 *
 * Uses `annual_point_earn_window` (= total_card_earn / wallet_window_years)
 * with `sub_eaf_contribution` (also wallet-year basis). Summing this across
 * cards gives the wallet's rate over its own window — summing the active-year
 * flavor would inflate the total because cards active for only part of the
 * window would each contribute their peak rate.
 */
export function cardAnnualPointIncomeWindow(
  c: CardResult | null | undefined,
  includeSubs: boolean,
): number | null {
  if (!c) return null
  const base = c.annual_point_earn_window ?? c.annual_point_earn
  if (!includeSubs) return base
  const subDollars = c.sub_eaf_contribution ?? 0
  if (!subDollars || !c.cents_per_point) return base
  return base + (subDollars * 100) / c.cents_per_point
}

/** Per-card earn scaled to a currency's own window (for per-currency-group
 * aggregation).
 *
 * - Recurring earn is rescaled from wallet-year basis to currency-year basis
 *   (wallet_window_years / currency_window_years). So a currency with a
 *   1.65-year active window surfaces the actual earning pace during that
 *   window, not a rate diluted across the full wallet window.
 * - One-time SUBs are kept on wallet-year basis when `includeSubs` is on.
 *   Scaling SUBs over a shorter currency window would inflate them by the
 *   same factor as recurring earn, which isn't what "Include SUBs" means —
 *   the toggle amortizes the SUB across the projection, not across the
 *   currency window in particular.
 */
export function cardAnnualPointIncomeCurrencyWindow(
  c: CardResult | null | undefined,
  includeSubs: boolean,
  walletWindowYears: number | undefined,
  currencyWindowYears: number | undefined,
): number | null {
  if (!c) return null
  const recurring = c.annual_point_earn_window ?? c.annual_point_earn
  const scale =
    walletWindowYears && currencyWindowYears && currencyWindowYears > 0
      ? walletWindowYears / currencyWindowYears
      : 1
  const scaledRecurring = recurring * scale
  if (!includeSubs) return scaledRecurring
  const subDollars = c.sub_eaf_contribution ?? 0
  if (!subDollars || !c.cents_per_point) return scaledRecurring
  const subPts = (subDollars * 100) / c.cents_per_point
  return scaledRecurring + subPts
}

/** Per-card active-year EAF (for single-card display).
 *
 * Uses `card_effective_annual_fee` (= total_card_net / card_active_years).
 * When `includeSubs` is off, the SUB-contribution portion of EAF
 * (`card_sub_eaf_contribution`, also active-year basis) is added back
 * so the displayed EAF reflects the toggle.
 */
export function cardEafActive(
  c: CardResult | null | undefined,
  includeSubs: boolean,
): number | null {
  if (!c) return null
  const base = c.card_effective_annual_fee ?? 0
  return includeSubs ? base : base + (c.card_sub_eaf_contribution ?? 0)
}

/** Per-card window-basis EAF (for wallet/currency-group aggregation).
 *
 * Uses `effective_annual_fee` (= total_card_net / wallet_window_years).
 * Summing this across cards yields the wallet's EAF over its window.
 * Summing the active-year flavor would inflate the magnitude because cards
 * active for only part of the window contribute their peak per-active-year
 * rate instead of their prorated share of the window.
 */
export function cardEafWindow(
  c: CardResult | null | undefined,
  includeSubs: boolean,
): number | null {
  if (!c) return null
  const base = c.effective_annual_fee ?? 0
  return includeSubs ? base : base + (c.sub_eaf_contribution ?? 0)
}
