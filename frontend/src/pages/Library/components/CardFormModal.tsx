import { useState } from 'react'
import {
  type CardCreatePayload,
  type CurrencyRead,
  type EcosystemRead,
  type IssuerRead,
} from '../../../api/client'

export const DEFAULT_CARD_FORM: CardCreatePayload = {
  name: '',
  issuer_id: 0,
  currency_id: 0,
  annual_fee: 0,
  first_year_fee: null,
  business: false,
  sub: 0,
  sub_min_spend: null,
  sub_months: null,
  sub_spend_amount: 0,
  annual_bonus: 0,
  ecosystem_memberships: [],
  multipliers: [],
  credits: [],
}

export interface CardFormModalProps {
  open: boolean
  onClose: () => void
  initial?: CardCreatePayload & { id?: number }
  issuers: IssuerRead[]
  currencies: CurrencyRead[]
  ecosystems: EcosystemRead[]
  onSubmit: (payload: CardCreatePayload) => void
  isSubmitting: boolean
  error?: string | null
}

export function CardFormModal({
  open,
  onClose,
  initial,
  issuers,
  currencies,
  ecosystems,
  onSubmit,
  isSubmitting,
  error,
}: CardFormModalProps) {
  const [form, setForm] = useState<CardCreatePayload>(initial ?? DEFAULT_CARD_FORM)
  const isEdit = initial?.id != null
  const currenciesForIssuer = form.issuer_id
    ? currencies.filter((c) => c.issuer_id === form.issuer_id || c.issuer_id == null)
    : []
  const singleMembership = (form.ecosystem_memberships ?? [])[0]
  const ecosystemId = singleMembership?.ecosystem_id ?? 0

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.issuer_id || !form.currency_id) return
    onSubmit(form)
  }

  const setEcosystem = (id: number) => {
    setForm((f) => ({
      ...f,
      ecosystem_memberships: id ? [{ ecosystem_id: id, key_card: false }] : [],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit card' : 'Add Card'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Issuer</label>
            <select
              value={form.issuer_id || ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                setForm((f) => ({
                  ...f,
                  issuer_id: id,
                  currency_id: 0,
                }))
              }}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              required
            >
              <option value="">Select issuer</option>
              {issuers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Currency</label>
            <select
              value={form.currency_id || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency_id: Number(e.target.value) }))
              }
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              required
            >
              <option value="">Select currency</option>
              {currenciesForIssuer.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ecosystem</label>
            <select
              value={ecosystemId || ''}
              onChange={(e) => setEcosystem(Number(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
            >
              <option value="">—</option>
              {ecosystems.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={form.business ?? false}
                onChange={(e) => setForm((f) => ({ ...f, business: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              Business card
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Annual Fee ($)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.annual_fee ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, annual_fee: Number(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">First year annual fee ($, optional)</label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Same as annual fee if blank"
                value={form.first_year_fee ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({ ...f, first_year_fee: v === '' ? null : Number(v) || 0 }))
                }}
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">SUB Amount</label>
              <input
                type="number"
                min={0}
                value={form.sub ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sub: Number(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">SUB min spend ($)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.sub_min_spend ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({ ...f, sub_min_spend: v === '' ? null : Number(v) || 0 }))
                }}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">SUB spend window (mo.)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.sub_months ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({ ...f, sub_months: v === '' ? null : Number(v) || 0 }))
                }}
                placeholder="Optional"
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
              />
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.name.trim() || !form.issuer_id || !form.currency_id}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
