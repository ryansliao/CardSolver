import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { CardResult, WalletResult } from '../../../../api/client'
import { walletCppApi, walletsApi } from '../../../../api/client'
import { formatCashRewardUnits, formatMoney, formatPoints } from '../../../../utils/format'
import { queryKeys } from '../../lib/queryKeys'
import { CurrencySettingsModal } from '../summary/CurrencySettingsModal'
import { SpendTabContent } from '../spend/SpendTabContent'

type WalletSummaryTab = 'summary' | 'spend'

function formatDuration(years: number, months: number): string {
  const total = years * 12 + months
  const y = Math.floor(total / 12)
  const m = total % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr`
  return `${y} yr ${m} mo`
}

interface LabeledToggleProps {
  leftLabel: string
  rightLabel: string
  isRight: boolean
  onToggle: () => void
  activeColor: 'emerald' | 'indigo'
  ariaLabel: string
  title?: string
}

function LabeledToggle({
  leftLabel,
  rightLabel,
  isRight,
  onToggle,
  activeColor,
  ariaLabel,
  title,
}: LabeledToggleProps) {
  const activeText = activeColor === 'emerald' ? 'text-emerald-300' : 'text-indigo-300'
  const knobColor = activeColor === 'emerald' ? 'bg-emerald-400' : 'bg-indigo-400'
  return (
    <div className="flex items-center gap-1.5 text-xs select-none" title={title}>
      <span className={!isRight ? `${activeText} font-medium` : 'text-slate-500'}>
        {leftLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={ariaLabel}
        onClick={onToggle}
        className="relative w-8 h-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full ${knobColor} transition-transform ${
            isRight ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={isRight ? `${activeText} font-medium` : 'text-slate-500'}>
        {rightLabel}
      </span>
    </div>
  )
}

interface Props {
  walletId: number | null
  result: WalletResult | null
  resultsError: Error | null
  isCalculating: boolean
  durationYears: number
  durationMonths: number
  onDurationChange: (years: number, months: number) => void
  onDurationCommit: (years: number, months: number) => void
  onCppChange: () => void
  onSpendChange: () => void
}

export function WalletResultsAndCurrenciesPanel({
  walletId,
  result,
  resultsError,
  isCalculating,
  durationYears,
  durationMonths,
  onDurationChange,
  onDurationCommit,
  onCppChange,
  onSpendChange,
}: Props) {
  const [editingCurrencyId, setEditingCurrencyId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<WalletSummaryTab>('summary')
  const [showDurationSlider, setShowDurationSlider] = useState(false)
  const [includeSubs, setIncludeSubs] = useState(true)
  const [calcMode, setCalcMode] = useState<'annual' | 'total'>('annual')

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

  const totalYears = Math.max(durationYears + durationMonths / 12, 1 / 12)
  const isTotal = calcMode === 'total'
  // Multipliers convert calculator outputs to the requested mode.
  // - effective_annual_fee and annual_fee are per-year → ×totalYears for Total
  // - total_points is already total over the duration → ÷totalYears for Annual
  const feeMultiplier = isTotal ? totalYears : 1
  const pointsMultiplier = isTotal ? 1 : 1 / totalYears
  const subDollarsAnnualized = (c: CardResult) =>
    ((c.sub + c.sub_spend_earn) * c.cents_per_point) / 100 / totalYears
  const adjustedEffectiveAF = (c: CardResult) =>
    (c.effective_annual_fee + (includeSubs ? 0 : subDollarsAnnualized(c))) * feeMultiplier
  const adjustedCardPoints = (c: CardResult) => {
    const subPts = includeSubs ? 0 : c.sub + c.sub_spend_earn
    return (c.total_points - subPts) * pointsMultiplier
  }

  const selectedCards = result?.card_results.filter((c) => c.selected) ?? []
  const totalAnnualFees = selectedCards.reduce((s, c) => s + c.annual_fee * feeMultiplier, 0)
  const totalEffectiveAF = selectedCards.reduce((s, c) => s + adjustedEffectiveAF(c), 0)
  const totalWalletPoints = selectedCards.reduce((s, c) => s + adjustedCardPoints(c), 0)

  const eafLabel = isTotal ? 'Total Expected Value' : 'Effective Annual Fee'
  const totalEafDisplay = isTotal ? -totalEffectiveAF : totalEffectiveAF
  const pointsLabel = isTotal ? 'Total Points' : 'Annual Points'
  const feesLabel = isTotal ? 'Total Fees' : 'Total Annual Fees'
  const cardEafLabel = isTotal ? 'Eff. Total Fee' : 'Eff. Annual Fee'

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
    <div className="flex h-full min-w-0 min-h-0 items-stretch">
      {/* Binder-style icon tabs sitting outside the panel on the left, near the top */}
      {walletId != null && (
        <div className="shrink-0 flex flex-col gap-1 pt-6 z-10">
          {([
            {
              key: 'summary' as const,
              label: 'Summary',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="9" rx="1" />
                  <rect x="14" y="3" width="7" height="5" rx="1" />
                  <rect x="14" y="12" width="7" height="9" rx="1" />
                  <rect x="3" y="16" width="7" height="5" rx="1" />
                </svg>
              ),
            },
            {
              key: 'spend' as const,
              label: 'Spend',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              ),
            },
          ]).map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`p-2 rounded-l-md border border-r-0 transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-indigo-300 border-slate-700 -mr-px'
                    : 'bg-slate-800/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
                aria-pressed={isActive}
                aria-label={tab.label}
                title={tab.label}
              >
                {tab.icon}
              </button>
            )
          })}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-w-0 min-h-0 flex-1 flex flex-col overflow-hidden">
      {/* h-7 keeps this header the same height as the Cards panel header so the
          top of the summary statistics row lines up with the top of the In Wallet panel. */}
      <div className="shrink-0 h-7 flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Wallet Summary</h2>
        {walletId != null && (
          <div className="flex items-center gap-6">
            <LabeledToggle
              leftLabel="SUBs"
              rightLabel="No SUBs"
              isRight={!includeSubs}
              onToggle={() => setIncludeSubs((v) => !v)}
              activeColor="emerald"
              ariaLabel="Toggle SUB inclusion"
              title={includeSubs ? 'SUBs included in totals' : 'SUBs excluded from totals'}
            />
            <LabeledToggle
              leftLabel="Annual"
              rightLabel="Total"
              isRight={isTotal}
              onToggle={() => setCalcMode((m) => (m === 'annual' ? 'total' : 'annual'))}
              activeColor="indigo"
              ariaLabel="Toggle annual vs total"
              title={isTotal ? `Showing totals over ${formatDuration(durationYears, durationMonths)}` : 'Showing per-year values'}
            />
            <button
              type="button"
              onClick={() => setShowDurationSlider((v) => !v)}
              className={`p-1 rounded transition-colors ${showDurationSlider ? 'text-indigo-400 bg-slate-700' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'}`}
              title="Duration"
              aria-label="Toggle duration setting"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <circle cx="8" cy="6" r="2.5" fill="currentColor" stroke="none"/>
                <line x1="4" y1="12" x2="20" y2="12"/>
                <circle cx="16" cy="12" r="2.5" fill="currentColor" stroke="none"/>
                <line x1="4" y1="18" x2="20" y2="18"/>
                <circle cx="10" cy="18" r="2.5" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      {showDurationSlider && walletId != null && (
        <div className="shrink-0 mb-3 px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Duration</span>
            <span className="text-xs font-medium text-slate-200 tabular-nums">
              {formatDuration(durationYears, durationMonths)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={durationYears * 12 + durationMonths}
            onChange={(e) => {
              const total = Number(e.target.value)
              onDurationChange(Math.floor(total / 12), total % 12)
            }}
            onMouseUp={(e) => {
              const total = Number((e.target as HTMLInputElement).value)
              onDurationCommit(Math.floor(total / 12), total % 12)
            }}
            onTouchEnd={(e) => {
              const total = Number((e.target as HTMLInputElement).value)
              onDurationCommit(Math.floor(total / 12), total % 12)
            }}
            className="w-full h-1.5 accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>1 mo</span>
            <span>1 yr</span>
            <span>2 yr</span>
            <span>3 yr</span>
            <span>4 yr</span>
            <span>5 yr</span>
          </div>
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-y-auto pr-0.5 -mr-0.5">
        {walletId == null ? (
          <div className="text-slate-500 text-sm py-4">Select a wallet.</div>
        ) : (
          <>
            {/* Top stats */}
            <div className="space-y-3">
              {resultsError && (
                <div className="text-red-400 text-sm bg-red-950 border border-red-700 rounded-lg p-3">
                  {resultsError.message}
                </div>
              )}
              {result ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-indigo-900/40 border border-indigo-700 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-indigo-300 uppercase tracking-wider">{eafLabel}</p>
                    <p className="text-xl font-bold text-indigo-100 mt-0.5">{formatMoney(totalEafDisplay)}</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{pointsLabel}</p>
                    <p className="text-xl font-bold text-white mt-0.5">{formatPoints(Math.round(totalWalletPoints))}</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{feesLabel}</p>
                    <p className="text-xl font-bold text-white mt-0.5">{formatMoney(totalAnnualFees)}</p>
                  </div>
                </div>
              ) : isCalculating ? (
                <div className="text-slate-500 text-xs text-center py-2">Calculating…</div>
              ) : (
                <div className="text-slate-500 text-xs text-center py-2">
                  Add cards to see effective annual fee (credits, SUB and fees amortised over your projection).
                </div>
              )}
            </div>

            {/* Currencies + Cards combined (Summary tab) */}
            {activeTab === 'summary' && isLoading ? (
              <div className="flex flex-1 min-h-0 items-center justify-center text-slate-500 text-sm">
                Loading…
              </div>
            ) : activeTab === 'summary' ? (
              <div className="flex flex-col flex-1 min-h-0 pt-3">
                <ul className="space-y-2">
                  {sortedBalances.map((b) => {
                  const cpp = cppForName(b.currency_name)
                  const rk = rewardKindForName(b.currency_name)
                  const isCash = rk === 'cash'
                  const estValue = b.balance > 0 ? (b.balance * cpp) / 100 : 0
                  const cards = cardsByCurrency[b.currency_name] ?? []
                  // Initial balance is a one-time, static amount; scale it the
                  // same way as projection earn so the header total stays
                  // consistent across the Annual/Total toggle
                  // (Total = initial + projected; Annual = (initial + projected) / years).
                  const initialBalanceScaled = b.initial_balance * pointsMultiplier
                  const currencyTotalPoints =
                    cards.reduce((s, c) => s + adjustedCardPoints(c), 0) + initialBalanceScaled
                  const currencyTotalCashDollars =
                    cards.reduce(
                      (s, c) => s + (adjustedCardPoints(c) * c.cents_per_point) / 100,
                      0
                    ) + (initialBalanceScaled * cpp) / 100
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
                              {hasResultData
                                ? isCash
                                  ? formatMoney(currencyTotalCashDollars)
                                  : `${formatPoints(Math.round(currencyTotalPoints))} Pts`
                                : isCash
                                  ? formatCashRewardUnits(b.balance, cpp)
                                  : `${formatPoints(b.balance)} Pts`}
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
                        {!hasResultData && !isCash && estValue > 0 ? (
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            ≈ {formatMoney(estValue)}
                          </div>
                        ) : !hasResultData && isCash && estValue > 0 ? (
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            {formatMoney(estValue)} face value
                          </div>
                        ) : null}
                      </div>

                      {/* Nested card rows */}
                      {cards.length > 0 && (
                        <div className="border-t border-slate-700/60">
                          {cards.map((card, idx) => {
                            const cardEffectiveAF = adjustedEffectiveAF(card)
                            const isLast = idx === cards.length - 1
                            const cardIsCash = (card.effective_reward_kind ?? 'points') === 'cash'
                            const cardTotalPts = adjustedCardPoints(card)
                            const totalEarnNumber = cardIsCash
                              ? formatMoney((cardTotalPts * card.cents_per_point) / 100)
                              : formatPoints(Math.round(cardTotalPts))
                            const totalEarnUnit = cardIsCash ? 'Cash' : 'Pts'
                            return (
                              <div
                                key={card.card_id}
                                className={`bg-slate-900/40 ${!isLast ? 'border-b border-slate-700/40' : ''}`}
                              >
                                {/* Card header row */}
                                <div className="px-3 py-1.5 flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className="text-sm font-medium text-slate-200 truncate"
                                      title={card.card_name}
                                    >
                                      {card.card_name}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {totalEarnNumber} {totalEarnUnit}
                                      {card.credit_valuation !== 0 && (
                                        <span className="text-slate-600 mx-1">·</span>
                                      )}
                                      {card.credit_valuation !== 0 && (
                                        <span>{formatMoney(card.credit_valuation)} Credit Value</span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p
                                      className={`text-sm font-semibold tabular-nums ${cardEffectiveAF <= 0 ? 'text-emerald-400' : 'text-slate-200'}`}
                                    >
                                      {formatMoney(cardEffectiveAF)}
                                    </p>
                                    <p className="text-xs text-slate-500">{cardEafLabel}</p>
                                  </div>
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
                  <p className="text-slate-500 text-xs pt-3">
                    Add a card that earns a currency to see it here.
                  </p>
                )}
              </div>
            ) : null}

            {/* Spend tab content */}
            {activeTab === 'spend' && (
              <SpendTabContent
                walletId={walletId}
                selectedCards={selectedCards}
                isTotal={isTotal}
                totalYears={totalYears}
                onSpendChange={onSpendChange}
              />
            )}

          </>
        )}
      </div>

      </div>

      {editingCurrencyId != null && editingCurrency != null && (
        <CurrencySettingsModal
          walletId={walletId}
          currency={editingCurrency}
          balance={editingBalance}
          onClose={() => setEditingCurrencyId(null)}
          onCppChange={() => {
            onCppChange()
          }}
        />
      )}

    </div>
  )
}
