import { useQuery } from '@tanstack/react-query'

import { getHealthz } from '@/api/endpoints'

export function AdminPanelPage() {
  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: getHealthz,
    refetchInterval: 15_000,
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Admin Panel</h2>
        <p className="text-sm text-slate-600">System monitoring and export hooks (contract-first).</p>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">API Gateway Health</div>
            <div className="mt-1 text-sm text-slate-600">
              {health.isLoading && 'Loading…'}
              {health.isError && 'Error contacting gateway.'}
              {health.data && `status=${health.data.status} ts=${health.data.ts}`}
            </div>
          </div>
          <button
            className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            type="button"
            onClick={() => alert('Export endpoint scaffolded in OpenAPI; wire when backend is ready.')}
          >
            Export Data
          </button>
        </div>
      </div>

      <div className="rounded border border-slate-200 p-4">
        <div className="font-medium">Monitoring</div>
        <div className="mt-1 text-sm text-slate-600">Next: surface metrics, queue depth, and active sessions.</div>
      </div>
    </div>
  )
}
