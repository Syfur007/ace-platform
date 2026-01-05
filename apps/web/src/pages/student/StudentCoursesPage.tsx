import { Link } from 'react-router-dom'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listExamPackages, studentCancelEnrollment, studentEnroll, studentListEnrollments } from '@/api/endpoints'

export function StudentCoursesPage() {
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

  const unenrollMutation = useMutation({
    mutationFn: async (examPackageId: string) => studentCancelEnrollment(examPackageId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student', 'enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['practice-templates'] }),
      ])
    },
  })

  const enrolledIds = new Set(
    (enrollmentsQuery.data?.items?.map((e) => e.examPackageId) ?? enrollmentsQuery.data?.examPackageIds ?? []),
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Courses</h1>
        <p className="text-sm text-slate-600">
          Browse available prep packages. Course structure (sections/topics/lessons) will be expanded here.
        </p>
      </header>

      {packagesQuery.isLoading ? (
        <div className="text-sm text-slate-600">Loading packages…</div>
      ) : packagesQuery.isError ? (
        <div className="text-sm text-rose-700">Failed to load packages.</div>
      ) : (packagesQuery.data?.items?.length ?? 0) === 0 ? (
        <div className="text-sm text-slate-600">No packages available.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packagesQuery.data!.items.map((p) => {
            const isEnrolled = enrolledIds.has(p.id)
            const isEnrolling = enrollMutation.isPending && enrollMutation.variables === p.id
            const isUnenrolling = unenrollMutation.isPending && unenrollMutation.variables === p.id
            const enrollDisabled = isEnrolled || isEnrolling || enrollmentsQuery.isError
            const unenrollDisabled = !isEnrolled || isUnenrolling || enrollmentsQuery.isError

            return (
              <div key={p.id} className="rounded border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Package</div>
                <div className="mt-1 text-lg font-semibold">{p.name}</div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    to={`/packages/${encodeURIComponent(p.id)}`}
                  >
                    View details
                  </Link>

                  <button
                    type="button"
                    className={[
                      'rounded border px-3 py-2 text-sm',
                      enrollDisabled ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                    disabled={enrollDisabled}
                    onClick={() => enrollMutation.mutate(p.id)}
                    title={enrollmentsQuery.isError ? 'Sign in as a student to enroll.' : undefined}
                  >
                    {isEnrolled ? 'Enrolled' : isEnrolling ? 'Enrolling…' : 'Enroll'}
                  </button>

                  <button
                    type="button"
                    className={[
                      'rounded border px-3 py-2 text-sm',
                      unenrollDisabled ? 'border-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                    disabled={unenrollDisabled}
                    onClick={() => unenrollMutation.mutate(p.id)}
                    title={enrollmentsQuery.isError ? 'Sign in as a student to manage enrollment.' : undefined}
                  >
                    {isUnenrolling ? 'Unenrolling…' : 'Unenroll'}
                  </button>
                </div>

                {enrollMutation.isError && enrollMutation.variables === p.id ? (
                  <div className="mt-3 text-sm text-rose-700">Failed to enroll.</div>
                ) : null}

                {unenrollMutation.isError && unenrollMutation.variables === p.id ? (
                  <div className="mt-3 text-sm text-rose-700">Failed to unenroll.</div>
                ) : null}

                {enrollmentsQuery.isError ? (
                  <div className="mt-3 text-sm text-slate-600">
                    <Link className="underline" to="/student/auth">Sign in</Link> to enroll.
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
