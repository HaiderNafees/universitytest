import type { Session } from '../types'

interface ResultPageProps {
  session: Session
  onSignOut: () => void
}

/**
 * Personalized result display. Shows ONLY the signed-in candidate's own
 * result — no other student's name, ID or score is ever rendered.
 */
export function ResultPage({ session, onSignOut }: ResultPageProps) {
  const passed = session.result === 'pass'

  return (
    <div className="w-full max-w-xl animate-fade-up">
      <div
        className={`rounded-2xl border bg-white p-8 text-center shadow-lg sm:p-12 ${
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
