import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeFrame, captureFrame } from '../lib/proctor'
import { detectFaceFrame, ensureVisionLoaded, isVisionReady } from '../lib/vision'

interface CameraTestProps {
  subjectName: string
  subjectChinese: string
  onPass: () => void
  onDisqualify: (reason: string) => void
  onCancel: () => void
}

type Phase = 'permission' | 'testing' | 'notvisible' | 'review' | 'failed' | 'rejected'

/**
 * Live camera check. There is no attempt limit: the check keeps running /
 * retrying until it passes, so the candidate simply cannot start a paper
 * until the environment verifies. A candidate who is not visible gets the
 * test auto-restarted with a loud warning; anything else that fails the check
 * is shown as a "failed attempt" the candidate can retry as many times as
 * needed. The only automatic disqualification here is denying camera access.
 */
const TEST_MS = 6000
const SAMPLE_MS = 600
const NOT_VISIBLE_DELAY_MS = 1500

interface TestStats {
  samples: number
  clean: number
  personVisible: number
  /** ML samples in which the candidate's face was found */
  faceSamples: number
  /** ML samples in which the candidate was looking at the camera */
  lookingCount: number
  motionSum: number
  reasonCounts: Record<string, number>
}

interface ChecksSeen {
  feed: boolean
  person: boolean
  lighting: boolean
  looking: boolean
}

