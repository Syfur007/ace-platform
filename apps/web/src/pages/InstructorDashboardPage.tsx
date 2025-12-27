import { LlmFeedbackPanel } from '@/llm/LlmFeedbackPanel'

export function InstructorDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Instructor / Content Creator Dashboard</h2>
        <p className="text-sm text-slate-600">Question bank management + LLM-assisted generation and feedback previews.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-4">
          <div className="font-medium">Question Bank (QTI 3.0)</div>
          <p className="mt-1 text-sm text-slate-600">Import/export plumbing is scaffolded for QTI 3.0 interoperability.</p>
          <div className="mt-3 text-sm text-slate-500">Next: wire API endpoints + QTI item editor.</div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="font-medium">LLM-Assisted Generation</div>
          <p className="mt-1 text-sm text-slate-600">Contract-first API includes a placeholder /llm/feedback endpoint.</p>
          <div className="mt-3 text-sm text-slate-500">Next: add generation endpoints + streaming UI if desired.</div>
        </div>
      </div>

      <LlmFeedbackPanel
        title="Demo: Automated Essay Feedback"
        feedback={{
          kind: 'essay',
          summary: 'Clear thesis; improve cohesion between paragraphs; add 1 supporting example.',
          scores: [{ label: 'Overall', value: 4.0, max: 6.0 }],
          strengths: ['Relevant argument', 'Good vocabulary range'],
          improvements: ['Add transitions', 'Tighten conclusion'],
        }}
      />
    </div>
  )
}
