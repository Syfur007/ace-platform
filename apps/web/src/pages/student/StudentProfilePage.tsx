import { Link } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { listExamSessions, listPracticeSessions, studentGetMe } from '@/api/endpoints'

export function StudentProfilePage() {
  const meQuery = useQuery({
    queryKey: ['student-me'],
    queryFn: () => studentGetMe(),
    refetchOnWindowFocus: false,
  })

  const practiceHistoryQuery = useQuery({
    queryKey: ['practice-history', { limit: 10 }],
    queryFn: () => listPracticeSessions({ limit: 10, offset: 0 }),
    refetchOnWindowFocus: false,
  })

  const examHistoryQuery = useQuery({
    queryKey: ['exam-history', { limit: 10 }],
    queryFn: () => listExamSessions({ limit: 10, offset: 0 }),
    refetchOnWindowFocus: false,
  })

  const user = meQuery.data ?? null

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-slate-600">Your account details and recent learning activity.</p>
      </header>

      <section className="rounded border border-slate-200 p-4">
        <div className="font-medium">Account</div>
        {meQuery.isLoading ? (
          <div className="mt-2 text-sm text-slate-600">Loading…</div>
        ) : meQuery.isError ? (
          <div className="mt-2 text-sm text-rose-700">
            Failed to load profile. <Link className="underline" to="/student/auth">Sign in</Link>
          </div>
        ) : user ? (
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Email</div>
              <div className="mt-1 font-medium break-all">{user.email}</div>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Role</div>
              <div className="mt-1 font-medium">{user.role}</div>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Member since</div>
              <div className="mt-1 font-medium">{new Date(user.createdAt).toLocaleString()}</div>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Recent practice</div>
            <Link className="text-sm text-slate-600 hover:underline" to="/student/practice">
              Start practice
            </Link>
          </div>

          {practiceHistoryQuery.isLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : practiceHistoryQuery.isError ? (
            <div className="mt-3 text-sm text-rose-700">Failed to load practice history.</div>
          ) : practiceHistoryQuery.data?.items?.length ? (
            <ul className="mt-3 space-y-2">
              {practiceHistoryQuery.data.items.map((s) => (
                <li key={s.sessionId} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">Session {s.sessionId}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(s.createdAt).toLocaleString()} • {s.isTimed ? 'Timed' : 'Untimed'} • {s.status}
                      </div>
                    </div>
                    <Link
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      to={`/student/practice/session/${encodeURIComponent(s.sessionId)}`}
                    >
                      Open
                    </Link>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Correct: {s.correctCount} / {s.targetCount}
                    {typeof s.accuracy === 'number' ? ` • Accuracy: ${Math.round(s.accuracy * 100)}%` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No practice sessions yet.</div>
          )}
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Recent tests</div>
            <Link className="text-sm text-slate-600 hover:underline" to="/student/test">
              Open tests
            </Link>
          </div>

          {examHistoryQuery.isLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : examHistoryQuery.isError ? (
            <div className="mt-3 text-sm text-rose-700">Failed to load test history.</div>
          ) : examHistoryQuery.data?.items?.length ? (
            <ul className="mt-3 space-y-2">
              {examHistoryQuery.data.items.map((s) => (
                <li key={s.sessionId} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">Test {s.sessionId}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Last heartbeat: {new Date(s.lastHeartbeatAt).toLocaleString()} • {s.status}
                      </div>
                    </div>
                    <Link
                      className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      to={`/student/test/${encodeURIComponent(s.sessionId)}`}
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No test sessions yet.</div>
          )}
        </div>
      </section>
    </div>
  )
}
