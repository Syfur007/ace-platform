import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { getExamPackageById } from '@/packages/catalog'

type DemoQuestion = {
  id: string
  prompt: string
  choices: Array<{ id: string; text: string }>
  correctChoiceId: string
  explanation: string
}

function parseBooleanSearchParam(value: string | null) {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true'
}

function parseIntegerSearchParam(value: string | null, fallback: number) {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

export function StudentPracticeSessionPage() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()

  const packageId = searchParams.get('packageId')
  const isTimed = parseBooleanSearchParam(searchParams.get('timed'))
  const targetCount = parseIntegerSearchParam(searchParams.get('count'), 10)

  const selectedPackage = packageId ? getExamPackageById(packageId) : null

  const questions = useMemo<DemoQuestion[]>(
    () => [
      {
        id: 'q1',
        prompt: 'Demo: If x = 3, what is 2x + 1?',
        choices: [
          { id: 'a', text: '5' },
          { id: 'b', text: '7' },
          { id: 'c', text: '9' },
          { id: 'd', text: '11' },
        ],
        correctChoiceId: 'b',
        explanation: 'Substitute x = 3: 2(3) + 1 = 6 + 1 = 7.',
      },
      {
        id: 'q2',
        prompt: 'Demo: Which is the synonym of “rapid”?',
        choices: [
          { id: 'a', text: 'Slow' },
          { id: 'b', text: 'Careful' },
          { id: 'c', text: 'Quick' },
          { id: 'd', text: 'Weak' },
        ],
        correctChoiceId: 'c',
        explanation: '“Rapid” means fast/quick.',
      },
      {
        id: 'q3',
        prompt: 'Demo: Choose the correct option: “She ___ to the store yesterday.”',
        choices: [
          { id: 'a', text: 'go' },
          { id: 'b', text: 'goes' },
          { id: 'c', text: 'went' },
          { id: 'd', text: 'going' },
        ],
        correctChoiceId: 'c',
        explanation: 'Yesterday indicates past tense: “went”.',
      },
    ],
    [],
  )

  const effectiveTotal = Math.min(targetCount, questions.length)

  const [index, setIndex] = useState(0)
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  const question = questions[index]

  const isCorrect = submitted && selectedChoiceId != null && selectedChoiceId === question.correctChoiceId

  const canSubmit = selectedChoiceId != null && !submitted

  function submitAnswer() {
    if (!canSubmit) return
    setSubmitted(true)
    if (selectedChoiceId === question.correctChoiceId) {
      setCorrectCount((prev) => prev + 1)
    }
  }

  function nextQuestion() {
    setSubmitted(false)
    setSelectedChoiceId(null)
    setIndex((prev) => Math.min(prev + 1, effectiveTotal - 1))
  }

  const isLast = index >= effectiveTotal - 1

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Practice Session</h1>
          <Link to="/student/practice" className="text-sm text-slate-600 hover:underline">
            End session
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <div className="rounded border border-slate-200 px-2 py-1">Session: {sessionId ?? 'unknown'}</div>
          <div className="rounded border border-slate-200 px-2 py-1">Mode: {isTimed ? 'Timed' : 'Untimed'}</div>
          <div className="rounded border border-slate-200 px-2 py-1">Questions: {effectiveTotal}</div>
          <div className="rounded border border-slate-200 px-2 py-1">
            Package: {selectedPackage ? selectedPackage.name : 'Any'}
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded border border-slate-200 p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Question {index + 1} / {effectiveTotal}
            </div>
            <div className="text-sm text-slate-600">Correct: {correctCount}</div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="text-sm font-medium">{question.prompt}</div>

            <div className="space-y-2">
              {question.choices.map((choice) => {
                const isSelected = selectedChoiceId === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setSelectedChoiceId(choice.id)}
                    className={[
                      'w-full rounded border px-3 py-2 text-left text-sm',
                      'border-slate-200 hover:bg-slate-50',
                      isSelected ? 'bg-slate-100' : 'bg-white',
                    ].join(' ')}
                    aria-pressed={isSelected}
                    disabled={submitted}
                  >
                    {choice.text}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmit}
                className={[
                  'rounded border px-3 py-2 text-sm',
                  canSubmit ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 text-slate-400',
                ].join(' ')}
              >
                Submit
              </button>

              <button
                type="button"
                onClick={nextQuestion}
                disabled={!submitted || isLast}
                className={[
                  'rounded border px-3 py-2 text-sm',
                  submitted && !isLast ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-100 text-slate-400',
                ].join(' ')}
              >
                Next
              </button>

              {submitted && isLast ? (
                <Link to="/student/practice" className="rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  Back to Practice
                </Link>
              ) : null}
            </div>

            {submitted ? (
              <div className="rounded border border-slate-200 p-3">
                <div className="text-sm font-medium">{isCorrect ? 'Correct' : 'Not quite'}</div>
                <div className="mt-1 text-sm text-slate-600">{question.explanation}</div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded border border-slate-200 p-4">
          <div className="font-medium">Session actions</div>
          <div className="mt-3 space-y-2 text-sm">
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Flag question
            </button>
            <button type="button" className="w-full rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Explain more (planned)
            </button>
            <div className="rounded border border-slate-200 p-3 text-xs text-slate-600">
              This is a demo runner skeleton. Next steps: fetch questions from API, persist answers, and build review mode.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
