import { useNavigate } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'

import { listExamSessions } from '@/api/endpoints'

export function StudentTestsPage() {
  const navigate = useNavigate()

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
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            type="button"
            onClick={() => {
              const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
              navigate(`/student/test/${encodeURIComponent(id)}`)
            }}
          >
            Start
          </button>
        </div>
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
                      onClick={() => navigate(`/student/test/${encodeURIComponent(s.sessionId)}`)}
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
