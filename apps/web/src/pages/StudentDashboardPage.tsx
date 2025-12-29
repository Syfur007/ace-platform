import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { bdGpaFromPercent } from '@/grades/bdBoard'
import { getEliteCoinsSummary } from '@/gamification/eliteCoins'

export function StudentDashboardPage() {
  const demoUserName = 'Student'

  const demoPercent = 83
  const demoStreakDays = 3
  const demoCorrectRatePercent = 74
  const demoCompletedMockExams = 2

  const gpa = bdGpaFromPercent(demoPercent)
  const coins = getEliteCoinsSummary({
    streakDays: demoStreakDays,
    completedMockExams: demoCompletedMockExams,
    correctRatePercent: demoCorrectRatePercent,
  })

  const todayTasks = useMemo(
    () => [
      { id: 't1', title: 'Watch: Algebra fundamentals (20m)', meta: 'Lesson' },
      { id: 't2', title: 'Practice: 10 questions (timed)', meta: 'Practice' },
      { id: 't3', title: 'Review: Incorrect answers from yesterday', meta: 'Review' },
    ],
    [],
  )
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-xs text-slate-500">Student Home</div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Welcome back, {demoUserName}</h1>
            <p className="mt-1 text-sm text-slate-600">Your progress, plan, and next best actions in one place.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              to="/student/courses"
            >
              Browse courses
            </Link>
            <Link
              className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              to="/exam/demo-session"
            >
              Take a mock test
            </Link>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-semibold">Progress overview</h2>
          <Link className="text-sm text-slate-600 hover:underline" to="/student/analytics">
            View analytics (planned)
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Study streak</div>
            <div className="mt-2 text-2xl font-semibold">{demoStreakDays} days</div>
            <div className="mt-1 text-xs text-slate-500">Keep it going today</div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Accuracy</div>
            <div className="mt-2 text-2xl font-semibold">{demoCorrectRatePercent}%</div>
            <div className="mt-1 text-xs text-slate-500">Last 7 days (demo)</div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Predicted score</div>
            <div className="mt-2 text-2xl font-semibold">Coming soon</div>
            <div className="mt-1 text-xs text-slate-500">Confidence interval (planned)</div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Elite Coins</div>
            <div className="mt-2 text-2xl font-semibold">{coins.total}</div>
            <div className="mt-1 text-xs text-slate-500">Streak + activity</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Learning progress</div>
            <div className="mt-2 text-2xl font-semibold">{demoPercent}%</div>
            <div className="mt-1 text-xs text-slate-500">Lesson completion (demo)</div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">GPA (5.0) mapping</div>
            <div className="mt-2 text-2xl font-semibold">{gpa.toFixed(2)}</div>
            <div className="mt-1 text-xs text-slate-500">Derived from {demoPercent}%</div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Mock tests taken</div>
            <div className="mt-2 text-2xl font-semibold">{demoCompletedMockExams}</div>
            <div className="mt-1 text-xs text-slate-500">History (demo)</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded border border-slate-200 p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Today’s tasks</div>
              <div className="mt-1 text-sm text-slate-600">Generated from your study plan (demo).</div>
            </div>
            <Link className="text-sm text-slate-600 hover:underline" to="/student/study-plan">
              Open study plan
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {todayTasks.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(completedTaskIds[task.id])}
                  onChange={(e) =>
                    setCompletedTaskIds((prev) => ({
                      ...prev,
                      [task.id]: e.target.checked,
                    }))
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-medium">{task.title}</div>
                    <div className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {task.meta}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="font-medium">Recent activity</div>
          <div className="mt-1 text-sm text-slate-600">A timeline of lessons, practice, and tests (planned).</div>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="rounded border border-slate-200 p-3">Completed: Quant basics • 18m</li>
            <li className="rounded border border-slate-200 p-3">Practice: 10 questions • 70% correct</li>
            <li className="rounded border border-slate-200 p-3">Mock test: Demo session started</li>
          </ul>
        </div>
      </section>

      <section className="rounded border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Exam simulation engine</div>
            <div className="mt-1 text-sm text-slate-600">Full-screen test runner UI will be layered on this engine.</div>
          </div>
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/exam/demo-session">
            Start demo test
          </Link>
        </div>
      </section>
    </div>
  )
}
