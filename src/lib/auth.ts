import credentials from '../data/credentials.json'
import type { Candidate } from '../types'

/** A candidate account from the credentials registry. */
export interface CandidateAccount {
  username: string
  password: string
  name: string
  passport: string
  nationality: string
  email: string
}

const accounts: CandidateAccount[] = credentials.candidates ?? []

/**
 * Verify a username/password pair against the credentials registry.
 * Returns the candidate profile (without the password) on success, null on failure.
 */
export function authenticate(username: string, password: string): Candidate | null {
  const match = accounts.find(
    (c) => c.username.toLowerCase() === username.trim().toLowerCase() && c.password === password,
  )
  if (!match) return null
  const { password: _password, ...profile } = match
  return profile
}

