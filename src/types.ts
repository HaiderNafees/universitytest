/** Verdict stored on an account in the result registry. */
export type Result = 'pass' | 'fail'

/** A candidate account in the result registry (src/data/credentials.json). */
export interface Account {
  username: string
  password: string
  name: string
  id: string
  result: Result
  score: number
}

/** Signed-in session — everything the result page may show, without the password. */
export type Session = Omit<Account, 'password'>
