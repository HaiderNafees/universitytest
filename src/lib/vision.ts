/**
 * Face & gaze analysis for proctoring, powered by MediaPipe Face Landmarker.
 *
 * The landmarker WASM binaries and the `.task` model are served from this
 * app's own `public/` folder (synced by scripts/sync-mediapipe-assets.mjs),
 * so nothing is fetched from a CDN at runtime.
 *
 * Landmark semantics (MediaPipe 478-point face mesh):
 *   - Left eye  (subject's left): corners 33 (outer) / 133 (inner),
 *     upper lid 159, lower lid 145, iris centre 468.
 *   - Right eye (subject's right): corners 263 (outer) / 362 (inner),
 *     upper lid 386, lower lid 374, iris centre 473.
 *
 * "Looking at the camera" is decided purely from iris geometry — the position
 * of each iris inside its own eye aperture. That is self-consistent per eye,
 * so no assumption is needed about which side of the image is "left": a
 * centred iris reads as centred regardless.
 */

import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface GazeInfo {
  /** looking — eyes pointed at the camera; away — clearly looking off; unverifiable — face too small/obscured to tell */
  verdict: 'looking' | 'away' | 'unverifiable'
  /** Human-readable reason shown when the verdict isn't "looking". */
  reason: string | null
}

export interface FaceFrame {
  /** Number of faces detected by the ML model this frame (0..N). */
  faces: number
  /** Details of the largest (presumably the candidate's) face. */
  primary: {
    /** Face width across the eyes, as a fraction of the image width. */
    size: number
    gaze: GazeInfo
  } | null
}

// Landmark indices (see module docs above).
const LEFT_EYE_OUTER = 33
const LEFT_EYE_INNER = 133
const LEFT_EYE_UPPER = 159
const LEFT_EYE_LOWER = 145
const LEFT_IRIS = 468
const RIGHT_EYE_OUTER = 263
const RIGHT_EYE_INNER = 362
const RIGHT_EYE_UPPER = 386
const RIGHT_EYE_LOWER = 374
const RIGHT_IRIS = 473

/** Eyes count as looking sideways when an iris drifts more than ±0.17 of its eye width off-centre. */
const EYE_H_DEVIATION_MAX = 0.17
/** Vertical band for the iris inside the eye opening (very tolerant — cameras sit slightly above eye level). */
const EYE_V_MIN = 0.22
const EYE_V_MAX = 0.8
/** Head-yaw proxy: left/right eye-aperture width ratio when facing the camera. */
const YAW_RATIO_MIN = 0.72
const YAW_RATIO_MAX = 1.39
/** Faces narrower than this fraction of the image width are too far to verify gaze on. */
const MIN_FACE_WIDTH = 0.08

const WASM_BASE_PATH = '/wasm'
const MODEL_PATH = '/models/face_landmarker.task'
const MAX_FACES = 4

function eyeHorizontalFraction(outer: NormalizedLandmark, inner: NormalizedLandmark, iris: NormalizedLandmark): number {
  const xMin = Math.min(outer.x, inner.x)
  const xMax = Math.max(outer.x, inner.x)
  const span = xMax - xMin
  if (span < 1e-6) return 0.5
  return (iris.x - xMin) / span
}

function eyeVerticalFraction(upper: NormalizedLandmark, lower: NormalizedLandmark, iris: NormalizedLandmark): number {
  const span = lower.y - upper.y
  if (span < 1e-6) return 0.5
  return (iris.y - upper.y) / span
}

/**
 * Estimates whether the eyes of a single detected face are pointed at the
 * camera. Pure function of the 478 face-mesh landmarks — exported so it can
 * be unit-tested and tuned independently of the MediaPipe plumbing.
 */
