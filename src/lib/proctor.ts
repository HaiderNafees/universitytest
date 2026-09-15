import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { detectFaceFrame, ensureVisionLoaded } from './vision'
import type { FaceFrame } from './vision'

export interface FrameAnalysis {
  /** 0 = nobody visible, 1 = one person, 2 = two or more people */
  personCount: 0 | 1 | 2
  /** Human-readable problem, or null when the frame looks clean */
  violation: string | null
  /** Average brightness of the frame, 0–255 */
  brightness: number
  /** Fraction of sampled pixels that changed vs the previous frame (0–1) */
  motion: number
}

const SKIN_RATIO_MIN = 0.004
const SKIN_RATIO_MAX = 0.45
const REGION_SKIN_RATIO = 0.03
const MOTION_VIOLATION = 0.35

function isSkin(r: number, g: number, b: number): boolean {
  return (
    r > 95 && g > 40 && b > 20 &&
    r > g && r > b &&
    Math.abs(r - g) > 15 &&
    r - b > 15 &&
    r < 255 && g < 240 && b < 220
  )
}

/** Draw the current video frame onto the canvas; false when the feed isn't ready. */
export function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return false
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return true
}

/** Fraction of sampled pixels whose brightness changed beyond a threshold. */
function motionBetween(a: ImageData, b: ImageData | null): number {
  if (!b || a.width !== b.width || a.height !== b.height) return 0
  const d1 = a.data
  const d2 = b.data
  let changed = 0
  let total = 0
  for (let i = 0; i < d1.length; i += 16) {
    const br1 = (d1[i] + d1[i + 1] + d1[i + 2]) / 3
    const br2 = (d2[i] + d2[i + 1] + d2[i + 2]) / 3
    total++
    if (Math.abs(br1 - br2) > 30) changed++
  }
  return total === 0 ? 0 : changed / total
}

/**
 * Analyze a captured frame: estimates how many people are visible (skin-tone
 * based, not ML), checks brightness and motion, and returns a human-readable
 * violation when the frame looks suspicious.
 *
 * @param prev previous ImageData for motion detection (pass null for the first frame)
 * @param opts.expectPerson when false, an empty frame is not a violation (used
 *   while the candidate pans the room during the room scan)
 */
export function analyzeFrame(
  canvas: HTMLCanvasElement,
  prev: ImageData | null,
  opts: { expectPerson?: boolean } = {},
): FrameAnalysis {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { personCount: 0, violation: 'Camera feed unavailable.', brightness: 0, motion: 0 }

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const d = imageData.data

  const step = 3
  let sampled = 0
  let skin = 0
  let brightnessSum = 0
  const regionSkin = { left: 0, center: 0, right: 0 }
  const regionPixels = { left: 0, center: 0, right: 0 }

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4
      const r = d[idx]
      const g = d[idx + 1]
      const b = d[idx + 2]
      sampled++
      brightnessSum += (r + g + b) / 3
      const region = x < width / 3 ? 'left' : x < (2 * width) / 3 ? 'center' : 'right'
      regionPixels[region]++
      if (isSkin(r, g, b)) {
        skin++
        regionSkin[region]++
      }
    }
  }

  const brightness = sampled === 0 ? 0 : brightnessSum / sampled
  const skinRatio = sampled === 0 ? 0 : skin / sampled
  const significantRegions = (['left', 'center', 'right'] as const).filter(
    (r) => regionPixels[r] > 0 && regionSkin[r] / regionPixels[r] > REGION_SKIN_RATIO,
  ).length
  const motion = motionBetween(imageData, prev)

  let personCount: 0 | 1 | 2 = skinRatio < SKIN_RATIO_MIN ? 0 : significantRegions >= 2 ? 2 : 1
  let violation: string | null = null

  if (skinRatio > SKIN_RATIO_MAX) {
    // A single very close-up face can cover all three regions — treat it as
    // too close rather than as multiple people.
    personCount = 1
    violation = 'The candidate is too close to the camera — sit back so your face is clearly visible.'
  } else if (significantRegions >= 2) {
    personCount = 2
    violation = 'Multiple people detected in the room. Only the test-taker may be present.'
  } else if (skinRatio < SKIN_RATIO_MIN && opts.expectPerson !== false) {
    personCount = 0
    violation = 'No person detected — the candidate is not visible on camera.'
  }

  if (!violation && brightness < 30) violation = 'The room is too dark — please improve the lighting.'
  if (!violation && brightness > 235) violation = 'Excessive brightness detected — please adjust the lighting.'
  if (!violation && motion > MOTION_VIOLATION) violation = 'Rapid movement detected in the room.'

  return { personCount, violation, brightness, motion }
}

const PROCTOR_INTERVAL_MS = 2000
// Disqualify once 4 of the last 5 samples are violations (~8–12 s of
// continuous misbehaviour). Instant-severity events (second person, dead
// feed) skip straight past the window.
const VIOLATION_WINDOW = 5
const VIOLATION_THRESHOLD = 4
const HIDDEN_GRACE_MS = 6_000
const FEED_DEAD_MS = 6_000

const MSG_MULTI = 'Multiple people detected in the room. Please ask anyone else to leave — disqualification will follow if this persists.'
const MSG_NO_PERSON = 'No person detected — the candidate is not visible on camera.'
const MSG_NO_FACE = 'No face detected — you must keep facing the camera during the test.'
const MSG_NOT_LOOKING = 'You are not looking at the camera — keep your eyes on the screen.'

export interface ProctorInfo {
  /** true once the camera is live and monitoring is running */
  active: boolean
  /** most recent suspicious sample (shown in the UI as a warning) */
  warning: string | null
}

