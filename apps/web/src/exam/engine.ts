import type { ExamItem, ExamSection, ExamSessionSnapshot } from '@/exam/types'
import { isLikelyEquivalentExpression } from '@/exam/algebraEquivalence'

export type ExamAction =
  | { type: 'setDraftAnswer'; value: string }
  | { type: 'submitDraftAnswer' }
  | { type: 'advance' }
  | { type: 'markHeartbeatAttempt' }
  | { type: 'hydrateFromSnapshot'; snapshot: ExamSessionSnapshot }

const STORAGE_PREFIX = 'ace.exam.session.'

export function getStorageKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`
}

export function createDemoSessionSnapshot(sessionId: string): ExamSessionSnapshot {
  const section: ExamSection = {
    id: 'sec-1',
    title: 'Quant (demo)',
    items: [
      {
        id: 'q1',
        prompt: 'Simplify (x + 1)^2',
        modality: 'quant',
        expectedExpression: '(x+1)^2',
        variables: ['x'],
        irt: { a: 1.0, b: 0.0 },
        answerKey: { type: 'expression', value: '(x+1)^2', variables: ['x'] },
      },
      {
        id: 'q2',
        prompt: 'If x = 3, evaluate 2x + 5',
        modality: 'quant',
        irt: { a: 1.2, b: 0.4 },
        answerKey: { type: 'numeric', value: 11, tolerance: 0 },
      },
    ],
  }

  return {
    sessionId,
    sections: [section],
    thetaBySectionId: { [section.id]: 0 },
    activeSectionIndex: 0,
    activeItemIndex: 0,
    responses: {},
    draftAnswer: '',
    lastLocalPersistedAt: Date.now(),
    lastHeartbeatAttemptAt: null,
  }
}

function scoreItem(item: ExamItem, answer: string): boolean | undefined {
  if (!item.answerKey) return undefined

  if (item.answerKey.type === 'numeric') {
    const raw = answer.trim()
    if (raw.length === 0) return undefined
    const n = Number(raw)
    if (!Number.isFinite(n)) return false
    const tol = item.answerKey.tolerance ?? 0
    return Math.abs(n - item.answerKey.value) <= tol
  }

  if (item.answerKey.type === 'expression') {
    const expected = item.answerKey.value
    const variables = item.answerKey.variables ?? item.variables ?? ['x']
    return isLikelyEquivalentExpression({ expected, actual: answer, variables })
  }

  return undefined
}

function logistic(x: number): number {
  // Avoid overflow.
  if (x > 20) return 1
  if (x < -20) return 0
  return 1 / (1 + Math.exp(-x))
}

function irtProbabilityCorrect({ a, b, c, theta }: { a: number; b: number; c?: number; theta: number }): number {
  const cc = c ?? 0
  return cc + (1 - cc) * logistic(a * (theta - b))
}

function updateTheta({ theta, item, correct }: { theta: number; item: ExamItem; correct: boolean }): number {
  if (!item.irt) return theta
  const a = item.irt.a
  const b = item.irt.b
  const c = item.irt.c

  const p = irtProbabilityCorrect({ a, b, c, theta })
  const u = correct ? 1 : 0

  // Simple gradient step toward MLE; bounded for stability.
  const lr = 0.6
  const next = theta + lr * (u - p)
  return Math.max(-3, Math.min(3, next))
}

function pickNextItemIndex({
  section,
  theta,
  answeredItemIds,
}: {
  section: ExamSection
  theta: number
  answeredItemIds: Set<string>
}): number {
  let bestIndex = 0
  let bestScore = Number.POSITIVE_INFINITY

  for (let i = 0; i < section.items.length; i++) {
    const item = section.items[i]
    if (answeredItemIds.has(item.id)) continue
    if (!item.irt) {
      // Prefer IRT items when available.
      bestIndex = i
      bestScore = -1
      break
    }

    const score = Math.abs(item.irt.b - theta)
    if (score < bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return bestIndex
}

export function getCurrentItem(state: ExamSessionSnapshot): ExamItem | null {
  const section = state.sections[state.activeSectionIndex]
  if (!section) return null
  return section.items[state.activeItemIndex] ?? null
}

export function examReducer(state: ExamSessionSnapshot, action: ExamAction): ExamSessionSnapshot {
  switch (action.type) {
    case 'hydrateFromSnapshot':
      // Trust server snapshot as canonical. Keep local persistence timestamp fresh.
      return { ...action.snapshot, lastLocalPersistedAt: Date.now() }

    case 'setDraftAnswer':
      return { ...state, draftAnswer: action.value }

    case 'submitDraftAnswer': {
      const item = getCurrentItem(state)
      if (!item) return state

      const ts = new Date().toISOString()
      const section = state.sections[state.activeSectionIndex]
      const correct = scoreItem(item, state.draftAnswer)

      let nextThetaBySectionId = state.thetaBySectionId
      if (section && typeof correct === 'boolean') {
        const prevTheta = state.thetaBySectionId[section.id] ?? 0
        nextThetaBySectionId = {
          ...state.thetaBySectionId,
          [section.id]: updateTheta({ theta: prevTheta, item, correct }),
        }
      }

      return {
        ...state,
        thetaBySectionId: nextThetaBySectionId,
        responses: {
          ...state.responses,
          [item.id]: { answer: state.draftAnswer, ts, correct },
        },
      }
    }

    case 'advance': {
      const item = getCurrentItem(state)
      let next = state
      if (item && state.draftAnswer.trim().length > 0) {
        next = examReducer(state, { type: 'submitDraftAnswer' })
      }

      const section = next.sections[next.activeSectionIndex]
      if (!section) return next

      // Section-level adaptivity (IRT-based): pick next item by matching difficulty to theta.
      const theta = next.thetaBySectionId[section.id] ?? 0
      const answered = new Set(Object.keys(next.responses))
      const nextIndex = pickNextItemIndex({ section, theta, answeredItemIds: answered })

      return {
        ...next,
        activeItemIndex: nextIndex,
        draftAnswer: '',
      }
    }

    case 'markHeartbeatAttempt':
      return { ...state, lastHeartbeatAttemptAt: Date.now() }

    default:
      return state
  }
}

export function persistSnapshot(state: ExamSessionSnapshot) {
  try {
    localStorage.setItem(getStorageKey(state.sessionId), JSON.stringify({ ...state, lastLocalPersistedAt: Date.now() }))
  } catch {
    // Intentionally ignore: storage may be unavailable.
  }
}

export function loadSnapshot(sessionId: string): ExamSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId))
    if (!raw) return null
    return JSON.parse(raw) as ExamSessionSnapshot
  } catch {
    return null
  }
}
