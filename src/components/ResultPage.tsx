import { MAX_PER_SUBJECT, SUBJECTS } from '../lib/auth'
import type { Session } from '../types'

interface ResultPageProps {
  session: Session
  onSignOut: () => void
}

/** Maximum total marks across the four subject papers (48 × 4). */
const MAX_TOTAL = MAX_PER_SUBJECT * SUBJECTS.length

/**
 * Official result declaration for the signed-in candidate. Shows ONLY that
 * candidate's own data — no other student's name, ID or score is rendered.
 */
export function ResultPage({ session, onSignOut }: ResultPageProps) {
  const passed = session.result === 'pass'

  const obtained = SUBJECTS.reduce((sum, s) => sum + session.subjects[s.key], 0)
  const overallPercent = Math.round((obtained / MAX_TOTAL) * 100)

  return (
    <div className="w-full max-w-2xl animate-fade-up">
      <div className="overflow-hidden rounded-lg border border-ink-300/40 bg-white shadow-md shadow-ink-900/5">
        {/* Document header */}
        <div className="border-b-2 border-brand-700 px-6 pb-5 pt-8 text-center sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-500">
            Official Result Declaration
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            University Scholarship Test
          </h1>
        </div>

        {/* Candidate details */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1 border-b border-ink-300/30 px-6 py-5 text-sm sm:grid-cols-2 sm:px-10">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Candidate Name
            </dt>
            <dd className="font-semibold text-ink-900 sm:mt-0.5">{session.name}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Candidate ID
            </dt>
            <dd className="font-semibold text-ink-900 sm:mt-0.5">{session.id}</dd>
          </div>
        </dl>

        {/* Verdict band */}
        <div className={`px-6 py-5 sm:px-10 ${passed ? 'bg-emerald-50/70' : 'bg-red-50/70'}`}>
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              className={`inline-block rounded border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                passed
                  ? 'border-emerald-600/40 bg-emerald-100 text-emerald-800'
                  : 'border-red-600/40 bg-red-100 text-red-800'
              }`}
            >
              {passed ? 'Result: Passed' : 'Result: Failed'}
            </span>

            <h2
              className={`text-xl font-extrabold tracking-tight sm:text-2xl ${
                passed ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {passed ? `CONGRATULATIONS ${session.name}!` : `SORRY ${session.name}`}
            </h2>

            {passed ? (
              <>
                <p className="max-w-xl text-sm font-semibold leading-relaxed text-emerald-900">
                  You have PASSED the University Scholarship Test with an overall score
                  of {session.score}%.
                </p>
                <p className="max-w-xl text-sm leading-relaxed text-ink-700">
                  Your admission process will proceed. Further details will be
                  communicated shortly.
                </p>
              </>
            ) : (
              <p className="max-w-xl text-sm font-semibold leading-relaxed text-red-900">
                Your admission is cancelled. The next process will be informed to you
                later.
              </p>
            )}
          </div>
        </div>

        {/* Marks statement */}
        <div className="border-t border-ink-300/30">
          <div className="px-6 pb-1 pt-5 sm:px-10">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-700">
              Marks Statement
            </h3>
          </div>

          <div className="px-6 pb-2 sm:px-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-300/40 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  <th scope="col" className="py-2.5 pr-4">Subject</th>
                  <th scope="col" className="px-4 py-2.5 text-center">Marks Obtained</th>
                  <th scope="col" className="px-4 py-2.5 text-center">Maximum Marks</th>
                  <th scope="col" className="py-2.5 pl-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((s) => {
                  const marks = session.subjects[s.key]
                  const pct = Math.round((marks / MAX_PER_SUBJECT) * 100)
                  return (
                    <tr key={s.key} className="border-b border-ink-300/20">
                      <td className="py-3 pr-4 font-semibold text-ink-900">{s.name}</td>
                      <td className="px-4 py-3 text-center font-bold text-ink-900">{marks}</td>
                      <td className="px-4 py-3 text-center text-ink-500">{MAX_PER_SUBJECT}</td>
                      <td className="py-3 pl-4 text-right font-semibold text-ink-700">{pct}%</td>
                    </tr>
                  )
                })}
                <tr className="bg-paper">
                  <td className="py-3 pr-4 font-extrabold text-ink-900">Total</td>
                  <td className="px-4 py-3 text-center font-extrabold text-ink-900">{obtained}</td>
                  <td className="px-4 py-3 text-center font-semibold text-ink-700">{MAX_TOTAL}</td>
                  <td
                    className={`py-3 pl-4 text-right font-extrabold ${
                      passed ? 'text-emerald-800' : 'text-red-800'
                    }`}
                  >
                    {overallPercent}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 border-t border-ink-300/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Overall Score
            </span>
            <span
              className={`text-sm font-extrabold ${
                passed ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {obtained} / {MAX_TOTAL} marks · {overallPercent}%
            </span>
          </div>
        </div>

        {/* Document footer */}
        <div className="border-t border-ink-300/30 bg-paper px-6 py-4 text-center sm:px-10">
          <p className="text-[11px] leading-relaxed text-ink-500">
            This is a system-generated result. For any queries, please contact the
            admissions administration.
          </p>
        </div>
      </div>

      <div className="mt-5 text-center">
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
