import { Link } from 'react-router-dom'

export function StudentTestsPage() {
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
          <Link
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            to="/student/test/demo-session"
          >
            Start
          </Link>
        </div>
      </div>
    </div>
  )
}
