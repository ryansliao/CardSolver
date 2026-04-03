import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { CardResult, WalletResult } from '../../../../api/client'
import { walletCppApi, walletsApi } from '../../../../api/client'
import { formatCashRewardUnits, formatMoney, formatPoints } from '../../../../utils/format'
import { queryKeys } from '../../lib/queryKeys'
import { CurrencySettingsModal } from '../summary/CurrencySettingsModal'

interface Props {
  walletId: number | null
  result: WalletResult | null
  resultsError: Error | null
  onCppChangeClearResult: () => void
}

export function WalletResultsAndCurrenciesPanel({
  walletId,
  result,
  resultsError,
  onCppChangeClearResult,
}: Props) {
  const [editingCurrencyId, setEditingCurrencyId] = useState<number | null>(null)

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery({
    queryKey: queryKeys.walletCurrencies(walletId),
    queryFn: () => walletCppApi.listCurrencies(walletId!),
    enabled: walletId != null,
  })

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: queryKeys.walletCurrencyBalances(walletId),
    queryFn: () => walletsApi.listCurrencyBalances(walletId!),
    enabled: walletId != null,
  })

  const sortedBalances = useMemo(
    () =>
      [...balances].sort(
        (a, b) => b.balance - a.balance || a.currency_name.localeCompare(b.currency_name)
      ),
    [balances]
  )

  const cppForName = (name: string) => {
    const c = currencies.find((x) => x.name === name)
    return c ? c.user_cents_per_point ?? c.cents_per_point : 1
  }

  const rewardKindForName = (name: string): 'points' | 'cash' => {
    const c = currencies.find((x) => x.name === name)
    return (c?.reward_kind ?? 'points') === 'cash' ? 'cash' : 'points'
  }

  const selectedCards = result?.card_results.filter((c) => c.selected) ?? []
  const totalAnnualFees = selectedCards.reduce((s, c) => s + c.annual_fee, 0)
  const totalEffectiveAF = selectedCards.reduce((s, c) => s + c.effective_annual_fee, 0)

  const cardsByCurrency = useMemo(() => {
    if (!result) return {} as Record<string, CardResult[]>
    return result.card_results
      .filter((c) => c.selected)
      .reduce(
        (acc, card) => {
          const cur = card.effective_currency_name
          acc[cur] = [...(acc[cur] ?? []), card]
          return acc
        },
        {} as Record<string, CardResult[]>
      )
  }, [result])

  const editingBalance = balances.find((b) => b.currency_id === editingCurrencyId) ?? null
  const editingCurrency = currencies.find((c) => c.id === editingCurrencyId) ?? null

  const isLoading = currenciesLoading || (walletId != null && balancesLoading)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-w-0 flex flex-col max-h-[min(72vh,820px)]">
      <h2 className="text-sm font-semibold text-slate-200 shrink-0 mb-3">Wallet Summary</h2>

      {walletId == null ? (
        <div className="text-slate-500 text-sm py-4">Select a wallet.</div>
      ) : (
        <>
          {/* Top stats */}
          <div className="shrink-0 space-y-3 pb-4 border-b border-slate-600">
            {resultsError && (
              <div className="text-red-400 text-sm bg-red-950 border border-red-700 rounded-lg p-3">
                {resultsError.message}
              </div>
            )}
            {result ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-900/40 border border-indigo-700 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-wider">Effective Annual Fee</p>
                  <p className="text-xl font-bold text-indigo-100 mt-0.5">{formatMoney(totalEffectiveAF)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Annual Fees</p>
                  <p className="text-xl font-bold text-white mt-0.5">{formatMoney(totalAnnualFees)}</p>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center py-2">
                Click <span className="text-slate-400">Calculate</span> for effective annual fee (credits, SUB and
                fees amortised over your projection, and modeled earn at your CPP).
              </div>
            )}
          </div>

          {/* Currencies + Cards combined */}
          {isLoading ? (
            <div className="text-slate-500 text-sm py-4">Loading…</div>
          ) : (
            <>
              <ul className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-0.5 -mr-0.5 pt-4">
                {sortedBalances.map((b) => {
                  const cpp = cppForName(b.currency_name)
                  const rk = rewardKindForName(b.currency_name)
                  const isCash = rk === 'cash'
                  const estValue = b.balance > 0 ? (b.balance * cpp) / 100 : 0
                  const cards = cardsByCurrency[b.currency_name] ?? []
                  const currencyAnnualPoints = cards.reduce((s, c) => s + c.annual_point_earn, 0)
                  const currencyAnnualCashDollars = cards.reduce(
                    (s, c) => s + (c.annual_point_earn * c.cents_per_point) / 100,
                    0
                  )
                  const hasResultData = result != null && cards.length > 0

                  return (
                    <li key={b.id} className="bg-slate-800/80 rounded-lg overflow-hidden">
                      {/* Currency header row */}
                      <div className="px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-sm font-semibold text-white truncate"
                            title={b.currency_name}
                          >
                            {b.currency_name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-slate-300 tabular-nums">
                              {isCash
                                ? formatCashRewardUnits(b.balance, cpp)
                                : `${formatPoints(b.balance)} pts`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingCurrencyId(b.currency_id)}
                              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                              aria-label="Edit currency"
                              title="Edit"
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {hasResultData ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                            <span>
                              {isCash ? 'Annual cash back: ' : 'Annual pts earn: '}
                              <span className="text-slate-200 tabular-nums">
                                {isCash
                                  ? formatMoney(currencyAnnualCashDollars)
                                  : formatPoints(currencyAnnualPoints)}
                              </span>
                            </span>
                          </div>
                        ) : !isCash && estValue > 0 ? (
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            ≈ {formatMoney(estValue)}
                          </div>
                        ) : isCash && estValue > 0 ? (
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            {formatMoney(estValue)} face value
                          </div>
                        ) : null}
                      </div>

                      {/* Nested card rows */}
                      {cards.length > 0 && (
                        <div className="border-t border-slate-700/60">
                          {cards.map((card, idx) => {
                            const cardEffectiveAF = card.effective_annual_fee
                            const isLast = idx === cards.length - 1
                            const cardIsCash = (card.effective_reward_kind ?? 'points') === 'cash'
                            const annualEarnLabel = cardIsCash
                              ? `${formatMoney((card.annual_point_earn * card.cents_per_point) / 100)} cash back`
                              : `${formatPoints(card.annual_point_earn)} pts`
                            return (
                              <div
                                key={card.card_id}
                                className={`px-3 py-1.5 flex items-center justify-between gap-2 bg-slate-900/40 ${!isLast ? 'border-b border-slate-700/40' : ''}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="text-sm font-medium text-slate-200 truncate"
                                    title={card.card_name}
                                  >
                                    {card.card_name}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {annualEarnLabel} · {formatMoney(card.credit_valuation)} credits
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p
                                    className={`text-sm font-semibold tabular-nums ${cardEffectiveAF <= 0 ? 'text-emerald-400' : 'text-slate-200'}`}
                                  >
                                    {formatMoney(cardEffectiveAF)}
                                  </p>
                                  <p className="text-xs text-slate-500">Eff. Annual Fee</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {sortedBalances.length === 0 && (
                <p className="text-slate-500 text-xs pt-4">
                  Add a card that earns a currency to see it here.
                </p>
              )}
            </>
          )}
        </>
      )}

      {editingCurrencyId != null && editingCurrency != null && (
        <CurrencySettingsModal
          walletId={walletId}
          currency={editingCurrency}
          balance={editingBalance}
          onClose={() => setEditingCurrencyId(null)}
          onCppChange={() => {
            onCppChangeClearResult()
          }}
        />
      )}
    </div>
  )
}
