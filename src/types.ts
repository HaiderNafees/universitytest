export type SubjectId = 'physics' | 'chemistry' | 'math' | 'english'

/** Compact storage format: [question, opt1, opt2, opt3, opt4, correctIndex] */
export type RawQ = readonly [string, string, string, string, string, number]

export interface Question {
  id: number
  q: string
  options: string[]
  /** index of the correct option */
  a: number
}

export interface SubjectMeta {
  id: SubjectId
  name: string
  chinese: string
  short: string
  durationMinutes: number
  questionCount: number
  description: string
  icon: string
  accent: string
}

export interface Candidate {
  /** Login username from the credentials registry */
  username: string
  name: string
  passport: string
  nationality: string
  email: string
}

export interface SubjectResult {
  subjectId: SubjectId
  answers: (number | null)[]
  flagged: boolean[]
  startedAt: number
  timeLimitMs: number
  timeUsedMs: number
  submittedAt: number
  /** true when auto-submitted by the timer or manually submitted */
  completed: boolean
  score: number
  correct: number
  attempted: number
}

export interface Disqualification {
  reason: string
  at: number
  /** Where the violation was detected */
  phase: 'camera-test' | 'room-check' | 'monitoring'
  /** The paper being attempted when the violation occurred, if any */
  subjectId: SubjectId | null
}

export type View =
  | 'home'
  | 'subjects'
  | 'rules'
  | 'cameratest'
  | 'roomcheck'
  | 'test'
  | 'results'
  | 'submitted'
  | 'disqualified'