export function estimateGaze(lm: readonly NormalizedLandmark[]): GazeInfo {
  if (lm.length <= RIGHT_IRIS) return { verdict: 'unverifiable', reason: 'Incomplete face landmarks.' }

  const outerL = lm[LEFT_EYE_OUTER]
  const innerL = lm[LEFT_EYE_INNER]
  const upperL = lm[LEFT_EYE_UPPER]
  const lowerL = lm[LEFT_EYE_LOWER]
  const irisL = lm[LEFT_IRIS]
  const outerR = lm[RIGHT_EYE_OUTER]
  const innerR = lm[RIGHT_EYE_INNER]
  const upperR = lm[RIGHT_EYE_UPPER]
  const lowerR = lm[RIGHT_EYE_LOWER]
  const irisR = lm[RIGHT_IRIS]

  const fHL = eyeHorizontalFraction(outerL, innerL, irisL)
  const fHR = eyeHorizontalFraction(outerR, innerR, irisR)
  const fVL = eyeVerticalFraction(upperL, lowerL, irisL)
  const fVR = eyeVerticalFraction(upperR, lowerR, irisR)

  const apertureL = Math.hypot(outerL.x - innerL.x, outerL.y - innerL.y)
  const apertureR = Math.hypot(outerR.x - innerR.x, outerR.y - innerR.y)
  const yawRatio = apertureL / Math.max(1e-6, apertureR)

  // A very small face (candidate far from the camera) can't be reliably
  // verified — tell them to come closer rather than guessing.
  const faceSize = Math.abs(outerL.x - outerR.x)
  if (faceSize < MIN_FACE_WIDTH) {
    return { verdict: 'unverifiable', reason: 'Sit closer to the camera so your face is clearly visible.' }
  }

  if (Math.abs(fHL - 0.5) > EYE_H_DEVIATION_MAX || Math.abs(fHR - 0.5) > EYE_H_DEVIATION_MAX) {
    return { verdict: 'away', reason: 'Look directly at the camera.' }
  }

  const meanV = (fVL + fVR) / 2
  if (meanV < EYE_V_MIN || meanV > EYE_V_MAX) {
    return { verdict: 'away', reason: meanV < 0.5 ? 'Look at the camera — do not look up.' : 'Look at the camera — do not look down.' }
  }

  if (yawRatio < YAW_RATIO_MIN || yawRatio > YAW_RATIO_MAX) {
    return { verdict: 'away', reason: 'Turn your head to face the camera.' }
  }

  return { verdict: 'looking', reason: null }
}

// ---------------------------------------------------------------------------
// Landmarker lifecycle
// ---------------------------------------------------------------------------

let landmarkerRef: FaceLandmarker | null = null
let landmarkerFailed = false
let loadingPromise: Promise<void> | null = null

async function createLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)

  const make = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numFaces: MAX_FACES,
      minFaceDetectionConfidence: 0.5,
    })

  try {
    return await make('GPU')
  } catch {
    // GPU delegates are unavailable in some environments (headless browsers,
    // VMs, older GPUs) — CPU (XNNPACK) is plenty at our sample rates.
    return make('CPU')
  }
}

/**
 * Starts loading the face model (idempotent). Call early — e.g. when the
 * camera-test screen mounts — so it's usually ready by the first sample.
 */
export function ensureVisionLoaded(): void {
  if (landmarkerRef || landmarkerFailed || loadingPromise) return
  loadingPromise = (async () => {
    try {
      landmarkerRef = await createLandmarker()
    } catch (err) {
      landmarkerFailed = true
      console.error('[vision] face landmarker unavailable — falling back to pixel heuristics', err)
    } finally {
      loadingPromise = null
    }
  })()
}

export function isVisionReady(): boolean {
  return landmarkerRef !== null
}

/** True when the model could not be loaded at all (e.g. assets missing). */
export function visionUnavailable(): boolean {
  return landmarkerFailed
}

let lastFrameTs = -1

/**
 * Synchronous frame analysis. Returns null while the model is unavailable or
 * the frame isn't ready — callers keep their fallback heuristics. Never
 * throws: a single bad frame must not be able to crash the exam.
 */
export function detectFaceFrame(video: HTMLVideoElement): FaceFrame | null {
  const lm = landmarkerRef
  if (!lm) return null
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null
  try {
    // VIDEO mode requires monotonically increasing timestamps.
    const now = performance.now()
    const ts = now > lastFrameTs ? now : lastFrameTs + 1
    lastFrameTs = ts

    const meshes = lm.detectForVideo(video, ts).faceLandmarks
    if (!meshes || meshes.length === 0) return { faces: 0, primary: null }

    // Pick the largest face (eye-to-eye width) — presumably the candidate.
    let best: NormalizedLandmark[] | null = null
    let bestSize = -1
    for (const mesh of meshes) {
      if (!mesh || mesh.length <= RIGHT_IRIS) continue
      const size = Math.abs(mesh[LEFT_EYE_OUTER].x - mesh[RIGHT_EYE_OUTER].x)
      if (size > bestSize) {
        bestSize = size
        best = mesh
      }
    }
    if (!best) return { faces: meshes.length, primary: null }

    return {
      faces: meshes.length,
      primary: {
        size: bestSize,
        gaze: estimateGaze(best),
      },
    }
  } catch (err) {
    console.warn('[vision] frame analysis failed', err)
    return null
  }
}
