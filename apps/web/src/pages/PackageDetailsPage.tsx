import { Link, useParams } from 'react-router-dom'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listExamPackages, studentEnroll, studentListEnrollments } from '@/api/endpoints'
import { EXAM_PACKAGES } from '@/packages/catalog'

export function PackageDetailsPage() {
  const { packageId } = useParams()
  const queryClient = useQueryClient()

  const packagesQuery = useQuery({
    queryKey: ['exam-packages'],
    queryFn: () => listExamPackages(),
    refetchOnWindowFocus: false,
  })

  const enrollmentsQuery = useQuery({
    queryKey: ['student', 'enrollments'],
    queryFn: () => studentListEnrollments(),
    refetchOnWindowFocus: false,
    retry: false,
  })

  const enrollMutation = useMutation({
    mutationFn: async (examPackageId: string) => studentEnroll({ examPackageId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', 'enrollments'] })
    },
  })

  const apiPkg = packagesQuery.data?.items?.find((p) => p.id === packageId) ?? null
  const demoPkg = apiPkg ? (EXAM_PACKAGES.find((p) => p.name === apiPkg.name) ?? null) : null

  const enrolledIds = new Set(enrollmentsQuery.data?.examPackageIds ?? [])
  const isEnrolled = apiPkg ? enrolledIds.has(apiPkg.id) : false
  const isEnrolling = enrollMutation.isPending && enrollMutation.variables === apiPkg?.id

  if (packagesQuery.isLoading) {
    return <div className="text-sm text-slate-600">Loading package…</div>
  }

  if (packagesQuery.isError || !apiPkg) {
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
        <h2 className="text-2xl font-semibold">{apiPkg.name}</h2>
        {demoPkg ? <div className="text-sm text-slate-600">{demoPkg.subtitle}</div> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="font-medium">Overview</div>

          {demoPkg ? (
            <>
              <p className="mt-2 text-sm text-slate-700">{demoPkg.overview}</p>

              <div className="mt-4">
                <div className="text-xs text-slate-500">Modules</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {demoPkg.modules.map((m) => (
                    <span key={m} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs text-slate-500">Module Sections</div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {demoPkg.moduleSections.map((m) => (
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
                  {demoPkg.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-700">This package is available for enrollment.</p>
          )}
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Actions</div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className={[
                'w-full rounded border px-3 py-2 text-sm',
                isEnrolled || enrollmentsQuery.isError || isEnrolling
                  ? 'border-slate-100 text-slate-400'
                  : 'border-slate-200 hover:bg-slate-50',
              ].join(' ')}
              disabled={isEnrolled || enrollmentsQuery.isError || isEnrolling}
              onClick={() => enrollMutation.mutate(apiPkg.id)}
              title={enrollmentsQuery.isError ? 'Sign in as a student to enroll.' : undefined}
            >
              {isEnrolled ? 'Enrolled' : isEnrolling ? 'Enrolling…' : 'Enroll'}
            </button>
            <Link className="block w-full rounded border border-slate-200 px-3 py-2 text-center text-sm hover:bg-slate-50" to="/student">
              Back
            </Link>
          </div>

          {enrollMutation.isError ? <div className="mt-3 text-sm text-rose-700">Failed to enroll.</div> : null}

          {enrollmentsQuery.isError ? (
            <div className="mt-4 text-sm text-slate-600">
              <Link className="underline" to="/student/auth">Sign in</Link> to enroll.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
