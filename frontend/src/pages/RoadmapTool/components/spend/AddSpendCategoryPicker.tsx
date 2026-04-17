import type { UserSpendCategory } from '../../../../api/client'
import { useUserSpendCategories } from '../../../../hooks/useUserSpendCategories'

interface Props {
  existingCategoryIds: Set<number>
  onSelect: (category: UserSpendCategory) => void
  onClose: () => void
}

function CategoryRow({
  category,
  existingIds,
  onSelect,
}: {
  category: UserSpendCategory
  existingIds: Set<number>
  onSelect: (cat: UserSpendCategory) => void
}) {
  const alreadyAdded = existingIds.has(category.id)

  return (
    <div className="flex items-center">
      <button
        onClick={() => !alreadyAdded && onSelect(category)}
        disabled={alreadyAdded}
        className={`flex-1 text-left px-4 py-2 text-sm transition-colors ${
          alreadyAdded
            ? 'text-slate-600 cursor-default'
            : 'text-slate-200 hover:bg-slate-800'
        }`}
      >
        <span>{category.name}</span>
        {alreadyAdded && (
          <span className="ml-2 text-xs text-slate-600">added</span>
        )}
      </button>
    </div>
  )
}

export default function AddSpendCategoryPicker({ existingCategoryIds, onSelect, onClose }: Props) {
  const { data: categories = [], isLoading } = useUserSpendCategories()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-xl w-full m-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-bold text-white">Add spend category</h3>
          <p className="text-xs text-slate-400 mt-1">
            Pick a category to track your annual spend.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
          {isLoading && (
            <p className="text-slate-500 text-xs px-4 py-3">Loading…</p>
          )}
          {!isLoading && categories.length === 0 && (
            <p className="text-slate-500 text-xs px-4 py-3">No categories available.</p>
          )}
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              existingIds={existingCategoryIds}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="p-3 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full text-sm text-slate-400 hover:text-slate-200 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
