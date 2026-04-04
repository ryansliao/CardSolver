import type { WalletSpendItem } from '../../../../api/client'
import { formatMoney } from '../../../../utils/format'
import { useWalletSpendCategoriesTable } from '../../hooks/useWalletSpendCategoriesTable'
import AddSpendCategoryPicker from './AddSpendCategoryPicker'
import SpendItemModal from './SpendCategoryMappingModal'

type SpendItemRowProps = {
  item: WalletSpendItem
  isEditingAmount: boolean
  amountDraft: string
  onAmountDraftChange: (value: string) => void
  onStartEditAmount: () => void
  onCommitAmount: () => void
  onCancelEditAmount: () => void
  onOpenEdit: () => void
  onRequestDelete: () => void
  deletePending: boolean
}

function SpendItemRow({
  item,
  isEditingAmount,
  amountDraft,
  onAmountDraftChange,
  onStartEditAmount,
  onCommitAmount,
  onCancelEditAmount,
  onOpenEdit,
  onRequestDelete,
  deletePending,
}: SpendItemRowProps) {
  const cat = item.spend_category
  const isSystem = cat.is_system

  return (
    <div className="border-b border-slate-800 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-200 font-medium flex-1 truncate flex items-center gap-2 min-w-0">
          <span className="truncate">{cat.category}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isEditingAmount ? (
            <input
              autoFocus
              className="w-24 bg-slate-700 text-white text-sm text-right px-2 py-0.5 rounded border border-indigo-500 outline-none"
              value={amountDraft}
              onChange={(e) => onAmountDraftChange(e.target.value)}
              onBlur={onCommitAmount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitAmount()
                if (e.key === 'Escape') onCancelEditAmount()
              }}
            />
          ) : (
            <button
              className="text-sm text-indigo-300 hover:text-indigo-100 w-24 text-right"
              onClick={onStartEditAmount}
            >
              {formatMoney(item.amount)}
            </button>
          )}
          {!isSystem && (
            <button
              onClick={onOpenEdit}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700"
              aria-label="Edit spend"
              title="Edit"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {!isSystem && (
            <button
              onClick={onRequestDelete}
              disabled={deletePending}
              className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-50"
              aria-label="Delete spend category"
              title="Delete"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AnnualSpendPanel({ walletId }: { walletId: number | null }) {
  const {
    spendItems,
    isLoading,
    editingAmountId,
    amountDraft,
    setAmountDraft,
    startEditAmount,
    commitAmount,
    cancelEditAmount,
    showPicker,
    closePicker,
    openPicker,
    handlePickCategory,
    modal,
    openEdit,
    handleSave,
    closeModal,
    mutationError,
    isSaving,
    deleteMutationIsPending,
    requestDeleteItem,
  } = useWalletSpendCategoriesTable(walletId)

  const existingCategoryIds = new Set(spendItems.map((i) => i.spend_category_id))

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-w-0 flex flex-col max-h-[min(72vh,820px)]">
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Annual Spend</h2>
      <p className="text-xs text-slate-500 mb-3">Click an amount to edit inline.</p>
      <div className="min-h-0 overflow-y-auto flex-1">
        {isLoading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : (
          <div className="space-y-1">
            {spendItems.length === 0 && (
              <p className="text-slate-500 text-xs pb-2">
                No spend categories yet. Add one to configure your annual spend.
              </p>
            )}
            {spendItems.map((item) => (
              <SpendItemRow
                key={item.id}
                item={item}
                isEditingAmount={editingAmountId === item.id}
                amountDraft={amountDraft}
                onAmountDraftChange={setAmountDraft}
                onStartEditAmount={() => startEditAmount(item)}
                onCommitAmount={() => commitAmount(item)}
                onCancelEditAmount={cancelEditAmount}
                onOpenEdit={() => openEdit(item)}
                onRequestDelete={() => requestDeleteItem(item)}
                deletePending={deleteMutationIsPending}
              />
            ))}

            <button
              onClick={openPicker}
              className="w-full mt-2 text-sm text-indigo-400 hover:text-indigo-300 py-1.5 rounded-lg hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-600 transition-colors"
            >
              + Add Spend Category
            </button>

            {showPicker && (
              <AddSpendCategoryPicker
                existingCategoryIds={existingCategoryIds}
                onSelect={handlePickCategory}
                onClose={closePicker}
              />
            )}

            {modal && (
              <SpendItemModal
                initial={modal}
                onSave={handleSave}
                onClose={closeModal}
                isSaving={isSaving}
                error={mutationError}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
