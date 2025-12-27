export type ExamModality = 'verbal' | 'quant' | 'reading' | 'listening' | 'speaking' | 'writing'

export type ExamItem = {
  id: string
  prompt: string
  modality: ExamModality

  // IRT parameters for section-level adaptivity.
  // For GRE-style adaptive sections, b ~= difficulty, a ~= discrimination.
  irt?: {
    a: number
    b: number
    c?: number
  }

  // Optional answer key enabling local scoring (used for demo + STEM bias reduction).
  answerKey?:
    | { type: 'numeric'; value: number; tolerance?: number }
    | { type: 'expression'; value: string; variables?: string[] }

  // QTI 3.0 interoperability hook.
  // When the backend delivers QTI items, store the raw/normalized payload here.
  qti?: unknown

  // For algebraic reasoning, an optional expected expression can be used with the STEM validation box.
  expectedExpression?: string
  variables?: string[]
}

export type ExamSection = {
  id: string
  title: string
  items: ExamItem[]
}

export type ExamSessionSnapshot = {
  sessionId: string
  sections: ExamSection[]

  // Section-level ability estimate (theta) used by IRT-based adaptivity.
  thetaBySectionId: Record<string, number>

  activeSectionIndex: number
  activeItemIndex: number

  responses: Record<string, { answer: string; ts: string; correct?: boolean }>

  draftAnswer: string

  lastLocalPersistedAt: number
  lastHeartbeatAttemptAt: number | null
}
