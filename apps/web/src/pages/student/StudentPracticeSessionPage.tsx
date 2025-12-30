import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useMutation, useQuery } from '@tanstack/react-query'

import { getPracticeSession, getPracticeSessionReview, getPracticeSessionSummary, pausePracticeSession, resumePracticeSession, submitPracticeAnswer } from '@/api/endpoints'

export function StudentPracticeSessionPage() {
  const { sessionId } = useParams()

  const [nowMs, setNowMs] = useState(() => Date.now())

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

  const reviewQuery = useQuery({
    queryKey: ['practice-review', sessionId],
    enabled: Boolean(sessionId) && sessionQuery.data?.status === 'finished',
    queryFn: () => getPracticeSessionReview(String(sessionId)),
    refetchOnWindowFocus: false,
  })

  const submitMutation = useMutation({
    mutationFn: ({ questionId, choiceId }: { questionId: string; choiceId: string }) =>
      submitPracticeAnswer(String(sessionId), { questionId, choiceId, ts: new Date().toISOString() }),
    onSuccess: () => {
      void sessionQuery.refetch()
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => pausePracticeSession(String(sessionId)),
    onSuccess: () => {
      void sessionQuery.refetch()
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => resumePracticeSession(String(sessionId)),
    onSuccess: () => {
      void sessionQuery.refetch()
    },
  })

  const question = sessionQuery.data?.question ?? null

  const isTimed = sessionQuery.data?.isTimed ?? false
  const status = sessionQuery.data?.status
  const startedAt = sessionQuery.data?.startedAt ?? null
  const timeLimitSeconds = sessionQuery.data?.timeLimitSeconds ?? null
  const currentQuestionStartedAt = sessionQuery.data?.currentQuestionStartedAt ?? null
  const questionTimingsSeconds = sessionQuery.data?.questionTimingsSeconds ?? null

  useEffect(() => {
    if (status !== 'active') return
    // Use a wall-clock timestamp and update it every second.
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status])
  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return null
    const startedMs = Date.parse(startedAt)
    if (Number.isNaN(startedMs)) return null
    return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  }, [nowMs, startedAt])

  const timeRemainingSeconds = useMemo(() => {
    if (timeLimitSeconds == null || elapsedSeconds == null) return null
    return Math.max(0, timeLimitSeconds - elapsedSeconds)
  }, [elapsedSeconds, timeLimitSeconds])

  const currentQuestionElapsedSeconds = useMemo(() => {
    if (!currentQuestionStartedAt) return null
    const startedMs = Date.parse(currentQuestionStartedAt)
    if (Number.isNaN(startedMs)) return null
    return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  }, [currentQuestionStartedAt, nowMs])

  const avgAnsweredSeconds = useMemo(() => {
    if (!questionTimingsSeconds || typeof questionTimingsSeconds !== 'object') return null
    const values = Object.values(questionTimingsSeconds).filter((v) => typeof v === 'number' && Number.isFinite(v))
    if (values.length === 0) return null
    const sum = values.reduce((a, b) => a + b, 0)
    return Math.round(sum / values.length)
  }, [questionTimingsSeconds])

  const totalAnsweredSeconds = useMemo(() => {
    if (!questionTimingsSeconds || typeof questionTimingsSeconds !== 'object') return null
    const values = Object.values(questionTimingsSeconds).filter((v) => typeof v === 'number' && Number.isFinite(v))
    if (values.length === 0) return null
    return values.reduce((a, b) => a + b, 0)
  }, [questionTimingsSeconds])

  const finishedTimeStats = useMemo(() => {
    if (!reviewQuery.data) return null
    const totalSeconds = reviewQuery.data.items.reduce((acc, item) => acc + (item.timeTakenSeconds ?? 0), 0)
    const answered = reviewQuery.data.items.filter((item) => item.selectedChoiceId != null)
    const answeredSeconds = answered.reduce((acc, item) => acc + (item.timeTakenSeconds ?? 0), 0)
    const avgAnswered = answered.length > 0 ? Math.round(answeredSeconds / answered.length) : null
    return { totalSeconds, avgAnswered }
  }, [reviewQuery.data])

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [lastFeedback, setLastFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)

  const canSubmit = Boolean(question) && selectedChoiceId != null && !submitMutation.isPending && status === 'active'

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
              <div className="rounded border border-slate-200 px-2 py-1">Mode: {sessionQuery.data.isTimed ? 'Ironman (Timed)' : 'Untimed'}</div>
              <div className="rounded border border-slate-200 px-2 py-1">Questions: {sessionQuery.data.total}</div>
              {sessionQuery.data.isTimed && timeRemainingSeconds != null ? (
                <div className="rounded border border-slate-200 px-2 py-1">Time remaining: {timeRemainingSeconds}s</div>
              ) : null}
              {currentQuestionElapsedSeconds != null && status === 'active' ? (
                <div className="rounded border border-slate-200 px-2 py-1">This question: {currentQuestionElapsedSeconds}s</div>
              ) : null}
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
              Failed to load session. <Link to="/student/auth" className="underline">Sign in</Link>
            </div>
          ) : sessionQuery.data?.status === 'finished' ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Session complete</div>
              {summaryQuery.data ? (
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-sm">Correct: {summaryQuery.data.correctCount} / {summaryQuery.data.total}</div>
                  <div className="text-sm text-slate-600">Accuracy: {Math.round(summaryQuery.data.accuracy * 100)}%</div>
                  {finishedTimeStats?.totalSeconds != null ? (
                    <div className="mt-2 text-sm">Total time: {finishedTimeStats.totalSeconds}s</div>
                  ) : totalAnsweredSeconds != null ? (
                    <div className="mt-2 text-sm">Total time: {totalAnsweredSeconds}s</div>
                  ) : null}
                  {finishedTimeStats?.avgAnswered != null ? (
                    <div className="text-sm text-slate-600">Avg (answered): {finishedTimeStats.avgAnswered}s</div>
                  ) : avgAnsweredSeconds != null ? (
                    <div className="text-sm text-slate-600">Avg (answered): {avgAnsweredSeconds}s</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-slate-600">Loading summary…</div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Review</div>
                {reviewQuery.isLoading ? (
                  <div className="text-sm text-slate-600">Loading review…</div>
                ) : reviewQuery.isError ? (
                  <div className="text-sm text-rose-700">Failed to load review.</div>
                ) : reviewQuery.data ? (
                  <div className="space-y-3">
                    {reviewQuery.data.items.map((item) => {
                      const choicesById = new Map(item.question.choices.map((c) => [c.id, c.text]))
                      const selectedText = item.selectedChoiceId ? choicesById.get(item.selectedChoiceId) ?? item.selectedChoiceId : null
                      const correctText = choicesById.get(item.correctChoiceId) ?? item.correctChoiceId

                      const verdict = item.correct == null ? 'Not answered' : item.correct ? 'Correct' : 'Incorrect'

                      return (
                        <div key={item.question.id} className="rounded border border-slate-200 p-3">
                          <div className="text-sm font-medium">Question {item.index + 1}</div>
                          <div className="mt-1 text-sm">{item.question.prompt}</div>

                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <div>
                              <span className="font-medium">Verdict:</span> {verdict}
                            </div>
                            <div>
                              <span className="font-medium">Selected:</span> {selectedText ?? '—'}
                            </div>
                            <div>
                              <span className="font-medium">Correct answer:</span> {correctText}
                            </div>
                            <div>
                              <span className="font-medium">Time:</span> {item.timeTakenSeconds}s
                            </div>
                            {item.explanation ? (
                              <div className="text-slate-600">
                                <span className="font-medium text-slate-700">Explanation:</span> {item.explanation}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>

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
          ) : sessionQuery.data?.status === 'paused' ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Session paused</div>
              <div className="text-sm text-slate-600">Resume when you’re ready (pause is only available for untimed sessions).</div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className={[
                    'rounded border px-3 py-2 text-sm',
                    resumeMutation.isPending ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {resumeMutation.isPending ? 'Resuming…' : 'Resume'}
                </button>
                <Link to="/student/practice" className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  Back to Practice
                </Link>
              </div>

              {resumeMutation.isError ? <div className="text-sm text-rose-700">Failed to resume.</div> : null}
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
                    Failed to submit answer. <Link to="/student/auth" className="underline">Sign in</Link>
                  </div>
                ) : null}

                {lastFeedback ? (
                  <div className="rounded border border-slate-200 p-3">
                    <div className="text-sm font-medium">{lastFeedback.correct ? 'Correct' : 'Not quite'}</div>
                    {lastFeedback.explanation ? <div className="mt-1 text-sm text-slate-600">{lastFeedback.explanation}</div> : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Session actions</div>
          <div className="mt-3 space-y-2 text-sm">
            {!isTimed && status === 'active' ? (
              <button
                type="button"
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className={[
                  'w-full rounded border px-3 py-2 text-sm',
                  pauseMutation.isPending ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {pauseMutation.isPending ? 'Pausing…' : 'Pause'}
              </button>
            ) : null}
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Flag question
            </button>
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Explain more (planned)
            </button>
            {pauseMutation.isError ? <div className="text-xs text-rose-700">Failed to pause.</div> : null}
            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              This runner is now API-backed (Postgres). Next steps: add review mode and integrate a real question bank.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
