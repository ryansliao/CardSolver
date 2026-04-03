import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { CardCredit } from '../../../../api/client'
import { cardsApi } from '../../../../api/client'
import { formatMoney } from '../../../../utils/format'
import { useCardLibrary } from '../../hooks/useCardLibrary'
import { queryKeys } from '../../lib/queryKeys'

function MiniDialog({
  title,
  children,
  onClose,
  zClass = 'z-[60]',
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  zClass?: string
}) {
  const titleId = useId()
  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-center justify-center ${zClass} p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-base font-semibold text-white mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

function CreditValueEditorDialog({
  open,
  creditName,
  initialValue,
  onClose,
  onSave,
}: {
  open: boolean
  creditName: string
  initialValue: number
  onClose: () => void
  onSave: (value: number) => void
}) {
  const [valueText, setValueText] = useState(String(initialValue))

  useEffect(() => {
    if (open) setValueText(String(initialValue))
  }, [open, initialValue])

  if (!open) return null

  function submit() {
    const v = Number.parseFloat(valueText.trim())
    if (Number.isNaN(v) || v < 0) return
    onSave(v)
    onClose()
  }

  return (
    <MiniDialog title="Statement credit (this wallet)" onClose={onClose} zClass="z-[70]">
      <p className="text-sm text-slate-300 mb-3">{creditName}</p>
      <label className="text-xs text-slate-400 mb-1 block">Value ($)</label>
      <input
        type="number"
        min={0}
        step="0.01"
        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 mb-4"
        value={valueText}
        onChange={(e) => setValueText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded-lg"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 rounded-lg"
          onClick={submit}
        >
          Save
        </button>
      </div>
    </MiniDialog>
  )
}

export function StatementCreditsModal({
  cardId,
  creditOverrides,
  onSetCreditOverride,
  onClose,
}: {
  cardId: number
  creditOverrides: Record<number, number>
  onSetCreditOverride: (creditId: number, value: number) => void
  onClose: () => void
}) {
  const titleId = useId()
  const queryClient = useQueryClient()
  const { data: cards, isLoading } = useCardLibrary()
  const card = cards?.find((c) => c.id === cardId)
  const [editing, setEditing] = useState<CardCredit | null>(null)

  const patchCreditMutation = useMutation({
    mutationFn: ({
      creditId,
      payload,
    }: {
      creditId: number
      payload: { is_one_time: boolean }
    }) => cardsApi.updateCredit(cardId, creditId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards() })
    },
  })

  function displayValue(cr: CardCredit) {
    return creditOverrides[cr.id] ?? cr.credit_value
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[55] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={onClose}
      >
        <div
          className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 id={titleId} className="text-lg font-semibold text-white pr-2">
              {isLoading ? 'Statement credits' : `Credits — ${card?.name ?? 'Card'}`}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-slate-700"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Dollar overrides apply only to this wallet. The one-time flag updates the card library
            for all wallets.
          </p>

          {isLoading && (
            <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
          )}

          {!isLoading && !card && (
            <p className="text-sm text-amber-400 py-4">Card not found.</p>
          )}

          {card && card.credits.length === 0 && (
            <p className="text-sm text-slate-500 py-4">No statement credits on this card.</p>
          )}

          {card && card.credits.length > 0 && (
            <ul className="rounded-lg border border-slate-600/80 bg-slate-900/40 overflow-hidden">
              {card.credits.map((cr) => (
                <li
                  key={cr.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 text-sm border-b border-slate-700/40 last:border-b-0"
                >
                  <div className="min-w-0">
                    <span className="text-slate-200 block truncate">{cr.credit_name}</span>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                        checked={Boolean(cr.is_one_time)}
                        disabled={patchCreditMutation.isPending}
                        onChange={(e) =>
                          patchCreditMutation.mutate({
                            creditId: cr.id,
                            payload: { is_one_time: e.target.checked },
                          })
                        }
                      />
                      One-Time Credit
                    </label>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className="text-slate-400 tabular-nums">
                      {formatMoney(displayValue(cr))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditing(cr)}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-medium px-2 py-1 rounded-md hover:bg-slate-700/80"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CreditValueEditorDialog
        open={editing != null}
        creditName={editing?.credit_name ?? ''}
        initialValue={editing != null ? displayValue(editing) : 0}
        onClose={() => setEditing(null)}
        onSave={(value) => {
          if (editing) onSetCreditOverride(editing.id, value)
        }}
      />
    </>
  )
}
