import type { ReactElement } from 'react'
import type {
  RoadmapCardStatus,
  RoadmapResponse,
  UpdateWalletCardPayload,
  Wallet,
  WalletCard,
} from '../../../../api/client'
import { today } from '../../../../utils/format'

function SubStatusBadge({ status, daysRemaining }: { status: string; daysRemaining: number | null }) {
  if (status === 'earned') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
        SUB Earned
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50">
        {daysRemaining != null ? `SUB: ${daysRemaining}d left` : 'SUB Pending'}
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/50">
        SUB Expired
      </span>
    )
  }
  // 'no_sub' and any unknown status: render nothing
  return null
}

interface Props {
  wallet: Wallet
  roadmap: RoadmapResponse | undefined
  markEarnedCardId: number | null
  earnedDateInput: string
  closeCardId: number | null
  closeDateInput: string
  isUpdating: boolean
  isRemoving: boolean
  onSetMarkEarned: (cardId: number | null) => void
  onSetEarnedDateInput: (v: string) => void
  onSetCloseCard: (cardId: number | null) => void
  onSetCloseDateInput: (v: string) => void
  onUpdateCard: (cardId: number, payload: UpdateWalletCardPayload) => void
  onRemoveCard: (cardId: number) => void
  onEditCard: (wc: WalletCard) => void
  onAddCard: () => void
}

