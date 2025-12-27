import { useMemo } from 'react'

import { isLikelyEquivalentExpression } from '@/exam/algebraEquivalence'

export function StemValidationBox({
  label,
  expectedExpression,
  variables,
  value,
  onChange,
}: {
  label: string
  expectedExpression: string
  variables: string[]
  value: string
  onChange: (value: string) => void
}) {
  const status = useMemo(() => {
    if (value.trim().length === 0) return { kind: 'empty' as const, message: 'Enter your expression.' }

    const ok = isLikelyEquivalentExpression({
      expected: expectedExpression,
      actual: value,
      variables,
    })

    return ok
      ? { kind: 'ok' as const, message: 'Equivalent (checked numerically).' }
      : { kind: 'bad' as const, message: 'Not equivalent (or could not be parsed).' }
  }, [expectedExpression, value, variables])

  const color =
    status.kind === 'ok'
      ? 'text-emerald-700'
      : status.kind === 'bad'
        ? 'text-rose-700'
        : 'text-slate-600'

  return (
    <div className="rounded border border-slate-200 p-4">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 text-xs text-slate-500">Expected: {expectedExpression}</div>

      <input
        className="mt-3 w-full rounded border border-slate-200 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type an equivalent expression (e.g. x^2 + 2x + 1)"
        inputMode="text"
      />

      <div className={`mt-2 text-xs ${color}`}>{status.message}</div>
    </div>
  )
}
