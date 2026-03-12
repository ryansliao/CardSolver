export type TabId = 'cards' | 'issuers' | 'currencies' | 'ecosystems' | 'categories'

export const TABS: { id: TabId; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'issuers', label: 'Issuers' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'ecosystems', label: 'Ecosystems' },
  { id: 'categories', label: 'Categories' },
]
