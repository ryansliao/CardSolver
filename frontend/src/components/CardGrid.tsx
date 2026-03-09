import type { Card } from '../api/client'

const ISSUER_COLORS: Record<string, string> = {
  'American Express': 'border-blue-500 bg-blue-950',
  Chase: 'border-sky-500 bg-sky-950',
  'Capital One': 'border-red-500 bg-red-950',
  Citi: 'border-cyan-500 bg-cyan-950',
  Bilt: 'border-violet-500 bg-violet-950',
  Delta: 'border-purple-500 bg-purple-950',
  Hilton: 'border-teal-500 bg-teal-950',
}

function issuerColor(issuer: string) {
  return ISSUER_COLORS[issuer] ?? 'border-slate-500 bg-slate-800'
}

interface Props {
  cards: Card[]
  selected: Set<number>
  onToggle: (id: number) => void
}

export default function CardGrid({ cards, selected, onToggle }: Props) {
  const issuers = Array.from(new Set(cards.map((c) => c.issuer))).sort()

  return (
    <div className="space-y-4">
      {issuers.map((issuer) => (
        <div key={issuer}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {issuer}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {cards
              .filter((c) => c.issuer === issuer)
              .map((card) => {
                const active = selected.has(card.id)
                return (
                  <button
                    key={card.id}
                    onClick={() => onToggle(card.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      active
                        ? issuerColor(card.issuer) + ' border-opacity-100'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-sm font-medium leading-tight text-white">{card.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {card.annual_fee === 0 ? 'No fee' : `$${card.annual_fee}/yr`}
                      {' · '}
                      {card.currency}
                    </p>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
