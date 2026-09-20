/** Verdict stored on an account in the result registry. */
export type Result = 'pass' | 'fail'

/** The four examined subjects, keyed as stored in the registry. */
export type SubjectKey = 'english' | 'chemistry' | 'math' | 'physics'

/** Marks obtained per subject, out of 48 each. */
export type SubjectMarks = Record<SubjectKey, number>

/** A candidate account in the result registry (src/data/credentials.json). */
export interface Account {
  username: string
  password: string
  name: string
  id: string
  result: Result
  score: number
  subjects: SubjectMarks
}

/** Signed-in session — everything the result page may show, without the password. */
export type Session = Omit<Account, 'password'>
