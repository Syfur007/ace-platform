import { useEffect, useMemo, useReducer } from 'react'

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

  const currentItem: ExamItem | null = useMemo(() => getCurrentItem(state), [state])

  return {
    state,
    dispatch: dispatch as (a: ExamAction) => void,
    currentItem,
  }
}
