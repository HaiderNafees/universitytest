/**
 * Copies the MediaPipe Tasks Vision WASM binaries (from node_modules) and the
 * face landmarker model into `public/` so the app can run the proctoring
 * vision checks fully offline (no CDN at runtime).
 *
 * Runs automatically before `npm run dev` and `npm run build` (predev/prebuild).
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmOut = join(root, 'public', 'wasm')
const modelOut = join(root, 'public', 'models', 'face_landmarker.task')

// Only the SIMD pair or the no-SIMD pair is actually fetched at runtime
// (FilesetResolver picks one based on WebAssembly.SIMD support), but we ship
// both so every browser works offline.
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

if (existsSync(wasmSrc)) {
  mkdirSync(wasmOut, { recursive: true })
  for (const file of WASM_FILES) {
    if (!existsSync(join(wasmSrc, file))) {
      console.warn(`[mediapipe] missing ${file} in @mediapipe/tasks-vision/wasm — skipping`)
      continue
    }
    cpSync(join(wasmSrc, file), join(wasmOut, file))
  }
  console.log('[mediapipe] wasm assets synced to public/wasm')
} else {
  console.warn('[mediapipe] @mediapipe/tasks-vision not installed — run npm install first')
}

if (!existsSync(modelOut)) {
  const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
  console.log('[mediapipe] downloading face landmarker model…')
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`[mediapipe] failed to download face landmarker model: HTTP ${res.status}`)
  mkdirSync(dirname(modelOut), { recursive: true })
  const fs = await import('node:fs/promises')
  await fs.writeFile(modelOut, Buffer.from(await res.arrayBuffer()))
  console.log('[mediapipe] face landmarker model downloaded to public/models')
}
