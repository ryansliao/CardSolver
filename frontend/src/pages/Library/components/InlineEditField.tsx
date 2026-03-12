import type { Card, CardCreatePayload } from '../../../api/client'

export const EXPANDED_ROW_FIELDS: { field: keyof CardCreatePayload; label: string; widthClass: string }[] = [
  { field: 'annual_fee', label: 'Annual Fee', widthClass: 'w-20' },
  { field: 'first_year_fee', label: '1st Year Fee', widthClass: 'w-20' },
  { field: 'sub', label: 'SUB Amount', widthClass: 'w-24' },
  { field: 'sub_min_spend', label: 'SUB Min Spend', widthClass: 'w-24' },
  { field: 'sub_months', label: 'SUB Months', widthClass: 'w-16' },
  { field: 'annual_bonus', label: 'Annual Bonus', widthClass: 'w-24' },
]

interface InlineEditFieldProps {
  card: Card
  field: string
  label: string
  widthClass: string
  tableEditMode: boolean
  value: string | number | null
  displayValue: string | number
  editingCell: { cardId: number; field: string; value: string | number | null } | null
  setEditingCell: React.Dispatch<React.SetStateAction<{ cardId: number; field: string; value: string | number | null } | null>>
  patchCell: (card: Card, field: string, value: string | number | null) => void
}

export function InlineEditField({
  card,
  field,
  label,
  widthClass,
  tableEditMode,
  value,
  displayValue,
  editingCell,
  setEditingCell,
  patchCell,
}: InlineEditFieldProps) {
  const isEditing = editingCell?.cardId === card.id && editingCell?.field === field
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 whitespace-nowrap">{label}</label>
      <input
        type="number"
        min={0}
        step={field === 'annual_fee' || field === 'first_year_fee' ? 1 : undefined}
        disabled={!tableEditMode}
        placeholder={field === 'first_year_fee' ? '—' : undefined}
        className={`${widthClass} bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed`}
        value={displayValue}
        onFocus={() => setEditingCell({ cardId: card.id, field, value })}
        onChange={(e) =>
          setEditingCell((c) =>
            c && c.cardId === card.id && c.field === field
              ? { ...c, value: e.target.value === '' ? '' : Number(e.target.value) }
              : c
          )
        }
        onBlur={() => {
          if (isEditing) patchCell(card, field, editingCell.value)
          setEditingCell(null)
        }}
      />
    </div>
  )
}
