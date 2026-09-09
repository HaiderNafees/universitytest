import { useState } from 'react'
import { RULES } from '../data/rules'

interface RulesPageProps {
  subjectName: string
  subjectChinese: string
  onAccept: () => void
  onCancel: () => void
}

export function RulesPage({ subjectName, subjectChinese, onAccept, onCancel }: RulesPageProps) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="animate-fade-up mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-brand-600" aria-hidden="true">
            <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v16h12V8h-4V4H6Zm2 4h8v2H8v-2Zm0 4h8v2H8v-2Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Examination Rules &amp; Code of Conduct
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
          Before starting <b className="text-ink-900">{subjectName} ({subjectChinese})</b>, you must
          read and accept the official examination rules. Violating any rule results in automatic
          disqualification.
        </p>
      </div>

      {/* Rules list */}
      <ol className="mt-8 space-y-3">
        {RULES.map((rule, i) => (
          <li key={rule} className="flex gap-3 rounded-xl border border-ink-300/30 bg-white p-4 shadow-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-ink-700">{rule}</span>
          </li>
        ))}
      </ol>

      {/* Proctoring notice */}
      <div className="mt-6 rounded-xl border border-gold-500/40 bg-gold-400/10 p-4">
        <p className="text-sm font-semibold text-ink-900">
          Proctoring notice
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Your camera is verified before the test (it repeats until it passes — there is no
          3-attempt limit) and monitors you continuously while you answer, including eye tracking
          to confirm you are looking at the camera. The room must contain only you. Another
          person, looking away from the camera, leaving the camera view, covering the lens, or
          switching tabs/windows triggers automatic disqualification.
        </p>
      </div>

      {/* Consent + actions */}
      <div className="mt-6 rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <span className="text-sm leading-relaxed text-ink-700">
            I have read and understood all of the above rules. I agree to be monitored by camera
            for the entire examination and accept that any violation will result in my automatic
            disqualification.
          </span>
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-paper"
          >
            ← Back to papers
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={onAccept}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            I agree — Continue to Camera Test →
          </button>
        </div>
        {!agreed && (
          <p className="mt-3 text-center text-[11px] font-medium text-ink-400">
            You must tick the checkbox to continue.
          </p>
        )}
      </div>
    </div>
  )
}