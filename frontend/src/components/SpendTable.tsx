import { useState } from 'react'
import type { SpendCategory } from '../api/client'

interface Props {
  categories: SpendCategory[]
  overrides: Record<string, number>
  onChange: (category: string, value: number) => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function SpendTable({ categories, overrides, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function startEdit(cat: SpendCategory) {
    setEditing(cat.category)
    setDraft(String(overrides[cat.category] ?? cat.annual_spend))
  }

  function commit(category: string) {
    const val = parseFloat(draft)
    if (!isNaN(val) && val >= 0) onChange(category, val)
    setEditing(null)
  }

  return (
    <div className="space-y-1">
      {categories.map((cat) => {
        const value = overrides[cat.category] ?? cat.annual_spend
        const isEditing = editing === cat.category
        return (
          <div
            key={cat.category}
            className="flex items-center justify-between gap-2 py-1 border-b border-slate-800"
          >
            <span className="text-sm text-slate-300 flex-1 truncate">{cat.category}</span>
            {isEditing ? (
              <input
                autoFocus
                className="w-28 bg-slate-700 text-white text-sm text-right px-2 py-0.5 rounded border border-indigo-500 outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(cat.category)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(cat.category)
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button
                className="text-sm text-indigo-300 hover:text-indigo-100 w-28 text-right"
                onClick={() => startEdit(cat)}
              >
                {fmt(value)}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
