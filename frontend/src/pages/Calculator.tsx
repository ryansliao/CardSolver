import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { calcApi, cardsApi, spendApi, type WalletResult } from '../api/client'
import CardGrid from '../components/CardGrid'
import SpendTable from '../components/SpendTable'
import WalletSummary from '../components/WalletSummary'

export default function Calculator() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [yearsCount, setYearsCount] = useState(2)
  const [spendOverrides, setSpendOverrides] = useState<Record<string, number>>({})
  const [result, setResult] = useState<WalletResult | null>(null)

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: cardsApi.list,
  })

  const { data: spend, isLoading: spendLoading } = useQuery({
    queryKey: ['spend'],
    queryFn: spendApi.list,
  })

  const calcMutation = useMutation({
    mutationFn: calcApi.calculate,
    onSuccess: (data) => setResult(data),
  })

  function toggleCard(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSpendChange(category: string, value: number) {
    setSpendOverrides((prev) => ({ ...prev, [category]: value }))
  }

  function calculate() {
    calcMutation.mutate({
      years_counted: yearsCount,
      selected_card_ids: Array.from(selectedIds),
      spend_overrides: spendOverrides,
    })
  }

  const isLoading = cardsLoading || spendLoading

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet Calculator</h1>
          <p className="text-slate-400 text-sm mt-1">
            Select your cards, set your spend, and calculate expected value.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Years for SUB</label>
            <select
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
              value={yearsCount}
              onChange={(e) => setYearsCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={calculate}
            disabled={calcMutation.isPending || selectedIds.size === 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"
          >
            {calcMutation.isPending ? 'Calculating…' : 'Calculate'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-20">Loading…</div>
      ) : (
        <div className="grid grid-cols-[280px_1fr_320px] gap-6">
          {/* Left: Spend */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Annual Spend</h2>
            <p className="text-xs text-slate-500 mb-3">Click a value to edit it.</p>
            {spend && (
              <SpendTable
                categories={spend}
                overrides={spendOverrides}
                onChange={handleSpendChange}
              />
            )}
          </div>

          {/* Center: Cards */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">Cards</h2>
              <span className="text-xs text-slate-400">
                {selectedIds.size} selected
                {selectedIds.size > 0 && (
                  <button
                    className="ml-2 text-slate-500 hover:text-slate-300"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </button>
                )}
              </span>
            </div>
            {cards && (
              <CardGrid cards={cards} selected={selectedIds} onToggle={toggleCard} />
            )}
          </div>

          {/* Right: Results */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Results</h2>
            {calcMutation.isError && (
              <div className="text-red-400 text-sm bg-red-950 border border-red-700 rounded-lg p-3 mb-3">
                {calcMutation.error?.message}
              </div>
            )}
            {result ? (
              <WalletSummary result={result} />
            ) : (
              <div className="text-slate-500 text-sm text-center py-12">
                Select cards and click Calculate to see your wallet's expected value.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
