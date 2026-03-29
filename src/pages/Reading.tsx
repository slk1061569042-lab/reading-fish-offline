import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

type FishTier = 'normal' | 'good' | 'rare'

type FishCounts = {
  normal: number
  good: number
  rare: number
}

const FISH_WINDOW_SECONDS = 15
const RARE_FISH_NAMES = ['晨光蝶尾', '静海流金', '银月纱鳍', '晚霞星鳞']

function statusLabel(s: ReadingStatus): string {
  switch (s) {
    case 'idle': return '待命'
    case 'requesting': return '请求麦克风权限…'
    case 'active': return '状态良好'
    case 'quiet': return '未达标'
    case 'error': return '出错了'
    default: return s
  }
}

function modeUiLabel(m: GameMode): string {
  switch (m) {
    case 'reverse': return '守护鱼缸'
    case 'study': return '自习养鱼'
    default: return '早读养鱼'
  }
}

function pickRareFishName(seed: number): string {
  const idx = Math.floor(seed / 15) % RARE_FISH_NAMES.length
  return RARE_FISH_NAMES[idx]!
}

function qualityText(mode: GameMode, tier: FishTier) {
  if (mode === 'study') {
    if (tier === 'rare') return '本轮 15 秒非常安静，结算稀有鱼'
    if (tier === 'good') return '本轮 15 秒较稳定，结算优质鱼'
    return '本轮 15 秒有干扰，结算普通鱼'
  }
  if (tier === 'rare') return '本轮 15 秒朗读很稳定，结算稀有鱼'
  if (tier === 'good') return '本轮 15 秒朗读不错，结算优质鱼'
  return '本轮 15 秒朗读较弱，结算普通鱼'
}

function summarizeFish(counts: FishCounts) {
  return counts.normal + counts.good + counts.rare
}

