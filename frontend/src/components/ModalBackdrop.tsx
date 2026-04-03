import { useEffect, useId, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  children: ReactNode
  /** Accessible label for the dialog (shown to screen readers). */
  label?: string
  className?: string
  zIndex?: string
}

/**
 * Shared modal backdrop with consistent styling, backdrop-click dismiss,
 * and Escape key handling. Wrap dialog content as children.
 */
export function ModalBackdrop({ onClose, children, label, className, zIndex = 'z-50' }: Props) {
  const titleId = useId()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/60 p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={label ? titleId : undefined}
      onClick={onClose}
    >
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
