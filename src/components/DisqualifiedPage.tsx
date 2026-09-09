import { subjectMap } from '../data/exams'
import type { Candidate, Disqualification } from '../types'

interface DisqualifiedPageProps {
  candidate: Candidate
  info: Disqualification
  onLogout: () => void
}

const PHASE_LABEL: Record<Disqualification['phase'], string> = {
  'camera-test': 'Camera verification',
  'room-check': 'Room scan',
  monitoring: 'In-test monitoring',
}

export function DisqualifiedPage({ candidate, info, onLogout }: DisqualifiedPageProps) {
  const paperName = info.subjectId ? subjectMap[info.subjectId].name : null
  const time = new Date(info.at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="animate-fade-up mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-2xl border-2 border-red-300 bg-white p-8 text-center shadow-xl shadow-red-900/5">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg viewBox="0 0 24 24" className="h-11 w-11 fill-red-600" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 6.32 12.9L5.1 7.68A8 8 0 0 1 12 4Zm0 16a8 8 0 0 1-6.32-12.9l13.22 13.22A8 8 0 0 1 12 20Z" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-red-700 sm:text-3xl">
          Candidate Disqualified
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          <b className="text-ink-900">{candidate.name}</b> ({candidate.passport}) has been
          automatically disqualified from the examination. All papers are now locked.
        </p>

        <div className="mt-6 space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm">
          <p className="flex justify-between gap-4">
            <span className="font-semibold text-red-500">Reason</span>
            <span className="text-right font-semibold text-red-700">{info.reason}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="font-semibold text-red-500">Detected during</span>
            <span className="font-semibold text-red-700">{PHASE_LABEL[info.phase]}</span>
          </p>
          {paperName && (
            <p className="flex justify-between gap-4">
              <span className="font-semibold text-red-500">Paper</span>
              <span className="font-semibold text-red-700">{paperName}</span>
            </p>
          )}
          <p className="flex justify-between gap-4">
            <span className="font-semibold text-red-500">Time</span>
            <span className="font-semibold text-red-700">{time}</span>
          </p>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-ink-500">
          This decision is final and was applied automatically by the proctoring system. If you
          believe this is an error, contact the admissions office at{' '}
          <b className="text-ink-700">admissions@qqhru.edu.cn</b> within 48 hours.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 w-full rounded-xl bg-ink-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-ink-900/20 transition hover:bg-ink-900 active:scale-[0.99]"
        >
          End session
        </button>
      </div>
    </div>
  )
}