import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import {
  cardsApi,
  currenciesApi,
  ecosystemsApi,
  issuersApi,
  type Card,
  type CardCreatePayload,
} from '../../../api/client'
import {
  CardFormModal,
  CardMultipliersDialog,
  EXPANDED_ROW_FIELDS,
  InlineEditField,
} from '../components'

export function CardsTab() {
  const queryClient = useQueryClient()
  const { data: cards, isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: cardsApi.list,
  })
  const { data: issuers = [] } = useQuery({
    queryKey: ['issuers'],
    queryFn: issuersApi.list,
  })
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.list(),
  })
  const { data: ecosystems = [] } = useQuery({
    queryKey: ['ecosystems'],
    queryFn: ecosystemsApi.list,
  })
  const [search, setSearch] = useState('')
  const [issuerFilter, setIssuerFilter] = useState('All')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editCardId, setEditCardId] = useState<number | null>(null)
  const [tableEditMode, setTableEditMode] = useState(false)
  const [editingCell, setEditingCell] = useState<{
    cardId: number
    field: string
    value: string | number | null
  } | null>(null)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<number>>(new Set())
  const [multiplierDialogCardId, setMultiplierDialogCardId] = useState<number | null>(null)

  const createCard = useMutation({
    mutationFn: cardsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setAddModalOpen(false)
    },
  })
  const updateCard = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CardCreatePayload> }) =>
      cardsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setAddModalOpen(false)
      setEditCardId(null)
    },
  })
  const deleteCard = useMutation({
    mutationFn: cardsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })

  const issuerNames = ['All', ...Array.from(new Set(cards?.map((c) => c.issuer.name) ?? [])).sort()]
  const filtered =
    (cards?.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.issuer.name.toLowerCase().includes(search.toLowerCase())
      const matchIssuer = issuerFilter === 'All' || c.issuer.name === issuerFilter
      return matchSearch && matchIssuer
    }) ?? []).sort((a, b) => a.name.localeCompare(b.name))

  const cellValue = (card: Card, field: string): string | number => {
    if (editingCell?.cardId === card.id && editingCell?.field === field)
      return editingCell.value ?? ''
    switch (field) {
      case 'name':
        return card.name
      case 'annual_fee':
        return card.annual_fee
      case 'first_year_fee':
        return card.first_year_fee ?? ''
      case 'sub':
        return card.sub
      case 'sub_min_spend':
        return card.sub_min_spend ?? ''
      case 'sub_months':
        return card.sub_months ?? ''
      case 'annual_bonus':
        return card.annual_bonus
      default:
        return ''
    }
  }

  const patchCell = (card: Card, field: string, value: string | number | null) => {
    const payload: Partial<CardCreatePayload> = {}
    if (field === 'name') payload.name = value === null ? card.name : String(value)
    else if (field === 'annual_fee') payload.annual_fee = value === null || value === '' ? 0 : Number(value)
    else if (field === 'first_year_fee') payload.first_year_fee = value === null || value === '' ? null : Number(value)
    else if (field === 'sub') payload.sub = value === null || value === '' ? 0 : Number(value)
    else if (field === 'sub_min_spend') payload.sub_min_spend = value === null || value === '' ? null : Number(value)
    else if (field === 'sub_months') payload.sub_months = value === null || value === '' ? null : Number(value)
    else if (field === 'annual_bonus') payload.annual_bonus = value === null || value === '' ? 0 : Number(value)
    if (Object.keys(payload).length) updateCard.mutate({ id: card.id, payload })
  }

  const handleDeleteRow = (card: Card) => {
    if (!window.confirm(`Delete card "${card.name}"? This will remove it from all wallets and scenarios.`))
      return
    deleteCard.mutate(card.id)
  }

  const cardToPayload = (card: Card): CardCreatePayload & { id?: number } => ({
    id: card.id,
    name: card.name,
    issuer_id: card.issuer_id,
    currency_id: card.currency_id,
    annual_fee: card.annual_fee,
    first_year_fee: card.first_year_fee,
    business: card.business,
    sub: card.sub,
    sub_min_spend: card.sub_min_spend,
    sub_months: card.sub_months,
    sub_spend_amount: card.sub_spend_amount,
    annual_bonus: card.annual_bonus,
    ecosystem_memberships: card.ecosystem_memberships?.length
      ? [{ ecosystem_id: card.ecosystem_memberships[0].ecosystem_id, key_card: false }]
      : [],
    multipliers: card.multipliers,
    credits: card.credits,
  })

  const handleCardSubmit = (payload: CardCreatePayload) => {
    if (editCardId != null) {
      updateCard.mutate({ id: editCardId, payload })
      setEditCardId(null)
    } else {
      createCard.mutate(payload)
    }
  }

  const currenciesByIssuer = (issuerId: number) =>
    currencies.filter((c) => c.issuer_id === issuerId || c.issuer_id == null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-indigo-500 w-56"
            placeholder="Search cards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {issuerNames.map((iss) => (
              <button
                key={iss}
                type="button"
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
        </div>
        <p className="text-slate-400 text-sm">Add or edit cards in the table.</p>
        <div className="flex items-center gap-2">
          {tableEditMode ? (
            <button
              type="button"
              onClick={() => {
                setTableEditMode(false)
                queryClient.invalidateQueries({ queryKey: ['cards'] })
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
            >
              Save
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTableEditMode(true)}
              className="px-4 py-2 rounded-lg bg-slate-600 text-white text-sm font-medium hover:bg-slate-500"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
          >
            Add card
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Loading…</div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse text-sm table-fixed">
            <colgroup>
              <col style={{ width: '40px' }} />
              {tableEditMode ? (
                <>
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '48px' }} />
                </>
              ) : (
                <>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '26.5%' }} />
                  <col style={{ width: '26.5%' }} />
                </>
              )}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-center text-slate-400 font-medium px-2 py-2.5" aria-label="Expand" />
                <th className="text-left text-slate-400 font-medium px-2 py-2.5">Name</th>
                <th className="text-left text-slate-400 font-medium px-2 py-2.5">Issuer</th>
                <th className="text-left text-slate-400 font-medium px-2 py-2.5">Currency</th>
                <th className="text-left text-slate-400 font-medium px-2 py-2.5">Ecosystem</th>
                {tableEditMode && (
                  <th className="text-center text-slate-400 font-medium px-2 py-2.5" aria-label="Actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={tableEditMode ? 6 : 5} className="text-slate-500 px-3 py-8 text-center">
                    No cards match.
                  </td>
                </tr>
              ) : (
                filtered.map((card) => (
                  <Fragment key={card.id}>
                    <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="px-0 py-1 overflow-visible align-middle">
                        <div className="flex items-center justify-center w-full">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCardIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(card.id)) next.delete(card.id)
                                else next.add(card.id)
                                return next
                              })
                            }
                            className="flex items-center justify-center p-1.5 rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-transform"
                            title={expandedCardIds.has(card.id) ? 'Collapse' : 'Expand fee & SUB'}
                            aria-expanded={expandedCardIds.has(card.id)}
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${expandedCardIds.has(card.id) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1 min-w-0 overflow-hidden align-middle">
                        <input
                          disabled={!tableEditMode}
                          className="w-full min-w-0 bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded focus:border-indigo-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          value={cellValue(card, 'name')}
                          onFocus={() =>
                            setEditingCell({ cardId: card.id, field: 'name', value: card.name })
                          }
                          onChange={(e) =>
                            setEditingCell((c) =>
                              c && c.cardId === card.id && c.field === 'name'
                                ? { ...c, value: e.target.value }
                                : c
                            )
                          }
                          onBlur={() => {
                            if (editingCell?.cardId === card.id && editingCell?.field === 'name')
                              patchCell(card, 'name', editingCell.value)
                            setEditingCell(null)
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 min-w-0 overflow-visible align-middle">
                        <select
                          disabled={!tableEditMode}
                          className="w-full min-w-0 bg-slate-800 border border-slate-600 text-white pl-2 pr-7 py-1.5 rounded focus:border-indigo-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed appearance-none bg-[length:1rem_1rem] bg-[right_0.25rem_center] bg-no-repeat"
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")' }}
                          value={card.issuer_id}
                          onChange={(e) => {
                            const issuerId = Number(e.target.value)
                            const curList = currenciesByIssuer(issuerId)
                            updateCard.mutate({
                              id: card.id,
                              payload: {
                                issuer_id: issuerId,
                                currency_id: curList[0]?.id ?? 0,
                              },
                            })
                          }}
                        >
                          {issuers.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 min-w-0 overflow-visible align-middle">
                        <select
                          disabled={!tableEditMode}
                          className="w-full min-w-0 bg-slate-800 border border-slate-600 text-white pl-2 pr-7 py-1.5 rounded focus:border-indigo-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed appearance-none bg-[length:1rem_1rem] bg-[right_0.25rem_center] bg-no-repeat"
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")' }}
                          value={card.currency_id}
                          onChange={(e) =>
                            updateCard.mutate({
                              id: card.id,
                              payload: { currency_id: Number(e.target.value) },
                            })
                          }
                        >
                          {currenciesByIssuer(card.issuer_id).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 min-w-0 overflow-visible align-middle">
                        <select
                          disabled={!tableEditMode}
                          className="w-full min-w-0 bg-slate-800 border border-slate-600 text-white pl-2 pr-7 py-1.5 rounded focus:border-indigo-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed appearance-none bg-[length:1rem_1rem] bg-[right_0.25rem_center] bg-no-repeat"
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")' }}
                          value={card.ecosystem_memberships?.[0]?.ecosystem_id ?? ''}
                          onChange={(e) => {
                            const id = Number(e.target.value)
                            updateCard.mutate({
                              id: card.id,
                              payload: {
                                ecosystem_memberships: id ? [{ ecosystem_id: id, key_card: false }] : [],
                              },
                            })
                          }}
                        >
                            <option value="">—</option>
                            {ecosystems.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                      </td>
                      {tableEditMode && (
                        <td className="px-0 py-1 overflow-visible align-middle">
                          <div className="flex items-center justify-center w-full">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(card)}
                              className="flex items-center justify-center text-xs px-2 py-1 rounded bg-red-900/60 text-red-200 hover:bg-red-800/60"
                              title="Delete card"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {expandedCardIds.has(card.id) && (
                      <tr key={`${card.id}-details`} className="border-b border-slate-800 bg-slate-800/30">
                        <td colSpan={tableEditMode ? 6 : 5} className="px-3 py-3">
                          <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                            {EXPANDED_ROW_FIELDS.map(({ field, label, widthClass }) => {
                              const raw =
                                field === 'first_year_fee'
                                  ? card.first_year_fee ?? ''
                                  : (card as unknown as Record<string, unknown>)[field]
                              return (
                                <InlineEditField
                                  key={field}
                                  card={card}
                                  field={field}
                                  label={label}
                                  widthClass={widthClass}
                                  tableEditMode={tableEditMode}
                                  value={raw as string | number | null}
                                  displayValue={cellValue(card, field)}
                                  editingCell={editingCell}
                                  setEditingCell={setEditingCell}
                                  patchCell={patchCell}
                                />
                              )
                            })}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMultiplierDialogCardId(card.id)
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600"
                            >
                              Edit category multipliers
                            </button>
                            <label
                              htmlFor={`card-business-${card.id}`}
                              className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Business
                              <input
                                id={`card-business-${card.id}`}
                                type="checkbox"
                                checked={card.business ?? false}
                                disabled={!tableEditMode}
                                onChange={(e) =>
                                  updateCard.mutate({
                                    id: card.id,
                                    payload: { business: e.target.checked },
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <CardFormModal
        key={editCardId ?? 'add'}
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false)
          setEditCardId(null)
          createCard.reset()
          updateCard.reset()
        }}
        initial={editCardId != null && cards ? cardToPayload(cards.find((c) => c.id === editCardId)!) : undefined}
        issuers={issuers}
        currencies={currencies}
        ecosystems={ecosystems}
        onSubmit={handleCardSubmit}
        isSubmitting={createCard.isPending || updateCard.isPending}
        error={createCard.error?.message ?? updateCard.error?.message ?? null}
      />
      <CardMultipliersDialog
        cardId={multiplierDialogCardId}
        onClose={() => setMultiplierDialogCardId(null)}
      />
    </div>
  )
}
