import { useCallback, useEffect, useRef, useState } from 'react'

interface CameraMonitorProps {
  onViolation: (reason: string) => void
  active: boolean
}

type MonitorStatus = 'connecting' | 'active' | 'warning' | 'violation'

/**
 * Persistent camera monitor that runs during the entire test.
 * Periodically checks the camera feed for violations (second person, camera disabled, etc.)
 */
export function CameraMonitor({ onViolation, active }: CameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<MonitorStatus>('connecting')
  const [statusMessage, setStatusMessage] = useState('Initializing camera...')
  const [isMinimized, setIsMinimized] = useState(false)
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const violationCountRef = useRef(0)

  const checkCameraFeed = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return false

    const video = videoRef.current
    const canvas = canvasRef.current

    // Check if camera is actually providing frames
    if (video.readyState < 2 || video.videoWidth === 0) {
      return false
    }

    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240

    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Check 1: Is the frame mostly black/blank (camera covered)?
    let totalBrightness = 0
    const sampleSize = Math.min(1000, (canvas.width * canvas.height) / 10)
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(Math.random() * (data.length / 4)) * 4
      totalBrightness += (data[idx] + data[idx + 1] + data[idx + 2]) / 3
    }
    const avgBrightness = totalBrightness / sampleSize

    if (avgBrightness < 15) {
      setStatus('warning')
      setStatusMessage('Camera may be covered')
      return true // potential violation
    }

    // Check 2: Detect skin-tone regions (face detection proxy)
    const regions = [
      { x1: 0, y1: 0, x2: Math.floor(canvas.width / 2), y2: canvas.height },
      { x1: Math.floor(canvas.width / 2), y1: 0, x2: canvas.width, y2: canvas.height },
    ]

    const regionSkinCounts: number[] = []

    for (const region of regions) {
      let skinCount = 0
      const regionPixels = (region.x2 - region.x1) * (region.y2 - region.y1)

      for (let y = region.y1; y < region.y2; y += 4) {
        for (let x = region.x1; x < region.x2; x += 4) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]

          // Skin-tone detection
          if (
            r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15
          ) {
            skinCount++
          }
        }
      }

      regionSkinCounts.push(skinCount / regionPixels)
    }

    // Check if both halves have significant skin-tone (likely two people)
    const significantRegions = regionSkinCounts.filter((v) => v > 0.04).length

    if (significantRegions >= 2) {
      setStatus('violation')
      setStatusMessage('Second person detected!')
      return true
    }

    setStatus('active')
    setStatusMessage('Camera active — monitoring')
    return false
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setStatus('connecting')
      setStatusMessage('Requesting camera access...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setStatus('active')
      setStatusMessage('Camera active — monitoring')

      // Start periodic checks every 5 seconds
      checkIntervalRef.current = setInterval(() => {
        if (!active) return
        const violation = checkCameraFeed()
        if (violation) {
          violationCountRef.current++
          if (violationCountRef.current >= 2) {
            onViolation('Multiple violations detected. Camera must remain active and uncovered during the test.')
          }
        } else {
          violationCountRef.current = Math.max(0, violationCountRef.current - 1)
        }
      }, 5000)

      // Also monitor the stream for tracks being stopped
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setStatus('violation')
          setStatusMessage('Camera was disabled!')
          onViolation('Camera was disabled during the test. The test will be submitted immediately.')
        }
      })
    } catch (err) {
      setStatus('violation')
      setStatusMessage('Camera access denied!')
      onViolation('Camera access was denied. A working camera is required to take the test.')
    }
  }, [active, checkCameraFeed, onViolation])

  // Start camera on mount
  useEffect(() => {
    if (active) {
      startCamera()
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current)
      }
    }
  }, [active, startCamera])

  // Detect tab visibility changes
  useEffect(() => {
    if (!active) return

    const handleVisibility = () => {
      if (document.hidden) {
        setStatus('warning')
        setStatusMessage('Tab is hidden — stay focused!')
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [active])

  const statusColor = {
    connecting: 'bg-amber-500',
    active: 'bg-emerald-500',
    warning: 'bg-amber-500',
    violation: 'bg-red-500',
  }[status]

  const statusTextColor = {
    connecting: 'text-amber-700',
    active: 'text-emerald-700',
    warning: 'text-amber-700',
    violation: 'text-red-700',
  }[status]

  return (
    <div
      className={`fixed z-50 overflow-hidden rounded-xl border-2 border-ink-300/30 bg-black shadow-2xl transition-all duration-300 ${
        isMinimized ? 'bottom-4 right-4 h-24 w-32' : 'bottom-4 right-4 h-48 w-64'
      }`}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
        muted
        playsInline
        autoPlay
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusColor} animate-pulse`} />
          <span className={`text-[10px] font-bold ${statusTextColor}`}>
            {isMinimized ? (status === 'active' ? 'Active' : 'Alert') : statusMessage}
          </span>
        </div>
      </div>

      {/* Minimize/Maximize button */}
      <button
        type="button"
        onClick={() => setIsMinimized(!isMinimized)}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white transition hover:bg-black/70"
        title={isMinimized ? 'Expand camera' : 'Minimize camera'}
      >
        {isMinimized ? '□' : '—'}
      </button>

      {/* Label */}
      {!isMinimized && (
        <div className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">
            Proctored
          </span>
        </div>
      )}
    </div>
  )
}
