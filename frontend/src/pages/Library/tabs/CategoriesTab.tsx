import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { spendApi } from '../../../api/client'

export function CategoriesTab() {
  const queryClient = useQueryClient()
  const [addName, setAddName] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['spend'],
    queryFn: spendApi.list,
  })

  const createCategory = useMutation({
    mutationFn: (category: string) =>
      spendApi.create({ category, annual_spend: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spend'] })
      setAddOpen(false)
      setAddName('')
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (category: string) => spendApi.delete(category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spend'] }),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addName.trim()) return
    createCategory.mutate(addName.trim())
  }

  const handleRemove = (category: string) => {
    if (!window.confirm(`Remove category "${category}"? Card multipliers for this category will remain.`)) return
    deleteCategory.mutate(category)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-slate-400 text-sm">
          Manage spend category names used across the app. Card-specific earn rates are edited per card in the Cards tab.
        </p>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 shrink-0"
        >
          Add category
        </button>
      </div>
      {isLoading && <p className="text-slate-400">Loading…</p>}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-slate-500 text-center">
                  No categories yet. Add one to define category names for card multipliers.
                </td>
              </tr>
            ) : (
              categories.map((sc) => (
                <tr
                  key={sc.id}
                  className="border-b border-slate-700/70 hover:bg-slate-800/50"
                >
                  <td className="px-5 py-3 text-white font-medium">{sc.category}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleRemove(sc.category)}
                      disabled={deleteCategory.isPending}
                      className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {(createCategory.isError || deleteCategory.isError) && (
          <div className="px-5 py-3 bg-red-950/50 border-t border-slate-700 text-red-400 text-sm">
            {createCategory.error?.message ?? deleteCategory.error?.message ?? 'Failed to save'}
          </div>
        )}
      </div>
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-sm w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Add category</h3>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Dining, Travel"
                  className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategory.isPending || !addName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {createCategory.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
