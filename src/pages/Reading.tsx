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
    case 'idle': return '待命'
    case 'requesting': return '请求麦克风权限…'
    case 'active': return '状态良好'
    case 'quiet': return '安静 / 已暂停'
    case 'error': return '出错了'
    default: return s
  }
}

function statusClass(s: ReadingStatus): string {
  return s
}

function modeUiLabel(m: GameMode): string {
  switch (m) {
    case 'reverse': return '守护模式'
    case 'study': return '自习模式'
    default: return '朗读模式'
  }
}

function evolutionStage(sec: number) {
  if (sec >= 1200) return '鱼缸升级'
  if (sec >= 900) return '发光鱼'
  if (sec >= 600) return '大鱼出现'
  if (sec >= 300) return '小鱼群'
  if (sec >= 180) return '鱼苗'
  return '起步中'
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
  const studyFishRef = useRef(0)
  const recoverAccRef = useRef(0)
  const quietAccRef = useRef(0)
  const effectiveRef = useRef(0)
  const meterAccRef = useRef(0)

  const [sessionMode, setSessionMode] = useState<GameMode>('positive')
  const [sessionPlayer, setSessionPlayer] = useState('')
  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const [displayFish, setDisplayFish] = useState(0)
  const [loopOn, setLoopOn] = useState(false)
  const [meterLevel, setMeterLevel] = useState(0)

  const cleanupMic = useCallback(() => {
    stopMicPipeline(pipelineRef.current)
    pipelineRef.current = null
    voiceRef.current.reset()
    setLoopOn(false)
  }, [])

  useEffect(() => () => cleanupMic(), [cleanupMic])

  const startReading = useCallback(async () => {
    setErrorMessage(null)
    setUiStatus('requesting')
    cleanupMic()

    const settings = loadSettings()
    settingsRef.current = settings
    const profile = loadProfile()
    const mode = settings.mode || profile.mode
    sessionModeRef.current = mode
    sessionPlayerRef.current = profile.playerName
    setSessionMode(mode)
    setSessionPlayer(profile.playerName)
    voiceRef.current = createVoiceStateMachine(audioConfigFromGameSettings(settings))

    try {
      const pipeline = await startMicPipeline(audioConfigFromGameSettings(settings))
      pipelineRef.current = pipeline
      if (pipeline.context.state === 'suspended') await pipeline.context.resume()

      startedAtRef.current = new Date().toISOString()
      effectiveRef.current = 0
      recoverAccRef.current = 0
      quietAccRef.current = 0
      setEffectiveSeconds(0)
      setMeterLevel(0)

      const startFish = Math.min(24, Math.max(0, settings.reverseInitialFish))
      fishAtStartRef.current = startFish
      reverseFishRef.current = startFish
      studyFishRef.current = 0
      setDisplayFish(mode === 'reverse' ? startFish : 0)

      setUiStatus(mode === 'study' ? 'quiet' : 'quiet')
      setLoopOn(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法访问麦克风'
      setErrorMessage(msg)
      setUiStatus('error')
      cleanupMic()
    }
  }, [cleanupMic])

  useGameLoop((dtMs) => {
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
    const isStudyQuiet = voice.smoothed <= settings.quietThreshold
    const isReadingActive = voice.isActive

    if (mode === 'study') {
      if (isStudyQuiet) {
        setUiStatus('active')
        quietAccRef.current += dtMs
        const next = effectiveRef.current + dtMs / 1000
        effectiveRef.current = next
        setEffectiveSeconds(next)

        let fish = studyFishRef.current
        while (quietAccRef.current >= settings.fishEverySeconds * 1000 && fish < 24) {
          quietAccRef.current -= settings.fishEverySeconds * 1000
          fish += 1
        }
        studyFishRef.current = fish
        setDisplayFish(fish)
      } else {
        setUiStatus('quiet')
        quietAccRef.current = 0
      }
      return
    }

    if (isReadingActive) {
      setUiStatus('active')
      quietAccRef.current = 0
      const next = effectiveRef.current + dtMs / 1000
      effectiveRef.current = next
      setEffectiveSeconds(next)

      if (mode === 'reverse') {
        let fish = reverseFishRef.current
        const cap = Math.min(24, settings.reverseInitialFish)
        if (fish < cap) {
          recoverAccRef.current += dtMs
          while (recoverAccRef.current >= settings.fishEverySeconds * 1000 && fish < cap) {
            recoverAccRef.current -= settings.fishEverySeconds * 1000
            fish += 1
          }
        }
        reverseFishRef.current = fish
        setDisplayFish(fish)
      } else {
        setDisplayFish(Math.floor(next / settings.fishEverySeconds))
      }
    } else {
      setUiStatus('quiet')
      recoverAccRef.current = 0
      if (mode === 'reverse') {
        let fish = reverseFishRef.current
        quietAccRef.current += dtMs
        while (quietAccRef.current >= settings.fishEverySeconds * 1000 && fish > 0) {
          quietAccRef.current -= settings.fishEverySeconds * 1000
          fish -= 1
        }
        reverseFishRef.current = fish
        setDisplayFish(fish)
      }
    }
  }, loopOn)

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const effective = effectiveRef.current
    const settings = settingsRef.current
    const mode = sessionModeRef.current
    const playerName = sessionPlayerRef.current
    const fishAtStart = fishAtStartRef.current
    const positiveFish = Math.floor(effective / settings.fishEverySeconds)
    const fishAtEnd =
      mode === 'positive' ? positiveFish : mode === 'study' ? Math.max(0, Math.round(studyFishRef.current)) : Math.max(0, Math.round(reverseFishRef.current))

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
    quietAccRef.current = 0
    recoverAccRef.current = 0
    setEffectiveSeconds(0)
    setDisplayFish(0)

    navigate('/result', { state: payload })
  }, [cleanupMic, navigate])

  const resetLocal = useCallback(() => {
    cleanupMic()
    setUiStatus('idle')
    setErrorMessage(null)
    startedAtRef.current = null
    effectiveRef.current = 0
    fishAtStartRef.current = null
    quietAccRef.current = 0
    recoverAccRef.current = 0
    studyFishRef.current = 0
    reverseFishRef.current = 0
    setEffectiveSeconds(0)
    setDisplayFish(0)
    setMeterLevel(0)
  }, [cleanupMic])

  const fishEvery = settingsRef.current.fishEverySeconds
  const progressPct = Math.min(100, ((effectiveSeconds % fishEvery) / fishEvery) * 100)
  const subtitle =
    sessionMode === 'positive'
      ? `继续朗读，满 ${fishEvery} 秒得鱼`
      : sessionMode === 'reverse'
        ? '保持朗读来守住鱼缸，安静太久会掉鱼'
        : '保持安静专注，稳定自习会慢慢长鱼'

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
        <AquariumTank fishCount={Math.min(24, displayFish)} />
        <div style={{ padding: '0.75rem 1rem 1rem' }}>
          <VolumeMeter level={meterLevel} activeThreshold={settingsRef.current.activeThreshold} quietThreshold={settingsRef.current.quietThreshold} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', margin: '0.85rem 0 0.35rem' }}>
            <span>{sessionMode === 'study' ? '安静成长进度' : '本轮成长进度'}</span>
            <span>{effectiveSeconds.toFixed(1)}s</span>
          </div>
          <div className="progress-wrap" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            累计有效时长 {effectiveSeconds.toFixed(1)} 秒 · 当前 {displayFish} 条鱼
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--accent-soft)', fontSize: '0.88rem', fontWeight: 600 }}>
            当前节点：{evolutionStage(effectiveSeconds)}
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{subtitle}</p>
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          节点进化：3 分钟鱼苗，5 分钟小鱼群，10 分钟大鱼，15 分钟发光鱼，20 分钟鱼缸升级。
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {uiStatus === 'idle' || uiStatus === 'error' ? (
          <button type="button" onClick={startReading}>{uiStatus === 'error' ? '重试麦克风' : '开始麦克风'}</button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={endSession}>结束并查看结果</button>
            <button type="button" className="secondary" onClick={resetLocal}>重置</button>
          </>
        )}
      </div>
    </>
  )
}
