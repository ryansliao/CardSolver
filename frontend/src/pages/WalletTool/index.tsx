import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  spendApi,
  walletsApi,
  type AddCardToWalletPayload,
  type WalletResultResponse,
} from '../../api/client'
import SpendTable from './components/SpendTable'
import WalletSummary from './components/WalletSummary'
import { AddCardModal } from './components/AddCardModal'
import { CreateWalletModal } from './components/CreateWalletModal'
import { MyCppModal } from './components/MyCppModal'
import { DEFAULT_USER_ID } from './constants'

export default function WalletToolPage() {
  const queryClient = useQueryClient()
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [projectionYears, setProjectionYears] = useState(2)
  const [projectionMonths, setProjectionMonths] = useState(0)
  const [referenceDate, setReferenceDate] = useState('')
  const [spendOverrides, setSpendOverrides] = useState<Record<string, number>>({})
  const [result, setResult] = useState<WalletResultResponse | null>(null)
  const [showMyCppModal, setShowMyCppModal] = useState(false)

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['wallets', DEFAULT_USER_ID],
    queryFn: () => walletsApi.list(DEFAULT_USER_ID),
  })

  const { data: spend, isLoading: spendLoading } = useQuery({
    queryKey: ['spend'],
    queryFn: spendApi.list,
  })

  const createWalletMutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      walletsApi.create({
        user_id: DEFAULT_USER_ID,
        name: payload.name,
        description: payload.description || null,
      }),
    onSuccess: (wallet) => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      setSelectedWalletId(wallet.id)
      setShowCreateModal(false)
    },
  })

  const addCardMutation = useMutation({
    mutationFn: ({ walletId, payload }: { walletId: number; payload: AddCardToWalletPayload }) =>
      walletsApi.addCard(walletId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      setShowAddCardModal(false)
    },
  })

  const removeCardMutation = useMutation({
    mutationFn: ({ walletId, cardId }: { walletId: number; cardId: number }) =>
      walletsApi.removeCard(walletId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })

  const resultsMutation = useMutation({
    mutationFn: (walletId: number) =>
      walletsApi.results(walletId, {
        reference_date: referenceDate || undefined,
        projection_years: projectionYears,
        projection_months: projectionMonths,
        spend_overrides: Object.keys(spendOverrides).length > 0 ? spendOverrides : undefined,
      }),
    onSuccess: setResult,
  })

  const selectedWallet = wallets?.find((w) => w.id === selectedWalletId)

  function handleSpendChange(category: string, value: number) {
    setSpendOverrides((prev) => ({ ...prev, [category]: value }))
  }

  function calculate() {
    if (selectedWalletId != null) resultsMutation.mutate(selectedWalletId)
  }

  if (walletsLoading) {
    return (
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center text-slate-400 py-20">Loading wallets…</div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Wallet Tool</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage wallets, add cards with sign-up bonus and min spend, and calculate EV and
          opportunity cost over your chosen time frame.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: Wallet list */}
        <div className="w-56 shrink-0 bg-slate-900 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200">Wallets</h2>
            <button
              className="text-indigo-400 hover:text-indigo-300 text-sm"
              onClick={() => setShowCreateModal(true)}
            >
              + New
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowMyCppModal(true)}
            className="w-full text-left text-slate-400 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors mb-3"
          >
            My CPP
          </button>
          <ul className="space-y-1">
            {wallets?.map((w) => (
              <li key={w.id}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedWalletId === w.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    setSelectedWalletId(w.id)
                    setResult(null)
                  }}
                >
                  {w.name}
                </button>
              </li>
            ))}
            {wallets?.length === 0 && (
              <li className="text-slate-500 text-sm py-2">No wallets yet. Create one.</li>
            )}
          </ul>
        </div>

        {/* Main: Selected wallet detail or empty state */}
        <div className="flex-1 min-w-0">
          {!selectedWallet ? (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
              Select a wallet or create one to get started.
            </div>
          ) : (
            <>
              {/* Time frame & Calculate */}
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400">Projection</label>
                  <select
                    className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
                    value={projectionYears}
                    onChange={(e) => setProjectionYears(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} yr
                      </option>
                    ))}
                  </select>
                  <select
                    className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
                    value={projectionMonths}
                    onChange={(e) => setProjectionMonths(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {i} mo
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400">As of</label>
                  <input
                    type="date"
                    className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                  />
                </div>
                <button
                  onClick={calculate}
                  disabled={
                    resultsMutation.isPending || (selectedWallet?.wallet_cards?.length ?? 0) === 0
                  }
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"
                >
                  {resultsMutation.isPending ? 'Calculating…' : 'Calculate'}
                </button>
              </div>

              <div className="grid grid-cols-[280px_1fr_320px] gap-6">
                {/* Spend */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-slate-200 mb-3">Annual Spend</h2>
                  <p className="text-xs text-slate-500 mb-3">Click a value to edit.</p>
                  {spend && (
                    <SpendTable
                      categories={spend}
                      overrides={spendOverrides}
                      onChange={handleSpendChange}
                    />
                  )}
                  {spendLoading && (
                    <div className="text-slate-500 text-sm">Loading…</div>
                  )}
                </div>

                {/* Cards in wallet */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-200">Cards in wallet</h2>
                    <button
                      className="text-indigo-400 hover:text-indigo-300 text-sm"
                      onClick={() => setShowAddCardModal(true)}
                    >
                      + Add card
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {selectedWallet.wallet_cards?.map((wc) => (
                      <li
                        key={wc.id}
                        className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {wc.card_name ?? `Card #${wc.card_id}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            Added {wc.added_date}
                            {(wc.sub != null || wc.sub_min_spend != null) && (
                              <span className="ml-1">
                                · SUB:{' '}
                                {wc.sub != null ? `${(wc.sub / 1000).toFixed(0)}k` : '—'} value
                                {wc.sub_min_spend != null && ` / $${wc.sub_min_spend.toLocaleString()}`}
                                {wc.sub_months != null && ` in ${wc.sub_months} mo`}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          className="text-slate-500 hover:text-red-400 text-sm"
                          onClick={() =>
                            removeCardMutation.mutate({
                              walletId: selectedWallet.id,
                              cardId: wc.card_id,
                            })
                          }
                          disabled={removeCardMutation.isPending}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {!selectedWallet.wallet_cards?.length && (
                      <li className="text-slate-500 text-sm py-4 text-center">
                        No cards. Add cards to calculate EV.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Results */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-slate-200 mb-3">Results</h2>
                  {resultsMutation.isError && (
                    <div className="text-red-400 text-sm bg-red-950 border border-red-700 rounded-lg p-3 mb-3">
                      {resultsMutation.error?.message}
                    </div>
                  )}
                  {result ? (
                    <WalletSummary result={result.wallet} />
                  ) : (
                    <div className="text-slate-500 text-sm text-center py-12">
                      Set projection and click Calculate to see EV and opportunity cost.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateWalletModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(name, description) =>
            createWalletMutation.mutate({ name, description })
          }
          isLoading={createWalletMutation.isPending}
        />
      )}

      {showAddCardModal && selectedWallet && (
        <AddCardModal
          onClose={() => setShowAddCardModal(false)}
          onAdd={(payload) =>
            addCardMutation.mutate({ walletId: selectedWallet.id, payload })
          }
          isLoading={addCardMutation.isPending}
        />
      )}

      {showMyCppModal && (
        <MyCppModal
          onClose={() => setShowMyCppModal(false)}
          onCppChange={() => setResult(null)}
        />
      )}
    </div>
  )
}