export function CameraTest({ subjectName, subjectChinese, onPass, onDisqualify, onCancel }: CameraTestProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const absentTicksRef = useRef(0)
  const doneRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('permission')
  const [attempt, setAttempt] = useState(1)
  const [cameraError, setCameraError] = useState('')
  const [progress, setProgress] = useState(0)
  const [rejectedReason, setRejectedReason] = useState('')
  const [checks, setChecks] = useState<ChecksSeen>({ feed: false, person: false, lighting: false, looking: false })
  const [lookAway, setLookAway] = useState(false)

  // Warm up the face model as soon as this screen mounts so the ML checks
  // are typically live by the time the first attempt starts.
  useEffect(() => {
    ensureVisionLoaded()
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
      stopStream()
    }
  }, [stopStream])

  /**
   * Disqualification for the pre-test stage is reserved for refusing camera
   * access — repeated failed checks only keep the candidate out of the paper.
   */
  const reject = useCallback(
    (reason: string) => {
      if (doneRef.current) return
      doneRef.current = true
      setRejectedReason(reason)
      setPhase('rejected')
      window.setTimeout(() => onDisqualify(reason), 1500)
    },
    [onDisqualify],
  )

  /** A failed attempt — retries are unlimited, so this never disqualifies. */
  const failAttempt = useCallback((reason: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setRejectedReason(reason)
    setPhase('failed')
  }, [])

  const finish = useCallback(
    (seen: ChecksSeen, stats: TestStats) => {
      const { samples, clean, personVisible, faceSamples, lookingCount, motionSum, reasonCounts } = stats

      if (samples < 2) {
        failAttempt('The camera feed could not be read. The test environment cannot be verified.')
        return
      }
      if (!seen.feed || motionSum <= 0) {
        failAttempt('The camera feed appears to be frozen — your camera is not working properly.')
        return
      }
      const multi = reasonCounts['Multiple people detected in the room. Only the test-taker may be present.'] ?? 0
      if (multi >= 2) {
        failAttempt('Multiple people detected in the room. Only the test-taker may be present.')
        return
      }
      if (!seen.person || personVisible < Math.max(2, Math.floor(samples * 0.5))) {
        failAttempt('No person detected — you must be clearly visible on camera during the test.')
        return
      }
      // Look-at-the-camera gate. It only applies when the face model was live
      // for most of the attempt (face seen in the majority of samples);
      // otherwise the check falls back to presence/lighting only.
      const visionEnforced = faceSamples >= Math.max(2, Math.floor(samples * 0.5))
      if (visionEnforced && lookingCount < Math.max(2, Math.floor(faceSamples * 0.6))) {
        failAttempt(
          'You must look directly at the camera during the camera test. Look at the camera and try again.',
        )
        return
      }
      if (clean < Math.max(3, Math.floor(samples * 0.6))) {
        const top = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]
        failAttempt(top ? top[0] : 'Unusual activity detected during the camera test.')
        return
      }
      setPhase('review')
    },
    [failAttempt],
  )

  /** Candidate not visible: warn loudly and restart the attempt from scratch. */
  function handleNotVisible(attemptNumber: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setLookAway(false)
    // Restart the attempt so the candidate gets a fresh window once they appear.
    // There is no cap on restarts — the test keeps going until they are visible.
    restartTimerRef.current = setTimeout(() => runTest(attemptNumber), NOT_VISIBLE_DELAY_MS)
  }

  function runTest(attemptNumber: number) {
    setAttempt(attemptNumber)
    setPhase('testing')
    setProgress(0)
    setLookAway(false)
    absentTicksRef.current = 0
    let samples = 0
    let clean = 0
    let personVisible = 0
    let faceSamples = 0
    let lookingCount = 0
    let motionSum = 0
    let prev: ImageData | null = null
    const seen: ChecksSeen = { feed: false, person: false, lighting: false, looking: false }
    const reasonCounts: Record<string, number> = {}
    const start = Date.now()
    const visionWarm = isVisionReady()

    timerRef.current = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      setProgress(Math.min(100, ((Date.now() - start) / TEST_MS) * 100))

      if (!captureFrame(video, canvas)) return

      const analysis = analyzeFrame(canvas, prev)
      prev = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)

      const ml = detectFaceFrame(video)
      const visionOn = visionWarm || ml !== null || isVisionReady()

      // No face at all (ML authoritative when available, pixel heuristic as
      // a fallback). Two consecutive empty samples trigger the loud restart.
      const personAbsentNow = ml !== null ? ml.faces === 0 : analysis.personCount === 0
      if (personAbsentNow) {
        absentTicksRef.current += 1
        setLookAway(false)
        if (absentTicksRef.current >= 2) {
          handleNotVisible(attemptNumber)
        }
        return
      }
      absentTicksRef.current = 0

      samples++
      motionSum += analysis.motion

      const gaze = ml?.primary?.gaze
      const personNow = ml !== null ? ml.faces >= 1 : analysis.personCount === 1
      if (personNow) personVisible++

      // A second face found by the model is a hard failure of this attempt.
      if (ml !== null && ml.faces >= 2) {
        const multiMsg = 'Multiple people detected in the room. Only the test-taker may be present.'
        reasonCounts[multiMsg] = (reasonCounts[multiMsg] ?? 0) + 1
      }

      if (ml !== null && gaze) {
        faceSamples++
        if (gaze.verdict === 'looking') {
          lookingCount++
          seen.looking = true
          setLookAway(false)
        } else {
          const reason = gaze.reason ?? 'You are not looking at the camera.'
          reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
          setLookAway(true)
        }
      } else if (visionOn) {
        setLookAway(false)
      }

      if (!analysis.violation) clean++
      if (analysis.violation) {
        reasonCounts[analysis.violation] = (reasonCounts[analysis.violation] ?? 0) + 1
      }
      seen.feed = seen.feed || analysis.motion > 0.0005
      seen.person = seen.person || personNow
      seen.lighting = seen.lighting || (analysis.brightness >= 30 && analysis.brightness <= 235)
      setChecks({ ...seen })

      if (Date.now() - start >= TEST_MS) {
        if (timerRef.current) clearInterval(timerRef.current)
        finish(seen, { samples, clean, personVisible, faceSamples, lookingCount, motionSum, reasonCounts })
      }
    }, SAMPLE_MS)
  }

  async function requestCamera() {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      runTest(1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(msg)
      // Refusing the camera means the environment cannot be verified.
      reject(`Camera access is required for the examination: ${msg}`)
    }
  }

  function retry() {
    setRejectedReason('')
    runTest(attempt + 1)
  }

  const proceed = useCallback(() => {
    stopStream()
    onPass()
  }, [stopStream, onPass])

  const cancel = useCallback(() => {
    stopStream()
    onCancel()
  }, [stopStream, onCancel])

  return (
    <div className="animate-fade-up mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-12 sm:px-6">
      <div className="w-full">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-brand-600" aria-hidden="true">
              <path d="M4 5h10a2 2 0 0 1 2 2v1l4-2.5v11L16 14v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v10h10V7H4Zm2 2v6h6V9H6Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">
            Camera Test Required
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
            Before starting <b className="text-ink-900">{subjectName} ({subjectChinese})</b>, you must
            pass a live camera test. The camera must show <b className="text-ink-900">exactly one person — you</b> —
            clearly visible and <b className="text-ink-900">looking directly at the camera</b>, with proper lighting.
            The check keeps running until it passes — it never gives up on you.
          </p>
        </div>

        {/* Camera Preview */}
        <div className="relative mt-6 overflow-hidden rounded-2xl border-2 border-ink-300/30 bg-black">
          <video
            ref={videoRef}
            className="w-full rounded-2xl"
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Attempt badge */}
          {(phase === 'testing' || phase === 'notvisible') && (
            <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
              Attempt {attempt}
            </div>
          )}

          {/* Testing overlay */}
          {phase === 'testing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <div className="rounded-xl bg-black/60 px-6 py-4 text-center">
                <p className="text-lg font-bold text-white">Testing camera…</p>
                <p className="mt-1 text-sm text-white/80">
                  Look directly at the camera. Keep your face clearly visible.
                </p>
                <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Not-visible overlay — loud warning + auto restart */}
          {phase === 'notvisible' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/50 p-4">
              <div className="w-full max-w-sm animate-pulse rounded-xl border-2 border-red-400 bg-red-600/95 px-6 py-5 text-center shadow-xl">
                <p className="mt-2 text-lg font-extrabold text-white">
                  YOU ARE NOT VISIBLE!
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/90">
                  Please look directly at the camera now.
                </p>
                <p className="mt-1 text-xs text-white/80">
                  The test keeps restarting until your face is detected.
                </p>
              </div>
            </div>
          )}

          {/* Look-away warning overlay */}
          {phase === 'testing' && lookAway && (
            <div className="absolute inset-0 flex items-start justify-center bg-black/20 p-4">
              <div className="mt-16 w-full max-w-sm animate-pulse rounded-xl border-2 border-amber-400 bg-amber-500/95 px-5 py-4 text-center shadow-xl">
                <p className="mt-1 text-base font-extrabold text-white">
                  LOOK AT THE CAMERA!
                </p>
                <p className="mt-1 text-xs font-semibold text-white/90">
                  Your eyes must stay on the camera during the check.
                </p>
              </div>
            </div>
          )}

          {/* Passed overlay */}
          {phase === 'review' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-xl bg-emerald-600/90 px-6 py-4 text-center">
                <p className="text-lg font-bold text-white">Camera test passed</p>
                <p className="mt-1 text-sm text-white/80">One person detected · looking at camera · feed live</p>
              </div>
            </div>
          )}
        </div>

        {/* Phase: Permission */}
        {phase === 'permission' && (
          <div className="mt-6 space-y-4">
            {cameraError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">{cameraError}</p>
              </div>
            )}

            <div className="rounded-xl border border-ink-300/30 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">The camera test verifies:</h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Your camera is working and the feed is live',
                  'Exactly one person (you) is visible in the frame',
                  'You are looking directly at the camera',
                  'Your face is clearly visible with adequate lighting',
                  'No second person appears anywhere in the room',
                  'There is no limit on retries — the check repeats until you pass',
                ].map((req) => (
                  <li key={req} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="mt-0.5 text-brand-600">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={requestCamera}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
            >
              Start Camera Test →
            </button>
            <button
              type="button"
              onClick={cancel}
              className="w-full rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-paper"
            >
              ← Back to papers
            </button>
          </div>
        )}

        {/* Phase: Testing */}
        {phase === 'testing' && (
          <div className="mt-6 rounded-xl border border-brand-300 bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">
              Camera test in progress — attempt {attempt}. Look at the camera and do not look away…
            </p>
            <p className="mt-1 text-xs text-brand-600">
              Keep your face visible and stay still. The test takes about 6 seconds.
            </p>
            <div className="mt-3 space-y-1.5 text-xs font-semibold">
              <p className={checks.feed ? 'text-emerald-700' : 'text-ink-500'}>
                {checks.feed ? '●' : '○'} Live camera feed
              </p>
              <p className={checks.person ? 'text-emerald-700' : 'text-ink-500'}>
                {checks.person ? '●' : '○'} One person detected
              </p>
              {isVisionReady() && (
                <p className={checks.looking ? 'text-emerald-700' : 'text-ink-500'}>
                  {checks.looking ? '●' : '○'} Looking at the camera
                </p>
              )}
              <p className={checks.lighting ? 'text-emerald-700' : 'text-ink-500'}>
                {checks.lighting ? '●' : '○'} Adequate lighting
              </p>
            </div>
          </div>
        )}

        {/* Phase: Not visible — restarting */}
        {phase === 'notvisible' && (
          <div className="mt-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              You are not visible in the camera. Look at the camera now — the test is restarting…
            </p>
          </div>
        )}

        {/* Phase: Review */}
        {phase === 'review' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-700">Camera test passed</p>
              <p className="mt-1 text-sm text-emerald-600">
                Your camera works, you are the only person visible, and you are looking at the camera.
                Proceed to the room scan.
              </p>
            </div>
            <button
              type="button"
              onClick={proceed}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
            >
              Continue to Room Scan →
            </button>
          </div>
        )}

        {/* Phase: Failed — unlimited retries */}
        {phase === 'failed' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-4xl font-extrabold text-amber-500">
                !
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-amber-800">
                Camera test not passed yet — attempt {attempt}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-amber-700">
                {rejectedReason}
              </p>
              <p className="mt-3 text-xs font-semibold text-amber-600">
                There is no limit on retries — fix the issue above and try again. The paper will not
                start until this check passes.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-paper"
              >
                ← Back to papers
              </button>
              <button
                type="button"
                onClick={retry}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-amber-600/25 transition hover:bg-amber-700 active:scale-[0.99]"
              >
                Try again — attempt {attempt + 1} →
              </button>
            </div>
          </div>
        )}

        {/* Phase: Rejected — camera access denied */}
        {phase === 'rejected' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" className="h-9 w-9 fill-red-600" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 6.32 12.9L5.1 7.68A8 8 0 0 1 12 4Zm0 16a8 8 0 0 1-6.32-12.9l13.22 13.22A8 8 0 0 1 12 20Z" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-red-700">
                Camera access required
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-red-600">
                {rejectedReason}
              </p>
              <p className="mt-3 text-xs font-semibold text-red-500">
                A working camera is mandatory for the examination. You are being automatically
                disqualified because the camera could not be used…
              </p>
            </div>
          </div>
        )}

        {/* Warning footer */}
        <div className="mt-8 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold text-amber-700">
            The camera test is mandatory and repeats until you pass — there is no 3-attempt limit.
            If you are not visible, the test restarts automatically and warns you to look at the camera.
            Denying camera access, covering the lens, or showing another person results in automatic
            disqualification.
          </p>
        </div>
      </div>
    </div>
  )
}
