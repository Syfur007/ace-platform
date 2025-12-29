import { useParams } from 'react-router-dom'

import { StemValidationBox } from '@/exam/StemValidationBox'
import { useExamEngine } from '@/exam/useExamEngine'
import { useHeartbeatSync } from '@/exam/useHeartbeatSync'

export function ExamSimulationPage() {
  const { testId } = useParams()
  const engine = useExamEngine({ sessionId: testId ?? 'unknown-session' })

  const activeSection = engine.state.sections[engine.state.activeSectionIndex]
  const theta = activeSection ? (engine.state.thetaBySectionId[activeSection.id] ?? 0) : 0

  useHeartbeatSync({
    sessionId: engine.state.sessionId,
    getSnapshot: () => engine.state,
    enabled: engine.state.sessionId !== 'unknown-session',
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
            </div>
            <button
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              type="button"
              onClick={() => engine.dispatch({ type: 'advance' })}
            >
              Next Item
            </button>
          </div>

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
