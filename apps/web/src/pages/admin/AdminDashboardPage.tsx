import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { adminGetDashboardStats, getHealthz } from '@/api/endpoints'

function StatCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded border border-slate-200 p-4">
      <div className="text-sm font-medium">{props.title}</div>
      <div className="mt-2 text-2xl font-semibold">{props.value}</div>
      {props.subtitle ? <div className="mt-1 text-sm text-slate-600">{props.subtitle}</div> : null}
    </div>
  )
}

export function AdminDashboardPage() {
  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: getHealthz,
    refetchInterval: 15_000,
  })

  const stats = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminGetDashboardStats,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <div className="mt-1 text-sm text-slate-600">Lifetime totals across the platform.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin/question-bank">
            Question Bank
          </Link>
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin/users">
            Users
          </Link>
          <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/admin/exam-integrity">
            Exam Integrity
          </Link>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="text-sm font-medium">API</div>
        <div className="mt-2 text-sm text-slate-600">
          {health.isLoading ? 'Checking…' : health.isError ? 'Unreachable' : `Healthy (${health.data?.status ?? 'ok'})`}
        </div>
      </div>

      {stats.isLoading ? <div className="text-sm text-slate-600">Loading stats…</div> : null}
      {stats.isError ? <div className="text-sm text-red-600">Failed to load dashboard stats.</div> : null}

      {stats.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Users (active)"
              value={String(stats.data.users.active)}
              subtitle={`Total ${stats.data.users.total} · Deleted ${stats.data.users.deleted}`}
            />
            <StatCard title="Question bank questions" value={String(stats.data.questionBank.questions)} />
            <StatCard title="Exams (sessions)" value={String(stats.data.exams.sessions)} subtitle={`Submitted ${stats.data.exams.submitted}`} />
            <StatCard title="Exam events" value={String(stats.data.exams.events)} />
            <StatCard title="Exam flags" value={String(stats.data.exams.flags)} />
            <StatCard title="Packages / Topics" value={`${stats.data.questionBank.packages} / ${stats.data.questionBank.topics}`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded border border-slate-200 p-4">
              <div className="text-sm font-medium">Users by role (active)</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-slate-600">Students</div>
                  <div className="font-medium">{stats.data.users.byRole.student ?? 0}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-600">Instructors</div>
                  <div className="font-medium">{stats.data.users.byRole.instructor ?? 0}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-slate-600">Admins</div>
                  <div className="font-medium">{stats.data.users.byRole.admin ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-4">
              <div className="text-sm font-medium">Question bank by status</div>
              <div className="mt-3 grid gap-2 text-sm">
                {Object.entries(stats.data.questionBank.byStatus)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="text-slate-600">{status}</div>
                      <div className="font-medium">{count}</div>
                    </div>
                  ))}
                {Object.keys(stats.data.questionBank.byStatus).length === 0 ? (
                  <div className="text-sm text-slate-600">No questions yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">Updated at {new Date(stats.data.ts).toLocaleString()}</div>
        </>
      ) : null}
    </div>
  )
}
