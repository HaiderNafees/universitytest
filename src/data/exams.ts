import type { SubjectMeta, SubjectId } from '../types'

export const DURATION_MINUTES = 45
export const QUESTION_COUNT = 48

export const subjects: SubjectMeta[] = [
  {
    id: 'physics',
    name: 'Physics',
    chinese: '物理',
    short: 'PHY',
    durationMinutes: DURATION_MINUTES,
    questionCount: QUESTION_COUNT,
    description: 'Mechanics, electromagnetism, waves, optics and modern physics.',
    icon: 'PHY',
    accent: 'from-indigo-500 to-blue-600',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    chinese: '化学',
    short: 'CHE',
    durationMinutes: DURATION_MINUTES,
    questionCount: QUESTION_COUNT,
    description: 'Atomic structure, bonding, reactions, acids & bases and organic basics.',
    icon: 'CHE',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'math',
    name: 'Mathematics',
    chinese: '数学',
    short: 'MAT',
    durationMinutes: DURATION_MINUTES,
    questionCount: QUESTION_COUNT,
    description: 'Algebra, geometry, trigonometry, probability and calculus.',
    icon: 'MAT',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    id: 'english',
    name: 'English',
    chinese: '英语',
    short: 'ENG',
    durationMinutes: DURATION_MINUTES,
    questionCount: QUESTION_COUNT,
    description: 'Grammar, vocabulary and reading comprehension.',
    icon: 'ENG',
    accent: 'from-rose-500 to-pink-600',
  },
]

export const subjectMap: Record<SubjectId, SubjectMeta> = Object.fromEntries(
  subjects.map((s) => [s.id, s]),
) as Record<SubjectId, SubjectMeta>

export const subjectOrder: SubjectId[] = subjects.map((s) => s.id)