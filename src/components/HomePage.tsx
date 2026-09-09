import { useState } from 'react'
import { subjects } from '../data/exams'
import { RULES } from '../data/rules'
import { authenticate } from '../lib/auth'
import type { Candidate } from '../types'

interface HomePageProps {
  onLogin: (candidate: Candidate) => void
}

const inputCls =
  'w-full rounded-lg border border-ink-300/50 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

export function HomePage({ onLogin }: HomePageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const candidate = authenticate(username, password)
    if (candidate) {
      setError(null)
      onLogin(candidate)
    } else {
      setError('Invalid username or password. Check the demo accounts below.')
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
            Official University Admission Test
          </span>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            齐齐哈尔大学
            <span className="mt-2 block font-sans text-2xl font-extrabold tracking-tight sm:text-4xl">
              Qiqihar University Test
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-50/90 sm:text-base">
            The Qiqihar University Test is the official entrance examination for
            international applicants. It consists of four papers, 48 multiple-choice
            questions each, with an automatic 45-minute countdown per paper, monitored
            by camera throughout.
          </p>

          <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'Papers', v: '4 subjects' },
              { k: 'Questions', v: '48 / paper' },
              { k: 'Time', v: '45 min / paper' },
              { k: 'Scoring', v: '+1 per correct' },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-100/80">
                  {s.k}
                </dt>
                <dd className="mt-0.5 text-lg font-bold">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Rules */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink-900">
              Examination rules
            </h2>
            <ul className="mt-4 space-y-3">
              {RULES.map((rule, i) => (
                <li key={rule} className="flex gap-3 rounded-xl border border-ink-300/30 bg-white p-4 shadow-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink-700">{rule}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-gold-500/40 bg-gold-400/10 p-4">
              <p className="text-sm font-semibold text-ink-900">
                Marking scheme for each paper
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-white p-2 shadow-sm">
                  <div className="text-lg font-extrabold text-brand-700">48</div>
                  <div className="text-[11px] font-medium text-ink-500">Max score</div>
                </div>
                <div className="rounded-lg bg-white p-2 shadow-sm">
                  <div className="text-lg font-extrabold text-emerald-600">+1</div>
                  <div className="text-[11px] font-medium text-ink-500">Per correct</div>
                </div>
                <div className="rounded-lg bg-white p-2 shadow-sm">
                  <div className="text-lg font-extrabold text-ink-700">0</div>
                  <div className="text-[11px] font-medium text-ink-500">Wrong / blank</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-ink-900">One attempt only</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                Each paper may be attempted once. Once submitted, the paper is locked
                forever — the result is final and cannot be changed or retaken.
              </p>
            </div>
          </div>

          {/* Login */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-ink-300/30 bg-white p-6 shadow-lg shadow-ink-900/5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-ink-900">
                    Candidate login
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Sign in with the username and password issued to you for the 2026
                    intake assessment.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="username" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700">
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
                  <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-700">
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
                  Sign in &amp; enter the examination hall →
                </button>
                <p className="text-center text-[11px] leading-relaxed text-ink-300">
                  Progress is stored locally in your browser. No data is sent to any server.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Subjects strip */}
        <div className="mt-10">
          <h3 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-ink-500">
            Papers administered by the examination
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-ink-300/30 bg-white px-4 py-3 shadow-sm"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${s.accent} text-[10px] font-extrabold tracking-wider text-white`}>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">
                    {s.name} <span className="font-normal text-ink-300">{s.chinese}</span>
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {s.questionCount} Q · {s.durationMinutes} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}