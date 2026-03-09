import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { cardsApi, type Card } from '../api/client'

const CURRENCY_COLORS: Record<string, string> = {
  'Amex MR': 'bg-blue-900 text-blue-200',
  'Chase UR': 'bg-sky-900 text-sky-200',
  'Capital One Miles': 'bg-red-900 text-red-200',
  'Citi TY': 'bg-cyan-900 text-cyan-200',
  'Bilt Points': 'bg-violet-900 text-violet-200',
  'Delta SkyMiles': 'bg-purple-900 text-purple-200',
  'Hilton Honors': 'bg-teal-900 text-teal-200',
  'Cash Back': 'bg-emerald-900 text-emerald-200',
}

function badge(label: string) {
  const cls = CURRENCY_COLORS[label] ?? 'bg-slate-700 text-slate-300'
  return (
    <span key={label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface CardDetailProps {
  card: Card
}

function CardDetail({ card }: CardDetailProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{card.name}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{card.issuer}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">
            {card.annual_fee === 0 ? 'No fee' : money(card.annual_fee)}
          </p>
          <p className="text-xs text-slate-500">annual fee</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {badge(card.currency)}
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
          {card.cents_per_point}¢/pt
        </span>
      </div>

      {/* SUB */}
      {card.sub_points > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Sign-Up Bonus</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-white">
                {(card.sub_points / 1000).toFixed(0)}k
              </p>
              <p className="text-xs text-slate-400">points</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {card.sub_min_spend ? money(card.sub_min_spend) : '—'}
              </p>
              <p className="text-xs text-slate-400">min spend</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {card.sub_months != null ? `${card.sub_months} mo` : '—'}
              </p>
              <p className="text-xs text-slate-400">window</p>
            </div>
          </div>
        </div>
      )}

      {/* Credits */}
      {card.credits.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Credits & Benefits</p>
          <div className="space-y-1">
            {card.credits.map((cr) => (
              <div
                key={cr.credit_name}
                className="flex justify-between items-center bg-slate-800 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-slate-300">{cr.credit_name}</span>
                <span className="text-sm font-medium text-emerald-400">{money(cr.credit_value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multipliers */}
      {card.multipliers.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
            Category Multipliers
          </p>
          <div className="grid grid-cols-2 gap-1">
            {card.multipliers
              .sort((a, b) => b.multiplier - a.multiplier)
              .map((m) => (
                <div
                  key={m.category}
                  className="flex justify-between items-center bg-slate-800 rounded-lg px-3 py-1.5"
                >
                  <span className="text-xs text-slate-400 truncate">{m.category}</span>
                  <span className="text-xs font-bold text-white ml-2">{m.multiplier}x</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Annual bonus */}
      {card.annual_bonus_points > 0 && (
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex justify-between">
          <span className="text-sm text-slate-400">Annual bonus points</span>
          <span className="text-sm font-medium text-white">
            {(card.annual_bonus_points / 1000).toFixed(0)}k pts
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Cards() {
  const { data: cards, isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: cardsApi.list,
  })

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [issuerFilter, setIssuerFilter] = useState('All')

  const issuers = ['All', ...Array.from(new Set(cards?.map((c) => c.issuer) ?? [])).sort()]

  const filtered = cards?.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.issuer.toLowerCase().includes(search.toLowerCase())
    const matchIssuer = issuerFilter === 'All' || c.issuer === issuerFilter
    return matchSearch && matchIssuer
  })

  const selected = cards?.find((c) => c.id === selectedId) ?? null

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Card Library</h1>
        <p className="text-slate-400 text-sm mt-1">Browse all 26 cards with their earn rates and benefits.</p>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="grid grid-cols-[320px_1fr] gap-6">
          {/* List */}
          <div className="space-y-3">
            {/* Filters */}
            <input
              className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500"
              placeholder="Search cards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {issuers.map((iss) => (
                <button
                  key={iss}
                  onClick={() => setIssuerFilter(iss)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    issuerFilter === iss
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {iss}
                </button>
              ))}
            </div>

            {/* Card list */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              {filtered?.length === 0 ? (
                <p className="text-slate-500 text-sm p-4">No cards match.</p>
              ) : (
                filtered?.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedId(card.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800 last:border-0 transition-colors ${
                      selectedId === card.id
                        ? 'bg-indigo-900/40'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{card.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{card.issuer}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs text-slate-400">
                        {card.annual_fee === 0 ? 'No fee' : money(card.annual_fee)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <CardDetail card={selected} />
            ) : (
              <div className="bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center h-64">
                <p className="text-slate-500 text-sm">Select a card to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
