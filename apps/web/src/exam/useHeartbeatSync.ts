import { useEffect, useRef } from 'react'

import { postHeartbeat } from '@/api/endpoints'
import type { ExamSessionSnapshot } from '@/exam/types'

export function useHeartbeatSync({
  sessionId,
  examPackageId,
  enabled,
  getSnapshot,
  onAttempt,
}: {
  sessionId: string
	// Optional. If omitted, backend will auto-resolve only when exactly 1 enrollment exists.
	examPackageId?: string | null
  enabled: boolean
  getSnapshot: () => ExamSessionSnapshot
  onAttempt?: () => void
}) {
  const snapshotRef = useRef(getSnapshot)
  snapshotRef.current = getSnapshot

  useEffect(() => {
    if (!enabled) return

    let stopped = false

    const tick = async () => {
      if (stopped) return

      const snapshot = snapshotRef.current()
      try {
        onAttempt?.()
        await postHeartbeat(sessionId, {
          sessionId,
          examPackageId: examPackageId ?? null,
          ts: new Date().toISOString(),
          snapshot,
        })
      } catch {
        // Intentionally swallow for now; UX can surface offline state.
      }
    }

    const id = window.setInterval(tick, 15_000)
    void tick()

    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [enabled, sessionId, examPackageId])
}
