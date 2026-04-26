import { useEffect, useState } from 'react'
import { today } from '../utils/format'

/** Reactive YYYY-MM-DD for the current local date. Re-renders the consumer
 * just after midnight so date-sensitive computations (SUB earned status,
 * "today" cursor on the timeline, stale-calc detection) stay current
 * without a page refresh. */
export function useToday(): string {
  const [value, setValue] = useState(today)

  useEffect(() => {
    function scheduleNext(): number {
      const now = new Date()
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 1, 0, // 1 second past midnight to avoid race
      )
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime())
      return window.setTimeout(() => {
        setValue(today())
        timer = scheduleNext()
      }, delay)
    }
    let timer = scheduleNext()
    // Resync on tab refocus — if the laptop slept past midnight the
    // setTimeout doesn't fire on schedule, so re-check on visibility.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const fresh = today()
        setValue((prev) => (prev === fresh ? prev : fresh))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return value
}
