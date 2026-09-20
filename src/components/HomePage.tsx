import { useState } from 'react'
import { authenticate } from '../lib/auth'
import type { Session } from '../types'

interface HomePageProps {
  onLogin: (session: Session) => void
}

const inputCls =
  'w-full rounded-lg border border-ink-300/50 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

/**
 * Login-only page. No exam rules, countdowns or test content — candidates sign
 * in and are taken straight to their personalized result.
 */
export function HomePage({ onLogin }: HomePageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const session = authenticate(username, password)
    if (session) {
      setError(null)
      onLogin(session)
    } else {
      setError('Account not found. Please contact administration.')
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 1.5px)',
            backgroundSize: '42px 42px',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            University Scholarship Test
          </span>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Result Portal
            <span className="mt-2 block font-sans text-2xl font-extrabold tracking-tight sm:text-4xl">
              University Scholarship Test
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-50/90 sm:text-base">
            Sign in with the account issued to you to view your personal result.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-ink-300/30 bg-white p-6 shadow-lg shadow-ink-900/5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink-900">
                  Candidate login
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Sign in with your username and password to view your result.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700"
                >
                  Username
                </label>
                <input
                  id="username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your username"
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
              >
                Sign in &amp; view my result →
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
