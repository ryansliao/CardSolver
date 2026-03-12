import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currenciesApi, type CurrencyRead } from '../../../api/client'
import { DEFAULT_USER_ID } from '../constants'

interface MyCppModalProps {
  onClose: () => void
  onCppChange: () => void
}

export function MyCppModal({
  onClose,
  onCppChange,
}: MyCppModalProps) {
  const queryClient = useQueryClient()
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ['currencies', DEFAULT_USER_ID],
    queryFn: () => currenciesApi.list(DEFAULT_USER_ID),
  })
  const setUserCpp = useMutation({
    mutationFn: ({ currencyId, centsPerPoint }: { currencyId: number; centsPerPoint: number }) =>
      currenciesApi.setUserCpp(DEFAULT_USER_ID, currencyId, centsPerPoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies', DEFAULT_USER_ID] })
      onCppChange()
    },
  })
  const deleteUserCpp = useMutation({
    mutationFn: (currencyId: number) =>
      currenciesApi.deleteUserCpp(DEFAULT_USER_ID, currencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies', DEFAULT_USER_ID] })
      onCppChange()
    },
  })

  const myCpp = (c: CurrencyRead) =>
    c.user_cents_per_point != null ? c.user_cents_per_point : c.cents_per_point

  const handleBlur = (c: CurrencyRead, value: number) => {
    if (!Number.isFinite(value) || value <= 0) return
    if (value === c.cents_per_point) {
      deleteUserCpp.mutate(c.id)
    } else {
      setUserCpp.mutate({ currencyId: c.id, centsPerPoint: value })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-1">My point valuations</h2>
        <p className="text-slate-400 text-sm mb-4">
          Set your cents-per-point for each currency. These values are used when calculating wallet EV.
        </p>
        {isLoading ? (
          <div className="text-slate-500 text-sm py-8 text-center">Loading…</div>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="py-2 pr-3">Currency</th>
                  <th className="py-2 pr-3 w-20">Default</th>
                  <th className="py-2 pr-3 w-24">My ¢/pt</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-3 text-white font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-slate-400">{c.cents_per_point}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        defaultValue={myCpp(c)}
                        onBlur={(e) => {
                          const v = Number(e.target.value)
                          handleBlur(c, v)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-600">
          <button
            type="button"
            className="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded-lg"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
