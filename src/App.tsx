import { useCallback, useEffect, useState } from 'react'
import { CameraTest } from './components/CameraTest'
import { DisqualifiedPage } from './components/DisqualifiedPage'
import { Header } from './components/Header'
import { HomePage } from './components/HomePage'
import { ResultsPage } from './components/ResultsPage'
import { RoomCheck } from './components/RoomCheck'
import { RulesPage } from './components/RulesPage'
import { SubjectsPage } from './components/SubjectsPage'
import { SubmittedPage } from './components/SubmittedPage'
import { TestPage } from './components/TestPage'
import { subjectMap, subjectOrder } from './data/exams'
import { getQuestions } from './data/questions'
import { grade, resultsAnnounced } from './lib/exam'
import type { Candidate, Disqualification, SubjectId, SubjectResult, View } from './types'

const STORAGE_KEY = 'qiqihar-csca-exam-v1'
const TIME_LIMIT_MS = 45 * 60 * 1000

interface Persisted {
  candidate: Candidate | null
  results: Partial<Record<SubjectId, SubjectResult>>
  disqualification: Disqualification | null
}

function freshResult(subjectId: SubjectId): SubjectResult {
  const count = getQuestions(subjectId).length
  return {
    subjectId,
    answers: Array<number | null>(count).fill(null),
    flagged: Array<boolean>(count).fill(false),
    startedAt: Date.now(),
    timeLimitMs: TIME_LIMIT_MS,
    timeUsedMs: 0,
    submittedAt: 0,
    completed: false,
    score: 0,
    correct: 0,
    attempted: 0,
  }
}

function loadPersisted(): Persisted {
  const fallback: Persisted = { candidate: null, results: {}, disqualification: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Persisted
    if (parsed && typeof parsed === 'object') {
      return {
        candidate: parsed.candidate ?? null,
        results: parsed.results ?? {},
        disqualification: parsed.disqualification ?? null,
      }
    }
    return fallback
  } catch {
    return fallback
  }
}

/** Mark attempts whose clock expired while the app was closed as completed. */
function finalizeResults(results: Partial<Record<SubjectId, SubjectResult>>): Partial<Record<SubjectId, SubjectResult>> {
  let changed = false
  const next: Partial<Record<SubjectId, SubjectResult>> = { ...results }
  for (const id of subjectOrder) {
    const r = results[id]
    if (r && !r.completed && r.startedAt + r.timeLimitMs <= Date.now()) {
      const submittedAt = r.startedAt + r.timeLimitMs
      const g = grade(getQuestions(id), r.answers)
      next[id] = { ...r, completed: true, submittedAt, timeUsedMs: r.timeLimitMs, ...g }
      changed = true
    }
  }
  return changed ? next : results
}

