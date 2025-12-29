import { useMemo, useState } from 'react'

export function StudentStudyPlanPage() {
  const plan = {
    name: '8-week plan (demo)',
    startDate: '2025-12-29',
    targetScore: 'TBD',
    status: 'active',
  } as const

  const tasks = useMemo(
    () => [
      { id: 'd1', title: 'Watch: Algebra fundamentals (20m)', meta: 'Lesson' },
      { id: 'd2', title: 'Practice: 10 questions (timed)', meta: 'Practice' },
      { id: 'd3', title: 'Review: Incorrect answers from yesterday', meta: 'Review' },
      { id: 'd4', title: 'Mock test warm-up: 5 questions', meta: 'Test' },
    ],
    [],
  )

  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const completedCount = tasks.reduce((acc, t) => acc + (checked[t.id] ? 1 : 0), 0)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Study Plan</h1>
        <p className="text-sm text-slate-600">Calendar view is planned. Today’s checklist is available now (demo).</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Today</div>
              <div className="font-medium">Tasks</div>
            </div>
            <div className="text-sm text-slate-600">
              {completedCount}/{tasks.length} completed
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {tasks.map((task) => (
              <label key={task.id} className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(checked[task.id])}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [task.id]: e.target.checked }))}
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

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Plan overview</div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Name</dt>
              <dd className="font-medium text-slate-900">{plan.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Start</dt>
              <dd className="font-medium text-slate-900">{plan.startDate}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Target</dt>
              <dd className="font-medium text-slate-900">{plan.targetScore}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Status</dt>
              <dd className="font-medium text-slate-900">{plan.status}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Pause plan
            </button>
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Adjust plan
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
