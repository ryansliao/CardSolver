import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  cardsApi,
  scenariosApi,
  type AddCardToScenarioPayload,
  type Scenario,
  type ScenarioResult,
} from '../api/client'
import WalletSummary from '../components/WalletSummary'

// ─── Create scenario modal ────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreate: (name: string, description: string, asOfDate: string) => void
  isLoading: boolean
}

function CreateModal({ onClose, onCreate, isLoading }: CreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [asOfDate, setAsOfDate] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">New Scenario</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Name *</label>
            <input
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              placeholder="e.g. 2025 Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              placeholder="Optional notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Reference date</label>
            <input
              type="date"
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
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
            disabled={!name.trim() || isLoading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
            onClick={() => onCreate(name, description, asOfDate)}
          >
            {isLoading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add card to scenario modal ───────────────────────────────────────────────

interface AddCardModalProps {
  onClose: () => void
  onAdd: (payload: AddCardToScenarioPayload) => void
  isLoading: boolean
}

function AddCardModal({ onClose, onAdd, isLoading }: AddCardModalProps) {
  const { data: cards } = useQuery({ queryKey: ['cards'], queryFn: cardsApi.list })
  const [cardId, setCardId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [years, setYears] = useState(2)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Add Card to Scenario</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Card *</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              value={cardId}
              onChange={(e) => setCardId(Number(e.target.value))}
            >
              <option value="">Select a card…</option>
              {cards?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start date</label>
              <input
                type="date"
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">End date</label>
              <input
                type="date"
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Years for SUB amortization</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
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
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                years_counted: years,
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

// ─── Scenario detail panel ────────────────────────────────────────────────────

interface ScenarioDetailProps {
  scenario: Scenario
  onDelete: () => void
}

function ScenarioDetail({ scenario, onDelete }: ScenarioDetailProps) {
  const qc = useQueryClient()
  const [showAddCard, setShowAddCard] = useState(false)
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [loadingResult, setLoadingResult] = useState(false)

  const addCardMutation = useMutation({
    mutationFn: (payload: AddCardToScenarioPayload) =>
      scenariosApi.addCard(scenario.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios'] })
      setShowAddCard(false)
    },
  })

  const removeCardMutation = useMutation({
    mutationFn: (cardId: number) => scenariosApi.removeCard(scenario.id, cardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  async function fetchResults() {
    setLoadingResult(true)
    try {
      const res = await scenariosApi.results(scenario.id)
      setScenarioResult(res)
    } finally {
      setLoadingResult(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{scenario.name}</h2>
          {scenario.description && (
            <p className="text-sm text-slate-400 mt-0.5">{scenario.description}</p>
          )}
          {scenario.as_of_date && (
            <p className="text-xs text-slate-500 mt-1">As of {scenario.as_of_date}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-1 rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Cards list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Cards</p>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300"
            onClick={() => setShowAddCard(true)}
          >
            + Add card
          </button>
        </div>
        {scenario.scenario_cards.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">No cards yet.</p>
        ) : (
          <div className="space-y-1">
            {scenario.scenario_cards.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm text-white">{sc.card_name ?? `Card #${sc.card_id}`}</p>
                  <p className="text-xs text-slate-400">
                    {sc.start_date ?? '—'} → {sc.end_date ?? '∞'} · {sc.years_counted}yr SUB
                  </p>
                </div>
                <button
                  onClick={() => removeCardMutation.mutate(sc.card_id)}
                  className="text-slate-500 hover:text-red-400 text-xs ml-3"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculate results */}
      <div>
        <button
          onClick={fetchResults}
          disabled={loadingResult || scenario.scenario_cards.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loadingResult ? 'Calculating…' : 'Calculate Scenario EV'}
        </button>
        {scenarioResult && (
          <div className="mt-4">
            <WalletSummary result={scenarioResult.wallet} />
          </div>
        )}
      </div>

      {showAddCard && (
        <AddCardModal
          onClose={() => setShowAddCard(false)}
          onAdd={(payload) => addCardMutation.mutate(payload)}
          isLoading={addCardMutation.isPending}
        />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Scenarios() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: scenarios, isLoading } = useQuery({
    queryKey: ['scenarios'],
    queryFn: scenariosApi.list,
  })

  const createMutation = useMutation({
    mutationFn: scenariosApi.create,
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['scenarios'] })
      setShowCreate(false)
      setSelectedId(s.id)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: scenariosApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios'] })
      setSelectedId(null)
    },
  })

  const selected = scenarios?.find((s) => s.id === selectedId) ?? null

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scenarios</h1>
          <p className="text-slate-400 text-sm mt-1">
            Model future wallet states with date-windowed card assignments.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          New Scenario
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 h-fit">
            {scenarios?.length === 0 ? (
              <p className="text-slate-500 text-sm px-2 py-4">No scenarios yet.</p>
            ) : (
              <div className="space-y-1">
                {scenarios?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      selectedId === s.id
                        ? 'bg-indigo-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.scenario_cards.length} card{s.scenario_cards.length !== 1 ? 's' : ''}
                      {s.as_of_date ? ` · ${s.as_of_date}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <ScenarioDetail
                scenario={selected}
                onDelete={() => deleteMutation.mutate(selected.id)}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center h-64">
                <p className="text-slate-500 text-sm">Select a scenario to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(name, description, asOfDate) =>
            createMutation.mutate({
              name,
              description: description || undefined,
              as_of_date: asOfDate || undefined,
            })
          }
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  )
}
