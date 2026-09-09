import type { Question, SubjectResult } from '../types'

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

export interface Grade {
  correct: number
  attempted: number
  skipped: number
  score: number
}

export function grade(questions: Question[], answers: (number | null)[]): Grade {
  let correct = 0
  let attempted = 0
  answers.forEach((ans, i) => {
    if (ans === null) return
    attempted += 1
    if (questions[i] && ans === questions[i].a) correct += 1
  })
  return {
    correct,
    attempted,
    skipped: answers.length - attempted,
    score: correct,
  }
}

export function isExpired(result: SubjectResult, now = Date.now()): boolean {
  return result.startedAt + result.timeLimitMs <= now
}

/** mm:ss (or h:mm:ss when >= 1 hour) */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Human readable duration, e.g. "42 min 08 s" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m} min ${String(s).padStart(2, '0')} s`
}

export function accuracyPercent(result: SubjectResult, questionCount: number): number {
  return questionCount === 0 ? 0 : Math.round((result.correct / questionCount) * 100)
}

/** Results are announced exactly three days after submission. */
export const RESULT_ANNOUNCEMENT_DELAY_MS = 3 * 24 * 60 * 60 * 1000

export function announcementAt(result: SubjectResult): number {
  return result.submittedAt + RESULT_ANNOUNCEMENT_DELAY_MS
}

/** Results become visible once three days have passed since submission. */
export function resultsAnnounced(result: SubjectResult, now = Date.now()): boolean {
  return result.completed && now >= announcementAt(result)
}