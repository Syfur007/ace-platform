import { useEffect, useMemo, useReducer } from 'react'

import { getExamSession } from '@/api/endpoints'
import { createDemoSessionSnapshot, examReducer, getCurrentItem, loadSnapshot, persistSnapshot } from '@/exam/engine'
import type { ExamAction } from '@/exam/engine'
import type { ExamItem, ExamSessionSnapshot } from '@/exam/types'

export function useExamEngine({ sessionId }: { sessionId: string }) {
  const initial = useMemo<ExamSessionSnapshot>(() => {
    const loaded = loadSnapshot(sessionId)
    return loaded ?? createDemoSessionSnapshot(sessionId)
  }, [sessionId])

  const [state, dispatch] = useReducer(examReducer, initial)

  useEffect(() => {
    persistSnapshot(state)
  }, [state])

  useEffect(() => {
    let cancelled = false

    const loadFromServer = async () => {
      try {
        const res = await getExamSession(sessionId)
        const snapshot = (res as any).snapshot as ExamSessionSnapshot | undefined
        if (!snapshot || typeof snapshot !== 'object') return
        if (!snapshot.sessionId || snapshot.sessionId !== sessionId) return
        if (cancelled) return
        dispatch({ type: 'hydrateFromSnapshot', snapshot } as ExamAction)
      } catch {
        // No-op: if session doesn't exist yet or user is offline, local snapshot remains.
      }
    }

    void loadFromServer()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const currentItem: ExamItem | null = useMemo(() => getCurrentItem(state), [state])

  return {
    state,
    dispatch: dispatch as (a: ExamAction) => void,
    currentItem,
  }
}
