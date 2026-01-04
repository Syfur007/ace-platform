import { Link } from 'react-router-dom'

import { PracticeTemplatesManager } from '@/pages/shared/PracticeTemplatesManager'

export function InstructorPracticeTemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Practice Templates</h1>
          <p className="text-sm text-slate-600">Create and publish reusable practice tests for enrolled students.</p>
        </div>
        <Link className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" to="/instructor">
          Back to dashboard
        </Link>
      </div>

      <PracticeTemplatesManager />
    </div>
  )
}
