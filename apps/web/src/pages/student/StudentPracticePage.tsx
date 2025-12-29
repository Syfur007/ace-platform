import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EXAM_PACKAGES } from '@/packages/catalog'

function createSessionId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function StudentPracticePage() {
  const navigate = useNavigate()

  const packages = useMemo(() => EXAM_PACKAGES, [])

  const [packageId, setPackageId] = useState<string>('')
  const [isTimed, setIsTimed] = useState(true)
  const [questionCount, setQuestionCount] = useState(10)

  function startSession() {
    const sessionId = createSessionId()
    const params = new URLSearchParams()
    if (packageId) params.set('packageId', packageId)
    params.set('timed', isTimed ? '1' : '0')
    params.set('count', String(questionCount))
    navigate(`/student/practice/session/${encodeURIComponent(sessionId)}?${params.toString()}`)
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
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value="">Any package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Mode</span>
                <select
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={isTimed ? 'timed' : 'untimed'}
                  onChange={(e) => setIsTimed(e.target.value === 'timed')}
                >
                  <option value="timed">Timed</option>
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
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Start practice
              </button>

              <Link
                to="/student/study-plan"
                className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                View study plan
              </Link>
            </div>

            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              Next steps: wire to API (create session → fetch questions → submit answers) and add a review mode for incorrect/flagged.
            </div>
          </div>
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Quick links</div>
          <div className="mt-3 space-y-2">
            <Link to="/student/courses" className="block rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Browse courses
            </Link>
            <Link to="/student/tests" className="block rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Take a mock test
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
