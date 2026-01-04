import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { createPracticeSession, listExamPackages, listPracticeSessions, studentListEnrollments } from '@/api/endpoints'

export function StudentPracticePage() {
  const navigate = useNavigate()

  const packagesQuery = useQuery({
    queryKey: ['exam-packages'],
    queryFn: () => listExamPackages(),
    refetchOnWindowFocus: false,
  })

  const enrollmentsQuery = useQuery({
    queryKey: ['student', 'enrollments'],
    queryFn: () => studentListEnrollments(),
    refetchOnWindowFocus: false,
    retry: false,
  })

  const enrolledIds = useMemo(() => enrollmentsQuery.data?.examPackageIds ?? [], [enrollmentsQuery.data])

  const [examPackageId, setExamPackageId] = useState<string>('')
  const [isTimed, setIsTimed] = useState(true)
  const [questionCount, setQuestionCount] = useState(10)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['practice-sessions', 'catalog'],
    queryFn: () => listPracticeSessions({ limit: 10, offset: 0 }),
    refetchOnWindowFocus: false,
  })

  async function startSession() {
    if (isStarting) return

    setStartError(null)

    if (!examPackageId && enrolledIds.length > 1) {
      setStartError('Please pick a package (you are enrolled in multiple).')
      return
    }

    setIsStarting(true)
    try {
      const session = await createPracticeSession({
        examPackageId: examPackageId || null,
        timed: isTimed,
        count: questionCount,
      })

      navigate(`/student/practice/session/${encodeURIComponent(session.sessionId)}`)
    } catch (e) {
      const status = typeof e === 'object' && e && 'status' in e ? Number((e as any).status) : null
      if (status === 401) {
        setStartError('You are not signed in. Open the Auth page and login/register first.')
      } else {
        const message = typeof e === 'object' && e && 'message' in e ? String((e as any).message) : 'Failed to start session'
        setStartError(message)
      }
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Practice</h1>
        <p className="text-sm text-slate-600">Start a short session to drill weak areas (demo).</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="font-medium">Start a session</div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-slate-600">Package (optional)</span>
              <select
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                value={examPackageId}
                onChange={(e) => setExamPackageId(e.target.value)}
                disabled={packagesQuery.isLoading || packagesQuery.isError}
              >
                <option value="">Auto (requires exactly 1 enrollment)</option>
                {(packagesQuery.data?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            {enrollmentsQuery.isError ? (
              <div className="text-sm text-slate-600">
                <Link className="underline" to="/student/auth">Sign in</Link> to start practice.
              </div>
            ) : enrolledIds.length === 0 ? (
              <div className="text-sm text-slate-600">
                You are not enrolled in any package. Enroll from <Link className="underline" to="/student/courses">Courses</Link>.
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Mode</span>
                <select
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={isTimed ? 'timed' : 'untimed'}
                  onChange={(e) => setIsTimed(e.target.value === 'timed')}
                >
                  <option value="timed">Ironman (Timed)</option>
                  <option value="untimed">Untimed</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Questions</span>
                <select
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={String(questionCount)}
                  onChange={(e) => setQuestionCount(Number.parseInt(e.target.value, 10))}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startSession}
                disabled={isStarting}
                className={[
                  'rounded border px-3 py-2 text-sm',
                  isStarting ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {isStarting ? 'Starting…' : 'Start practice'}
              </button>

              <Link
                to="/student/study-plan"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                View study plan
              </Link>
            </div>

            {startError ? (
              <div className="text-sm text-rose-700">
                {startError} <Link to="/student/auth" className="underline">Go to Student Auth</Link>
              </div>
            ) : null}

            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              Sessions are API-backed. Next: add richer filters (topic/difficulty) and better review workflows (incorrect/flagged).
            </div>
          </div>
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Quick links</div>
          <div className="mt-3 space-y-2">
            <Link to="/student/courses" className="block rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Browse courses
            </Link>
            <Link to="/student/test" className="block rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Take a mock test
            </Link>
          </div>
        </aside>
      </div>

      <section className="rounded border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-medium">Previous practice sessions</div>
          <Link to="/student/profile" className="text-sm text-slate-600 hover:underline">
            View full history
          </Link>
        </div>

        <div className="mt-3">
          {historyQuery.isLoading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : historyQuery.isError ? (
            <div className="text-sm text-rose-700">Failed to load practice history.</div>
          ) : (historyQuery.data?.items?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-600">No sessions yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyQuery.data!.items.map((s) => {
                const actionLabel = s.status === 'finished' ? 'Review' : s.isTimed ? 'In progress' : 'Resume'
                const statusLabel = s.status === 'paused' ? 'Paused' : s.status === 'finished' ? 'Finished' : 'Active'
                const modeLabel = s.isTimed ? 'Ironman (Timed)' : 'Untimed'

                return (
                  <div key={s.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{modeLabel}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                        <div className="rounded border border-slate-200 px-2 py-1">Status: {statusLabel}</div>
                        <div className="rounded border border-slate-200 px-2 py-1">Questions: {s.targetCount}</div>
                        {s.isTimed && s.timeRemainingSeconds != null ? (
                          <div className="rounded border border-slate-200 px-2 py-1">Remaining: {s.timeRemainingSeconds}s</div>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      to={`/student/practice/session/${encodeURIComponent(s.sessionId)}`}
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {actionLabel}
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
