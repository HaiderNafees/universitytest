import { useEffect, useState } from 'react'
import { subjects } from '../data/exams'
import { getQuestions } from '../data/questions'
import { accuracyPercent, announcementAt, formatDuration, resultsAnnounced } from '../lib/exam'
import type { Candidate, SubjectId, SubjectResult } from '../types'

interface SubjectsPageProps {
  candidate: Candidate
  results: Partial<Record<SubjectId, SubjectResult>>
  onResume: (subject: SubjectId) => void
  onReview: (subject: SubjectId) => void
  onLogout: () => void
}

function statusOf(result: SubjectResult | undefined, now: number) {
  if (!result) return { label: 'Not started', tone: 'text-ink-500 bg-ink-300/15' }
  if (!result.completed) {
    return result.startedAt + result.timeLimitMs <= now
      ? { label: 'Timed out', tone: 'text-amber-700 bg-amber-100' }
      : { label: 'In progress', tone: 'text-brand-700 bg-brand-100' }
  }
  return resultsAnnounced(result)
    ? { label: 'Result announced', tone: 'text-emerald-700 bg-emerald-100' }
    : { label: 'Awaiting result', tone: 'text-amber-700 bg-amber-100' }
}

export function SubjectsPage({ candidate, results, onResume, onReview, onLogout }: SubjectsPageProps) {
  const [now, setNow] = useState(() => Date.now())
  // Re-evaluate live statuses (expired clocks, remaining minutes) every 15 s.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const completed = subjects.filter((s) => results[s.id]?.completed)
  const announcedList = completed.filter((s) => resultsAnnounced(results[s.id]!))
  const totalScore = announcedList.reduce((sum, s) => sum + (results[s.id]?.correct ?? 0), 0)
  const allDone = completed.length === subjects.length

  return (
    <div className="animate-fade-up mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Greeting + progress */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Examination hall
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Welcome, {candidate.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Choose a paper below. The 45-minute timer starts the moment you open it.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-ink-300/50 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700"
        >
          ← End session
        </button>
      </div>

      {/* Overall progress */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Papers completed</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {completed.length}
            <span className="text-lg font-semibold text-ink-300"> / {subjects.length}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-300/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{ width: `${(completed.length / subjects.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Aggregate score</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {announcedList.length === 0 ? '—' : totalScore}
            <span className="text-lg font-semibold text-ink-300"> / {announcedList.length * 48}</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">announced results only</p>
        </div>
        <div className="rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Average accuracy</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {announcedList.length === 0
              ? '—'
              : `${Math.round(
                  announcedList.reduce(
                    (sum, s) => sum + accuracyPercent(results[s.id]!, getQuestions(s.id).length),
                    0,
                  ) / announcedList.length,
                )}%`}
          </p>
          <p className="mt-1 text-xs text-ink-500">announced results only</p>
        </div>
      </div>

      {allDone && (
        <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            All four papers submitted. Your results will be announced after three days — this
            page will show your scores once they are published.
          </p>
        </div>
      )}

      {/* Subject cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {subjects.map((s) => {
          const result = results[s.id]
          const st = statusOf(result, now)
          const qs = getQuestions(s.id)
          const answered = result ? result.answers.filter((a) => a !== null).length : 0
          const live = !!result && !result.completed && result.startedAt + result.timeLimitMs > now
          const leftMs = result ? result.startedAt + result.timeLimitMs - now : 0

          return (
            <div
              key={s.id}
              className="relative overflow-hidden rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink-900/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-sm font-extrabold tracking-wider text-white shadow`}>
                    {s.icon}
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
                      {s.name}
                      <span className="ml-2 font-serif text-sm font-semibold text-ink-300">
                        {s.chinese}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-ink-500">
                      {s.questionCount} questions · {s.durationMinutes} minutes
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.tone}`}>
                  {st.label}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-500">{s.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                {result ? (
                  <>
                    <span>
                      <b className="text-ink-900">{answered}</b> / {qs.length} answered
                    </span>
                    {result.completed && resultsAnnounced(result) && (
                      <>
                        <span>
                          Score <b className="text-brand-700">{result.correct}</b> / {qs.length}
                        </span>
                        <span>
                          Time <b className="text-ink-900">{formatDuration(result.timeUsedMs)}</b>
                        </span>
                      </>
                    )}
                    {result.completed && !resultsAnnounced(result) && (
                      <span className="font-semibold text-amber-700">
                        Result on{' '}
                        {new Date(announcementAt(result)).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {live && (
                      <span className="font-semibold text-amber-700">
                        {Math.max(0, Math.ceil(leftMs / 60000))} min left
                      </span>
                    )}
                    {result.completed && (
                      <span className="font-semibold text-ink-500">One attempt only</span>
                    )}
                  </>
                ) : (
                  <span>{qs.length} multiple-choice questions, one answer each</span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {!result ? (
                  <button
                    type="button"
                    onClick={() => onResume(s.id)}
                    className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
                  >
                    Start paper →
                  </button>
                ) : result.completed ? (
                  <button
                    type="button"
                    onClick={() => onReview(s.id)}
                    className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700"
                  >
                    Review result
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => (st.label === 'Timed out' ? onReview(s.id) : onResume(s.id))}
                    className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
                  >
                    {st.label === 'Timed out' ? 'View result' : 'Resume paper'} ⏱
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Score table */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-ink-300/30 bg-white shadow-sm">
        <div className="border-b border-ink-300/30 bg-paper px-5 py-3">
          <h3 className="text-sm font-bold text-ink-900">Results summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3">Paper</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">Accuracy</th>
                <th className="px-5 py-3">Time used</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const result = results[s.id]
                const qs = getQuestions(s.id)
                return (
                  <tr key={s.id} className="border-t border-ink-300/20">
                    <td className="px-5 py-3 font-semibold text-ink-900">
                      {s.name} <span className="font-normal text-ink-300">{s.chinese}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusOf(result, now).tone}`}>
                        {statusOf(result, now).label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-ink-900">
                      {result?.completed && resultsAnnounced(result) ? `${result.correct} / ${qs.length}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {result?.completed && resultsAnnounced(result) ? `${accuracyPercent(result, qs.length)}%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {result?.completed && resultsAnnounced(result) ? formatDuration(result.timeUsedMs) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-ink-300">
        Candidate: {candidate.name} · {candidate.passport} · {candidate.nationality}
      </p>
    </div>
  )
}