import credentials from '../data/credentials.json'
import type { Account, Session } from '../types'

/**
 * The account registry — keyed by username. It ships inside the bundle for
 * this local demo portal; a production deployment would authenticate
 * server-side and never expose passwords or results.
 */
const registry = credentials as unknown as Record<string, Omit<Account, 'username'>>

const accounts: Account[] = Object.entries(registry).map(([username, account]) => ({
  ...account,
  username,
}))

function findAccount(username: string): Account | undefined {
  const needle = username.trim().toLowerCase()
  return accounts.find((a) => a.username.toLowerCase() === needle)
}

function toSession(account: Account): Session {
  return {
    username: account.username,
    name: account.name,
    id: account.id,
    result: account.result,
    score: account.score,
  }
}

/** Verify a username/password pair. Returns the signed-in session (no password) or null. */
export function authenticate(username: string, password: string): Session | null {
  const match = findAccount(username)
  if (!match || match.password !== password) return null
  return toSession(match)
}

/** Look up a session by username — used to restore a persisted sign-in. */
export function findSessionByUsername(username: string): Session | null {
  const match = findAccount(username)
  return match ? toSession(match) : null
}
