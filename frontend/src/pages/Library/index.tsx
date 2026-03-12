import { useState } from 'react'
import { TABS, type TabId } from './types'
import { CardsTab, CategoriesTab, CurrenciesTab, EcosystemsTab, IssuersTab } from './tabs'

export default function LibraryPage() {
  const [tab, setTab] = useState<TabId>('cards')

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Library</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage cards, issuers, and currencies. Add, edit, or remove entries in each tab.
        </p>
      </div>
      <div className="flex gap-1 mb-6 border-b border-slate-700">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-slate-800 text-white border border-slate-700 border-b-0 -mb-px'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'cards' && <CardsTab />}
      {tab === 'issuers' && <IssuersTab />}
      {tab === 'currencies' && <CurrenciesTab />}
      {tab === 'ecosystems' && <EcosystemsTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  )
}
