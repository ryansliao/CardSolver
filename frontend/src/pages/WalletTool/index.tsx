import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  walletsApi,
  type AddCardToWalletPayload,
  type RoadmapResponse,
  type RoadmapRuleStatus,
  type UpdateWalletCardPayload,
  type WalletCard,
  type WalletResultResponse,
} from '../../api/client'
import { today } from '../../utils/format'
import { AnnualSpendPanel } from './components/spend/AnnualSpendPanel'
import { WalletCardModal } from './components/cards/WalletCardModal'
import { CreateWalletModal } from './components/wallet/CreateWalletModal'
import { WalletResultsAndCurrenciesPanel } from './components/summary/WalletResultsAndCurrenciesPanel'
import { CardsListPanel } from './components/cards/CardsListPanel'
import { ApplicationRuleWarningModal } from './components/roadmap/ApplicationRuleWarningModal'
import { DEFAULT_USER_ID } from './constants'
import { queryKeys } from './lib/queryKeys'


type WalletCardModalOpen =
  | { mode: 'add' }
  | { mode: 'edit'; walletCard: WalletCard }

export default function WalletToolPage() {
  const queryClient = useQueryClient()
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [walletCardModal, setWalletCardModal] = useState<WalletCardModalOpen | null>(null)
  const [durationYears, setDurationYears] = useState(2)
  const [durationMonths, setDurationMonths] = useState(0)
  const [result, setResult] = useState<WalletResultResponse | null>(null)
  const [markEarnedCardId, setMarkEarnedCardId] = useState<number | null>(null)
  const [earnedDateInput, setEarnedDateInput] = useState('')
  const [closeCardId, setCloseCardId] = useState<number | null>(null)
  const [closeDateInput, setCloseDateInput] = useState('')
  const [applicationRuleWarnings, setApplicationRuleWarnings] = useState<RoadmapRuleStatus[] | null>(
    null
  )

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: queryKeys.wallets(),
    queryFn: () => walletsApi.list(DEFAULT_USER_ID),
  })

  const createWalletMutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      walletsApi.create({
        user_id: DEFAULT_USER_ID,
        name: payload.name,
        description: payload.description || null,
      }),
    onSuccess: (wallet) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets() })
      setSelectedWalletId(wallet.id)
      setShowCreateModal(false)
    },
  })

  const addCardMutation = useMutation({
    mutationFn: ({ walletId, payload }: { walletId: number; payload: AddCardToWalletPayload }) =>
      walletsApi.addCard(walletId, payload),
    onSuccess: async (_data, { walletId }) => {
      const prev = queryClient.getQueryData<RoadmapResponse>(queryKeys.roadmap(walletId))
      const prevViolatedIds = new Set(
        (prev?.rule_statuses ?? []).filter((r) => r.is_violated).map((r) => r.rule_id)
      )

      queryClient.invalidateQueries({ queryKey: queryKeys.wallets() })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
      setWalletCardModal(null)

      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.roadmap(walletId) })
        const fresh = await queryClient.fetchQuery({
          queryKey: queryKeys.roadmap(walletId),
          queryFn: () => walletsApi.roadmap(walletId),
        })
        const newlyViolated = fresh.rule_statuses.filter(
          (r) => r.is_violated && !prevViolatedIds.has(r.rule_id)
        )
        if (newlyViolated.length > 0) {
          setApplicationRuleWarnings(newlyViolated)
        }
      } catch {
        /* roadmap optional for add flow */
      }
    },
  })

  const removeCardMutation = useMutation({
    mutationFn: ({ walletId, cardId }: { walletId: number; cardId: number }) =>
      walletsApi.removeCard(walletId, cardId),
    onSuccess: (_data, { walletId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets() })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
    },
  })

  const resultsMutation = useMutation({
    mutationFn: ({
      walletId,
      params,
    }: {
      walletId: number
      params: {
        start_date: string
        end_date?: string
        duration_years?: number
        duration_months?: number
      }
    }) => walletsApi.results(walletId, params),
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(data.wallet_id) })
    },
  })

  // Single mutation for all wallet card updates (quick actions + edit modal).
  // Call sites handle their own UI side effects (clearing state / closing modals).
  const updateWalletCardMutation = useMutation({
    mutationFn: ({
      walletId,
      cardId,
      payload,
    }: {
      walletId: number
      cardId: number
      payload: UpdateWalletCardPayload
    }) => walletsApi.updateCard(walletId, cardId, payload),
    onSuccess: (_data, { walletId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets() })
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
    },
  })

  const { data: roadmap } = useQuery({
    queryKey: queryKeys.roadmap(selectedWalletId!),
    queryFn: () => walletsApi.roadmap(selectedWalletId!),
    enabled: selectedWalletId != null,
  })

  const selectedWallet = wallets?.find((w) => w.id === selectedWalletId)

  useEffect(() => {
    if (selectedWalletId == null || !selectedWallet) return

    setDurationYears(selectedWallet.calc_duration_years)
    setDurationMonths(selectedWallet.calc_duration_months)

    if (selectedWallet.calc_start_date) {
      // Auto-run the last calculation from today
      resultsMutation.mutate({
        walletId: selectedWalletId,
        params: {
          start_date: today(),
          duration_years: selectedWallet.calc_duration_years,
          duration_months: selectedWallet.calc_duration_months,
        },
      })
    }
  }, [selectedWalletId])

  function buildResultsParams() {
    return { start_date: today(), duration_years: durationYears, duration_months: durationMonths }
  }

  const durationTotalMonths = durationYears * 12 + durationMonths
  const windowParamsValid = durationTotalMonths > 0

  function calculate() {
    if (selectedWalletId == null || !windowParamsValid) return
    resultsMutation.mutate({ walletId: selectedWalletId, params: buildResultsParams() })
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
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Wallet Tool</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage wallets, add cards with sign-up bonus and min spend, and run calculations
            (fees, points, opportunity cost) over your chosen time frame.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium px-2 py-2"
            onClick={() => setShowCreateModal(true)}
          >
            + New wallet
          </button>
          <label htmlFor="wallet-select" className="sr-only">
            Wallet
          </label>
          <select
            id="wallet-select"
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 min-w-[10rem] max-w-[16rem]"
            value={selectedWalletId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setSelectedWalletId(v === '' ? null : Number(v))
              setResult(null)
            }}
          >
            <option value="">
              {wallets?.length === 0 ? 'No wallets — create one' : 'Select wallet…'}
            </option>
            {wallets?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-w-0">
        {!selectedWallet ? (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
            Select a wallet or create one to get started.
          </div>
        ) : (
          <>
            {/* Duration & Calculate */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-400">Duration</span>
              <select
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2"
                value={durationYears}
                onChange={(e) => setDurationYears(Number(e.target.value))}
                aria-label="Duration years"
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} yr
                  </option>
                ))}
              </select>
              <select
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                aria-label="Duration months"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} mo
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={calculate}
                disabled={
                  resultsMutation.isPending ||
                  (selectedWallet?.wallet_cards?.length ?? 0) === 0 ||
                  !windowParamsValid
                }
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"
              >
                {resultsMutation.isPending ? 'Calculating…' : 'Calculate'}
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,1fr)] gap-6">
              <AnnualSpendPanel walletId={selectedWalletId} />

              <CardsListPanel
                wallet={selectedWallet}
                roadmap={roadmap}
                markEarnedCardId={markEarnedCardId}
                earnedDateInput={earnedDateInput}
                closeCardId={closeCardId}
                closeDateInput={closeDateInput}
                isUpdating={updateWalletCardMutation.isPending}
                isRemoving={removeCardMutation.isPending}
                onSetMarkEarned={setMarkEarnedCardId}
                onSetEarnedDateInput={setEarnedDateInput}
                onSetCloseCard={setCloseCardId}
                onSetCloseDateInput={setCloseDateInput}
                onUpdateCard={(cardId, payload) => {
                  updateWalletCardMutation.mutate(
                    { walletId: selectedWallet.id, cardId, payload },
                    {
                      onSuccess: () => {
                        setMarkEarnedCardId(null)
                        setEarnedDateInput('')
                        setCloseCardId(null)
                        setCloseDateInput('')
                      },
                    }
                  )
                }}
                onRemoveCard={(cardId) =>
                  removeCardMutation.mutate({ walletId: selectedWallet.id, cardId })
                }
                onEditCard={(wc) => setWalletCardModal({ mode: 'edit', walletCard: wc })}
                onAddCard={() => setWalletCardModal({ mode: 'add' })}
              />

              <WalletResultsAndCurrenciesPanel
                walletId={selectedWalletId}
                result={result?.wallet ?? null}
                resultsError={
                  resultsMutation.isError
                    ? resultsMutation.error instanceof Error
                      ? resultsMutation.error
                      : new Error(String(resultsMutation.error))
                    : null
                }
                onCppChangeClearResult={() => setResult(null)}
              />
            </div>

          </>
        )}
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

      {applicationRuleWarnings && applicationRuleWarnings.length > 0 && (
        <ApplicationRuleWarningModal
          violations={applicationRuleWarnings}
          onClose={() => setApplicationRuleWarnings(null)}
        />
      )}

      {walletCardModal && selectedWallet && (
        <WalletCardModal
          key={walletCardModal.mode === 'add' ? 'add' : walletCardModal.walletCard.id}
          mode={walletCardModal.mode}
          walletCard={
            walletCardModal.mode === 'edit' ? walletCardModal.walletCard : undefined
          }
          existingCardIds={selectedWallet.wallet_cards.map((wc) => wc.card_id)}
          onClose={() => setWalletCardModal(null)}
          onAdd={(payload) =>
            addCardMutation.mutate({ walletId: selectedWallet.id, payload })
          }
          onSaveEdit={(payload) => {
            if (walletCardModal.mode !== 'edit') return
            updateWalletCardMutation.mutate(
              {
                walletId: selectedWallet.id,
                cardId: walletCardModal.walletCard.card_id,
                payload,
              },
              {
                onSuccess: () => {
                  setWalletCardModal(null)
                  setResult(null)
                },
              }
            )
          }}
          isLoading={addCardMutation.isPending || updateWalletCardMutation.isPending}
        />
      )}
    </div>
  )
}
