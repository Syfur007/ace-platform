type Token =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }

function tokenize(input: string): Token[] | null {
  const s = input.replace(/\s+/g, '')
  const out: Token[] = []

  let i = 0
  while (i < s.length) {
    const ch = s[i]

    if (ch === '(') {
      out.push({ kind: 'lparen' })
      i += 1
      continue
    }
    if (ch === ')') {
      out.push({ kind: 'rparen' })
      i += 1
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      out.push({ kind: 'op', op: ch })
      i += 1
      continue
    }

    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1
      const raw = s.slice(i, j)
      const num = Number(raw)
      if (!Number.isFinite(num)) return null
      out.push({ kind: 'num', value: num })
      i = j
      continue
    }

    if (/[a-zA-Z]/.test(ch)) {
      let j = i
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j += 1
      const name = s.slice(i, j)
      out.push({ kind: 'var', name })
      i = j
      continue
    }

    return null
  }

  return out
}

type Rpn = Array<{ kind: 'num'; value: number } | { kind: 'var'; name: string } | { kind: 'op'; op: '+' | '-' | '*' | '/' | '^' }>

const precedence: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '^': 3,
}

function toRpn(tokens: Token[]): Rpn | null {
  const output: Rpn = []
  const ops: Token[] = []

  // Handle unary minus by rewriting as (0 - x)
  const normalized: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind === 'op' && t.op === '-') {
      const prev = normalized[normalized.length - 1]
      const unary = !prev || prev.kind === 'op' || prev.kind === 'lparen'
      if (unary) {
        normalized.push({ kind: 'num', value: 0 })
      }
    }
    normalized.push(t)
  }

  for (const t of normalized) {
    if (t.kind === 'num' || t.kind === 'var') {
      output.push(t)
      continue
    }

    if (t.kind === 'op') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1]
        if (top.kind !== 'op') break

        const p1 = precedence[top.op]
        const p2 = precedence[t.op]

        // '^' is right-associative
        const shouldPop = t.op === '^' ? p1 > p2 : p1 >= p2
        if (!shouldPop) break

        output.push(top)
        ops.pop()
      }
      ops.push(t)
      continue
    }

    if (t.kind === 'lparen') {
      ops.push(t)
      continue
    }

    if (t.kind === 'rparen') {
      while (ops.length > 0 && ops[ops.length - 1].kind !== 'lparen') {
        const top = ops.pop()!
        if (top.kind === 'op') output.push(top)
      }
      if (ops.length === 0) return null
      ops.pop() // pop lparen
      continue
    }
  }

  while (ops.length > 0) {
    const top = ops.pop()!
    if (top.kind === 'lparen' || top.kind === 'rparen') return null
    if (top.kind === 'op') output.push(top)
  }

  return output
}

function evalRpn(rpn: Rpn, vars: Record<string, number>): number | null {
  const stack: number[] = []

  for (const t of rpn) {
    if (t.kind === 'num') {
      stack.push(t.value)
      continue
    }

    if (t.kind === 'var') {
      const v = vars[t.name]
      if (!Number.isFinite(v)) return null
      stack.push(v)
      continue
    }

    if (t.kind === 'op') {
      const b = stack.pop()
      const a = stack.pop()
      if (a === undefined || b === undefined) return null

      let res: number
      switch (t.op) {
        case '+':
          res = a + b
          break
        case '-':
          res = a - b
          break
        case '*':
          res = a * b
          break
        case '/':
          res = a / b
          break
        case '^':
          res = a ** b
          break
        default:
          return null
      }

      if (!Number.isFinite(res)) return null
      stack.push(res)
      continue
    }
  }

  if (stack.length !== 1) return null
  return stack[0]
}

function compileExpression(expr: string): ((vars: Record<string, number>) => number | null) | null {
  const tokens = tokenize(expr)
  if (!tokens) return null
  const rpn = toRpn(tokens)
  if (!rpn) return null

  return (vars) => evalRpn(rpn, vars)
}

export function isLikelyEquivalentExpression({
  expected,
  actual,
  variables,
}: {
  expected: string
  actual: string
  variables: string[]
}): boolean {
  const f = compileExpression(expected)
  const g = compileExpression(actual)
  if (!f || !g) return false

  // Deterministic sample points; avoids randomness in tests/UX.
  const samples = [-2, -1, 0, 1, 2, 3]

  for (const x of samples) {
    const vars: Record<string, number> = {}
    for (const v of variables) vars[v] = x

    const a = f(vars)
    const b = g(vars)
    if (a === null || b === null) return false

    const diff = Math.abs(a - b)
    if (diff > 1e-6) return false
  }

  return true
}
