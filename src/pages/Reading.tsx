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

type WindowStats = {
  activeSeconds: number
  quietSeconds: number
  badStreakSeconds: number
}

const FISH_WINDOW_SECONDS = 15
const READING_BREAK_RESET_SECONDS = 1.8
const STUDY_NOISE_RESET_SECONDS = 0.8
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
  return counts.normal + counts.good + counts.rare
}

function classifyFish(mode: GameMode, stats: WindowStats): FishTier {
  if (mode === 'study') {
    if (stats.quietSeconds >= 14) return 'rare'
    if (stats.quietSeconds >= 10) return 'good'
    return 'normal'
  }

  if (stats.activeSeconds >= 13) return 'rare'
  if (stats.activeSeconds >= 9) return 'good'
  return 'normal'
}

function qualityText(mode: GameMode, tier: FishTier | null, broken: boolean) {
  if (broken) {
    return mode === 'study'
      ? '连续噪音过久，本条鱼已失败，进度重新开始'
      : '连续掉线过久，本条鱼已失败，进度重新开始'
  }
  if (!tier) {
    return mode === 'study'
      ? '自习养鱼：看 15 秒内安静占比，允许短暂干扰，但连续噪音过久会失败'
      : '早读养鱼：看 15 秒内朗读占比，允许短暂停顿，但连续掉线过久会失败'
  }
  if (mode === 'study') {
    if (tier === 'rare') return '这一条很安静，结算稀有鱼'
    if (tier === 'good') return '这一条比较稳，结算优质鱼'
    return '这一条干扰偏多，结算普通鱼'
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
  const statsRef = useRef<WindowStats>({ activeSeconds: 0, quietSeconds: 0, badStreakSeconds: 0 })
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
  const [justBroken, setJustBroken] = useState(false)

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
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, badStreakSeconds: 0 }
    fishCountsRef.current = { normal: 0, good: 0, rare: 0 }
    rareFishNameRef.current = null
    setEffectiveSeconds(0)
    setDisplayFish(0)
    setMeterLevel(0)
    setProgressSeconds(0)
    setLastTier(null)
    setJustBroken(false)
  }

  const resetCurrentFish = () => {
    progressRef.current = 0
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, badStreakSeconds: 0 }
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

    setUiStatus(goodNow ? 'active' : 'quiet')
    setJustBroken(false)

    effectiveRef.current += dt
    setEffectiveSeconds(effectiveRef.current)

    if (goodNow) {
      progressRef.current = Math.min(FISH_WINDOW_SECONDS, progressRef.current + dt)
      statsRef.current.badStreakSeconds = 0
      if (mode === 'study') {
        statsRef.current.quietSeconds += dt
      } else {
        statsRef.current.activeSeconds += dt
      }
    } else {
      statsRef.current.badStreakSeconds += dt
      if (mode === 'study') {
        statsRef.current.activeSeconds += dt
      } else {
        statsRef.current.quietSeconds += dt
      }
    }

    const shouldBreak = mode === 'study'
      ? statsRef.current.badStreakSeconds >= STUDY_NOISE_RESET_SECONDS
      : statsRef.current.badStreakSeconds >= READING_BREAK_RESET_SECONDS

    if (shouldBreak) {
      if (progressRef.current > 0) setJustBroken(true)
      resetCurrentFish()
      return
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
  const subtitle = qualityText(sessionMode, lastTier, justBroken)

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
        />
        <div style={{ padding: '0.8rem 1rem 1rem' }}>
          <VolumeMeter level={meterLevel} activeThreshold={settingsRef.current.activeThreshold} quietThreshold={settingsRef.current.quietThreshold} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', margin: '0.95rem 0 0.35rem' }}>
            <span>本条鱼进度（15 秒有效进度）</span>
            <span>{progressSeconds.toFixed(1)} / 15s</span>
          </div>
          <div className="progress-wrap" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p style={{ margin: '0.7rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            累计时长 {effectiveSeconds.toFixed(1)} 秒 · 已结算 {displayFish} 条鱼
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--accent-soft)', fontSize: '0.92rem', fontWeight: 700 }}>
            普通鱼 {fishCounts.normal} · 优质鱼 {fishCounts.good} · 稀有鱼 {fishCounts.rare}
          </p>
          <p style={{ margin: '0.3rem 0 0', color: justBroken ? 'var(--warn)' : 'var(--muted)', fontSize: '0.88rem' }}>{subtitle}</p>
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
