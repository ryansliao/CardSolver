import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { issuersApi, type IssuerRead } from '../../../api/client'

export function IssuersTab() {
  const queryClient = useQueryClient()
  const { data: issuers = [], isLoading } = useQuery({
    queryKey: ['issuers'],
    queryFn: issuersApi.list,
  })
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<IssuerRead | null>(null)
  const [name, setName] = useState('')
  const [coBrandPartner, setCoBrandPartner] = useState('')
  const [network, setNetwork] = useState('')

  const resetForm = () => {
    setName('')
    setCoBrandPartner('')
    setNetwork('')
    setEditing(null)
  }

  const createIssuer = useMutation({
    mutationFn: (payload: { name: string; co_brand_partner?: string | null; network?: string | null }) =>
      issuersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuers'] })
      setModalOpen(null)
      resetForm()
    },
  })
  const updateIssuer = useMutation({
    mutationFn: ({
      id,
      name: n,
      co_brand_partner,
      network,
    }: {
      id: number
      name: string
      co_brand_partner?: string | null
      network?: string | null
    }) => issuersApi.update(id, { name: n, co_brand_partner, network }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issuers'] })
      setModalOpen(null)
      resetForm()
    },
  })
  const deleteIssuer = useMutation({
    mutationFn: issuersApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issuers'] }),
  })

  const handleDelete = (issuer: IssuerRead) => {
    if (!window.confirm(`Delete issuer "${issuer.name}"? This will fail if any cards use it.`))
      return
    deleteIssuer.mutate(issuer.id)
  }

  const openEdit = (issuer: IssuerRead) => {
    setEditing(issuer)
    setName(issuer.name)
    setCoBrandPartner(issuer.co_brand_partner ?? '')
    setNetwork(issuer.network ?? '')
    setModalOpen('edit')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-slate-400 text-sm">Add, edit, or remove issuers (issuer, co-brand partner, network).</p>
        <button
          type="button"
          onClick={() => {
            resetForm()
            setModalOpen('add')
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
        >
          Add Issuer
        </button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          {issuers.length === 0 ? (
            <p className="text-slate-500 text-sm p-4">No issuers yet. Add one to get started.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {issuers.map((issuer) => (
                <li
                  key={issuer.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 gap-4"
                >
                  <div className="min-w-0">
                    <span className="text-white font-medium">{issuer.name}</span>
                    {(issuer.co_brand_partner || issuer.network) && (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {issuer.co_brand_partner && (
                          <span className="text-xs text-slate-400">
                            Co-brand: {issuer.co_brand_partner}
                          </span>
                        )}
                        {issuer.network && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                            {issuer.network}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(issuer)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(issuer)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-red-900/60 text-red-200 hover:bg-red-800/60"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {modalOpen !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModalOpen(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-3">
              {modalOpen === 'add' ? 'Add issuer' : 'Edit issuer'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const n = name.trim()
                if (!n) return
                const payload = {
                  name: n,
                  co_brand_partner: coBrandPartner.trim() || null,
                  network: network.trim() || null,
                }
                if (modalOpen === 'add') createIssuer.mutate(payload)
                else if (editing) updateIssuer.mutate({ id: editing.id, ...payload })
                setModalOpen(null)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Issuer</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chase, Amex"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Co-brand partner (optional)</label>
                <input
                  type="text"
                  value={coBrandPartner}
                  onChange={(e) => setCoBrandPartner(e.target.value)}
                  placeholder="e.g. United, Delta"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Network (optional)</label>
                <input
                  type="text"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  placeholder="e.g. Visa, Mastercard, Amex"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createIssuer.isPending || updateIssuer.isPending || !name.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {modalOpen === 'add' ? 'Add' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteIssuer.isError && (
        <p className="text-red-400 text-sm">{deleteIssuer.error?.message}</p>
      )}
    </div>
  )
}
