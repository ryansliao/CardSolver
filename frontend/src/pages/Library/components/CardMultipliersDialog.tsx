import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { cardsApi } from '../../../api/client'

function formatRate(multiplier: number, isCashback: boolean): string {
  if (isCashback) {
    const pct = multiplier * 100
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`
  }
  const x = multiplier
  return Number.isInteger(x) ? `${x}x` : `${x.toFixed(2)}x`
}

export interface CardMultipliersDialogProps {
  cardId: number | null
  onClose: () => void
}

export function CardMultipliersDialog({ cardId, onClose }: CardMultipliersDialogProps) {
  const queryClient = useQueryClient()
  const [addCategoryName, setAddCategoryName] = useState('')
  const [addMultiplier, setAddMultiplier] = useState('1')
  const [addOpen, setAddOpen] = useState(false)

  const { data: card, isLoading: cardLoading } = useQuery({
    queryKey: ['cards', cardId],
    queryFn: () => cardsApi.get(cardId!),
    enabled: cardId != null,
  })

  const updateMultipliersMutation = useMutation({
    mutationFn: (multipliers: { category: string; multiplier: number }[]) =>
      cardsApi.update(cardId!, { multipliers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId] })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
  })

  const isCashback = card?.currency_obj?.is_cashback ?? false

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardId || !addCategoryName.trim() || !card) return
    const mult = parseFloat(addMultiplier)
    if (Number.isNaN(mult) || mult < 0) return
    const current = card.multipliers ?? []
    if (current.some((m) => m.category.toLowerCase() === addCategoryName.trim().toLowerCase())) {
      updateMultipliersMutation.mutate(
        current.map((m) =>
          m.category.toLowerCase() === addCategoryName.trim().toLowerCase()
            ? { category: addCategoryName.trim(), multiplier: mult }
            : m
        )
      )
    } else {
      updateMultipliersMutation.mutate([
        ...current,
        { category: addCategoryName.trim(), multiplier: mult },
      ])
    }
    setAddCategoryName('')
    setAddMultiplier('1')
    setAddOpen(false)
  }

  const handleRemoveCategory = (category: string) => {
    if (!cardId || !card) return
    const next = card.multipliers.filter(
      (m) => m.category.toLowerCase() !== category.toLowerCase()
    )
    updateMultipliersMutation.mutate(next)
  }

  if (cardId == null) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-bold text-white">
                Category multipliers · {card?.name ?? '…'}
              </h3>
              <p className="text-slate-400 text-sm mt-0.5">
                {card?.currency_obj?.name}
                {isCashback ? ' · Cashback %' : ' · Points multiplier'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="overflow-auto flex-1 min-h-0">
            {cardLoading && (
              <div className="p-5 text-slate-400">Loading…</div>
            )}
            {card && !cardLoading && (
              <>
                <div className="px-5 py-3 border-b border-slate-700 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
                  >
                    Add category
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">
                        {isCashback ? 'Cashback %' : 'Multiplier'}
                      </th>
                      <th className="px-5 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {card.multipliers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-slate-500 text-center">
                          No categories yet. Add one to set earn rates for this card.
                        </td>
                      </tr>
                    ) : (
                      card.multipliers
                        .slice()
                        .sort((a, b) => a.category.localeCompare(b.category))
                        .map((m) => (
                          <tr
                            key={m.category}
                            className="border-b border-slate-700/70 hover:bg-slate-800/50"
                          >
                            <td className="px-5 py-3 text-white font-medium">{m.category}</td>
                            <td className="px-5 py-3 text-slate-200">
                              {formatRate(m.multiplier, isCashback)}
                            </td>
                            <td className="px-5 py-3">
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory(m.category)}
                                disabled={updateMultipliersMutation.isPending}
                                className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
                {updateMultipliersMutation.isError && (
                  <div className="px-5 py-3 bg-red-950/50 border-t border-slate-700 text-red-400 text-sm">
                    {updateMultipliersMutation.error instanceof Error
                      ? updateMultipliersMutation.error.message
                      : 'Failed to save'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {addOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-sm w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700">
              <h4 className="text-lg font-bold text-white">Add category</h4>
            </div>
            <form onSubmit={handleAddCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category name</label>
                <input
                  type="text"
                  value={addCategoryName}
                  onChange={(e) => setAddCategoryName(e.target.value)}
                  placeholder="e.g. Dining, Travel"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {isCashback ? 'Cashback (e.g. 0.05 for 5%)' : 'Multiplier (e.g. 2 for 2x)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={isCashback ? 0.01 : 0.5}
                  value={addMultiplier}
                  onChange={(e) => setAddMultiplier(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMultipliersMutation.isPending || !addCategoryName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {updateMultipliersMutation.isPending ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
