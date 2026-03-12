import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { cardsApi, type AddCardToWalletPayload } from '../../../api/client'

interface AddCardModalProps {
  onClose: () => void
  onAdd: (payload: AddCardToWalletPayload) => void
  isLoading: boolean
}

export function AddCardModal({
  onClose,
  onAdd,
  isLoading,
}: AddCardModalProps) {
  const { data: cards } = useQuery({ queryKey: ['cards'], queryFn: cardsApi.list })
  const [cardId, setCardId] = useState<number | ''>('')
  const [addedDate, setAddedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [subPoints, setSubPoints] = useState<string>('')
  const [subMinSpend, setSubMinSpend] = useState<string>('')
  const [subMonths, setSubMonths] = useState<string>('')

  useEffect(() => {
    if (!cardId || !cards) return
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    setSubPoints(card.sub != null ? String(card.sub) : '')
    setSubMinSpend(card.sub_min_spend != null ? String(card.sub_min_spend) : '')
    setSubMonths(card.sub_months != null ? String(card.sub_months) : '')
  }, [cardId, cards])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Add Card to Wallet</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Card *</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              value={cardId}
              onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select a card…</option>
              {cards?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Date added *</label>
            <input
              type="date"
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              value={addedDate}
              onChange={(e) => setAddedDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">SUB amount override (pts or cash)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                placeholder="Use card default"
                value={subPoints}
                onChange={(e) => setSubPoints(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Min spend override ($)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                placeholder="Use card default"
                value={subMinSpend}
                onChange={(e) => setSubMinSpend(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Months to achieve (mo)</label>
            <input
              type="number"
              min={0}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              placeholder="Use card default"
              value={subMonths}
              onChange={(e) => setSubMonths(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded-lg"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={!cardId || isLoading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
            onClick={() =>
              onAdd({
                card_id: cardId as number,
                added_date: addedDate,
                sub: subPoints ? Number(subPoints) : undefined,
                sub_min_spend: subMinSpend ? Number(subMinSpend) : undefined,
                sub_months: subMonths ? Number(subMonths) : undefined,
              })
            }
          >
            {isLoading ? 'Adding…' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  )
}