export default function App() {
  // Parse + finalize persisted state exactly once.
  const [boot] = useState(() => {
    const snap = loadPersisted()
    return {
      candidate: snap.candidate,
      results: finalizeResults(snap.results),
      disqualification: snap.disqualification,
    }
  })
  const [candidate, setCandidate] = useState<Candidate | null>(boot.candidate)
  const [results, setResults] = useState<Partial<Record<SubjectId, SubjectResult>>>(boot.results)
  const [disqualification, setDisqualification] = useState<Disqualification | null>(boot.disqualification)
  const [view, setView] = useState<View>(() =>
    boot.disqualification ? 'disqualified' : boot.candidate ? 'subjects' : 'home',
  )
  const [active, setActive] = useState<SubjectId | null>(null)

  // Persist everything except the transient route.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ candidate, results, disqualification }))
    } catch {
      /* storage full or unavailable — ignore */
    }
  }, [candidate, results, disqualification])

  const goSubjects = useCallback(() => {
    setActive(null)
    setView('subjects')
  }, [])

  const rulesAccept = useCallback(() => {
    setView('cameratest')
  }, [])

  const cameraTestPass = useCallback(() => {
    setView('roomcheck')
  }, [])

  const roomCheckPass = useCallback(() => {
    setView('test')
  }, [])

  /** Automatic disqualification — final and persisted; locks every paper. */
  const disqualify = useCallback(
    (reason: string, phase: Disqualification['phase'], subjectId: SubjectId | null) => {
      setDisqualification({ reason, at: Date.now(), phase, subjectId })
      setActive(null)
      setView('disqualified')
    },
    [],
  )

  /** Successful login — profile comes from the credentials registry (src/data/credentials.json). */
  const login = (c: Candidate) => {
    setCandidate(c)
    setActive(null)
    setView('subjects')
  }

  const logout = () => {
    setCandidate(null)
    setResults({})
    setDisqualification(null)
    setActive(null)
    setView('home')
  }

  const beginOrResume = (subjectId: SubjectId) => {
    const existing = results[subjectId]
    if (!existing || existing.completed) {
      setResults((prev) => ({ ...prev, [subjectId]: freshResult(subjectId) }))
    }
    setActive(subjectId)
    setView('rules')
  }

  const review = (subjectId: SubjectId) => {
    const r = results[subjectId]
    if (!r) return
    // Finalize an attempt that ran out of time before being opened.
    setResults((prev) => {
      const cur = prev[subjectId]
      if (!cur || cur.completed) return prev
      const submittedAt = cur.startedAt + cur.timeLimitMs
      const g = grade(getQuestions(subjectId), cur.answers)
      return {
        ...prev,
        [subjectId]: { ...cur, completed: true, submittedAt, timeUsedMs: cur.timeLimitMs, ...g },
      }
    })
    if (!resultsAnnounced(r)) {
      // Results are withheld until three days after submission.
      setView('submitted')
    } else {
      setActive(subjectId)
      setView('results')
    }
  }

  const answer = useCallback(
    (questionIndex: number, optionIndex: number | null) => {
      setResults((prev) => {
        const id = active
        if (!id) return prev
        const r = prev[id]
        if (!r || r.completed) return prev
        const answers = r.answers.slice()
        answers[questionIndex] = optionIndex
        return { ...prev, [id]: { ...r, answers } }
      })
    },
    [active],
  )

  const toggleFlag = useCallback(
    (questionIndex: number) => {
      setResults((prev) => {
        const id = active
        if (!id) return prev
        const r = prev[id]
        if (!r || r.completed) return prev
        const flagged = r.flagged.slice()
        flagged[questionIndex] = !flagged[questionIndex]
        return { ...prev, [id]: { ...r, flagged } }
      })
    },
    [active],
  )

  const submit = useCallback(() => {
    const id = active
    if (!id) return
    setResults((prev) => {
      const r = prev[id]
      if (!r || r.completed) return prev
      const now = Date.now()
      const g = grade(getQuestions(id), r.answers)
      const completed: SubjectResult = {
        ...r,
        completed: true,
        submittedAt: now,
        timeUsedMs: Math.min(r.timeLimitMs, Math.max(0, now - r.startedAt)),
        ...g,
      }
      return { ...prev, [id]: completed }
    })
    setView('submitted')
  }, [active])

  // Scroll to top on every navigation.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view, active])

  // If no candidate is registered, always land on home.
  if (!candidate) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header candidate={null} onHome={() => setView('home')} />
        <main className="flex-1">
          <HomePage onLogin={login} />
        </main>
        <Footer />
      </div>
    )
  }

  // A disqualification is final and locks every paper.
  if (disqualification) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header candidate={candidate} onHome={() => {}} />
        <main className="flex-1">
          <DisqualifiedPage candidate={candidate} info={disqualification} onLogout={logout} />
        </main>
        <Footer />
      </div>
    )
  }

  if (view === 'rules' && active) {
    const meta = subjectMap[active]
    return (
      <RulesPage
        subjectName={meta.name}
        subjectChinese={meta.chinese}
        onAccept={rulesAccept}
        onCancel={goSubjects}
      />
    )
  }

  if (view === 'cameratest' && active) {
    const meta = subjectMap[active]
    return (
      <CameraTest
        subjectName={meta.name}
        subjectChinese={meta.chinese}
        onPass={cameraTestPass}
        onDisqualify={(reason) => disqualify(reason, 'camera-test', active)}
        onCancel={goSubjects}
      />
    )
  }

  if (view === 'roomcheck' && active) {
    const meta = subjectMap[active]
    return (
      <RoomCheck
        subjectName={meta.name}
        subjectChinese={meta.chinese}
        onPass={roomCheckPass}
        onDisqualify={(reason) => disqualify(reason, 'room-check', active)}
        onCancel={goSubjects}
      />
    )
  }

  if (view === 'test' && active) {
    const meta = subjectMap[active]
    const qs = getQuestions(active)
    const result = results[active]
    // Safety: if no live result exists (e.g. expired on boot), route back.
    if (!result) {
      return null
    }
    return (
      <TestPage
        key={active}
        meta={meta}
        questions={qs}
        result={result}
        onAnswer={answer}
        onToggleFlag={toggleFlag}
        onSubmit={submit}
        onExit={goSubjects}
        onDisqualify={(reason) => disqualify(reason, 'monitoring', active)}
      />
    )
  }

  const page =
    view === 'submitted' && active && results[active]?.submittedAt ? (
      <SubmittedPage
        meta={subjectMap[active]}
        submittedAt={results[active]!.submittedAt}
        onBack={goSubjects}
      />
    ) : view === 'results' && active && results[active]?.completed && resultsAnnounced(results[active]!) ? (
      <ResultsPage
        candidate={candidate}
        meta={subjectMap[active]}
        result={results[active]!}
        questions={getQuestions(active)}
        onBack={goSubjects}
      />
    ) : (
      <SubjectsPage
        candidate={candidate}
        results={results}
        onResume={beginOrResume}
        onReview={review}
        onLogout={logout}
      />
    )

  return (
    <div className="flex min-h-screen flex-col">
      <Header candidate={candidate} onHome={goSubjects} />
      <main className="flex-1">{page}</main>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-300/30 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center sm:px-6">
        <p className="text-xs font-semibold text-ink-500">
          <span className="font-serif text-brand-700">齐齐哈尔大学</span> Qiqihar University ·
          Official 2026 International Admission Test
        </p>
        <p className="mt-1 text-[11px] text-ink-300">
          Qiqihar, Heilongjiang Province, People&apos;s Republic of China · admissions@qqhru.edu.cn
        </p>
      </div>
    </footer>
  )
}