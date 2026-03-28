/**
 * RMS-based voice activity with EMA smoothing and enter/exit cooldown (hysteresis).
 * No speech recognition — energy threshold only, tuned for demo mic levels.
 */

export type AudioDetectorConfig = {
  /** EMA factor for RMS (0–1), higher = more responsive */
  smoothAlpha: number
  /** Normalized RMS above this starts "active" candidate */
  activeThreshold: number
  /** Below this starts "quiet" candidate */
  quietThreshold: number
  /** Ms of sustained active before counting as speaking */
  activeHoldMs: number
  /** Ms of sustained quiet before counting as paused */
  quietHoldMs: number
  /** FFT size for analyser (power of 2) */
  fftSize: number
}

export const defaultAudioConfig: AudioDetectorConfig = {
  smoothAlpha: 0.35,
  activeThreshold: 0.012,
  quietThreshold: 0.006,
  activeHoldMs: 120,
  quietHoldMs: 450,
  fftSize: 2048,
}

/** Merge persisted game thresholds/timing into the default mic pipeline config. */
export function audioConfigFromGameSettings(settings: {
  activeThreshold: number
  quietThreshold: number
  quietHoldMs: number
}): AudioDetectorConfig {
  let quiet = settings.quietThreshold
  let active = settings.activeThreshold
  if (quiet >= active) quiet = Math.max(0.0005, active * 0.75)
  return {
    ...defaultAudioConfig,
    activeThreshold: active,
    quietThreshold: quiet,
    quietHoldMs: settings.quietHoldMs,
  }
}

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

export type VoiceStateMachine = {
  smoothed: number
  isActive: boolean
  /** Call each frame with dtMs and fresh RMS */
  update(rms: number, dtMs: number): void
  reset(): void
}

export function createVoiceStateMachine(cfg: AudioDetectorConfig): VoiceStateMachine {
  let smoothed = 0
  let isActive = false
  let aboveTimer = 0
  let belowTimer = 0

  return {
    get smoothed() {
      return smoothed
    },
    get isActive() {
      return isActive
    },
    update(rms: number, dtMs: number) {
      smoothed = cfg.smoothAlpha * rms + (1 - cfg.smoothAlpha) * smoothed

      if (isActive) {
        if (smoothed < cfg.quietThreshold) {
          belowTimer += dtMs
          aboveTimer = 0
          if (belowTimer >= cfg.quietHoldMs) {
            isActive = false
            belowTimer = 0
          }
        } else {
          belowTimer = 0
        }
      } else {
        if (smoothed > cfg.activeThreshold) {
          aboveTimer += dtMs
          belowTimer = 0
          if (aboveTimer >= cfg.activeHoldMs) {
            isActive = true
            aboveTimer = 0
          }
        } else {
          aboveTimer = 0
        }
      }
    },
    reset() {
      smoothed = 0
      isActive = false
      aboveTimer = 0
      belowTimer = 0
    },
  }
}

export type MicPipeline = {
  context: AudioContext
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode
  stream: MediaStream
  buffer: Float32Array
}

export async function startMicPipeline(cfg: AudioDetectorConfig): Promise<MicPipeline> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })

  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = cfg.fftSize
  analyser.smoothingTimeConstant = 0.5
  source.connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)

  return { context, analyser, source, stream, buffer }
}

export function stopMicPipeline(p: MicPipeline | null) {
  if (!p) return
  try {
    p.source.disconnect()
    p.analyser.disconnect()
  } catch {
    /* ignore */
  }
  p.stream.getTracks().forEach((t) => t.stop())
  void p.context.close()
}

export function sampleRms(pipeline: MicPipeline): number {
  pipeline.analyser.getFloatTimeDomainData(pipeline.buffer)
  return computeRms(pipeline.buffer)
}
