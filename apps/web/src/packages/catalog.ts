export type ExamPackage = {
  id: string
  name: string
  subtitle: string
  overview: string
  highlights: string[]
  modules: string[]
}

export const EXAM_PACKAGES: ExamPackage[] = [
  {
    id: 'ielts',
    name: 'IELTS',
    subtitle: 'Listening • Reading • Writing • Speaking',
    overview: 'Full IELTS prep with multi-modal modules, timed mocks, and feedback displays for writing and speaking.',
    highlights: ['Band-style scoring display (UI scaffold)', 'Listening + speaking modules (hooks in place)', 'Progress analytics + streaks'],
    modules: ['Listening', 'Reading', 'Writing', 'Speaking'],
  },
  {
    id: 'toefl',
    name: 'TOEFL',
    subtitle: 'iBT practice + speaking/essay feedback',
    overview: 'Practice tests and drills aligned to TOEFL iBT sections with feedback-ready review screens.',
    highlights: ['Speaking analysis panel scaffold', 'Essay feedback panel scaffold', 'Mock exams + review'],
    modules: ['Reading', 'Listening', 'Speaking', 'Writing'],
  },
  {
    id: 'gre',
    name: 'GRE',
    subtitle: 'Section-level adaptivity (IRT-based)',
    overview: 'GRE-style adaptive practice with section-level IRT hooks, STEM validation for algebra, and timed mocks.',
    highlights: ['Section-level IRT adaptivity (theta + difficulty match)', 'STEM equivalence validation box', 'Heartbeat-backed session recovery'],
    modules: ['Verbal', 'Quant', 'Analytical Writing'],
  },
  {
    id: 'gmat',
    name: 'GMAT',
    subtitle: 'Quant • Verbal • Data Insights',
    overview: 'GMAT prep with modular practice blocks and analytics hooks for scoring and progress tracking.',
    highlights: ['Timed practice blocks', 'Progress analytics scaffold', 'Question bank hooks'],
    modules: ['Quant', 'Verbal', 'Data Insights'],
  },
  {
    id: 'sat',
    name: 'SAT',
    subtitle: 'Math • Reading & Writing',
    overview: 'SAT preparation with topic-based practice and full mocks, designed for fast review cycles.',
    highlights: ['Topic practice sets', 'Mock exams + analytics scaffold', 'Gamified streaks + coins'],
    modules: ['Math', 'Reading & Writing'],
  },
  {
    id: 'pte',
    name: 'PTE',
    subtitle: 'AI-scored speaking and writing practice',
    overview: 'PTE prep flow with speaking and writing feedback-ready UI components.',
    highlights: ['Speaking feedback panel scaffold', 'Writing feedback panel scaffold', 'Practice sets + review'],
    modules: ['Speaking', 'Writing', 'Reading', 'Listening'],
  },
  {
    id: 'det',
    name: 'Duolingo English Test',
    subtitle: 'Fast adaptive practice sets',
    overview: 'Adaptive practice sets with short sessions and quick feedback loops.',
    highlights: ['Fast practice blocks', 'Analytics scaffold', 'Gamified coins'],
    modules: ['Adaptive Practice'],
  },
  {
    id: 'oet',
    name: 'OET',
    subtitle: 'Healthcare-focused English prep',
    overview: 'OET-aligned practice and review scaffolding for healthcare professionals.',
    highlights: ['Role-play speaking practice hooks', 'Writing feedback panel scaffold', 'Mock exams + review'],
    modules: ['Listening', 'Reading', 'Writing', 'Speaking'],
  },
]

export function getExamPackageById(packageId: string) {
  return EXAM_PACKAGES.find((p) => p.id === packageId) ?? null
}
