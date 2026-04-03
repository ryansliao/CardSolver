import { useState } from 'react'
import type { SpendItemModalState } from '../../hooks/useWalletSpendCategoriesTable'

interface Props {
  initial: SpendItemModalState
  onSave: (amount: number) => void
  onClose: () => void
  isSaving: boolean
  error?: string
}

function digitsOnly(raw: string) {
  return raw.replace(/[^\d]/g, '')
}

export default function SpendItemModal({ initial, onSave, onClose, isSaving, error }: Props) {
  const [amount, setAmount] = useState(initial.amount)

  const parsedAmount = amount ? parseInt(amount, 10) : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(parsedAmount)
  }

  const { category } = initial

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-sm w-full m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">
            {initial.mode === 'add' ? 'Add spend' : 'Edit spend'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Set how much you spend annually in this category.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Category</p>
            <p className="text-sm font-medium text-slate-100">{category.category}</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Annual spend ($, whole dollars)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(digitsOnly(e.target.value))}
                placeholder="0"
                className="flex-1 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-sm px-3 py-2 rounded-lg"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || parsedAmount < 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 text-sm"
            >
              {isSaving ? 'Saving…' : initial.mode === 'add' ? 'Add' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
