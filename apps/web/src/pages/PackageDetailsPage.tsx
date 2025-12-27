import { Link, useParams } from 'react-router-dom'

import { getExamPackageById } from '@/packages/catalog'

export function PackageDetailsPage() {
  const { packageId } = useParams()
  const pkg = getExamPackageById(packageId ?? '')

  if (!pkg) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Package Not Found</h2>
        <p className="text-sm text-slate-600">The selected package does not exist.</p>
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/student">
          Back to Student Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Exam Package</div>
        <h2 className="text-2xl font-semibold">{pkg.name}</h2>
        <div className="text-sm text-slate-600">{pkg.subtitle}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="font-medium">Overview</div>
          <p className="mt-2 text-sm text-slate-700">{pkg.overview}</p>

          <div className="mt-4">
            <div className="text-xs text-slate-500">Modules</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pkg.modules.map((m) => (
                <span key={m} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs text-slate-500">Module Sections</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {pkg.moduleSections.map((m) => (
                <div key={m.id} className="rounded border border-slate-200 p-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{m.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500">Highlights</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {pkg.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Actions</div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => alert(`Enrollment flow will be wired via contract-first API. Selected: ${pkg.name}`)}
            >
              Enroll
            </button>
            <Link className="block w-full rounded border border-slate-200 px-3 py-2 text-center text-sm hover:bg-slate-50" to="/student">
              Back
            </Link>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Next: wire enrollment + entitlement checks to the API gateway.
          </div>
        </aside>
      </div>
    </div>
  )
}
