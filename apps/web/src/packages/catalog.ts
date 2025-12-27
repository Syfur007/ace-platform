export type ExamPackage = {
  id: string
  name: string
  subtitle: string
  overview: string
  highlights: string[]
  modules: string[]
  moduleSections: Array<{ id: string; name: string; description: string }>
}

export const EXAM_PACKAGES: ExamPackage[] = [
  {
    id: 'ielts',
    name: 'IELTS',
    subtitle: 'Listening • Reading • Writing • Speaking',
    overview: 'Full IELTS prep with multi-modal modules, timed mocks, and feedback displays for writing and speaking.',
    highlights: ['Band-style scoring display (UI scaffold)', 'Listening + speaking modules (hooks in place)', 'Progress analytics + streaks'],
    modules: ['Listening', 'Reading', 'Writing', 'Speaking'],
    moduleSections: [
      {
        id: 'listening',
        name: 'Listening',
        description: 'Audio-based question sets with timed sections and review of transcripts and answer patterns.',
      },
      {
        id: 'reading',
        name: 'Reading',
        description: 'Passage-based practice with question types aligned to IELTS Academic/General formats.',
      },
      {
        id: 'writing',
        name: 'Writing',
        description: 'Task 1/Task 2 workflows with feedback-ready scoring displays and rubric-aligned guidance.',
      },
      {
        id: 'speaking',
        name: 'Speaking',
        description: 'Cue-card style prompts with speaking analysis hooks (fluency, coherence, pronunciation).',
      },
    ],
  },
  {
    id: 'toefl',
    name: 'TOEFL',
    subtitle: 'iBT practice + speaking/essay feedback',
    overview: 'Practice tests and drills aligned to TOEFL iBT sections with feedback-ready review screens.',
    highlights: ['Speaking analysis panel scaffold', 'Essay feedback panel scaffold', 'Mock exams + review'],
    modules: ['Reading', 'Listening', 'Speaking', 'Writing'],
    moduleSections: [
      { id: 'reading', name: 'Reading', description: 'Academic passages with question-type coverage and timed drills.' },
      { id: 'listening', name: 'Listening', description: 'Lecture/conversation audio modules with note-taking style practice.' },
      { id: 'speaking', name: 'Speaking', description: 'Integrated and independent speaking prompts with analysis hooks.' },
      { id: 'writing', name: 'Writing', description: 'Integrated + independent writing with feedback display scaffolding.' },
    ],
  },
  {
    id: 'gre',
    name: 'GRE',
    subtitle: 'Section-level adaptivity (IRT-based)',
    overview: 'GRE-style adaptive practice with section-level IRT hooks, STEM validation for algebra, and timed mocks.',
    highlights: ['Section-level IRT adaptivity (theta + difficulty match)', 'STEM equivalence validation box', 'Heartbeat-backed session recovery'],
    modules: ['Verbal', 'Quant', 'Analytical Writing'],
    moduleSections: [
      { id: 'verbal', name: 'Verbal', description: 'Text completion, sentence equivalence, and reading comprehension practice.' },
      { id: 'quant', name: 'Quant', description: 'Algebra/geometry/data with STEM validation boxes for expression entry.' },
      { id: 'awa', name: 'Analytical Writing', description: 'Issue/argument tasks with LLM feedback display scaffolding.' },
    ],
  },
  {
    id: 'gmat',
    name: 'GMAT',
    subtitle: 'Quant • Verbal • Data Insights',
    overview: 'GMAT prep with modular practice blocks and analytics hooks for scoring and progress tracking.',
    highlights: ['Timed practice blocks', 'Progress analytics scaffold', 'Question bank hooks'],
    modules: ['Quant', 'Verbal', 'Data Insights'],
    moduleSections: [
      { id: 'quant', name: 'Quant', description: 'Arithmetic/algebra/word problems with timed sets and review.' },
      { id: 'verbal', name: 'Verbal', description: 'Critical reasoning and reading comprehension style practice blocks.' },
      { id: 'data', name: 'Data Insights', description: 'Multi-source reasoning and data interpretation style modules.' },
    ],
  },
  {
    id: 'sat',
    name: 'SAT',
    subtitle: 'Math • Reading & Writing',
    overview: 'SAT preparation with topic-based practice and full mocks, designed for fast review cycles.',
    highlights: ['Topic practice sets', 'Mock exams + analytics scaffold', 'Gamified streaks + coins'],
    modules: ['Math', 'Reading & Writing'],
    moduleSections: [
      { id: 'math', name: 'Math', description: 'Algebra, advanced math, problem-solving with quick drills and mocks.' },
      { id: 'rw', name: 'Reading & Writing', description: 'Grammar and reading comprehension practice with timed sets.' },
    ],
  },
  {
    id: 'pte',
    name: 'PTE',
    subtitle: 'AI-scored speaking and writing practice',
    overview: 'PTE prep flow with speaking and writing feedback-ready UI components.',
    highlights: ['Speaking feedback panel scaffold', 'Writing feedback panel scaffold', 'Practice sets + review'],
    modules: ['Speaking', 'Writing', 'Reading', 'Listening'],
    moduleSections: [
      { id: 'speaking', name: 'Speaking', description: 'Read aloud, repeat sentence, and describe image-style prompts.' },
      { id: 'writing', name: 'Writing', description: 'Summarize written text and essay tasks with feedback display hooks.' },
      { id: 'reading', name: 'Reading', description: 'Re-order paragraphs and fill-in-the-blanks style drills.' },
      { id: 'listening', name: 'Listening', description: 'Summarize spoken text and multiple-choice listening drills.' },
    ],
  },
  {
    id: 'det',
    name: 'Duolingo English Test',
    subtitle: 'Fast adaptive practice sets',
    overview: 'Adaptive practice sets with short sessions and quick feedback loops.',
    highlights: ['Fast practice blocks', 'Analytics scaffold', 'Gamified coins'],
    modules: ['Adaptive Practice'],
    moduleSections: [
      { id: 'adaptive', name: 'Adaptive Practice', description: 'Short adaptive sets with quick review and progress tracking.' },
    ],
  },
  {
    id: 'oet',
    name: 'OET',
    subtitle: 'Healthcare-focused English prep',
    overview: 'OET-aligned practice and review scaffolding for healthcare professionals.',
    highlights: ['Role-play speaking practice hooks', 'Writing feedback panel scaffold', 'Mock exams + review'],
    modules: ['Listening', 'Reading', 'Writing', 'Speaking'],
    moduleSections: [
      { id: 'listening', name: 'Listening', description: 'Healthcare-context listening tasks with review.' },
      { id: 'reading', name: 'Reading', description: 'Workplace reading tasks aligned to OET formats.' },
      { id: 'writing', name: 'Writing', description: 'Referral/discharge letter practice with feedback display hooks.' },
      { id: 'speaking', name: 'Speaking', description: 'Role-play consultations with speaking analysis scaffolding.' },
    ],
  },
]

export function getExamPackageById(packageId: string) {
  return EXAM_PACKAGES.find((p) => p.id === packageId) ?? null
}
