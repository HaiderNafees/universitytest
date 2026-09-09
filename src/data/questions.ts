import { chemistryQuestions } from './chemistry'
import { englishQuestions } from './english'
import { mathQuestions } from './math'
import { physicsQuestions } from './physics'
import type { Question, SubjectId } from '../types'

export const questionBank: Record<SubjectId, Question[]> = {
  physics: physicsQuestions,
  chemistry: chemistryQuestions,
  math: mathQuestions,
  english: englishQuestions,
}

export function getQuestions(subject: SubjectId): Question[] {
  return questionBank[subject]
}