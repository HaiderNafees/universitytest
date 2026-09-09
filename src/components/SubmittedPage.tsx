import { useEffect, useState } from 'react'
import { RESULT_ANNOUNCEMENT_DELAY_MS } from '../lib/exam'
import type { SubjectMeta } from '../types'

interface SubmittedPageProps {
  meta: SubjectMeta
  submittedAt: number
  onBack: () => void
}

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = Math.max(0, target - now)
  const total = Math.ceil(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { d, h, m, s }
}

export function SubmittedPage({ meta, submittedAt, onBack }: SubmittedPageProps) {
  const target = submittedAt + RESULT_ANNOUNCEMENT_DELAY_MS
  const { d, h, m, s } = useCountdown(target)

  const pad = (n: number) => String(n).padStart(2, '0')
  const announceDate = new Date(target)

  return (
    <div className="animate-fade-up mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-inner">
        <svg viewBox="0 0 24 24" className="h-11 w-11 fill-emerald-600" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" />
        </svg>
      </div>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
        Test submitted
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-500">
        Your <b className="text-ink-900">{meta.name} ({meta.chinese})</b> paper was submitted on{' '}
        {new Date(submittedAt).toLocaleString()}. Your result will be announced on <b className="text-ink-900">September 20, 2026</b>.
      </p>

      <div className="mt-8 w-full rounded-2xl border border-ink-300/30 bg-white p-6 shadow-lg shadow-ink-900/5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
          Results announced in
        </p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { v: d, l: 'Days' },
            { v: h, l: 'Hours' },
            { v: m, l: 'Minutes' },
            { v: s, l: 'Seconds' },
          ].map((b) => (
            <div key={b.l} className="rounded-xl bg-paper px-2 py-4">
              <div className="font-mono text-3xl font-extrabold tabular-nums text-ink-900">
                {pad(b.v)}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                {b.l}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-500">
          Announcement date: {announceDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="mt-4 w-full rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-center">
        <p className="text-sm font-semibold text-ink-900">One attempt only</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          This submission is final and cannot be changed or retaken. The result will
          be published once the announcement period ends.
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-8 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
      >
        ← Back to papers
      </button>
    </div>
  )
}
