import { useId } from 'react'
import type { Card } from '../../../../api/client'
import { ModalBackdrop } from '../../../../components/ModalBackdrop'
import { useCardLibrary } from '../../hooks/useCardLibrary'

function earnSummary(c: Card) {
  return (
    [
      c.multipliers.length > 0 && `${c.multipliers.length} listed rates`,
      c.multiplier_groups.length > 0 &&
        `${c.multiplier_groups.length} rate group${c.multiplier_groups.length === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(' · ') || '—'
  )
}

export function CardLibraryInfoModal({
  cardId,
  onClose,
}: {
  cardId: number
  onClose: () => void
}) {
  const titleId = useId()
  const { data: cards, isLoading } = useCardLibrary()
  const card = cards?.find((c) => c.id === cardId)

  return (
    <ModalBackdrop onClose={onClose} zIndex="z-[55]" className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-white pr-2">
            {isLoading ? 'Card details' : card?.name ?? 'Card'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        {isLoading && (
          <p className="text-sm text-slate-400 py-8 text-center">Loading card…</p>
        )}

        {!isLoading && !card && (
          <p className="text-sm text-amber-400 py-4">Card not found.</p>
        )}

        {card && (
          <div className="rounded-lg border border-slate-600/80 bg-slate-900/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Reference
            </p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Issuer</dt>
                <dd className="text-slate-200 text-right">{card.issuer.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Co-brand</dt>
                <dd className="text-slate-200 text-right">{card.co_brand?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Currency</dt>
                <dd className="text-slate-200 text-right">{card.currency_obj.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Network</dt>
                <dd className="text-slate-200 text-right">
                  {card.network_tier?.name || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Product</dt>
                <dd className="text-slate-200 text-right">
                  {card.business ? 'Business' : 'Personal'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Earning structure</dt>
                <dd className="text-slate-200 text-right">{earnSummary(card)}</dd>
              </div>
            </dl>
          </div>
        )}
    </ModalBackdrop>
  )
}