export function CardsListPanel({
  wallet,
  roadmap,
  markEarnedCardId,
  earnedDateInput,
  closeCardId,
  closeDateInput,
  isUpdating,
  isRemoving,
  onSetMarkEarned,
  onSetEarnedDateInput,
  onSetCloseCard,
  onSetCloseDateInput,
  onUpdateCard,
  onRemoveCard,
  onEditCard,
  onAddCard,
}: Props) {
  const todayIso = today()
  const cardsSortedByOpening = [...(wallet.wallet_cards ?? [])].sort((a, b) => {
    const da = a.added_date?.trim() ?? ''
    const db = b.added_date?.trim() ?? ''
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return db.localeCompare(da)
  })
  const ownedCards = cardsSortedByOpening.filter((wc) => (wc.added_date?.trim() ?? '') <= todayIso)
  const prospectiveCards = cardsSortedByOpening.filter((wc) => (wc.added_date?.trim() ?? '') > todayIso)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-w-0 flex flex-col max-h-[min(72vh,820px)]">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Cards</h2>
          {roadmap && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                roadmap.five_twenty_four_eligible
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : 'bg-red-900/60 text-red-300 border border-red-700'
              }`}
              title={`${roadmap.five_twenty_four_count} personal cards opened in last 24 months`}
            >
              5/24: {roadmap.five_twenty_four_count}/5
            </span>
          )}
        </div>
        <button
          className="text-indigo-400 hover:text-indigo-300 text-sm"
          onClick={onAddCard}
        >
          + Add card
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto flex-1 flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Owned</p>
          <ul className="space-y-2">
            {ownedCards.length === 0 && (
              <li className="text-slate-600 text-xs py-2 text-center">No Cards Added</li>
            )}
            {ownedCards.map((wc) => {
          const rm: RoadmapCardStatus | undefined = roadmap?.cards.find(
            (c) => c.wallet_card_id === wc.id
          )
          const isClosed = !!wc.closed_date
          const hasSubOffer = wc.sub != null || wc.sub_min_spend != null
          const metaRow2: ReactElement[] = []
          if (hasSubOffer) {
            metaRow2.push(
              <span key="sub">
                SUB:{' '}
                {wc.sub != null ? `${(wc.sub / 1000).toFixed(0)}k` : '—'}
                {wc.sub_min_spend != null && ` / $${wc.sub_min_spend.toLocaleString()}`}
                {wc.sub_months != null && ` in ${wc.sub_months} mo`}
              </span>
            )
          }
          if (wc.sub_earned_date) {
            metaRow2.push(
              <span key="earned" className="text-emerald-400">
                Earned {wc.sub_earned_date}
              </span>
            )
          }
          if (rm?.next_sub_eligible_date) {
            metaRow2.push(
              <span key="next" className="text-slate-500">
                Next eligible: {rm.next_sub_eligible_date}
              </span>
            )
          }
          metaRow2.push(
            <span key="af">
              AF:{' '}
              {wc.annual_fee != null
                ? `$${wc.annual_fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : '—'}
            </span>
          )
          return (
            <li
              key={wc.id}
              className={`bg-slate-800 rounded-lg px-3 py-2 ${isClosed ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${isClosed ? 'bg-slate-500' : 'bg-emerald-400'}`}
                      title={isClosed ? `Closed ${wc.closed_date}` : 'Active'}
                    />
                    <p className={`text-sm font-medium ${isClosed ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {wc.card_name ?? `Card #${wc.card_id}`}
                    </p>
                    {rm && rm.sub_status !== 'no_sub' && (
                      <SubStatusBadge status={rm.sub_status} daysRemaining={rm.sub_days_remaining} />
                    )}
                    {wc.acquisition_type === 'product_change' && (
                      <span className="text-[10px] font-medium bg-violet-900/60 text-violet-300 border border-violet-700/50 rounded px-1.5 py-0.5">
                        PC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {wc.acquisition_type === 'product_change' ? 'PC date' : 'Opened'} {wc.added_date}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-baseline gap-x-0">
                    {metaRow2.flatMap((el, i) =>
                      i === 0
                        ? [el]
                        : [
                            <span key={`sep-${i}`} className="text-slate-600 px-1" aria-hidden>
                              ·
                            </span>,
                            el,
                          ]
                    )}
                  </p>
                  {/* Quick actions */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {rm?.sub_status === 'pending' && (
                      <>
                        {markEarnedCardId === wc.card_id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="date"
                              value={earnedDateInput}
                              onChange={(e) => onSetEarnedDateInput(e.target.value)}
                              className="bg-slate-700 border border-slate-500 text-white text-xs rounded px-1.5 py-0.5"
                            />
                            <button
                              className="text-xs text-emerald-400 hover:text-emerald-300"
                              disabled={isUpdating}
                              onClick={() =>
                                onUpdateCard(wc.card_id, { sub_earned_date: earnedDateInput || today() })
                              }
                            >
                              Save
                            </button>
                            <button
                              className="text-xs text-slate-500 hover:text-slate-300"
                              onClick={() => { onSetMarkEarned(null); onSetEarnedDateInput('') }}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="text-xs text-emerald-400/80 hover:text-emerald-400"
                            onClick={() => {
                              onSetMarkEarned(wc.card_id)
                              onSetEarnedDateInput(today())
                            }}
                          >
                            ✓ Mark SUB earned
                          </button>
                        )}
                      </>
                    )}
                    {rm?.sub_status === 'earned' && (
                      <button
                        className="text-xs text-slate-500 hover:text-slate-400"
                        disabled={isUpdating}
                        onClick={() => onUpdateCard(wc.card_id, { sub_earned_date: null })}
                      >
                        ✕ Clear earned
                      </button>
                    )}
                    {!isClosed && (
                      <>
                        {closeCardId === wc.card_id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="date"
                              value={closeDateInput}
                              onChange={(e) => onSetCloseDateInput(e.target.value)}
                              className="bg-slate-700 border border-slate-500 text-white text-xs rounded px-1.5 py-0.5"
                            />
                            <button
                              className="text-xs text-amber-400 hover:text-amber-300"
                              disabled={isUpdating}
                              onClick={() =>
                                onUpdateCard(wc.card_id, { closed_date: closeDateInput || today() })
                              }
                            >
                              Save
                            </button>
                            <button
                              className="text-xs text-slate-500 hover:text-slate-300"
                              onClick={() => { onSetCloseCard(null); onSetCloseDateInput('') }}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="text-xs text-slate-500 hover:text-amber-400"
                            onClick={() => {
                              onSetCloseCard(wc.card_id)
                              onSetCloseDateInput(today())
                            }}
                          >
                            Close card
                          </button>
                        )}
                      </>
                    )}
                    {isClosed && (
                      <button
                        className="text-xs text-slate-500 hover:text-emerald-400"
                        disabled={isUpdating}
                        onClick={() => onUpdateCard(wc.card_id, { closed_date: null })}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                    aria-label="Edit card"
                    title="Edit"
                    onClick={() => onEditCard(wc)}
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
                  <button
                    type="button"
                    className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                    aria-label="Remove card from wallet"
                    title="Remove"
                    onClick={() => onRemoveCard(wc.card_id)}
                    disabled={isRemoving}
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
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          )
        })}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Future</p>
          <ul className="space-y-2">
            {prospectiveCards.length === 0 && (
              <li className="text-slate-600 text-xs py-2 text-center">No Cards Added</li>
            )}
            {prospectiveCards.map((wc) => {
                const rm: RoadmapCardStatus | undefined = roadmap?.cards.find(
                  (c) => c.wallet_card_id === wc.id
                )
                const isClosed = !!wc.closed_date
                const hasSubOffer = wc.sub != null || wc.sub_min_spend != null
                const metaRow2: ReactElement[] = []
                if (hasSubOffer) {
                  metaRow2.push(
                    <span key="sub">
                      SUB:{' '}
                      {wc.sub != null ? `${(wc.sub / 1000).toFixed(0)}k` : '—'}
                      {wc.sub_min_spend != null && ` / $${wc.sub_min_spend.toLocaleString()}`}
                      {wc.sub_months != null && ` in ${wc.sub_months} mo`}
                    </span>
                  )
                }
                if (wc.sub_earned_date) {
                  metaRow2.push(
                    <span key="earned" className="text-emerald-400">
                      Earned {wc.sub_earned_date}
                    </span>
                  )
                }
                if (rm?.next_sub_eligible_date) {
                  metaRow2.push(
                    <span key="next" className="text-slate-500">
                      Next eligible: {rm.next_sub_eligible_date}
                    </span>
                  )
                }
                metaRow2.push(
                  <span key="af">
                    AF:{' '}
                    {wc.annual_fee != null
                      ? `$${wc.annual_fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                )
                return (
                  <li
                    key={wc.id}
                    className={`bg-slate-800 rounded-lg px-3 py-2 ${isClosed ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${isClosed ? 'bg-slate-500' : 'bg-emerald-400'}`}
                            title={isClosed ? `Closed ${wc.closed_date}` : 'Active'}
                          />
                          <p className={`text-sm font-medium ${isClosed ? 'text-slate-400 line-through' : 'text-white'}`}>
                            {wc.card_name ?? `Card #${wc.card_id}`}
                          </p>
                          {rm && rm.sub_status !== 'no_sub' && (
                            <SubStatusBadge status={rm.sub_status} daysRemaining={rm.sub_days_remaining} />
                          )}
                          {wc.acquisition_type === 'product_change' && (
                            <span className="text-[10px] font-medium bg-violet-900/60 text-violet-300 border border-violet-700/50 rounded px-1.5 py-0.5">
                              PC
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {wc.acquisition_type === 'product_change' ? 'PC date' : 'Opened'} {wc.added_date}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-baseline gap-x-0">
                          {metaRow2.flatMap((el, i) =>
                            i === 0
                              ? [el]
                              : [
                                  <span key={`sep-${i}`} className="text-slate-600 px-1" aria-hidden>
                                    ·
                                  </span>,
                                  el,
                                ]
                          )}
                        </p>
                        {/* Quick actions */}
                        <div className="flex items-center gap-3 mt-1.5">
                          {rm?.sub_status === 'pending' && (
                            <>
                              {markEarnedCardId === wc.card_id ? (
                                <span className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={earnedDateInput}
                                    onChange={(e) => onSetEarnedDateInput(e.target.value)}
                                    className="bg-slate-700 border border-slate-500 text-white text-xs rounded px-1.5 py-0.5"
                                  />
                                  <button
                                    className="text-xs text-emerald-400 hover:text-emerald-300"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      onUpdateCard(wc.card_id, { sub_earned_date: earnedDateInput || today() })
                                    }
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="text-xs text-slate-500 hover:text-slate-300"
                                    onClick={() => { onSetMarkEarned(null); onSetEarnedDateInput('') }}
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  className="text-xs text-emerald-400/80 hover:text-emerald-400"
                                  onClick={() => {
                                    onSetMarkEarned(wc.card_id)
                                    onSetEarnedDateInput(today())
                                  }}
                                >
                                  ✓ Mark SUB earned
                                </button>
                              )}
                            </>
                          )}
                          {rm?.sub_status === 'earned' && (
                            <button
                              className="text-xs text-slate-500 hover:text-slate-400"
                              disabled={isUpdating}
                              onClick={() => onUpdateCard(wc.card_id, { sub_earned_date: null })}
                            >
                              ✕ Clear earned
                            </button>
                          )}
                          {!isClosed && (
                            <>
                              {closeCardId === wc.card_id ? (
                                <span className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={closeDateInput}
                                    onChange={(e) => onSetCloseDateInput(e.target.value)}
                                    className="bg-slate-700 border border-slate-500 text-white text-xs rounded px-1.5 py-0.5"
                                  />
                                  <button
                                    className="text-xs text-amber-400 hover:text-amber-300"
                                    disabled={isUpdating}
                                    onClick={() =>
                                      onUpdateCard(wc.card_id, { closed_date: closeDateInput || today() })
                                    }
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="text-xs text-slate-500 hover:text-slate-300"
                                    onClick={() => { onSetCloseCard(null); onSetCloseDateInput('') }}
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  className="text-xs text-slate-500 hover:text-amber-400"
                                  onClick={() => {
                                    onSetCloseCard(wc.card_id)
                                    onSetCloseDateInput(today())
                                  }}
                                >
                                  Close card
                                </button>
                              )}
                            </>
                          )}
                          {isClosed && (
                            <button
                              className="text-xs text-slate-500 hover:text-emerald-400"
                              disabled={isUpdating}
                              onClick={() => onUpdateCard(wc.card_id, { closed_date: null })}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700"
                          aria-label="Edit card"
                          title="Edit"
                          onClick={() => onEditCard(wc)}
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
                        <button
                          type="button"
                          className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                          aria-label="Remove card from wallet"
                          title="Remove"
                          onClick={() => onRemoveCard(wc.card_id)}
                          disabled={isRemoving}
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
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
