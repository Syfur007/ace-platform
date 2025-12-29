import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createPracticeSession } from '@/api/endpoints'
import { EXAM_PACKAGES } from '@/packages/catalog'

export function StudentPracticePage() {
  const navigate = useNavigate()

  const packages = useMemo(() => EXAM_PACKAGES, [])

  const [packageId, setPackageId] = useState<string>('')
  const [isTimed, setIsTimed] = useState(true)
  const [questionCount, setQuestionCount] = useState(10)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  async function startSession() {
    if (isStarting) return

    setStartError(null)
    setIsStarting(true)
    try {
      const session = await createPracticeSession({
        packageId: packageId || null,
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
            <Link to="/student/test" className="block rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Take a mock test
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
