import { Link } from 'react-router-dom'

import { EXAM_PACKAGES } from '@/packages/catalog'

export function StudentCoursesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Courses</h1>
        <p className="text-sm text-slate-600">
          Browse available prep packages. Course structure (sections/topics/lessons) will be expanded here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAM_PACKAGES.map((p) => (
          <div key={p.id} className="rounded border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Package</div>
            <div className="mt-1 text-lg font-semibold">{p.name}</div>
            <div className="mt-1 text-sm text-slate-600">{p.subtitle}</div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to={`/packages/${p.id}`}>
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
    </div>
  )
}
