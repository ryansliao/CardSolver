import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  walletCppApi,
  walletsApi,
  type CurrencyRead,
  type WalletCurrencyBalance,
} from '../../../../api/client'
import { ModalBackdrop } from '../../../../components/ModalBackdrop'
import { queryKeys } from '../../lib/queryKeys'

interface CurrencySettingsModalProps {
  walletId: number | null
  currency: CurrencyRead
  balance: WalletCurrencyBalance | null
  onClose: () => void
  /** Called when user CPP overrides change (clears stale calculate on parent). */
  onCppChange: () => void
}

export function CurrencySettingsModal({
  walletId,
  currency,
  balance,
  onClose,
  onCppChange,
}: CurrencySettingsModalProps) {
  const queryClient = useQueryClient()

  const setWalletCpp = useMutation({
    mutationFn: ({ currencyId, centsPerPoint }: { currencyId: number; centsPerPoint: number }) =>
      walletCppApi.set(walletId!, currencyId, centsPerPoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencies(walletId) })
      onCppChange()
    },
  })

  const invalidateWalletCurrencyQueries = () => {
    if (walletId == null) return
    queryClient.invalidateQueries({ queryKey: queryKeys.walletCurrencyBalances(walletId) })
  }

  const setInitialMutation = useMutation({
    mutationFn: ({ currencyId, initial }: { currencyId: number; initial: number }) =>
      walletsApi.setCurrencyInitialBalance(walletId!, currencyId, initial),
    onSuccess: () => {
      invalidateWalletCurrencyQueries()
    },
  })

  const deleteBalanceMutation = useMutation({
    mutationFn: (currencyId: number) => walletsApi.deleteCurrencyBalance(walletId!, currencyId),
    onSuccess: () => {
      invalidateWalletCurrencyQueries()
      onClose()
    },
  })

  const busy =
    setWalletCpp.isPending ||
    setInitialMutation.isPending ||
    deleteBalanceMutation.isPending

  const isCash = (currency.reward_kind ?? 'points') === 'cash'

  const myCpp = currency.user_cents_per_point != null
    ? currency.user_cents_per_point
    : currency.cents_per_point

  const handleCppBlur = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return
    setWalletCpp.mutate({ currencyId: currency.id, centsPerPoint: value })
  }

  const tracked = balance != null && walletId != null

  return (
    <ModalBackdrop
      onClose={onClose}
      className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-full max-w-sm shadow-xl"
    >
      <h2 className="text-base font-semibold text-white mb-4">{currency.name}</h2>

      <div className="space-y-4">
        {/* CPP — not applicable for cash (face value in stored units) */}
        {!isCash ? (
          <div>
            <label className="block text-xs text-slate-400 mb-1">¢ per point</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              key={`cpp-${currency.id}-${currency.user_cents_per_point ?? 'd'}-${currency.cents_per_point}`}
              defaultValue={myCpp}
              disabled={busy}
              onBlur={(e) => handleCppBlur(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Cash back is valued at face value (no cents-per-point override).
          </p>
        )}

        {/* Initial balance */}
        {tracked && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {isCash ? 'Initial balance (USD)' : 'Initial balance (pts)'}
            </label>
            <input
              type="number"
              min={0}
              step={isCash ? 0.01 : 1000}
              key={`init-${balance.id}-${balance.initial_balance}-${isCash ? 'c' : 'p'}`}
              defaultValue={isCash ? balance.initial_balance / 100 : balance.initial_balance}
              disabled={busy}
              onBlur={(e) => {
                const v = Number(e.target.value)
                if (!Number.isFinite(v) || v < 0) return
                const stored = isCash ? Math.round(v * 100) : v
                if (stored === balance.initial_balance) return
                setInitialMutation.mutate({ currencyId: currency.id, initial: stored })
              }}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-600 flex items-center justify-between gap-3">
        {tracked ? (
          <button
            type="button"
            disabled={busy}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
            onClick={() => {
              if (confirm(`Remove ${currency.name} balance tracking for this wallet?`))
                deleteBalanceMutation.mutate(currency.id)
            }}
          >
            Remove from wallet
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </ModalBackdrop>
  )
}
