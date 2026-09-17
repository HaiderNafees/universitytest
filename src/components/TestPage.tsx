import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatClock, OPTION_LETTERS } from '../lib/exam'
import { TRIAL_MODE, useProctor } from '../lib/proctor'
import type { Question, SubjectMeta, SubjectResult } from '../types'

interface TestPageProps {
  meta: SubjectMeta
  questions: Question[]
  result: SubjectResult
  onAnswer: (questionIndex: number, optionIndex: number | null) => void
  onToggleFlag: (questionIndex: number) => void
  onSubmit: () => void
  onExit: () => void
  /** Called with a reason when in-test monitoring detects a violation */
  onDisqualify: (reason: string) => void
}

const WARN_MS = 5 * 60 * 1000

export function TestPage({ meta, questions, result, onAnswer, onToggleFlag, onSubmit, onExit, onDisqualify }: TestPageProps) {
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null)
  const proctorCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const proctor = useProctor(proctorVideoRef, proctorCanvasRef, onDisqualify)
  const [current, setCurrent] = useState(0)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const submittedRef = useRef(false)

  const deadline = result.startedAt + result.timeLimitMs
  const remainingMs = Math.max(0, deadline - now)
  const danger = remainingMs <= WARN_MS

  // Keep the clock honest even when the tab is backgrounded.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [])

  const q = questions[current]
  const answeredCount = useMemo(() => result.answers.filter((a) => a !== null).length, [result.answers])
  const flaggedCount = useMemo(() => result.flagged.filter(Boolean).length, [result.flagged])

  // Auto-submit when time is up.
  useEffect(() => {
    if (remainingMs <= 0 && !submittedRef.current) {
      submittedRef.current = true
      onSubmit()
    }
  }, [remainingMs, onSubmit])

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (result.answers[current] === optionIndex) {
        onAnswer(current, null) // clicking the same option clears it
      } else {
        onAnswer(current, optionIndex)
      }
    },
    [current, result.answers, onAnswer],
  )

  const go = useCallback(
    (delta: number) => {
      setCurrent((c) => Math.min(questions.length - 1, Math.max(0, c + delta)))
    },
    [questions.length],
  )

  const jump = useCallback((i: number) => setCurrent(i), [])

  // Keyboard shortcuts: A–D select, ←/→ navigate, F flag for review
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (['a', 'b', 'c', 'd'].includes(k)) {
        e.preventDefault()
        selectOption(k.charCodeAt(0) - 97)
      } else if (k === 'arrowright') {
        e.preventDefault()
        go(1)
      } else if (k === 'arrowleft') {
        e.preventDefault()
        go(-1)
      } else if (k === 'f') {
        e.preventDefault()
        onToggleFlag(current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectOption, go, onToggleFlag, current])

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Hidden camera feed used by the proctoring monitor */}
      <video
        ref={proctorVideoRef}
        className="pointer-events-none fixed -left-[9999px] h-px w-px opacity-0"
        muted
        playsInline
        autoPlay
      />
      <canvas ref={proctorCanvasRef} className="hidden" />

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-ink-300/30 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <button
              type="button"
              onClick={() => setConfirmExit(true)}
              className="flex items-center gap-2 rounded-lg border border-ink-300/50 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition hover:border-brand-400 hover:text-brand-700"
            >
              ← Exit
            </button>
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${meta.accent} text-[10px] font-extrabold tracking-wider text-white`}>
                {meta.icon}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-extrabold tracking-tight text-ink-900">
                  {meta.name} <span className="font-serif font-semibold text-ink-300">{meta.chinese}</span>
                </p>
                <p className="text-[11px] text-ink-500">
                  Question {current + 1} of {questions.length}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="order-last w-full sm:order-none sm:ml-2 sm:w-auto sm:flex-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500">
                <span>{answeredCount} / {questions.length} answered</span>
                <span>{flaggedCount} flagged</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-300/20">
                <div
                  className={`h-full rounded-full transition-all ${danger ? 'bg-amber-500' : 'bg-brand-600'}`}
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Proctoring status */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                TRIAL_MODE
                  ? 'bg-sky-100 text-sky-800'
                  : proctor.warning
                    ? 'animate-pulse bg-amber-100 text-amber-800'
                    : proctor.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
              }`}
              title="Camera proctoring status"
            >
              {TRIAL_MODE
                ? 'Trial run — movement is ignored'
                : proctor.warning
                  ? proctor.warning
                  : proctor.active
                    ? 'Proctoring active'
                    : 'Camera off'}
            </div>

            {/* Timer */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
                danger ? 'animate-pulse bg-red-100 text-red-700' : 'bg-brand-50 text-brand-800'
              }`}
              title="Time remaining"
              role="timer"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 2a1 1 0 0 0-1 1v1.06A8 8 0 0 0 4.06 11H3a1 1 0 0 0 0 2h1.06A8 8 0 0 0 11 19.94V21a1 1 0 1 0 2 0v-1.06A8 8 0 0 0 19.94 13H21a1 1 0 1 0 0-2h-1.06A8 8 0 0 0 13 4.06V3a1 1 0 0 0-1-1Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm-1 2a1 1 0 0 0-1 1v3a1 1 0 0 0 .45.84l2.5 1.5a1 1 0 0 0 1.1-1.68l-2.05-1.23V9a1 1 0 0 0-1-1Z" />
              </svg>
              {formatClock(remainingMs)}
            </div>

            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Submit paper
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Question panel */}
          <main className="min-w-0 flex-1">
            <div className="rounded-2xl border border-ink-300/30 bg-white p-6 shadow-sm animate-fade-up" key={q.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">
                  Question {q.id}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleFlag(current)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                    result.flagged[current]
                      ? 'border-gold-500/60 bg-gold-400/15 text-amber-700'
                      : 'border-ink-300/40 bg-white text-ink-500 hover:border-gold-500/60 hover:text-amber-600'
                  }`}
                >
                  {result.flagged[current] ? 'Flagged' : 'Flag for review'}
                </button>
              </div>

              <p className="mt-4 text-base leading-relaxed text-ink-900 sm:text-lg">{q.q}</p>

              <div className="mt-6 space-y-3">
                {q.options.map((opt, i) => {
                  const selected = result.answers[current] === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectOption(i)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition active:scale-[0.995] ${
                        selected
                          ? 'border-brand-600 bg-brand-50 shadow-sm'
                          : 'border-ink-300/30 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${
                          selected ? 'bg-brand-600 text-white' : 'bg-paper text-ink-500'
                        }`}
                      >
                        {OPTION_LETTERS[i]}
                      </span>
                      <span className={`text-sm leading-relaxed sm:text-[15px] ${selected ? 'font-semibold text-brand-900' : 'text-ink-700'}`}>
                        {opt}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Prev / next */}
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-300/20 pt-5">
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => go(-1)}
                  className="rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <div className="hidden text-center sm:block">
                  <button
                    type="button"
                    onClick={() => onAnswer(current, null)}
                    disabled={result.answers[current] === null}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear response
                  </button>
                </div>
                {current === questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
                  >
                    Finish &amp; submit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98]"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>

            {/* Mobile palette */}
            <div className="mt-4 rounded-2xl border border-ink-300/30 bg-white p-4 shadow-sm lg:hidden">
              <Palette
                total={questions.length}
                answers={result.answers}
                flagged={result.flagged}
                current={current}
                jump={jump}
              />
            </div>
          </main>

          {/* Palette sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 rounded-2xl border border-ink-300/30 bg-white p-5 shadow-sm">
              <Palette
                total={questions.length}
                answers={result.answers}
                flagged={result.flagged}
                current={current}
                jump={jump}
              />
              <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] font-semibold text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-brand-600" /> Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-ink-300 bg-white" /> Unanswered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border-2 border-brand-500 bg-white" />
                  Current
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-gold-500" /> Flagged
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAnswer(current, null)}
                disabled={result.answers[current] === null}
                className="mt-5 w-full rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear response
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Submit confirmation modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-up">
            <h3 className="text-lg font-bold text-ink-900">Submit {meta.name} paper?</h3>
            <p className="mt-1 text-sm text-ink-500">
              Review your progress before finishing. After submission you cannot change answers,
              and the result will be announced after three days.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-xl font-extrabold text-emerald-700">{answeredCount}</div>
                <div className="text-[11px] font-semibold text-ink-500">Answered</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <div className="text-xl font-extrabold text-amber-700">{flaggedCount}</div>
                <div className="text-[11px] font-semibold text-ink-500">Flagged</div>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <div className="text-xl font-extrabold text-red-600">{questions.length - answeredCount}</div>
                <div className="text-[11px] font-semibold text-ink-500">Unanswered</div>
              </div>
            </div>
            {questions.length - answeredCount > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                You still have {questions.length - answeredCount} unanswered question
                {questions.length - answeredCount > 1 ? 's' : ''}. Unanswered questions score 0.
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-paper"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmit(false)
                  onSubmit()
                }}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700"
              >
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation modal */}
      {confirmExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-up">
            <h3 className="text-lg font-bold text-ink-900">Leave {meta.name}?</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Your answers are saved, but <b className="text-ink-900">the clock keeps running</b>. You can
              come back and resume as long as time remains. Time left:{' '}
              <b className="font-mono text-ink-900">{formatClock(remainingMs)}</b>
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700"
              >
                Stay in test
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExit(false)
                  onExit()
                }}
                className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-paper"
              >
                Leave for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PaletteProps {
  total: number
  answers: (number | null)[]
  flagged: boolean[]
  current: number
  jump: (i: number) => void
}

function Palette({ total, answers, flagged, current, jump }: PaletteProps) {
  const chipCls = (i: number) => {
    const answered = answers[i] !== null
    const isCurrent = i === current
    const base =
      'relative flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition active:scale-95'
    const style = answered
      ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'
      : 'border border-ink-300/50 bg-white text-ink-700 hover:border-brand-400 hover:text-brand-700'
    const ring = isCurrent ? 'ring-2 ring-brand-500 ring-offset-1' : ''
    return `${base} ${style} ${ring}`
  }
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">Question palette</p>
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} type="button" onClick={() => jump(i)} className={chipCls(i)} aria-label={`Go to question ${i + 1}`}>
            {i + 1}
            {flagged[i] && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-gold-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}