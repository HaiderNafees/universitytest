import { useMemo, useState } from 'react'
import { accuracyPercent, formatDuration, grade, OPTION_LETTERS } from '../lib/exam'
import type { Candidate, Question, SubjectMeta, SubjectResult } from '../types'

interface ResultsPageProps {
  candidate: Candidate
  meta: SubjectMeta
  result: SubjectResult
  questions: Question[]
  onBack: () => void
}

type Filter = 'all' | 'wrong' | 'skipped' | 'flagged' | 'correct'

const verdict = (correct: number) => {
  if (correct >= 40) return { label: 'Excellent', cls: 'from-emerald-500 to-teal-600' }
  if (correct >= 32) return { label: 'Good', cls: 'from-sky-500 to-blue-600' }
  if (correct >= 24) return { label: 'Fair — keep practising', cls: 'from-amber-500 to-orange-600' }
  return { label: 'Needs improvement', cls: 'from-red-500 to-rose-600' }
}

export function ResultsPage({ candidate, meta, result, questions, onBack }: ResultsPageProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const g = useMemo(() => grade(questions, result.answers), [questions, result.answers])
  const pct = accuracyPercent(result, questions.length)
  const v = verdict(g.correct)

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: questions.length },
    { key: 'correct', label: 'Correct', count: g.correct },
    { key: 'wrong', label: 'Incorrect', count: g.attempted - g.correct },
    { key: 'skipped', label: 'Skipped', count: g.skipped },
    { key: 'flagged', label: 'Flagged', count: result.flagged.filter(Boolean).length },
  ]

  const visible = questions.filter((q) => {
    const i = q.id - 1
    const ans = result.answers[i]
    const isCorrect = ans !== null && ans === q.a
    switch (filter) {
      case 'correct':
        return isCorrect
      case 'wrong':
        return ans !== null && !isCorrect
      case 'skipped':
        return ans === null
      case 'flagged':
        return result.flagged[i]
      default:
        return true
    }
  })

  return (
    <div className="animate-fade-up mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-300/50 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700"
      >
        ← Back to papers
      </button>

      {/* Header */}
      <div className="mt-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Result slip · {meta.name} {meta.chinese}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900">
          {candidate.name.split(' ')[0]}&apos;s score
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Submitted {new Date(result.submittedAt).toLocaleString()} · Candidate ID {candidate.passport}
        </p>
      </div>

      {/* Score card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-300/30 bg-white shadow-lg shadow-ink-900/5">
        <div className={`bg-gradient-to-r ${v.cls} px-6 py-8 text-white`}>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            <div className="text-center">
              <div className="text-6xl font-extrabold tracking-tight">
                {result.correct}
                <span className="text-3xl font-bold text-white/70"> / {questions.length}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/80">raw score</p>
            </div>
            <div className="h-16 w-px bg-white/25" />
            <div className="text-center">
              <div className="text-5xl font-extrabold">{pct}%</div>
              <p className="mt-1 text-sm font-semibold text-white/80">accuracy</p>
            </div>
            <div className="h-16 w-px bg-white/25" />
            <div className="text-center">
              <div className="text-3xl font-extrabold">{v.label}</div>
              <p className="mt-1 text-sm font-semibold text-white/80">
                time used: {formatDuration(result.timeUsedMs)}
              </p>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-ink-300/20 text-center sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: 'Correct', value: g.correct, cls: 'text-emerald-600' },
            { label: 'Incorrect', value: g.attempted - g.correct, cls: 'text-red-600' },
            { label: 'Skipped', value: g.skipped, cls: 'text-ink-500' },
            { label: 'Flagged', value: result.flagged.filter(Boolean).length, cls: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{s.label}</dt>
              <dd className={`mt-1 text-2xl font-extrabold ${s.cls}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Review */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Answer review</h2>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  filter === f.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border border-ink-300/40 bg-white text-ink-500 hover:border-brand-400 hover:text-brand-700'
                }`}
              >
                {f.label} <span className="opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-semibold text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Your correct answer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Your wrong choice
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-300/60" /> Correct answer
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-ink-300/50 bg-white p-10 text-center text-sm text-ink-500">
            No questions match this filter.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visible.map((q) => {
              const i = q.id - 1
              const ans = result.answers[i]
              const correct = ans === q.a
              const flagged = result.flagged[i]
              const wrong = ans !== null && !correct
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-extrabold text-ink-500">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
                          correct ? 'bg-emerald-100 text-emerald-700' : wrong ? 'bg-red-100 text-red-600' : 'bg-ink-300/15 text-ink-500'
                        }`}
                      >
                        {correct ? '✓' : wrong ? '✕' : '–'}
                      </span>
                      Question {q.id}
                      {flagged && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-gold-500" />}
                    </span>
                    {wrong && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        Your answer: {ans !== null ? OPTION_LETTERS[ans] : '—'}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-ink-900">{q.q}</p>

                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isCorrectOpt = oi === q.a
                      const isChosen = ans === oi
                      const showCorrect = isCorrectOpt || (isChosen && !isCorrectOpt)
                      return (
                        <li
                          key={oi}
                          className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-relaxed ${
                            isCorrectOpt
                              ? 'bg-emerald-50 font-semibold text-emerald-800'
                              : isChosen
                                ? 'bg-red-50 font-semibold text-red-700 line-through decoration-red-300'
                                : 'text-ink-500'
                          }`}
                        >
                          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-extrabold text-ink-500 ring-1 ring-ink-300/40">
                            {OPTION_LETTERS[oi]}
                          </span>
                          <span className="min-w-0">
                            {opt}
                            {showCorrect && (
                              <span className="ml-1.5 whitespace-nowrap text-[10px] font-bold uppercase">
                                {isCorrectOpt ? (isChosen ? '✓ your answer' : '✓ correct answer') : '✕ your answer'}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
        >
          ← Back to all papers
        </button>
      </div>
    </div>
  )
}