import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  walletSpendItemsApi,
  type SpendCategory,
  type WalletSpendItem,
} from '../../../api/client'
import { queryKeys } from '../lib/queryKeys'

export interface SpendItemModalState {
  mode: 'add' | 'edit'
  itemId?: number
  category: SpendCategory
  amount: string
}

export function useWalletSpendCategoriesTable(walletId: number | null) {
  const queryClient = useQueryClient()
  const [editingAmountId, setEditingAmountId] = useState<number | null>(null)
  const [amountDraft, setAmountDraft] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [modal, setModal] = useState<SpendItemModalState | null>(null)
  const [mutationError, setMutationError] = useState<string | undefined>()

  const { data: spendItems = [], isLoading } = useQuery({
    queryKey: queryKeys.walletSpendItems(walletId),
    queryFn: () => walletSpendItemsApi.list(walletId!),
    enabled: walletId != null,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.walletSpendItems(walletId) })

  const createMutation = useMutation({
    mutationFn: (payload: { spend_category_id: number; amount: number }) =>
      walletSpendItemsApi.create(walletId!, payload),
    onSuccess: () => {
      invalidate()
      setModal(null)
      setMutationError(undefined)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      walletSpendItemsApi.update(walletId!, id, { amount }),
    onSuccess: () => {
      invalidate()
      setModal(null)
      setMutationError(undefined)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => walletSpendItemsApi.delete(walletId!, id),
    onSuccess: invalidate,
  })

  function startEditAmount(item: WalletSpendItem) {
    setEditingAmountId(item.id)
    setAmountDraft(String(Math.round(item.amount)))
  }

  function commitAmount(item: WalletSpendItem) {
    const val = parseFloat(amountDraft)
    if (!isNaN(val) && val >= 0 && val !== item.amount) {
      updateMutation.mutate({ id: item.id, amount: val })
    }
    setEditingAmountId(null)
  }

  function openPicker() {
    setMutationError(undefined)
    setShowPicker(true)
  }

  function handlePickCategory(category: SpendCategory) {
    setShowPicker(false)
    setMutationError(undefined)
    setModal({ mode: 'add', category, amount: '' })
  }

  function openEdit(item: WalletSpendItem) {
    setMutationError(undefined)
    setModal({
      mode: 'edit',
      itemId: item.id,
      category: item.spend_category,
      amount: String(Math.round(item.amount)),
    })
  }

  function handleSave(amount: number) {
    if (!modal) return
    if (modal.mode === 'add') {
      createMutation.mutate({ spend_category_id: modal.category.id, amount })
    } else if (modal.itemId != null) {
      updateMutation.mutate({ id: modal.itemId, amount })
    }
  }

  function closeModal() {
    setModal(null)
    setMutationError(undefined)
  }

  function requestDeleteItem(item: WalletSpendItem) {
    if (window.confirm(`Remove "${item.spend_category.category}" from spend?`)) {
      deleteMutation.mutate(item.id)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return {
    spendItems,
    isLoading,
    editingAmountId,
    amountDraft,
    setAmountDraft,
    startEditAmount,
    commitAmount,
    cancelEditAmount: () => setEditingAmountId(null),
    showPicker,
    closePicker: () => setShowPicker(false),
    openPicker,
    handlePickCategory,
    modal,
    openEdit,
    handleSave,
    closeModal,
    mutationError,
    isSaving,
    deleteMutationIsPending: deleteMutation.isPending,
    requestDeleteItem,
  }
}
