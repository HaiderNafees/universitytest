import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeFrame } from '../lib/proctor'
import { detectFaceFrame, ensureVisionLoaded } from '../lib/vision'

interface RoomCheckProps {
  subjectName: string
  subjectChinese: string
  onPass: () => void
  onDisqualify: (reason: string) => void
  onCancel: () => void
}

type Phase = 'permission' | 'scanning' | 'failed' | 'review' | 'rejected'

/** Failed scans allowed before automatic disqualification kicks in. */
const MAX_SCANS = 5

/**
 * Pre-test room scan. The candidate pans the camera around the room for ~10
 * seconds while the feed is analyzed for a second person, unusual lighting or
 * rapid movement. A flagged scan can simply be redone — the candidate gets up
 * to MAX_SCANS attempts before an automatic disqualification kicks in. Only
 * denying camera access disqualifies immediately.
 */
export function RoomCheck({ subjectName, subjectChinese, onPass, onDisqualify, onCancel }: RoomCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('permission')
  const [countdown, setCountdown] = useState(10)
  const [attempt, setAttempt] = useState(1)
  const attemptRef = useRef(1)
  const [rejectionReason, setRejectionReason] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [scanProgress, setScanProgress] = useState(0)
  const animationRef = useRef<number>(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Warm up the face model while the candidate reads the instructions.
  useEffect(() => {
    ensureVisionLoaded()
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const stream = streamRef.current
      const countdown = countdownRef.current
      const animation = animationRef.current
      stream?.getTracks().forEach((t) => t.stop())
      if (countdown) clearInterval(countdown)
      if (animation) cancelAnimationFrame(animation)
    }
  }, [])

  // Automatic disqualification once a violation has been confirmed.
  useEffect(() => {
    if (phase !== 'rejected' || !rejectionReason) return
    const id = window.setTimeout(() => onDisqualify(rejectionReason), 1500)
    return () => clearTimeout(id)
  }, [phase, rejectionReason, onDisqualify])

  /** Release the camera without unmounting (kept running across scan retries). */
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  /** One frame at a time: pixel heuristics + the ML face count. */
  const sampleViolation = useCallback((): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const px = analyzeFrame(canvas, null, { expectPerson: false })

    // The ML model counts faces wherever they appear — even a second person
    // whose back is turned or who walks past mid-pan.
    const ml = detectFaceFrame(video)
    if (ml && ml.faces >= 2) {
      return 'Multiple people detected in the room. Please ask anyone else to leave and scan again.'
    }
    // During room scan, pixel-only multi-person is a soft hint — require ML
    // confirmation before treating it as a real violation.
    if (px.personCount === 2 && (!ml || ml.faces < 2)) {
      return null
    }
    return px.violation
  }, [])

  const performScan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    // Two frames, 500 ms apart — the candidate may be off-frame while panning,
    // so an empty frame alone is not a violation here.
    const result1 = sampleViolation()

    setTimeout(() => {
      const result2 = sampleViolation()

      // Require BOTH samples to agree on the violation to reduce false positives.
      // A single fluke frame during panning should not fail the scan.
      const detected = result1 && result2 ? result1 : (result1 ?? result2)
      // Only treat it as a real violation if both samples found something.
      const confirmed = result1 && result2 ? detected : null
      if (confirmed) {
        setRejectionReason(confirmed)
        // The first flagged scans are retryable — only the last strike
        // (or refusing the camera) disqualifies.
        if (attemptRef.current >= MAX_SCANS) {
          setPhase('rejected')
          stopStream()
        } else {
          setPhase('failed')
        }
      } else {
        setPhase('review')
      }
    }, 500)
  }, [sampleViolation, stopStream])

  const startCountdown = useCallback(() => {
    setCountdown(10)
    setScanProgress(0)
    const startTime = Date.now()
    const duration = 10 * 1000

    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 10 - Math.floor(elapsed / 1000))
      const progress = Math.min(100, (elapsed / duration) * 100)

      setCountdown(remaining)
      setScanProgress(progress)

      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current)
        performScan()
      }
    }, 100)
  }, [performScan])

  /** Run another scan with a fresh 10-second window. */
  const retryScan = useCallback(() => {
    setRejectionReason('')
    attemptRef.current += 1
    setAttempt(attemptRef.current)
    setPhase('scanning')
    startCountdown()
  }, [startCountdown])

  const requestCamera = useCallback(async () => {
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('scanning')
      startCountdown()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setCameraError(msg)
      setRejectionReason(`Camera access is required for the room scan: ${msg}`)
      setPhase('rejected')
    }
  }, [startCountdown])

  const retake = useCallback(() => {
    attemptRef.current = 1
    setAttempt(1)
    setPhase('permission')
    setRejectionReason('')
    setScanProgress(0)
  }, [])

  const proceed = useCallback(() => {
    // Stop camera before proceeding
    stopStream()
    onPass()
  }, [stopStream, onPass])

  const handleCancel = useCallback(() => {
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
            Room Verification Required
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
            Before starting <b className="text-ink-900">{subjectName} ({subjectChinese})</b>, you must
            pan your camera around the room so the system can confirm{' '}
            <b className="text-ink-900">no other person is present</b>. You get up to{' '}
            <b className="text-ink-900">{MAX_SCANS} scans</b> — a flagged scan can simply be
            redone, so take your time and show every corner of the room.
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

          {/* Overlay during scanning */}
          {phase === 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <div className="rounded-xl bg-black/60 px-6 py-4 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                  Scan {attempt} / {MAX_SCANS}
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  Scanning room...
                </p>
                <p className="mt-1 text-sm text-white/80">
                  Please show your entire room by slowly turning your camera
                </p>
                <p className="mt-2 text-3xl font-mono font-bold text-white">
                  {countdown}s
                </p>
                {/* Progress bar */}
                <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-100"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scan complete overlay */}
          {phase === 'review' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-xl bg-emerald-600/90 px-6 py-4 text-center">
                <p className="text-lg font-bold text-white">Room verified — clear</p>
                <p className="mt-1 text-sm text-white/80">No other person detected</p>
              </div>
            </div>
          )}
        </div>

        {/* Phase: Permission */}
        {phase === 'permission' && (
          <div className="mt-6 space-y-4">
            {cameraError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  Camera error: {cameraError}
                </p>
                <p className="mt-1 text-xs text-red-600">
                  Please allow camera access in your browser settings and try again.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-ink-300/30 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-ink-900">Requirements before starting:</h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Your camera must be turned on',
                  'You must be alone in the room',
                  'No other person should be visible anywhere in the room',
                  'Ensure proper lighting in the room',
                  'Remove any notes, books, or electronic devices',
                  `Up to ${MAX_SCANS} scans allowed — a flagged scan will not disqualify you right away`,
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
              Enable Camera &amp; Start Room Scan →
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full rounded-xl border border-ink-300/50 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-paper"
            >
              ← Back to papers
            </button>
          </div>
        )}

        {/* Phase: Scanning */}
        {phase === 'scanning' && (
          <div className="mt-6 rounded-xl border border-brand-300 bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">
              Camera active — scan {attempt} of {MAX_SCANS} in progress...
            </p>
            <p className="mt-1 text-xs text-brand-600">
              Slowly turn your camera to show the entire room. The scan takes 10 seconds.
              If it is flagged you can simply scan again.
            </p>
          </div>
        )}

        {/* Phase: Review */}
        {phase === 'review' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-700">
                Room verification passed
              </p>
              <p className="mt-1 text-sm text-emerald-600">
                No other person or unusual activity was detected. You may proceed with the test.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={retake}
                className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-paper"
              >
                Retake scan
              </button>
              <button
                type="button"
                onClick={proceed}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]"
              >
                Start {subjectName} →
              </button>
            </div>
          </div>
        )}

        {/* Phase: Failed — retryable scan */}
        {phase === 'failed' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-4xl font-extrabold text-amber-500">
                !
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-amber-800">
                Room scan flagged — {attempt} of {MAX_SCANS} attempts used
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-amber-700">
                {rejectionReason || 'Something unusual was detected during the scan.'}
              </p>
              <p className="mt-3 text-xs font-semibold text-amber-600">
                You are not disqualified yet — you have{' '}
                {Math.max(0, MAX_SCANS - attempt)} attempt
                {MAX_SCANS - attempt === 1 ? '' : 's'} left. Ask anyone present to leave,
                move to the next room, or fix the lighting, then scan again.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-xl border border-ink-300/50 bg-white px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-paper"
              >
                ← Back to papers
              </button>
              <button
                type="button"
                onClick={retryScan}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-amber-600/25 transition hover:bg-amber-700 active:scale-[0.99]"
              >
                Scan again — attempt {Math.min(MAX_SCANS, attempt + 1)} of {MAX_SCANS} →
              </button>
            </div>
          </div>
        )}

        {/* Phase: Rejected — automatic disqualification */}
        {phase === 'rejected' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" className="h-9 w-9 fill-red-600" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 6.32 12.9L5.1 7.68A8 8 0 0 1 12 4Zm0 16a8 8 0 0 1-6.32-12.9l13.22 13.22A8 8 0 0 1 12 20Z" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-red-700">
                Room check failed — you are disqualified
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-red-600">
                {rejectionReason || 'Another person was detected in the room during the scan.'}
              </p>
              <p className="mt-3 text-xs font-semibold text-red-500">
                You are being automatically disqualified from the examination…
              </p>
            </div>
          </div>
        )}

        {/* Warning footer */}
        <div className="mt-8 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold text-amber-700">
            You get {MAX_SCANS} room scans — a flagged scan is never an instant disqualification.
            However, denying camera access, using fake video feeds, or repeatedly failing the scan
            results in automatic disqualification from the examination.
          </p>
        </div>
      </div>
    </div>
  )
}