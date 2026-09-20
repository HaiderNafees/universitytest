import { useEffect, useState } from 'react'
import { findSessionByUsername } from './lib/auth'
import { HomePage } from './components/HomePage'
import { ResultPage } from './components/ResultPage'
import type { Session } from './types'

/** Persisted sign-in: only the username — the session is rebuilt from the registry. */
const STORAGE_KEY = 'universitytest-session-v1'

/**
 * Qiqihar University Scholarship Test — Result Portal.
 * Simple flow: login → personalized result. No exam, subjects, timers or
 * proctoring; every previous test view and its data have been removed.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const username = localStorage.getItem(STORAGE_KEY)
      return username ? findSessionByUsername(username) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem(STORAGE_KEY, session.username)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [session])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-300/30 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-serif text-2xl font-bold text-white shadow-sm">
              U
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-bold leading-tight text-brand-900">
                齐齐哈尔大学奖学金考试
                <span className="ml-2 font-sans text-sm font-bold tracking-tight text-ink-900">
                  Qiqihar University Scholarship Test
                </span>
              </span>
              <span className="block truncate text-xs font-medium tracking-wide text-ink-500">
                Result Portal
              </span>
            </span>
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        {session ? (
          <ResultPage session={session} onSignOut={() => setSession(null)} />
        ) : (
          <HomePage onLogin={setSession} />
        )}
      </main>

      <footer className="mt-auto border-t border-ink-300/30 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center sm:px-6">
          <p className="text-xs font-semibold text-ink-500">
            <span className="font-serif text-brand-700">齐齐哈尔大学奖学金考试</span> Qiqihar
            University Scholarship Test · Result Portal
          </p>
        </div>
      </footer>
    </div>
  )
}
