import { useEffect, useMemo, useRef, useState } from 'react'
// Note: useRef is used here to track which data has been hydrated into the form,
// preventing re-runs when the card library re-fetches without the user changing selection.
import {
  type AddCardToWalletPayload,
  type UpdateWalletCardPayload,
  type WalletCard,
  type WalletCardAcquisitionType,
} from '../../../../api/client'
import { ModalBackdrop } from '../../../../components/ModalBackdrop'
import { today } from '../../../../utils/format'
import { useCardLibrary } from '../../hooks/useCardLibrary'
import { initialCreditOverridesForEdit, buildWalletCardFields, walletFormToUpdatePayload } from '../../lib/walletCardForm'
import { CardLibraryInfoModal } from '../cards/CardLibraryInfoModal'
import { StatementCreditsModal } from '../cards/StatementCreditsModal'

export function WalletCardModal({
  mode,
  walletCard,
  existingCardIds,
  onClose,
  onAdd,
  onSaveEdit,
  isLoading,
}: {
  mode: 'add' | 'edit'
  walletCard?: WalletCard
  existingCardIds: number[]
  onClose: () => void
  onAdd: (payload: AddCardToWalletPayload) => void
  onSaveEdit: (payload: UpdateWalletCardPayload) => void
  isLoading: boolean
}) {
  const { data: cards } = useCardLibrary()
  const [cardId, setCardId] = useState<number | ''>('')
  const [addedDate, setAddedDate] = useState(
    () => (mode === 'edit' && walletCard ? walletCard.added_date : today())
  )
  const [acquisitionType, setAcquisitionType] = useState<WalletCardAcquisitionType>(
    mode === 'edit' && walletCard ? walletCard.acquisition_type : 'opened'
  )
  const [subPoints, setSubPoints] = useState('')
  const [subMinSpend, setSubMinSpend] = useState('')
  const [subMonths, setSubMonths] = useState('')
  const [annualFee, setAnnualFee] = useState('')
  const [firstYearFee, setFirstYearFee] = useState('')
  const [creditOverrides, setCreditOverrides] = useState<Record<number, number>>({})
  const [showLibraryInfo, setShowLibraryInfo] = useState(false)
  const [showStatementCredits, setShowStatementCredits] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Tracks the last key we hydrated form state from, preventing re-runs when the
  // card library re-fetches without the user changing their selection.
  // Format: "add:<cardId>" | "edit:<walletCardId>"
  const hydratedKey = useRef<string>('')

  const effectiveCardId =
    mode === 'add' ? (typeof cardId === 'number' ? cardId : null) : (walletCard?.card_id ?? null)

  // Issuers already represented in the wallet — used to filter card picker for product changes
  const existingIssuerIds = useMemo(() => {
    if (!cards) return []
    return [...new Set(
      existingCardIds
        .map((id) => cards.find((c) => c.id === id)?.issuer_id)
        .filter((id): id is number => id !== undefined)
    )]
  }, [cards, existingCardIds])

  const filteredCards = useMemo(() => {
    if (!cards) return []
    if (acquisitionType !== 'product_change' || existingIssuerIds.length === 0) return cards
    return cards.filter((c) => existingIssuerIds.includes(c.issuer_id))
  }, [cards, acquisitionType, existingIssuerIds])

  const lib = useMemo(
    () =>
      effectiveCardId != null && cards ? cards.find((c) => c.id === effectiveCardId) : undefined,
    [effectiveCardId, cards]
  )

  useEffect(() => {
    if (mode === 'add') {
      if (!cardId) {
        hydratedKey.current = ''
        return
      }
      if (!lib) return
      const key = `add:${cardId}`
      if (hydratedKey.current === key) return
      hydratedKey.current = key
      setSubPoints(lib.sub != null ? String(lib.sub) : '')
      setSubMinSpend(lib.sub_min_spend != null ? String(lib.sub_min_spend) : '')
      setSubMonths(lib.sub_months != null ? String(lib.sub_months) : '')
      setAnnualFee(String(lib.annual_fee))
      setFirstYearFee(lib.first_year_fee != null ? String(lib.first_year_fee) : '')
      setCreditOverrides({})
      setFormError(null)
    } else {
      if (!walletCard || !lib) return
      const key = `edit:${walletCard.id}`
      if (hydratedKey.current === key) return
      hydratedKey.current = key
      setAddedDate(walletCard.added_date)
      setAcquisitionType(walletCard.acquisition_type)
      const effSub = walletCard.sub ?? lib.sub
      setSubPoints(effSub != null ? String(effSub) : '')
      const effMin = walletCard.sub_min_spend ?? lib.sub_min_spend
      setSubMinSpend(effMin != null ? String(effMin) : '')
      const effMo = walletCard.sub_months ?? lib.sub_months
      setSubMonths(effMo != null ? String(effMo) : '')
      const effAf = walletCard.annual_fee ?? lib.annual_fee
      setAnnualFee(String(effAf))
      const effFy = walletCard.first_year_fee ?? lib.first_year_fee
      setFirstYearFee(effFy != null ? String(effFy) : '')
      setCreditOverrides(initialCreditOverridesForEdit(walletCard, lib))
      setFormError(null)
    }
  }, [mode, cardId, lib, walletCard])

  function handlePrimary() {
    setFormError(null)
    const built = buildWalletCardFields(
      subPoints,
      subMinSpend,
      subMonths,
      annualFee,
      firstYearFee
    )
    if (!built.ok) {
      setFormError(built.message)
      return
    }

    if (mode === 'add') {
      if (typeof cardId !== 'number') return
      const credit_overrides =
        Object.keys(creditOverrides).length > 0
          ? Object.fromEntries(
              Object.entries(creditOverrides).map(([k, v]) => [String(k), v])
            )
          : undefined
      onAdd({
        card_id: cardId,
        added_date: addedDate,
        acquisition_type: acquisitionType,
        sub: built.sub,
        sub_min_spend: built.sub_min_spend,
        sub_months: built.sub_months,
        annual_fee: built.annual_fee,
        first_year_fee: built.first_year_fee,
        credit_overrides,
      })
      return
    }

    if (!walletCard || !lib) {
      setFormError('Card library data is still loading.')
      return
    }
    onSaveEdit(walletFormToUpdatePayload(built, lib, creditOverrides, addedDate, acquisitionType))
  }

  const formDisabled = !lib
  const title =
    mode === 'add'
      ? 'Add Card to Wallet'
      : `${walletCard?.card_name ?? `Card #${walletCard?.card_id ?? ''}`}`

  const primaryLabel =
    mode === 'add' ? (isLoading ? 'Adding…' : 'Add Card') : isLoading ? 'Saving…' : 'Save Changes'

  const primaryDisabled =
    mode === 'add' ? !cardId || isLoading : isLoading || !walletCard

  return (
    <>
      <ModalBackdrop onClose={onClose} className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white pr-2">{title}</h2>
            <button
              type="button"
              disabled={!lib}
              onClick={() => setShowLibraryInfo(true)}
              title="Card library details"
              aria-label="Card library details"
              className="shrink-0 w-9 h-9 rounded-full border border-slate-500 text-slate-200 hover:bg-slate-700 hover:border-slate-400 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-sm font-serif italic leading-none pt-0.5"
            >
              i
            </button>
          </div>

          {mode === 'edit' && !lib ? (
            <p className="text-sm text-slate-400 py-8 text-center">Loading card…</p>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Acquisition type</label>
                  <div className="flex gap-4">
                    {(['opened', 'product_change'] as const).map((v) => (
                      <label key={v} className="flex items-center gap-1.5 text-sm text-white cursor-pointer">
                        <input
                          type="radio"
                          name="acquisitionType"
                          value={v}
                          checked={acquisitionType === v}
                          onChange={() => setAcquisitionType(v)}
                          className="accent-indigo-500"
                        />
                        {v === 'opened' ? 'New application' : 'Product change'}
                      </label>
                    ))}
                  </div>
                </div>
                {mode === 'add' && (
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Card *</label>
                    <select
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Select a card…</option>
                      {filteredCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {acquisitionType === 'product_change' && existingIssuerIds.length > 0 && (
                      <p className="text-[11px] text-slate-500 mt-1">Showing same-issuer cards only</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    {acquisitionType === 'product_change' ? 'Product change date *' : 'Date added *'}
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                    value={addedDate}
                    onChange={(e) => setAddedDate(e.target.value)}
                  />
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 pt-2">
                  Your card in this wallet
                </p>
                <p className="text-xs text-slate-500 -mt-2">
                  Stored on your wallet entry only (not the shared card library). Empty SUB, annual
                  fee, or first-year fee uses the library default. When editing, values that match
                  the library are saved as inherit.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      {acquisitionType === 'product_change' ? 'PC Bonus (points)' : 'SUB (points)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={formDisabled}
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                      value={subPoints}
                      onChange={(e) => setSubPoints(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      {acquisitionType === 'product_change' ? 'PC Bonus min spend ($)' : 'SUB min spend ($)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={formDisabled}
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                      value={subMinSpend}
                      onChange={(e) => setSubMinSpend(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    {acquisitionType === 'product_change' ? 'PC Bonus months' : 'SUB months'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={formDisabled}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                    value={subMonths}
                    onChange={(e) => setSubMonths(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Annual fee ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={formDisabled}
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                      value={annualFee}
                      onChange={(e) => setAnnualFee(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">First-year fee ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={formDisabled}
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                      placeholder="Optional"
                      value={firstYearFee}
                      onChange={(e) => setFirstYearFee(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={formDisabled}
                  onClick={() => setShowStatementCredits(true)}
                  className="w-full text-left text-sm text-indigo-400 hover:text-indigo-300 py-2 px-3 rounded-lg border border-slate-600 hover:border-slate-500 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Edit Credit Valuations
                </button>

                {formError && (
                  <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded-lg"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={primaryDisabled}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
                  onClick={handlePrimary}
                >
                  {primaryLabel}
                </button>
              </div>
            </>
          )}
      </ModalBackdrop>

      {showLibraryInfo && effectiveCardId != null && (
        <CardLibraryInfoModal cardId={effectiveCardId} onClose={() => setShowLibraryInfo(false)} />
      )}

      {showStatementCredits && effectiveCardId != null && (
        <StatementCreditsModal
          cardId={effectiveCardId}
          creditOverrides={creditOverrides}
          onSetCreditOverride={(id, value) =>
            setCreditOverrides((prev) => ({ ...prev, [id]: value }))
          }
          onClose={() => setShowStatementCredits(false)}
        />
      )}
    </>
  )
}
