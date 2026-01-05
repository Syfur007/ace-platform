import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { listExamPackages, listExamSessions, studentListEnrollments } from '@/api/endpoints'

export function StudentTestsPage() {
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

  const enrolledIds = useMemo(
    () => enrollmentsQuery.data?.items?.map((e) => e.examPackageId) ?? enrollmentsQuery.data?.examPackageIds ?? [],
    [enrollmentsQuery.data],
  )

  const [examPackageId, setExamPackageId] = useState<string>('')
  const [startError, setStartError] = useState<string | null>(null)

  function persistExamPackageId(sessionId: string, pkgId: string) {
    try {
      window.localStorage.setItem(`examSession:${sessionId}:examPackageId`, pkgId)
    } catch {
      // ignore
    }
  }

  const historyQuery = useQuery({
    queryKey: ['exam-sessions', 'catalog'],
    queryFn: () => listExamSessions({ limit: 10, offset: 0 }),
    refetchOnWindowFocus: false,
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Tests</h1>
        <p className="mt-1 text-sm text-slate-600">Start or resume a mock exam session.</p>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Demo mock exam</div>
            <div className="mt-1 text-sm text-slate-600">
              Uses a session-based URL so progress can be persisted and resumed.
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <label className="grid gap-1 text-right">
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

            <button
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              type="button"
              onClick={() => {
                setStartError(null)

                const resolved = examPackageId || (enrolledIds.length === 1 ? enrolledIds[0] : '')
                if (!resolved && enrolledIds.length > 1) {
                  setStartError('Please pick a package (you are enrolled in multiple).')
                  return
                }

                const id =
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : String(Date.now())

                if (resolved) persistExamPackageId(id, resolved)

                navigate(`/student/test/${encodeURIComponent(id)}`)
              }}
            >
              Start
            </button>
          </div>
        </div>

        {enrollmentsQuery.isError ? (
          <div className="mt-3 text-sm text-slate-600">
            <Link className="underline" to="/student/auth">Sign in</Link> to start tests.
          </div>
        ) : enrolledIds.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">
            You are not enrolled in any package. Enroll from <Link className="underline" to="/student/courses">Courses</Link>.
          </div>
        ) : null}

        {startError ? (
          <div className="mt-3 text-sm text-rose-700">
            {startError} <Link to="/student/auth" className="underline">Go to Student Auth</Link>
          </div>
        ) : null}
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="font-medium">Previous tests</div>
        <div className="mt-3">
          {historyQuery.isLoading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : historyQuery.isError ? (
            <div className="text-sm text-rose-700">Failed to load test history.</div>
          ) : (historyQuery.data?.items?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-600">No test sessions yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyQuery.data!.items.map((s) => {
                const actionLabel = s.status === 'finished' ? 'Review' : 'In progress'
                const statusLabel = s.status === 'finished' ? 'Finished' : 'Active'

                return (
                  <div key={s.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Session {s.sessionId}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                        <div className="rounded border border-slate-200 px-2 py-1">Status: {statusLabel}</div>
                        <div className="rounded border border-slate-200 px-2 py-1">Last activity: {new Date(s.lastHeartbeatAt).toLocaleString()}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => {
                        const resolved = s.examPackageId || examPackageId || (enrolledIds.length === 1 ? enrolledIds[0] : '')
                        if (!resolved && enrolledIds.length > 1) {
                          setStartError('Please pick a package to resume (you are enrolled in multiple).')
                          return
                        }

                        if (resolved) persistExamPackageId(s.sessionId, resolved)
                        navigate(`/student/test/${encodeURIComponent(s.sessionId)}`)
                      }}
                    >
                      {actionLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
