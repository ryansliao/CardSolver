import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { currenciesApi, ecosystemsApi, type EcosystemRead } from '../../../api/client'

export function EcosystemsTab() {
  const queryClient = useQueryClient()
  const { data: ecosystems = [], isLoading } = useQuery({
    queryKey: ['ecosystems'],
    queryFn: ecosystemsApi.list,
  })
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.list(),
  })
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<EcosystemRead | null>(null)
  const [form, setForm] = useState({
    name: '',
    points_currency_id: 0,
    additional_currency_ids: [] as number[],
  })

  const createEcosystem = useMutation({
    mutationFn: ecosystemsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecosystems'] })
      setModalOpen(null)
      setForm({ name: '', points_currency_id: 0, additional_currency_ids: [] })
    },
  })
  const updateEcosystem = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; points_currency_id?: number; additional_currency_ids?: number[] } }) =>
      ecosystemsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecosystems'] })
      setModalOpen(null)
      setEditing(null)
    },
  })
  const deleteEcosystem = useMutation({
    mutationFn: ecosystemsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ecosystems'] }),
  })

  const handleDelete = (e: EcosystemRead) => {
    if (!window.confirm(`Delete ecosystem "${e.name}"? Card memberships will be removed.`)) return
    deleteEcosystem.mutate(e.id)
  }

  const openEdit = (eco: EcosystemRead) => {
    setEditing(eco)
    setForm({
      name: eco.name,
      points_currency_id: eco.points_currency_id,
      additional_currency_ids: (eco.ecosystem_currencies ?? [])
        .map((ec) => ec.currency_id)
        .filter((cid) => cid !== eco.points_currency_id),
    })
    setModalOpen('edit')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-slate-400 text-sm">
          Ecosystems define which cards unlock conversion (key cards) and which earn as points when a key is in wallet.
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setForm({ name: '', points_currency_id: currencies[0]?.id ?? 0, additional_currency_ids: [] })
            setModalOpen('add')
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
        >
          Add Ecosystem
        </button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          {ecosystems.length === 0 ? (
            <p className="text-slate-500 text-sm p-4">No ecosystems yet. Add one (e.g. Chase UR, Amex MR).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Points currency</th>
                    <th className="px-4 py-3">Additional currencies</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ecosystems.map((e) => (
                    <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {e.points_currency?.name ?? `#${e.points_currency_id}`}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {(e.ecosystem_currencies ?? []).length
                          ? (e.ecosystem_currencies ?? []).map((ec) => ec.currency?.name ?? `#${ec.currency_id}`).join(', ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openEdit(e)} className="text-slate-300 hover:text-white mr-2">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} className="text-red-400 hover:text-red-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-3">
              {modalOpen === 'add' ? 'Add ecosystem' : 'Edit ecosystem'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.name.trim() || !form.points_currency_id) return
                const additionalIds = form.additional_currency_ids.filter((id) => id !== form.points_currency_id)
                if (modalOpen === 'add') {
                  createEcosystem.mutate({
                    name: form.name.trim(),
                    points_currency_id: form.points_currency_id,
                    additional_currency_ids: additionalIds.length ? additionalIds : undefined,
                  })
                } else if (editing) {
                  updateEcosystem.mutate({
                    id: editing.id,
                    payload: {
                      name: form.name.trim(),
                      points_currency_id: form.points_currency_id,
                      additional_currency_ids: additionalIds,
                    },
                  })
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  placeholder="e.g. Chase UR, Amex MR"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Points currency</label>
                <select
                  value={form.points_currency_id || ''}
                  onChange={(e) => setForm((f) => ({ ...f, points_currency_id: Number(e.target.value) }))}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  required
                >
                  <option value="">Select currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Additional currencies</label>
                <p className="text-xs text-slate-500 mb-1">Currencies that convert to this ecosystem's points when a key card is in wallet.</p>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-slate-800 border border-slate-600 rounded-lg">
                  {form.additional_currency_ids.map((cid) => {
                    const c = currencies.find((x) => x.id === cid)
                    return (
                      <span key={cid} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-700 text-slate-200">
                        {c?.name ?? cid}
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, additional_currency_ids: f.additional_currency_ids.filter((id) => id !== cid) }))}
                          className="text-slate-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {currencies
                    .filter((c) => c.id !== form.points_currency_id && !form.additional_currency_ids.includes(c.id))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, additional_currency_ids: [...f.additional_currency_ids, c.id] }))}
                        className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                      >
                        + {c.name}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(null)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createEcosystem.isPending || updateEcosystem.isPending || !form.name.trim() || !form.points_currency_id}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {modalOpen === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
