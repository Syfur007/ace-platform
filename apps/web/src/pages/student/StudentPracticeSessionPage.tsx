import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useMutation, useQuery } from '@tanstack/react-query'

import { getPracticeSession, getPracticeSessionSummary, submitPracticeAnswer } from '@/api/endpoints'

export function StudentPracticeSessionPage() {
  const { sessionId } = useParams()

  const sessionQuery = useQuery({
    queryKey: ['practice-session', sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => getPracticeSession(String(sessionId)),
    refetchOnWindowFocus: false,
  })

  const summaryQuery = useQuery({
    queryKey: ['practice-summary', sessionId],
    enabled: Boolean(sessionId) && sessionQuery.data?.status === 'finished',
    queryFn: () => getPracticeSessionSummary(String(sessionId)),
    refetchOnWindowFocus: false,
  })

  const submitMutation = useMutation({
    mutationFn: ({ questionId, choiceId }: { questionId: string; choiceId: string }) =>
      submitPracticeAnswer(String(sessionId), { questionId, choiceId, ts: new Date().toISOString() }),
    onSuccess: () => {
      void sessionQuery.refetch()
    },
  })

  const question = sessionQuery.data?.question ?? null

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [lastFeedback, setLastFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)

  const canSubmit = Boolean(question) && selectedChoiceId != null && !submitMutation.isPending

  const canStartOver = useMemo(() => sessionQuery.data?.status === 'finished', [sessionQuery.data?.status])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Practice Session</h1>
          <Link to="/student/practice" className="text-sm text-slate-600 hover:underline">
            End session
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <div className="rounded border border-slate-200 px-2 py-1">Session: {sessionId ?? 'unknown'}</div>
          {sessionQuery.data ? (
            <>
              <div className="rounded border border-slate-200 px-2 py-1">Mode: {sessionQuery.data.isTimed ? 'Timed' : 'Untimed'}</div>
              <div className="rounded border border-slate-200 px-2 py-1">Questions: {sessionQuery.data.total}</div>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded border border-slate-200 p-4 md:col-span-2">
          {sessionQuery.isLoading ? (
            <div className="text-sm text-slate-600">Loading session…</div>
          ) : sessionQuery.isError ? (
            <div className="text-sm text-rose-700">
              Failed to load session. <Link to="/auth" className="underline">Sign in</Link>
            </div>
          ) : sessionQuery.data?.status === 'finished' ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Session complete</div>
              {summaryQuery.data ? (
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-sm">Correct: {summaryQuery.data.correctCount} / {summaryQuery.data.total}</div>
                  <div className="text-sm text-slate-600">Accuracy: {Math.round(summaryQuery.data.accuracy * 100)}%</div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Loading summary…</div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link to="/student/practice" className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  Back to Practice
                </Link>
                {canStartOver ? (
                  <Link to="/student/practice" className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    Start another session
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Question {(sessionQuery.data?.currentIndex ?? 0) + 1} / {sessionQuery.data?.total ?? 0}
                </div>
                <div className="text-sm text-slate-600">Correct: {sessionQuery.data?.correctCount ?? 0}</div>
              </div>

              <div className="mt-4 space-y-4">
                {question ? <div className="text-sm font-medium">{question.prompt}</div> : null}

                {question ? (
                  <div className="space-y-2">
                    {question.choices.map((choice) => {
                      const isSelected = selectedChoiceId === choice.id
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => {
                            setSelectedChoiceId(choice.id)
                            setLastFeedback(null)
                          }}
                          className={[
                            'w-full rounded border px-3 py-2 text-left text-sm',
                            'border-slate-200 hover:bg-slate-50',
                            isSelected ? 'bg-slate-100' : 'bg-white',
                          ].join(' ')}
                          aria-pressed={isSelected}
                          disabled={submitMutation.isPending}
                        >
                          {choice.text}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">No question available.</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!question || !selectedChoiceId) return
                      const res = await submitMutation.mutateAsync({ questionId: question.id, choiceId: selectedChoiceId })
                      setLastFeedback({ correct: res.correct, explanation: res.explanation })
                      setSelectedChoiceId(null)
                    }}
                    disabled={!canSubmit}
                    className={[
                      'rounded border px-3 py-2 text-sm',
                      canSubmit ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 text-slate-400',
                    ].join(' ')}
                  >
                    {submitMutation.isPending ? 'Submitting…' : 'Submit'}
                  </button>
                </div>

                {submitMutation.isError ? (
                  <div className="text-sm text-rose-700">
                    Failed to submit answer. <Link to="/auth" className="underline">Sign in</Link>
                  </div>
                ) : null}

                {lastFeedback ? (
                  <div className="rounded border border-slate-200 p-3">
                    <div className="text-sm font-medium">{lastFeedback.correct ? 'Correct' : 'Not quite'}</div>
                    <div className="mt-1 text-sm text-slate-600">{lastFeedback.explanation}</div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Session actions</div>
          <div className="mt-3 space-y-2 text-sm">
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Flag question
            </button>
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Explain more (planned)
            </button>
            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              This runner is now API-backed (in-memory). Next steps: persist sessions, add review mode, and integrate a real question bank.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
