import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  walletsApi,
  walletCardCategoryPriorityApi,
  type AddCardToWalletPayload,
  type RoadmapResponse,
  type RoadmapRuleStatus,
  type UpdateWalletCardPayload,
  type WalletCard,
  type WalletResultResponse,
} from '../../api/client'
import { today } from '../../utils/format'
import { WalletCardModal } from './components/cards/WalletCardModal'
import { WalletSettingsModal } from './components/wallet/WalletSettingsModal'
import { WalletResultsAndCurrenciesPanel } from './components/summary/WalletResultsAndCurrenciesPanel'
import { CardsListPanel } from './components/cards/CardsListPanel'
import { DeleteCardWarningModal } from './components/cards/DeleteCardWarningModal'
import { ApplicationRuleWarningModal } from './components/roadmap/ApplicationRuleWarningModal'
import { useCreditLibrary } from './hooks/useCreditLibrary'
import { queryKeys } from './lib/queryKeys'


type WalletCardModalOpen =
  | { mode: 'add' }
  | { mode: 'edit'; walletCard: WalletCard }

export default function RoadmapToolPage() {
  const queryClient = useQueryClient()
  const [walletCardModal, setWalletCardModal] = useState<WalletCardModalOpen | null>(null)
  const [durationYears, setDurationYears] = useState(2)
  const [durationMonths, setDurationMonths] = useState(0)
  const [foreignSpendPercent, setForeignSpendPercent] = useState(0)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [result, setResult] = useState<WalletResultResponse | null>(null)
  const [closeCardId, setCloseCardId] = useState<number | null>(null)
  const [closeDateInput, setCloseDateInput] = useState('')
  const [applicationRuleWarnings, setApplicationRuleWarnings] = useState<RoadmapRuleStatus[] | null>(
    null
  )
  const [pendingRemoval, setPendingRemoval] = useState<{ cardId: number; cardName: string } | null>(
    null
  )

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: queryKeys.myWallet(),
    queryFn: () => walletsApi.getMyWallet(),
  })

  const walletId = wallet?.id ?? null

  // Warm the global credit library cache so the credits picker inside
  // WalletCardModal renders instantly when a card is opened.
  useCreditLibrary()

  const addCardMutation = useMutation({
    mutationFn: ({ walletId, payload }: { walletId: number; payload: AddCardToWalletPayload }) =>
      walletsApi.addCard(walletId, payload),
    onSuccess: async (_data, { walletId, payload }) => {
      const prev = queryClient.getQueryData<RoadmapResponse>(queryKeys.roadmap(walletId))
      const prevViolatedIds = new Set(
        (prev?.rule_statuses ?? []).filter((r) => r.is_violated).map((r) => r.rule_id)
      )

      if (payload.priority_category_ids && payload.priority_category_ids.length > 0) {
        await walletCardCategoryPriorityApi.set(walletId, payload.card_id, payload.priority_category_ids)
        queryClient.invalidateQueries({ queryKey: queryKeys.walletCategoryPriorities(walletId) })
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.myWallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
      setWalletCardModal(null)

      runCalculation()

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
      queryClient.invalidateQueries({ queryKey: queryKeys.myWallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
      runCalculation()
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
      queryClient.invalidateQueries({ queryKey: queryKeys.myWallet() })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.myWallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletSettingsCurrencyIds(walletId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCardCredits(walletId, null) })
      runCalculation()
    },
  })

  const { data: roadmap } = useQuery({
    queryKey: queryKeys.roadmap(walletId!),
    queryFn: () => walletsApi.roadmap(walletId!),
    enabled: walletId != null,
  })

  useEffect(() => {
    if (walletId == null || !wallet) return

    setDurationYears(wallet.calc_duration_years)
    setDurationMonths(wallet.calc_duration_months)
    setForeignSpendPercent(wallet.foreign_spend_percent ?? 0)

    if (wallet.calc_start_date) {
      resultsMutation.mutate({
        walletId: walletId,
        params: {
          start_date: today(),
          duration_years: wallet.calc_duration_years,
          duration_months: wallet.calc_duration_months,
        },
      })
    }
  }, [walletId, wallet?.id])

  function runCalculation(years = durationYears, months = durationMonths) {
    if (walletId == null) return
    if (years * 12 + months === 0) return
    resultsMutation.mutate({
      walletId: walletId,
      params: { start_date: today(), duration_years: years, duration_months: months },
    })
  }

  const isBusy = updateWalletCardMutation.isPending || removeCardMutation.isPending || resultsMutation.isPending

  if (walletLoading) {
    return (
      <div className="max-w-screen-xl mx-auto w-full shrink-0">
        <div className="text-center text-slate-400 py-20">Loading wallet…</div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0">
      {isBusy && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-indigo-500 animate-progress-bar" />
        </div>
      )}
      <header className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-white">Wallet Roadmap Tool</h1>
        <p className="text-slate-400 text-sm mt-1">
          Add cards to your future wallet and see how much value they will provide.
        </p>
      </header>

      <div className="min-w-0 flex-1 min-h-0 flex flex-col">
        {!wallet ? (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-500 shrink-0">
            Add cards and spending in your <Link to="/profile" className="text-indigo-400 hover:text-indigo-300">profile</Link> to get started.
          </div>
        ) : (
          <>
            <div
              className="grid flex-1 min-h-0 gap-6 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-2 xl:grid-rows-1"
            >
              <WalletResultsAndCurrenciesPanel
                walletId={walletId}
                result={result?.wallet ?? null}
                resultsError={
                  resultsMutation.isError
                    ? resultsMutation.error instanceof Error
                      ? resultsMutation.error
                      : new Error(String(resultsMutation.error))
                    : null
                }
                isCalculating={resultsMutation.isPending}
                durationYears={durationYears}
                durationMonths={durationMonths}
                photoSlugs={Object.fromEntries(
                  (wallet?.wallet_cards ?? []).map((wc) => [wc.card_id, wc.photo_slug])
                )}
                walletCards={wallet?.wallet_cards ?? []}
                onOpenSettings={() => setShowSettingsModal(true)}
                onCppChange={() => runCalculation()}
              />

              {/* Mirror the tab column on the Results panel so both inner panels
                  end up the same visual width inside their grid cells. */}
              <div className="flex h-full min-w-0 min-h-0 items-stretch">
                <div className="flex-1 min-w-0 min-h-0">
                  <CardsListPanel
                    wallet={wallet}
                    roadmap={roadmap}
                    inWalletLocked
                    closeCardId={closeCardId}
                    closeDateInput={closeDateInput}
                    isUpdating={updateWalletCardMutation.isPending}
                    isRemoving={removeCardMutation.isPending}
                    onSetCloseCard={setCloseCardId}
                    onSetCloseDateInput={setCloseDateInput}
                    onUpdateCard={(cardId, payload) => {
                      updateWalletCardMutation.mutate(
                        { walletId: wallet.id, cardId, payload },
                        {
                          onSuccess: () => {
                            setCloseCardId(null)
                            setCloseDateInput('')
                          },
                        }
                      )
                    }}
                    onRemoveCard={(cardId) => {
                      const wc = wallet.wallet_cards.find((c) => c.card_id === cardId)
                      setPendingRemoval({
                        cardId,
                        cardName: wc?.card_name ?? `Card #${cardId}`,
                      })
                    }}
                    onEditCard={(wc) => setWalletCardModal({ mode: 'edit', walletCard: wc })}
                    onAddCard={() => setWalletCardModal({ mode: 'add' })}
                  />
                </div>
                <div className="shrink-0 w-[35px]" aria-hidden />
              </div>
            </div>

          </>
        )}
      </div>

      {applicationRuleWarnings && applicationRuleWarnings.length > 0 && (
        <ApplicationRuleWarningModal
          violations={applicationRuleWarnings}
          onClose={() => setApplicationRuleWarnings(null)}
        />
      )}

      {pendingRemoval && wallet && (
        <DeleteCardWarningModal
          cardName={pendingRemoval.cardName}
          isLoading={removeCardMutation.isPending}
          onClose={() => setPendingRemoval(null)}
          onConfirm={() => {
            removeCardMutation.mutate(
              { walletId: wallet.id, cardId: pendingRemoval.cardId },
              { onSuccess: () => setPendingRemoval(null) },
            )
          }}
        />
      )}

      {showSettingsModal && wallet && (
        <WalletSettingsModal
          durationYears={durationYears}
          durationMonths={durationMonths}
          foreignSpendPercent={foreignSpendPercent}
          onDurationChange={(y, m) => {
            setDurationYears(y)
            setDurationMonths(m)
          }}
          onDurationCommit={(y, m) => runCalculation(y, m)}
          onForeignSpendChange={(pct) => setForeignSpendPercent(pct)}
          onForeignSpendCommit={(pct) => {
            setForeignSpendPercent(pct)
            walletsApi.update(wallet.id, { foreign_spend_percent: pct })
            runCalculation()
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {walletCardModal && wallet && (
        <WalletCardModal
          key={walletCardModal.mode === 'add' ? 'add' : walletCardModal.walletCard.id}
          mode={walletCardModal.mode}
          walletId={wallet.id}
          walletCard={
            walletCardModal.mode === 'edit' ? walletCardModal.walletCard : undefined
          }
          existingCardIds={wallet.wallet_cards.map((wc) => wc.card_id)}
          walletCardIds={wallet.wallet_cards.map((wc) => wc.card_id)}
          onClose={() => setWalletCardModal(null)}
          onAdd={(payload) =>
            addCardMutation.mutate({ walletId: wallet.id, payload })
          }
          onSaveEdit={(payload) => {
            if (walletCardModal.mode !== 'edit') return
            updateWalletCardMutation.mutate(
              {
                walletId: wallet.id,
                cardId: walletCardModal.walletCard.card_id,
                payload,
              },
              {
                onSuccess: () => {
                  setWalletCardModal(null)
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
