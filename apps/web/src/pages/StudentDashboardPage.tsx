import { Link } from 'react-router-dom'

import { bdGpaFromPercent } from '@/grades/bdBoard'
import { getEliteCoinsSummary } from '@/gamification/eliteCoins'
import { EXAM_PACKAGES } from '@/packages/catalog'

export function StudentDashboardPage() {
  const demoPercent = 83
  const gpa = bdGpaFromPercent(demoPercent)
  const coins = getEliteCoinsSummary({
    streakDays: 3,
    completedMockExams: 2,
    correctRatePercent: 74,
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Student Dashboard</h2>
        <p className="text-sm text-slate-600">Mock exams, analytics, GPA(5.0) mapping, and gamification widgets.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Bangladesh Board GPA (5.0)</div>
          <div className="mt-2 text-2xl font-semibold">{gpa.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">Demo from {demoPercent}%</div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Elite Coins</div>
          <div className="mt-2 text-2xl font-semibold">{coins.total}</div>
          <div className="mt-1 text-xs text-slate-500">Streak + activity</div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="text-xs text-slate-500">AIR Rank Analysis</div>
          <div className="mt-2 text-2xl font-semibold">Coming soon</div>
          <div className="mt-1 text-xs text-slate-500">Wired to contract-first API</div>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Real-time Exam Simulation</div>
            <div className="text-sm text-slate-600">GRE adaptivity + IELTS multi-modal modules + heartbeat sync.</div>
          </div>
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/exam/demo-session">
            Start Demo Session
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Enroll in Packages</h3>
          <p className="text-sm text-slate-600">Choose a preparation package to unlock mock exams, analytics, and feedback.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXAM_PACKAGES.map((p) => (
            <div key={p.id} className="rounded border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Package</div>
              <div className="mt-1 text-lg font-semibold">{p.name}</div>
              <div className="mt-1 text-sm text-slate-600">{p.subtitle}</div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Link
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  to={`/packages/${p.id}`}
                >
                  View details
                </Link>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => alert(`Enrollment flow will be wired via contract-first API. Selected: ${p.name}`)}
                >
                  Enroll
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
