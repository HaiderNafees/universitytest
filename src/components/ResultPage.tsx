import { MAX_PER_SUBJECT, SUBJECTS } from '../lib/auth'
import type { Session } from '../types'

interface ResultPageProps {
  session: Session
  onSignOut: () => void
}

/** Maximum total marks across the four subject papers (48 × 4). */
const MAX_TOTAL = MAX_PER_SUBJECT * SUBJECTS.length

/**
 * Personalized result display. Shows ONLY the signed-in candidate's own
 * result — no other student's name, ID or score is ever rendered.
 */
export function ResultPage({ session, onSignOut }: ResultPageProps) {
  const passed = session.result === 'pass'

  const obtained = SUBJECTS.reduce((sum, s) => sum + session.subjects[s.key], 0)
  const overallPercent = Math.round((obtained / MAX_TOTAL) * 100)

  return (
    <div className="w-full max-w-2xl animate-fade-up">
      {/* Verdict card */}
      <div
        className={`rounded-2xl border bg-white p-8 text-center shadow-lg sm:p-10 ${
          passed ? 'border-emerald-300/60 shadow-emerald-900/5' : 'border-red-300/60 shadow-red-900/5'
        }`}
      >
        <div
          aria-hidden="true"
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-4xl ${
            passed ? 'bg-emerald-100' : 'bg-red-100'
          }`}
        >
          {passed ? '✅' : '❌'}
        </div>

        <h1
          className={`mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl ${
            passed ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {passed ? `CONGRATULATIONS ${session.name}!` : `SORRY ${session.name}`}
        </h1>

        {passed ? (
          <>
            <p className="mt-5 text-base font-semibold leading-relaxed text-emerald-800">
              You have PASSED the University Scholarship Test with an overall score of{' '}
              {session.score}%.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-700">
              Your admission process will proceed. Further details will be communicated
              shortly.
            </p>
          </>
        ) : (
          <p className="mt-5 text-base font-semibold leading-relaxed text-red-800">
            Your admission is cancelled. The next process will be informed to you later.
          </p>
        )}
      </div>

      {/* Official marks statement */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-300/40 bg-white shadow-lg shadow-ink-900/5">
        <div className="border-b border-ink-300/30 bg-paper px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-700">
            Marks Statement
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {session.name} · ID {session.id}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-300/30 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500">
              <th scope="col" className="px-6 py-3">Subject</th>
              <th scope="col" className="px-4 py-3 text-center">Marks Obtained</th>
              <th scope="col" className="px-4 py-3 text-center">Maximum Marks</th>
              <th scope="col" className="px-6 py-3 text-right">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {SUBJECTS.map((s) => {
              const marks = session.subjects[s.key]
              const pct = Math.round((marks / MAX_PER_SUBJECT) * 100)
              return (
                <tr key={s.key} className="border-b border-ink-300/20">
                  <td className="px-6 py-3.5 font-semibold text-ink-900">{s.name}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-ink-900">{marks}</td>
                  <td className="px-4 py-3.5 text-center text-ink-500">{MAX_PER_SUBJECT}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-ink-700">{pct}%</td>
                </tr>
              )
            })}
            <tr className="bg-paper">
              <td className="px-6 py-3.5 font-extrabold text-ink-900">Total</td>
              <td className="px-4 py-3.5 text-center font-extrabold text-ink-900">{obtained}</td>
              <td className="px-4 py-3.5 text-center font-semibold text-ink-700">{MAX_TOTAL}</td>
              <td
                className={`px-6 py-3.5 text-right font-extrabold ${
                  passed ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {overallPercent}%
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-col gap-1 border-t border-ink-300/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-ink-500">
            Overall Score
          </span>
          <span
            className={`text-sm font-extrabold ${
              passed ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {obtained} / {MAX_TOTAL} marks · {overallPercent}%
          </span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onSignOut}
          className="text-xs font-semibold text-ink-300 underline-offset-4 transition hover:text-ink-700 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
