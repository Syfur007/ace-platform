import { useEffect, useRef } from 'react'

import { useParams } from 'react-router-dom'

import { useMutation, useQuery } from '@tanstack/react-query'

import { getExamSession, recordExamEvent, submitExamSession } from '@/api/endpoints'

import { StemValidationBox } from '@/exam/StemValidationBox'
import { useExamEngine } from '@/exam/useExamEngine'
import { useHeartbeatSync } from '@/exam/useHeartbeatSync'

export function ExamSimulationPage() {
  const { testId } = useParams()
  const engine = useExamEngine({ sessionId: testId ?? 'unknown-session' })
  const lastIntegrityEventAtRef = useRef<Record<string, number>>({})

  const sessionQuery = useQuery({
    queryKey: ['exam-session', engine.state.sessionId],
    enabled: engine.state.sessionId !== 'unknown-session',
    queryFn: () => getExamSession(engine.state.sessionId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const submitMutation = useMutation({
    mutationFn: () => submitExamSession(engine.state.sessionId),
    onSuccess: () => {
      void sessionQuery.refetch()
    },
  })

  const status = sessionQuery.data?.status ?? 'active'
  const isFinished = status === 'finished'

  useEffect(() => {
    const sessionId = engine.state.sessionId
    if (!sessionId || sessionId === 'unknown-session') return
    if (isFinished) return

    const emit = (eventType: string, payload?: Record<string, unknown>) => {
      const now = Date.now()
      const lastAt = lastIntegrityEventAtRef.current[eventType] ?? 0
      if (now - lastAt < 1500) return
      lastIntegrityEventAtRef.current[eventType] = now

      void recordExamEvent(sessionId, {
        eventType,
        ts: new Date().toISOString(),
        payload: payload ?? null,
      }).catch(() => {
        // No-op: integrity events should never break the exam UI.
      })
    }

    const onVisibilityChange = () => {
      emit(document.visibilityState === 'hidden' ? 'visibility_hidden' : 'visibility_visible', {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        href: window.location.href,
      })
    }

    const onFocus = () => {
      emit('window_focus', { href: window.location.href })
    }

    const onBlur = () => {
      emit('window_blur', { href: window.location.href })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [engine.state.sessionId, isFinished])

  const activeSection = engine.state.sections[engine.state.activeSectionIndex]
  const theta = activeSection ? (engine.state.thetaBySectionId[activeSection.id] ?? 0) : 0

  useHeartbeatSync({
    sessionId: engine.state.sessionId,
    getSnapshot: () => engine.state,
    enabled: engine.state.sessionId !== 'unknown-session' && !isFinished,
    onAttempt: () => engine.dispatch({ type: 'markHeartbeatAttempt' }),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Real-Time Exam Simulation</h2>
        <p className="text-sm text-slate-600">
          15s heartbeat, local persistence, section-level adaptivity hook points, and multi-modal module placeholders.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Session</div>
              <div className="font-medium">{engine.state.sessionId}</div>
              <div className="mt-1 text-xs text-slate-500">Status: {isFinished ? 'Finished' : 'In progress'}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={[
                  'rounded border px-3 py-2 text-sm',
                  isFinished ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                ].join(' ')}
                type="button"
                onClick={() => engine.dispatch({ type: 'advance' })}
                disabled={isFinished}
              >
                Next Item
              </button>
              <button
                className={[
                  'rounded border px-3 py-2 text-sm',
                  submitMutation.isPending || isFinished
                    ? 'border-slate-100 text-slate-400'
                    : 'border-slate-200 hover:bg-slate-50',
                ].join(' ')}
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || isFinished}
              >
                {isFinished ? 'Submitted' : submitMutation.isPending ? 'Submitting…' : 'Submit Test'}
              </button>
            </div>
          </div>

          {submitMutation.isError ? <div className="mt-3 text-sm text-rose-700">Failed to submit test.</div> : null}

          <div className="mt-4 rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Current Item (QTI-backed model)</div>
            <div className="mt-2 text-sm">
              <div className="font-medium">{engine.currentItem?.prompt ?? 'No item loaded'}</div>
              <div className="mt-2 text-xs text-slate-500">Modality: {engine.currentItem?.modality ?? 'n/a'}</div>
              <div className="mt-1 text-xs text-slate-500">Section theta (IRT): {theta.toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-4">
            <StemValidationBox
              label="STEM validation box (algebraic equivalence)"
              expectedExpression="(x+1)^2"
              variables={['x']}
              value={engine.state.draftAnswer}
              onChange={(value) => engine.dispatch({ type: 'setDraftAnswer', value })}
            />
          </div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="font-medium">Heartbeat</div>
          <div className="mt-1 text-sm text-slate-600">Every 15s, the session snapshot syncs to backend.</div>
          <div className="mt-3 text-xs text-slate-500">Last local save: {new Date(engine.state.lastLocalPersistedAt).toLocaleTimeString()}</div>
          <div className="mt-1 text-xs text-slate-500">Last heartbeat attempt: {engine.state.lastHeartbeatAttemptAt ? new Date(engine.state.lastHeartbeatAttemptAt).toLocaleTimeString() : 'n/a'}</div>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="font-medium">IELTS Multi-Modal Modules</div>
        <div className="mt-1 text-sm text-slate-600">Listening/audio and speaking/recording UI are stubbed as modules.</div>
      </div>
    </div>
  )
}
