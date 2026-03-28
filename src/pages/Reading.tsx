import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { VolumeMeter } from '../components/VolumeMeter'
import { useGameLoop } from '../hooks/useGameLoop'
import {
  audioConfigFromGameSettings,
  createVoiceStateMachine,
  sampleRms,
  startMicPipeline,
  stopMicPipeline,
  type MicPipeline,
  type VoiceStateMachine,
} from '../modules/audioDetector'
import { loadProfile, loadSettings, type GameMode, type GameSettings } from '../modules/storage'

export type ReadingStatus = 'idle' | 'requesting' | 'active' | 'quiet' | 'error'

function statusLabel(s: ReadingStatus): string {
  switch (s) {
    case 'idle':
      return '待命'
    case 'requesting':
      return '请求麦克风权限…'
    case 'active':
      return '正在阅读'
    case 'quiet':
      return '安静 / 已暂停'
    case 'error':
      return '出错了'
    default:
      return s
  }
}

function statusClass(s: ReadingStatus): string {
  switch (s) {
    case 'idle':
      return 'idle'
    case 'requesting':
      return 'requesting'
    case 'active':
      return 'active'
    case 'quiet':
      return 'quiet'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

function modeUiLabel(m: GameMode): string {
  return m === 'positive' ? '正向模式' : '守护模式'
}

export type ReadingResultPayload = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  playerName: string
  mode: GameMode
  fishAtStart?: number
  fishAtEnd?: number
}

export function Reading() {
  const navigate = useNavigate()
  const [uiStatus, setUiStatus] = useState<ReadingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pipelineRef = useRef<MicPipeline | null>(null)
  const settingsRef = useRef<GameSettings>(loadSettings())
  const voiceRef = useRef<VoiceStateMachine>(createVoiceStateMachine(audioConfigFromGameSettings(settingsRef.current)))
  const startedAtRef = useRef<string | null>(null)
  const sessionModeRef = useRef<GameMode>('positive')
  const sessionPlayerRef = useRef('')
  const fishAtStartRef = useRef<number | null>(null)
  const reverseFishRef = useRef(0)
  const reverseRecoverAccRef = useRef(0)
  const reverseQuietAccRef = useRef(0)
  const meterAccRef = useRef(0)
  const effectiveRef = useRef(0)

  const [sessionMode, setSessionMode] = useState<GameMode>('positive')
  const [sessionPlayer, setSessionPlayer] = useState('')
  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const [reverseFish, setReverseFish] = useState(0)
  const [loopOn, setLoopOn] = useState(false)
  const [meterLevel, setMeterLevel] = useState(0)

  const fishEvery = settingsRef.current.fishEverySeconds
  const activeTh = settingsRef.current.activeThreshold
  const quietTh = settingsRef.current.quietThreshold
  const fishEarnedLive =
    sessionMode === 'positive' ? Math.floor(effectiveSeconds / fishEvery) : Math.round(reverseFish)
  const intoFish = effectiveSeconds % fishEvery
  const progressPct =
    sessionMode === 'positive'
      ? Math.min(100, (intoFish / fishEvery) * 100)
      : Math.min(100, (reverseQuietAccRef.current / (fishEvery * 1000)) * 100)
  const fishInTank =
    sessionMode === 'positive' ? Math.min(24, fishEarnedLive) : Math.min(24, Math.max(0, Math.round(reverseFish)))

  const cleanupMic = useCallback(() => {
    stopMicPipeline(pipelineRef.current)
    pipelineRef.current = null
    voiceRef.current.reset()
    setLoopOn(false)
  }, [])

  useEffect(() => {
    return () => cleanupMic()
  }, [cleanupMic])

  const startReading = useCallback(async () => {
    setErrorMessage(null)
    setUiStatus('requesting')
    cleanupMic()

    const settings = loadSettings()
    settingsRef.current = settings
    const profile = loadProfile()
    sessionModeRef.current = profile.mode
    sessionPlayerRef.current = profile.playerName
    setSessionMode(profile.mode)
    setSessionPlayer(profile.playerName)
    voiceRef.current = createVoiceStateMachine(audioConfigFromGameSettings(settings))

    try {
      const pipeline = await startMicPipeline(audioConfigFromGameSettings(settings))
      pipelineRef.current = pipeline
      if (pipeline.context.state === 'suspended') {
        await pipeline.context.resume()
      }
      startedAtRef.current = new Date().toISOString()
      effectiveRef.current = 0
      setEffectiveSeconds(0)
      setMeterLevel(0)
      reverseRecoverAccRef.current = 0
      reverseQuietAccRef.current = 0

      const startFish = Math.min(24, Math.max(0, settings.reverseInitialFish))
      fishAtStartRef.current = startFish
      reverseFishRef.current = startFish
      setReverseFish(startFish)

      setUiStatus('quiet')
      setLoopOn(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法访问麦克风'
      setErrorMessage(msg)
      setUiStatus('error')
      cleanupMic()
    }
  }, [cleanupMic])

  useGameLoop(
    (dtMs) => {
      const pipe = pipelineRef.current
      if (!pipe) return

      const rms = sampleRms(pipe)
      const voice = voiceRef.current
      voice.update(rms, dtMs)

      meterAccRef.current += dtMs
      if (meterAccRef.current >= 90) {
        meterAccRef.current = 0
        setMeterLevel(voice.smoothed)
      }

      const mode = sessionModeRef.current
      const settings = settingsRef.current

      if (voice.isActive) {
        setUiStatus('active')
        reverseQuietAccRef.current = 0

        const next = effectiveRef.current + dtMs / 1000
        effectiveRef.current = next
        setEffectiveSeconds(next)

        if (mode === 'reverse') {
          let fish = reverseFishRef.current
          const cap = Math.min(24, settings.reverseInitialFish)
          if (fish < cap) {
            reverseRecoverAccRef.current += dtMs
            while (reverseRecoverAccRef.current >= settings.fishEverySeconds * 1000 && fish < cap) {
              reverseRecoverAccRef.current -= settings.fishEverySeconds * 1000
              fish += 1
            }
          }
          reverseFishRef.current = fish
          setReverseFish(fish)
        }
      } else {
        setUiStatus('quiet')
        reverseRecoverAccRef.current = 0

        if (mode === 'reverse') {
          let fish = reverseFishRef.current
          reverseQuietAccRef.current += dtMs
          while (reverseQuietAccRef.current >= settings.fishEverySeconds * 1000 && fish > 0) {
            reverseQuietAccRef.current -= settings.fishEverySeconds * 1000
            fish -= 1
          }
          reverseFishRef.current = fish
          setReverseFish(fish)
        }
      }
    },
    loopOn,
  )

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const effective = effectiveRef.current
    const settings = settingsRef.current
    const mode = sessionModeRef.current
    const playerName = sessionPlayerRef.current
    const fishAtStart = fishAtStartRef.current
    const positiveFish = Math.floor(effective / settings.fishEverySeconds)
    const fishAtEnd = mode === 'positive' ? positiveFish : Math.max(0, Math.round(reverseFishRef.current))

    const payload: ReadingResultPayload = {
      startedAt,
      endedAt: new Date().toISOString(),
      effectiveSeconds: effective,
      fishEarned: fishAtEnd,
      playerName,
      mode,
      fishAtStart: fishAtStart ?? undefined,
      fishAtEnd,
    }

    cleanupMic()
    setUiStatus('idle')
    startedAtRef.current = null
    effectiveRef.current = 0
    fishAtStartRef.current = null
    reverseQuietAccRef.current = 0
    reverseRecoverAccRef.current = 0
    setEffectiveSeconds(0)
    setReverseFish(0)

    navigate('/result', { state: payload })
  }, [cleanupMic, navigate])

  const resetLocal = useCallback(() => {
    cleanupMic()
    setUiStatus('idle')
    setErrorMessage(null)
    startedAtRef.current = null
    effectiveRef.current = 0
    fishAtStartRef.current = null
    reverseQuietAccRef.current = 0
    reverseRecoverAccRef.current = 0
    setEffectiveSeconds(0)
    setReverseFish(0)
    setMeterLevel(0)
  }, [cleanupMic])

  const subtitle =
    sessionMode === 'positive'
      ? `距离下一条鱼还差 ${(fishEvery - intoFish).toFixed(1)} 秒`
      : reverseFish >= settingsRef.current.reverseInitialFish
        ? '鱼缸稳定，继续守护'
        : '持续朗读可让鱼群慢慢恢复'

  return (
    <>
      <header>
        <h1 className="page-title">{sessionPlayer || '未命名玩家'}｜{modeUiLabel(sessionMode)}</h1>
        <div className={`status-pill ${statusClass(uiStatus)}`} role="status" aria-live="polite" style={{ marginTop: '0.5rem' }}>
          <span className="dot" />
          {statusLabel(uiStatus)}
        </div>
      </header>

      {errorMessage && <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem' }}>{errorMessage}</p>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={fishInTank} />
        <div style={{ padding: '0.75rem 1rem 1rem' }}>
          <VolumeMeter level={meterLevel} activeThreshold={activeTh} quietThreshold={quietTh} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', margin: '0.85rem 0 0.35rem' }}>
            <span>{sessionMode === 'positive' ? '下一条鱼' : '守护进度'}</span>
            <span>
              {sessionMode === 'positive' ? `${intoFish.toFixed(1)} / ${fishEvery}s` : `${Math.round(reverseFish)} / ${settingsRef.current.reverseInitialFish} 鱼`}
            </span>
          </div>
          <div className="progress-wrap" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            有效朗读 {effectiveSeconds.toFixed(1)} 秒 · 当前 {fishEarnedLive} 条鱼
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{subtitle}</p>
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          提示：设置页可调朗读阈值和节奏。正向模式靠持续朗读得鱼；守护模式开始自带鱼缸，安静太久会掉鱼。
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {uiStatus === 'idle' || uiStatus === 'error' ? (
          <button type="button" onClick={startReading}>
            {uiStatus === 'error' ? '重试麦克风' : '开始麦克风'}
          </button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={endSession}>
              结束并查看结果
            </button>
            <button type="button" className="secondary" onClick={resetLocal}>
              重置
            </button>
          </>
        )}
      </div>
    </>
  )
}
