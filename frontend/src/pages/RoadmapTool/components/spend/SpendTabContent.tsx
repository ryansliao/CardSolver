import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CardResult, UserSpendCategory, WalletCard } from '../../../../api/client'
import { walletSpendItemsApi } from '../../../../api/client'
import { ModalBackdrop } from '../../../../components/ModalBackdrop'
import { formatMoneyExact, formatPointsExact } from '../../../../utils/format'
import { queryKeys } from '../../../../lib/queryKeys'

interface Props {
  walletId: number | null
  selectedCards: CardResult[]
  walletCards: WalletCard[]
  isTotal: boolean
  totalYears: number
}

function CardPhoto({ slug, name }: { slug: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!slug || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      </div>
    )
  }
  return (
    <img
      src={`/photos/${slug}.png`}
      alt={name}
      title={name}
      className="w-full h-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export function SpendTabContent({
  walletId,
  selectedCards,
  walletCards,
  isTotal,
  totalYears,
}: Props) {
  const { data: spendItems = [], isLoading } = useQuery({
    queryKey: queryKeys.walletSpendItems(walletId),
    queryFn: () => walletSpendItemsApi.list(walletId!),
    enabled: walletId != null,
  })

  // View mode toggle: per-card (cycle through cards, show earn) vs
  // top-ros (highest return-on-spend card in each category).
  const [viewMode, setViewMode] = useState<'per-card' | 'top-ros'>('top-ros')
  const [includeClosed, setIncludeClosed] = useState(false)
  const [infoCategory, setInfoCategory] = useState<UserSpendCategory | null>(null)

  // Closed / product-changed-away-from cards; matches CardsListPanel dimming.
  const excludedCardIds = useMemo(() => {
    const ids = new Set<number>()
    for (const wc of walletCards) {
      if (wc.panel !== 'in_wallet' && wc.panel !== 'future_cards') continue
      if (wc.closed_date) ids.add(wc.card_id)
    }
    for (const pcCard of walletCards) {
      if (pcCard.acquisition_type !== 'product_change' || pcCard.panel !== 'future_cards') continue
      if (pcCard.pc_from_card_id != null) {
        ids.add(pcCard.pc_from_card_id)
      } else {
        for (const c of walletCards) {
          if (c.product_changed_date && c.product_changed_date === pcCard.added_date) {
            ids.add(c.card_id)
          }
        }
      }
    }
    return ids
  }, [walletCards])

  const topRosCards = useMemo(
    () =>
      includeClosed
        ? selectedCards
        : selectedCards.filter((c) => !excludedCardIds.has(c.card_id)),
    [includeClosed, selectedCards, excludedCardIds]
  )

  // Cycling through cards in the third column. Index is clamped to the
  // current card list so removing a card doesn't leave a stale index.
  const [cardCursor, setCardCursor] = useState(0)
  const cardCount = selectedCards.length
  const safeCardIndex = cardCount > 0 ? cardCursor % cardCount : 0
  const currentCard = cardCount > 0 ? selectedCards[safeCardIndex] : null

  function cycleCard(delta: number) {
    if (cardCount === 0) return
    setCardCursor((c) => (c + delta + cardCount) % cardCount)
  }

  function getMultForCard(card: CardResult, catName: string): number {
    const mults = card.category_multipliers ?? {}
    const lower = catName.trim().toLowerCase()
    let allOther = 1.0
    for (const [k, v] of Object.entries(mults)) {
      const kl = k.trim().toLowerCase()
      if (kl === lower) return v
      if (kl === 'all other') allOther = v
    }
    return allOther
  }

  function getRosForCard(card: CardResult, catName: string): number {
    // Return on spend, expressed as a percentage: multiplier × effective CPP.
    // e.g. 3x at 2¢/pt → 6 (i.e. 6% back).
    return getMultForCard(card, catName) * card.cents_per_point
  }

  function topCardsForCategory(catName: string): { cards: CardResult[]; ros: number } {
    if (topRosCards.length === 0) return { cards: [], ros: 0 }
    let best = -Infinity
    let bestCards: CardResult[] = []
    for (const card of topRosCards) {
      const r = getRosForCard(card, catName)
      if (r > best + 1e-9) {
        best = r
        bestCards = [card]
      } else if (Math.abs(r - best) <= 1e-9) {
        bestCards.push(card)
      }
    }
    return { cards: bestCards, ros: best }
  }

  function formatRos(ros: number): string {
    if (Number.isInteger(ros)) return `${ros}%`
    return `${ros.toFixed(2).replace(/\.?0+$/, '')}%`
  }

  // Build a category × card lookup of points (in raw effective-currency units, per-year).
  // The backend returns category_earn keyed by spend-category name; we match by name.
  const earnByCategoryByCard = useMemo(() => {
    const map = new Map<string, Map<number, number>>()
    for (const card of selectedCards) {
      for (const item of card.category_earn) {
        if (!map.has(item.category)) map.set(item.category, new Map())
        map.get(item.category)!.set(card.card_id, item.points)
      }
    }
    return map
  }, [selectedCards])

  function formatCardEarn(card: CardResult, points: number): string {
    const cardYears = card.card_active_years || totalYears
    const adjusted = isTotal ? points * totalYears : points * totalYears / cardYears
    if ((card.effective_reward_kind ?? 'points') === 'cash') {
      return formatMoneyExact((adjusted * card.cents_per_point) / 100)
    }
    return formatPointsExact(adjusted)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 pt-3">
      <div className="shrink-0 flex items-center justify-between gap-3 mb-2">
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setViewMode('top-ros')}
            className={`px-2.5 py-1 transition-colors ${
              viewMode === 'top-ros'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Top ROS
          </button>
          <button
            type="button"
            onClick={() => setViewMode('per-card')}
            className={`px-2.5 py-1 border-l border-slate-700 transition-colors ${
              viewMode === 'per-card'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Per-Card Earn
          </button>
        </div>
        {viewMode === 'top-ros' && (
          <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <span>Include Closed Cards</span>
            <button
              type="button"
              role="switch"
              aria-checked={includeClosed}
              onClick={() => setIncludeClosed((v) => !v)}
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                includeClosed ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  includeClosed ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        )}
      </div>
      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col />
              <col className="w-30" />
              <col className={viewMode === 'top-ros' ? 'w-36' : 'w-56'} />
              {viewMode === 'top-ros' && <col className="w-20" />}
            </colgroup>
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr>
                <th className="text-left text-sm font-semibold text-slate-300 px-3 py-2.5 border-b border-r border-slate-800">
                  Category
                </th>
                <th className="text-center text-sm font-semibold text-slate-300 px-3 py-2.5 border-b border-r border-slate-800 whitespace-nowrap">
                  Annual Spend
                </th>
                <th className="text-center text-sm font-semibold text-slate-300 px-3 py-2.5 border-b border-slate-800">
                  {viewMode === 'per-card' ? (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => cycleCard(-1)}
                        disabled={cardCount < 2}
                        className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
                        aria-label="Previous card"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0 flex items-center justify-center">
                        <div className="w-[72px] h-11 shrink-0 rounded overflow-hidden bg-slate-700/50">
                          <CardPhoto
                            slug={currentCard?.photo_slug ?? null}
                            name={currentCard?.card_name ?? 'Card'}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => cycleCard(1)}
                        disabled={cardCount < 2}
                        className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
                        aria-label="Next card"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span>Top ROS Card</span>
                  )}
                </th>
                {viewMode === 'top-ros' && (
                  <th className="text-center text-sm font-semibold text-slate-300 px-3 py-2.5 border-b border-l border-slate-800 whitespace-nowrap">
                    ROS
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Total row */}
              <tr className="border-b-2 border-slate-700 bg-slate-800/50">
                <td className="text-left px-3 py-2 text-slate-100 font-semibold border-r border-slate-800/60">
                  Total
                </td>
                <td className="text-center px-2 py-2 tabular-nums border-r border-slate-800/60">
                  <div className="text-slate-100 font-semibold">
                    ${spendItems.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                  </div>
                </td>
                <td className="text-center px-3 py-2 text-slate-500" colSpan={viewMode === 'top-ros' ? 2 : 1}>
                  —
                </td>
              </tr>
              {spendItems.map((item) => {
                const catName = item.user_spend_category?.name ?? 'Unknown'
                const earnRow = earnByCategoryByCard.get(catName)
                return (
                  <tr key={item.id} className="border-b border-slate-800/60">
                    <td className="text-left px-3 py-2 text-slate-200 border-r border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={catName}>
                          {catName}
                        </span>
                        {item.user_spend_category && item.user_spend_category.mappings.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setInfoCategory(item.user_spend_category)}
                            className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
                            title="View category details"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4" />
                              <path d="M12 8h.01" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 tabular-nums border-r border-slate-800/60">
                      <span className="text-slate-200">
                        ${item.amount === 0 ? '0' : Math.round(item.amount).toLocaleString()}
                      </span>
                    </td>
                    {viewMode === 'per-card' ? (
                      <td className="text-center tabular-nums px-3 py-2 text-slate-200">
                        {currentCard ? (
                          (() => {
                            const pts = earnRow?.get(currentCard.card_id) ?? 0
                            return pts > 0 ? (
                              formatCardEarn(currentCard, pts)
                            ) : (
                              <span className="text-slate-700">—</span>
                            )
                          })()
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    ) : (
                      (() => {
                        const top = topCardsForCategory(catName)
                        const noTop = top.cards.length === 0 || top.ros <= 0
                        return (
                          <>
                            <td className="text-center px-3 py-2 text-slate-200">
                              {noTop ? (
                                <span className="text-slate-700">—</span>
                              ) : (
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                  {top.cards.map((c) => (
                                    <div
                                      key={c.card_id}
                                      className="w-[72px] h-11 shrink-0 rounded overflow-hidden bg-slate-700/50"
                                    >
                                      <CardPhoto slug={c.photo_slug} name={c.card_name} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="text-center tabular-nums px-3 py-2 border-l border-slate-800/60">
                              {noTop ? (
                                <span className="text-slate-700">—</span>
                              ) : (
                                <span className="font-semibold text-indigo-300">
                                  {formatRos(top.ros)}
                                </span>
                              )}
                            </td>
                          </>
                        )
                      })()
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Category Info Modal */}
      {infoCategory && (
        <ModalBackdrop onClose={() => setInfoCategory(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{infoCategory.name}</h3>
                {infoCategory.description && (
                  <p className="text-sm text-slate-400 mt-1">{infoCategory.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInfoCategory(null)}
                className="shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Includes spend on:</h4>
              <ul className="space-y-2">
                {infoCategory.mappings
                  .sort((a, b) => b.default_weight - a.default_weight)
                  .map((mapping) => (
                    <li key={mapping.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">{mapping.earn_category.category}</span>
                      <span className="text-slate-500 tabular-nums">
                        {Math.round(mapping.default_weight * 100)}%
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}
