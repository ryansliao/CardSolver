import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { currenciesApi, issuersApi, type CurrencyRead } from '../../../api/client'

export function CurrenciesTab() {
  const queryClient = useQueryClient()
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.list(),
  })
  const { data: issuers = [] } = useQuery({
    queryKey: ['issuers'],
    queryFn: issuersApi.list,
  })
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<CurrencyRead | null>(null)
  const [form, setForm] = useState<{
    issuer_id: number | null
    name: string
    cents_per_point: number
    is_cashback: boolean
    is_transferable: boolean
  }>({
    issuer_id: null,
    name: '',
    cents_per_point: 1,
    is_cashback: false,
    is_transferable: true,
  })

  const createCurrency = useMutation({
    mutationFn: currenciesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      setModalOpen(null)
      setForm({
        issuer_id: null,
        name: '',
        cents_per_point: 1,
        is_cashback: false,
        is_transferable: true,
      })
    },
  })
  const updateCurrency = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; issuer_id?: number | null; cents_per_point?: number; is_cashback?: boolean; is_transferable?: boolean } }) =>
      currenciesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
      setModalOpen(null)
      setEditing(null)
    },
  })
  const deleteCurrency = useMutation({
    mutationFn: currenciesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] }),
  })

  const handleDelete = (c: CurrencyRead) => {
    if (!window.confirm(`Delete currency "${c.name}"? This will fail if any card uses it.`))
      return
    deleteCurrency.mutate(c.id)
  }

  const openEdit = (c: CurrencyRead) => {
    setEditing(c)
    setForm({
      issuer_id: c.issuer_id ?? null,
      name: c.name,
      cents_per_point: c.cents_per_point,
      is_cashback: c.is_cashback,
      is_transferable: c.is_transferable,
    })
    setModalOpen('edit')
  }

  const issuerName = (c: CurrencyRead) =>
    c.issuer?.name ?? (c.issuer_id != null ? issuers.find((i) => i.id === c.issuer_id)?.name ?? `#${c.issuer_id}` : '—')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-slate-400 text-sm">Add, edit, or remove currencies.</p>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setForm({
              issuer_id: null,
              name: '',
              cents_per_point: 1,
              is_cashback: false,
              is_transferable: true,
            })
            setModalOpen('add')
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
        >
          Add Currency
        </button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          {currencies.length === 0 ? (
            <p className="text-slate-500 text-sm p-4">No currencies yet. Add one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Issuer</th>
                    <th className="px-4 py-3">¢/pt</th>
                    <th className="px-4 py-3">Cashback</th>
                    <th className="px-4 py-3">Transferable</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-slate-300">{issuerName(c)}</td>
                      <td className="px-4 py-3 text-slate-300">{c.cents_per_point}</td>
                      <td className="px-4 py-3 text-slate-300">{c.is_cashback ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-slate-300">{c.is_transferable ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-slate-300 hover:text-white mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {modalOpen !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModalOpen(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-3">
              {modalOpen === 'add' ? 'Add currency' : 'Edit currency'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.name.trim()) return
                const payload = {
                  name: form.name.trim(),
                  issuer_id: form.issuer_id ?? undefined,
                  cents_per_point: form.cents_per_point,
                  is_cashback: form.is_cashback,
                  is_transferable: form.is_transferable,
                }
                if (modalOpen === 'add') {
                  createCurrency.mutate(payload)
                } else if (editing) {
                  updateCurrency.mutate({
                    id: editing.id,
                    payload,
                  })
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Issuer (optional, e.g. leave empty for Cash)</label>
                <select
                  value={form.issuer_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issuer_id: e.target.value ? Number(e.target.value) : null }))
                  }
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                >
                  <option value="">—</option>
                  {issuers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  placeholder="e.g. Chase UR, Amex MR, Cash"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cents per point</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.cents_per_point}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cents_per_point: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_cashback}
                    onChange={(e) => setForm((f) => ({ ...f, is_cashback: e.target.checked }))}
                    className="rounded border-slate-600"
                  />
                  Cashback
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_transferable}
                    onChange={(e) => setForm((f) => ({ ...f, is_transferable: e.target.checked }))}
                    className="rounded border-slate-600"
                  />
                  Transferable
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCurrency.isPending || updateCurrency.isPending || !form.name.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {modalOpen === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteCurrency.isError && (
        <p className="text-red-400 text-sm">{deleteCurrency.error?.message}</p>
      )}
    </div>
  )
}
