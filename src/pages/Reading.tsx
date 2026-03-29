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

type FishTier = 'normal' | 'good' | 'rare' | 'dead'

type FishCounts = {
  normal: number
  good: number
  rare: number
  dead: number
}

type WindowStats = {
  activeSeconds: number
  quietSeconds: number
  badSeconds: number
  worstBadStreak: number
  currentBadStreak: number
}

type SegmentState = 'good' | 'warn' | 'bad'

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

function summarizeFish(counts: FishCounts) {
  return counts.normal + counts.good + counts.rare + counts.dead
}

function classifyFish(mode: GameMode, stats: WindowStats): FishTier {
  if (mode === 'study') {
    if (stats.badSeconds >= 5 || stats.worstBadStreak >= 2.2) return 'dead'
    if (stats.quietSeconds >= 14) return 'rare'
    if (stats.quietSeconds >= 10.5) return 'good'
    return 'normal'
  }

  if (stats.badSeconds >= 6 || stats.worstBadStreak >= 3.2) return 'dead'
  if (stats.activeSeconds >= 13) return 'rare'
  if (stats.activeSeconds >= 9.5) return 'good'
  return 'normal'
}

function qualityText(mode: GameMode, tier: FishTier | null) {
  if (!tier) {
    return mode === 'study'
      ? '自习养鱼：15 秒固定结算，按安静质量生成普通 / 优质 / 稀有 / 死鱼'
      : '早读养鱼：15 秒固定结算，按朗读质量生成普通 / 优质 / 稀有 / 死鱼'
  }
  if (tier === 'dead') {
    return mode === 'study' ? '这一条干扰严重，生成了死鱼' : '这一条朗读质量太差，生成了死鱼'
  }
  if (mode === 'study') {
    if (tier === 'rare') return '这一条很安静，结算稀有鱼'
    if (tier === 'good') return '这一条比较稳，结算优质鱼'
    return '这一条有些干扰，结算普通鱼'
  }
  if (tier === 'rare') return '这一条朗读很稳，结算稀有鱼'
  if (tier === 'good') return '这一条朗读不错，结算优质鱼'
  return '这一条朗读一般，结算普通鱼'
}

export type ReadingResultPayload = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  normalFish: number
  goodFish: number
  rareFish: number
  deadFish: number
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
  const progressRef = useRef(0)
  const statsRef = useRef<WindowStats>({ activeSeconds: 0, quietSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 })
  const fishCountsRef = useRef<FishCounts>({ normal: 0, good: 0, rare: 0, dead: 0 })
  const rareFishNameRef = useRef<string | null>(null)
  const segmentStatesRef = useRef<SegmentState[]>(Array.from({ length: 30 }, () => 'bad'))

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
    progressRef.current = 0
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 }
    fishCountsRef.current = { normal: 0, good: 0, rare: 0, dead: 0 }
    rareFishNameRef.current = null
    segmentStatesRef.current = Array.from({ length: 30 }, () => 'bad')
    setEffectiveSeconds(0)
    setDisplayFish(0)
    setMeterLevel(0)
    setProgressSeconds(0)
    setLastTier(null)
  }

  const resetCurrentFish = () => {
    progressRef.current = 0
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 }
    segmentStatesRef.current = Array.from({ length: 30 }, () => 'bad')
    setProgressSeconds(0)
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

    const dt = dtMs / 1000
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
    const goodNow = mode === 'study' ? voice.smoothed <= settings.quietThreshold : voice.isActive
    const warnNow = mode === 'study'
      ? voice.smoothed <= settings.quietThreshold * 1.35
      : voice.smoothed >= settings.activeThreshold * 0.55
    const segmentState: SegmentState = goodNow ? 'good' : warnNow ? 'warn' : 'bad'

    setUiStatus(goodNow ? 'active' : 'quiet')

    effectiveRef.current += dt
    setEffectiveSeconds(effectiveRef.current)

    progressRef.current = Math.min(FISH_WINDOW_SECONDS, progressRef.current + dt)

    const segmentIndex = Math.min(29, Math.floor((progressRef.current / FISH_WINDOW_SECONDS) * 30))
    segmentStatesRef.current[segmentIndex] = segmentState

    if (goodNow) {
      statsRef.current.currentBadStreak = 0
      if (mode === 'study') statsRef.current.quietSeconds += dt
      else statsRef.current.activeSeconds += dt
    } else {
      statsRef.current.badSeconds += dt
      statsRef.current.currentBadStreak += dt
      statsRef.current.worstBadStreak = Math.max(statsRef.current.worstBadStreak, statsRef.current.currentBadStreak)
      if (mode === 'study') statsRef.current.activeSeconds += dt
      else statsRef.current.quietSeconds += dt
    }

    setProgressSeconds(progressRef.current)

    if (progressRef.current >= FISH_WINDOW_SECONDS) {
      const tier = classifyFish(mode, statsRef.current)
      fishCountsRef.current = {
        ...fishCountsRef.current,
        [tier]: fishCountsRef.current[tier] + 1,
      }
      if (tier === 'rare' && !rareFishNameRef.current) {
        rareFishNameRef.current = pickRareFishName(effectiveRef.current)
      }
      setLastTier(tier)
      setDisplayFish(Math.min(24, summarizeFish(fishCountsRef.current)))
      resetCurrentFish()
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
      deadFish: counts.dead,
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
  const progressSegments = 30
  const fishCounts = fishCountsRef.current
  const subtitle = qualityText(sessionMode, lastTier)

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

      <div className="card reading-stage-card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank
          full
          normalCount={fishCounts.normal}
          goodCount={fishCounts.good}
          rareCount={fishCounts.rare}
          deadCount={fishCounts.dead}
        />
        <div style={{ padding: '0.8rem 1rem 1rem' }}>
          <VolumeMeter level={meterLevel} activeThreshold={settingsRef.current.activeThreshold} quietThreshold={settingsRef.current.quietThreshold} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', margin: '0.95rem 0 0.35rem' }}>
            <span>本条鱼进度（固定 15 秒）</span>
            <span>{progressSeconds.toFixed(1)} / 15s</span>
          </div>
          <div className="progress-wrap progress-segments" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            {Array.from({ length: progressSegments }).map((_, i) => {
              const filled = progressPct >= ((i + 1) / progressSegments) * 100
              const state = segmentStatesRef.current[i]
              return <span key={i} className={`progress-segment ${filled ? `is-filled is-${state}` : ''}`} />
            })}
          </div>
          <p style={{ margin: '0.7rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            累计时长 {effectiveSeconds.toFixed(1)} 秒 · 已结算 {displayFish} 条鱼/死鱼
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--accent-soft)', fontSize: '0.92rem', fontWeight: 700 }}>
            普通鱼 {fishCounts.normal} · 优质鱼 {fishCounts.good} · 稀有鱼 {fishCounts.rare} · 死鱼 {fishCounts.dead}
          </p>
          <p style={{ margin: '0.3rem 0 0', color: lastTier === 'dead' ? 'var(--danger)' : 'var(--muted)', fontSize: '0.88rem' }}>{subtitle}</p>
        </div>
      </div>

      <div className="floating-actions">
        {uiStatus === 'idle' || uiStatus === 'error' ? (
          <button type="button" onClick={startReading}>{uiStatus === 'error' ? '重试' : '开始'}</button>
        ) : (
          <>
            <button type="button" onClick={endSession}>结束</button>
            <button type="button" className="secondary" onClick={resetLocal}>重置</button>
            <Link to="/"><button type="button" className="secondary">首页</button></Link>
          </>
        )}
      </div>
    </>
  )
}
