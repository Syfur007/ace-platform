export type LlmFeedback = {
  kind: 'essay' | 'speaking'
  summary: string
  scores: Array<{ label: string; value: number; max: number }>
  strengths: string[]
  improvements: string[]
}

export function LlmFeedbackPanel({
  title,
  feedback,
}: {
  title: string
  feedback: LlmFeedback
}) {
  return (
    <section className="rounded border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">LLM Feedback ({feedback.kind})</div>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-700">{feedback.summary}</div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Scores</div>
          <ul className="mt-2 space-y-1 text-sm">
            {feedback.scores.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span>{s.label}</span>
                <span className="font-medium">
                  {s.value}/{s.max}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Highlights</div>
          <div className="mt-2 grid gap-3 text-sm">
            <div>
              <div className="font-medium">Strengths</div>
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {feedback.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium">Improvements</div>
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {feedback.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