interface ViolationHit {
  reason: string
  /** instant-severity events fill the whole window so they disqualify immediately */
  hard: boolean
}

/**
 * Combines the pixel heuristics with the ML face model into a single
 * "is this frame OK?" verdict used during the live test.
 *
 * The ML face count is authoritative for people detection; the pixel
 * analysis still contributes brightness/motion and catches a second person
 * whose face is hidden (e.g. standing behind the candidate).
 */
function classifyFrame(px: FrameAnalysis, ml: FaceFrame | null): ViolationHit | null {
  const pixelMulti = px.personCount === 2

  if (ml !== null) {
    if (ml.faces >= 2) return { reason: MSG_MULTI, hard: false }
    if (ml.faces === 0) {
      if (pixelMulti) return { reason: MSG_MULTI, hard: false }
      // ML sees nobody. If the pixel heuristic still detects skin, someone is
      // there but not facing the camera — equally disqualifying during a test.
      return { reason: px.personCount === 0 ? MSG_NO_PERSON : MSG_NO_FACE, hard: false }
    }
    // Exactly one face — the candidate. A second, partially visible person
    // (skin in two regions) still counts, unless the model disagrees.
    if (pixelMulti) return { reason: MSG_MULTI, hard: false }
    const gaze = ml.primary?.gaze
    if (gaze && gaze.verdict !== 'looking') {
      return { reason: MSG_NOT_LOOKING, hard: false }
    }
    // Face + gaze are clean, but pixel checks still catch lighting/motion/
    // too-close issues. Only the pixel "no person" claim is ignored here,
    // because the model already confirmed a face is present.
    if (px.violation && !px.violation.startsWith('No person')) {
      return { reason: px.violation, hard: false }
    }
    return null
  }

  // Model unavailable — the old pixel-only behaviour.
  if (px.violation) return { reason: px.violation, hard: false }
  return null
}

/**
 * Continuously monitors the camera during the test. Samples the feed every
 * couple of seconds with both the pixel heuristics and the MediaPipe face
 * model; when enough consecutive samples look suspicious (another person,
 * candidate leaving the frame or not facing the camera, lost feed, tab
 * hidden, rapid movement) it automatically stops the stream and reports a
 * disqualification. Instant-severity events — a second person in frame or a
 * dead feed — disqualify almost immediately.
 *
 * The caller owns and renders the <video> and <canvas> elements via the refs.
 */
export function useProctor(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onDisqualify: (reason: string) => void,
): ProctorInfo {
  const streamRef = useRef<MediaStream | null>(null)
  const prevRef = useRef<ImageData | null>(null)
  const violationsRef = useRef<number[]>([])
  const lastViolationRef = useRef<string | null>(null)
  const hiddenSinceRef = useRef<number | null>(null)
  const feedDeadSinceRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const disqualifyRef = useRef(onDisqualify)
  // Keep the latest callback without re-running the monitoring effect.
  useEffect(() => {
    disqualifyRef.current = onDisqualify
  })

  const [active, setActive] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null
    // Kick off the face-model download as soon as monitoring starts so the
    // ML checks come online within the first seconds.
    ensureVisionLoaded()

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const recordViolation = (reason: string, hard = false) => {
      lastViolationRef.current = reason
      if (hard) {
        violationsRef.current = Array.from({ length: VIOLATION_WINDOW }, () => 1)
      } else {
        violationsRef.current.push(1)
        if (violationsRef.current.length > VIOLATION_WINDOW) violationsRef.current.shift()
      }
      setWarning(reason)
    }

    const recordClean = () => {
      violationsRef.current.push(0)
      if (violationsRef.current.length > VIOLATION_WINDOW) violationsRef.current.shift()
      setWarning(null)
    }

    const maybeDisqualify = () => {
      if (stoppedRef.current || violationsRef.current.length < VIOLATION_WINDOW) return
      const hits = violationsRef.current.reduce((sum, v) => sum + v, 0)
      if (hits < VIOLATION_THRESHOLD) return
      stoppedRef.current = true
      stopStream()
      disqualifyRef.current(lastViolationRef.current ?? 'Unusual activity detected during the test.')
    }

    const sample = () => {
      if (cancelled || stoppedRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      // Leaving the exam window is suspicious — the candidate could be
      // consulting external resources.
      if (document.hidden) {
        hiddenSinceRef.current = hiddenSinceRef.current ?? Date.now()
        if (Date.now() - hiddenSinceRef.current > HIDDEN_GRACE_MS) {
          recordViolation('You left the exam window (tab or window switched).')
        }
        maybeDisqualify()
        return
      }
      hiddenSinceRef.current = null

      if (!captureFrame(video, canvas)) {
        feedDeadSinceRef.current = feedDeadSinceRef.current ?? Date.now()
        if (Date.now() - feedDeadSinceRef.current > FEED_DEAD_MS) {
          recordViolation('Camera feed lost — the test environment can no longer be verified.', true)
        }
        maybeDisqualify()
        return
      }
      feedDeadSinceRef.current = null

      const analysis = analyzeFrame(canvas, prevRef.current)
      prevRef.current = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)

      const hit = classifyFrame(analysis, detectFaceFrame(video))
      if (hit) {
        recordViolation(hit.reason, hit.hard)
      } else {
        recordClean()
      }
      maybeDisqualify()
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setActive(true)
        interval = setInterval(sample, PROCTOR_INTERVAL_MS)
      } catch {
        recordViolation('Camera access lost — the test environment can no longer be verified.', true)
        maybeDisqualify()
      }
    }

    start()

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      stopStream()
    }
    // Refs are stable across renders, so this effect still runs exactly once.
  }, [videoRef, canvasRef])

  return { active, warning }
}
