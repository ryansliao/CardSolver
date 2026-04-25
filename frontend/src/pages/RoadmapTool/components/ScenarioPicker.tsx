import { useEffect, useRef, useState } from 'react'
import type { ScenarioSummary } from '../../../api/client'

interface Props {
  scenarios: ScenarioSummary[]
  currentId: number | null
  onSelect: (scenarioId: number) => void
  onAddScenario: () => void
  onMakeDefault: (scenarioId: number) => void
  onDelete: (scenarioId: number) => void
}

/** Picker for the active scenario under the user's single wallet. Mirrors
 * the look-and-feel of the previous WalletPicker but exposes per-row
 * "make default" and "delete" affordances. The backend auto-spawns a fresh
 * default if the last scenario gets deleted, so the delete affordance is
 * always enabled. */
export function ScenarioPicker({
  scenarios,
  currentId,
  onSelect,
  onAddScenario,
  onMakeDefault,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = scenarios.find((s) => s.id === currentId) ?? scenarios[0] ?? null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch scenario"
      >
        {current?.is_default && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-amber-400 shrink-0"
            aria-hidden
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
        <span className="truncate max-w-[14rem]">{current?.name ?? 'New Scenario'}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-1 left-0 z-50 min-w-[18rem] max-h-72 overflow-auto rounded-md bg-slate-800 border border-slate-700 shadow-lg py-1"
        >
          {scenarios.map((s) => (
            <div
              key={s.id}
              role="option"
              aria-selected={s.id === currentId}
              className={`group flex items-center gap-1 px-2 py-1.5 text-sm transition-colors hover:bg-slate-700 ${
                s.id === currentId ? 'text-indigo-300 font-semibold' : 'text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (s.id !== currentId) onSelect(s.id)
                }}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                title="Switch to this scenario"
              >
                {s.is_default ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-amber-400 shrink-0"
                    aria-hidden
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="truncate">{s.name}</span>
              </button>
              {!s.is_default && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMakeDefault(s.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300 hover:bg-amber-500/10 rounded transition-opacity"
                  title="Make default"
                >
                  Default
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(s.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition-opacity"
                title="Delete scenario"
                aria-label="Delete scenario"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
          <div className="border-t border-slate-700/60 my-1" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onAddScenario()
            }}
            className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-indigo-300 hover:bg-slate-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New scenario
          </button>
        </div>
      )}
    </div>
  )
}
