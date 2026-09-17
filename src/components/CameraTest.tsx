import { useCallback, useEffect, useRef, useState } from 'react'
import { TRIAL_MODE, analyzeFrame, captureFrame } from '../lib/proctor'
import { detectFaceFrame, ensureVisionLoaded } from '../lib/vision'

interface CameraTestProps {
  subjectName: string
  subjectChinese: string
  onPass: () => void
  onDisqualify: (reason: string) => void
  onCancel: () => void
}

type Phase = 'permission' | 'testing' | 'notvisible' | 'review' | 'failed' | 'rejected'

/**
 * Live camera check — presence only. The test simply verifies that the
 * candidate is there: as soon as a face is detected in the feed the test
 * passes. While nobody is visible it warns loudly and restarts the attempt,
 * never giving up, so a paper cannot be started without the candidate on
 * camera. The only automatic disqualification here is denying camera access.
 */
const TEST_MS = 6000
const SAMPLE_MS = 600
const NOT_VISIBLE_DELAY_MS = 1500

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
  const [failedReason, setFailedReason] = useState('')
  const [rejectedReason, setRejectedReason] = useState('')

  // Trial phase: warm up the ML model so the presence check works, but the
  // pre-test screen also shows a reminder that nothing can disqualify here.
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

  /** A failed attempt — retries are unlimited, so this never disqualifies. */
  const failAttempt = useCallback((reason: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setFailedReason(reason)
    setPhase('failed')
  }, [])

  /**
   * Trial phase: denying camera access does not disqualify either — it just
   * ends this attempt with a friendly explanation and an unlimited retry.
   */
  const reject = useCallback(
    (reason: string) => {
      if (TRIAL_MODE) {
        failAttempt(reason)
        return
      }
      if (doneRef.current) return
      doneRef.current = true
      setRejectedReason(reason)
      setPhase('rejected')
      window.setTimeout(() => onDisqualify(reason), 1500)
    },
    [onDisqualify, failAttempt],
  )

  /** Candidate not visible: warn loudly and restart the attempt from scratch. */
  function handleNotVisible(attemptNumber: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    // Trial phase: absence or movement is never a problem — if the feed is
    // readable the trial simply passes, face or no face.
    if (TRIAL_MODE) {
      setPhase('review')
      return
    }
    setPhase('notvisible')
    // Restart the attempt so the candidate gets a fresh window once they appear.
    // There is no cap on restarts — the test keeps going until they are visible.
    restartTimerRef.current = setTimeout(() => runTest(attemptNumber), NOT_VISIBLE_DELAY_MS)
  }

  function runTest(attemptNumber: number) {
    setAttempt(attemptNumber)
    setPhase('testing')
    setProgress(0)
    absentTicksRef.current = 0
    let readable = 0
    const start = Date.now()

    timerRef.current = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      setProgress(Math.min(100, ((Date.now() - start) / TEST_MS) * 100))

      if (!captureFrame(video, canvas)) {
        // The feed could not be read at all within the attempt window.
        if (Date.now() - start >= TEST_MS && readable === 0) {
          failAttempt('The camera feed could not be read. The test environment cannot be verified.')
        }
        return
      }
      readable++

      const ml = detectFaceFrame(video)
      // Presence check only: any detected face means the candidate is there
      // and the test passes immediately. The pixel heuristic is only a
      // fallback for while the ML model is still loading.
      const faceDetected = ml !== null ? ml.faces >= 1 : analyzeFrame(canvas, null).personCount >= 1

      // Trial phase: the only thing being verified is that the camera works.
      // Nobody has to be visible and no movement is judged — the check passes
      // once the feed can be read, and any absence is simply ignored.
      if (TRIAL_MODE || faceDetected) {
        if (timerRef.current) clearInterval(timerRef.current)
        setPhase('review')
        return
      }

      absentTicksRef.current += 1
      // Nobody visible — warn loudly and restart after two empty samples.
      if (absentTicksRef.current >= 2) {
        handleNotVisible(attemptNumber)
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
    setFailedReason('')
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
            Before starting <b className="text-ink-900">{subjectName} ({subjectChinese})</b>, the camera
            simply verifies that <b className="text-ink-900">your camera works</b>. This is a{' '}
            <b className="text-ink-900">trial run</b> — nothing you do on camera can disqualify you:
            movements and any unusual activity are ignored.
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

          {/* Trial banner */}
          {TRIAL_MODE && (
            <div className="absolute left-2 top-2 rounded-full bg-sky-600/90 px-2.5 py-1 text-[11px] font-bold text-white">
              Trial run — nothing can disqualify you
            </div>
          )}

          {/* Attempt badge — irrelevant in the trial (passes on first readable frame) */}
          {!TRIAL_MODE && (phase === 'testing' || phase === 'notvisible') && (
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
                  {TRIAL_MODE
                    ? 'Verifying your feed — the trial passes automatically.'
                    : 'Make sure your face is visible. The test passes as soon as it detects you.'}
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
                  Please look at the camera now.
                </p>
                <p className="mt-1 text-xs text-white/80">
                  The test keeps restarting until your face is detected.
                </p>
              </div>
            </div>
          )}

          {/* Passed overlay */}
          {phase === 'review' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-xl bg-emerald-600/90 px-6 py-4 text-center">
                <p className="text-lg font-bold text-white">Camera test passed</p>
                <p className="mt-1 text-sm text-white/80">
                  {TRIAL_MODE ? 'Feed verified — trial check complete' : 'Face detected — you are visible'}
                </p>
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
                  'That is all — in this trial nobody needs to stay visible',
                  'Movements and activity are ignored; nothing can disqualify you',
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
              Camera test in progress — the trial only verifies that your feed works…
            </p>
            <p className="mt-1 text-xs text-brand-600">
              {TRIAL_MODE
                ? 'Nothing can disqualify you here — just wait a moment while the feed is checked.'
                : 'Stay in front of the camera until a face is detected.'}
            </p>
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
                {TRIAL_MODE
                  ? 'Your camera works and the feed is live. Proceed to the room scan.'
                  : 'A face was detected — you are visible on camera. Proceed to the room scan.'}
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
                {failedReason}
              </p>
              <p className="mt-3 text-xs font-semibold text-amber-600">
                This is a trial run — there is no limit on retries and you cannot be disqualified.
                Fix the issue above and try again whenever you are ready.
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
        )}        {/* Warning footer */}
        <div className="mt-8 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold text-amber-700">
            {TRIAL_MODE
              ? 'Trial run: the camera test only checks that your feed works. You cannot be disqualified here — any movement or absence is ignored, and retries are unlimited.'
              : 'The camera test is mandatory and repeats until it detects your face — there is no attempt limit. If you are not visible, the test restarts automatically and warns you to look at the camera. Denying camera access results in automatic disqualification.'}
          </p>
        </div>
      </div>
    </div>
  )
}