export type ReadingResultPayload = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  normalFish: number
  goodFish: number
  rareFish: number
  playerName: string
  mode: GameMode
  fishAtStart?: number
  fishAtEnd?: number
  rareFishUnlocked?: boolean
  rareFishName?: string
  rareFishBroken?: boolean
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
  const effectiveRef = useRef(0)
  const meterAccRef = useRef(0)
  const windowAccRef = useRef(0)
  const qualityAccRef = useRef(0)
  const fishCountsRef = useRef<FishCounts>({ normal: 0, good: 0, rare: 0 })
  const rareFishNameRef = useRef<string | null>(null)

  const [sessionMode, setSessionMode] = useState<GameMode>('positive')
  const [sessionPlayer, setSessionPlayer] = useState('')
  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const [displayFish, setDisplayFish] = useState(0)
  const [loopOn, setLoopOn] = useState(false)
  const [meterLevel, setMeterLevel] = useState(0)
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [lastTier, setLastTier] = useState<FishTier | null>(null)

  const cleanupMic = useCallback(() => {
    stopMicPipeline(pipelineRef.current)
    pipelineRef.current = null
    voiceRef.current.reset()
    setLoopOn(false)
  }, [])

  useEffect(() => () => cleanupMic(), [cleanupMic])

  const resetCounters = () => {
    effectiveRef.current = 0
    meterAccRef.current = 0
    windowAccRef.current = 0
    qualityAccRef.current = 0
    fishCountsRef.current = { normal: 0, good: 0, rare: 0 }
    rareFishNameRef.current = null
    setEffectiveSeconds(0)
    setDisplayFish(0)
    setMeterLevel(0)
    setProgressSeconds(0)
    setLastTier(null)
  }

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
      resetCounters()
      setUiStatus('quiet')
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
    const isStudyGood = voice.smoothed <= settings.quietThreshold
    const isReadGood = voice.isActive
    const goodNow = mode === 'study' ? isStudyGood : isReadGood

    setUiStatus(goodNow ? 'active' : 'quiet')

    const nextEffective = effectiveRef.current + dtMs / 1000
    effectiveRef.current = nextEffective
    setEffectiveSeconds(nextEffective)

    windowAccRef.current += dtMs / 1000
    if (goodNow) qualityAccRef.current += dtMs / 1000
    setProgressSeconds(Math.min(FISH_WINDOW_SECONDS, windowAccRef.current))

    while (windowAccRef.current >= FISH_WINDOW_SECONDS) {
      const qualityRatio = qualityAccRef.current / FISH_WINDOW_SECONDS
      let tier: FishTier = 'normal'
      if (qualityRatio >= 0.9) tier = 'rare'
      else if (qualityRatio >= 0.6) tier = 'good'

      fishCountsRef.current = {
        ...fishCountsRef.current,
        [tier]: fishCountsRef.current[tier] + 1,
      }
      if (tier === 'rare' && !rareFishNameRef.current) {
        rareFishNameRef.current = pickRareFishName(nextEffective)
      }

      setLastTier(tier)
      const total = summarizeFish(fishCountsRef.current)
      setDisplayFish(Math.min(24, total))

      windowAccRef.current -= FISH_WINDOW_SECONDS
      qualityAccRef.current = Math.max(0, qualityAccRef.current - FISH_WINDOW_SECONDS)
      setProgressSeconds(windowAccRef.current)
    }
  }, loopOn)

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const counts = fishCountsRef.current
    const fishEarned = summarizeFish(counts)

    const payload: ReadingResultPayload = {
      startedAt,
      endedAt: new Date().toISOString(),
      effectiveSeconds: effectiveRef.current,
      fishEarned,
      normalFish: counts.normal,
      goodFish: counts.good,
      rareFish: counts.rare,
      playerName: sessionPlayerRef.current,
      mode: sessionModeRef.current,
      fishAtEnd: fishEarned,
      rareFishUnlocked: counts.rare > 0,
      rareFishName: counts.rare > 0 ? rareFishNameRef.current ?? pickRareFishName(effectiveRef.current) : undefined,
      rareFishBroken: false,
    }

    cleanupMic()
    setUiStatus('idle')
    startedAtRef.current = null
    resetCounters()
    navigate('/result', { state: payload })
  }, [cleanupMic, navigate])

  const resetLocal = useCallback(() => {
    cleanupMic()
    setUiStatus('idle')
    setErrorMessage(null)
    startedAtRef.current = null
    resetCounters()
  }, [cleanupMic])

  const progressPct = Math.min(100, (progressSeconds / FISH_WINDOW_SECONDS) * 100)
  const fishCounts = fishCountsRef.current
  const subtitle = lastTier ? qualityText(sessionMode, lastTier) : sessionMode === 'study'
    ? '自习模式下，每 15 秒按安静质量结算 1 条鱼'
    : '早读模式下，每 15 秒按朗读质量结算 1 条鱼'

  return (
    <>
      <header>
        <h1 className="page-title">{sessionPlayer || '未命名玩家'}｜{modeUiLabel(sessionMode)}</h1>
        <div className={`status-pill ${uiStatus}`} role="status" aria-live="polite" style={{ marginTop: '0.5rem' }}>
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
            <span>本条鱼进度（15 秒）</span>
            <span>{progressSeconds.toFixed(1)} / 15s</span>
          </div>
          <div className="progress-wrap" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            累计时长 {effectiveSeconds.toFixed(1)} 秒 · 已结算 {displayFish} 条鱼
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--accent-soft)', fontSize: '0.88rem', fontWeight: 600 }}>
            普通鱼 {fishCounts.normal} · 优质鱼 {fishCounts.good} · 稀有鱼 {fishCounts.rare}
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{subtitle}</p>
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          {sessionMode === 'study'
            ? '自习养鱼：每 15 秒按安静质量结算 1 条鱼。越安静，鱼越稀有。'
            : '早读养鱼：每 15 秒按朗读质量结算 1 条鱼。越稳定，鱼越稀有。'}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {uiStatus === 'idle' || uiStatus === 'error' ? (
          <button type="button" onClick={startReading}>{uiStatus === 'error' ? '重试麦克风' : '开始'}</button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={endSession}>结束并查看结果</button>
            <button type="button" className="secondary" onClick={resetLocal}>重置</button>
          </>
        )}
      </div>

      <Link to="/">
        <button type="button" className="secondary">回首页</button>
      </Link>
    </>
  )
}
