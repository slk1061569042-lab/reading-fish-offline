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
import { loadProfile, loadSettings, type BattleReport, type FishResult, type FishTier, type GameMode, type GameSettings, type SegmentState } from '../modules/storage'

export type ReadingStatus = 'idle' | 'requesting' | 'active' | 'quiet' | 'error'

type FishCounts = {
  normal: number
  good: number
  rare: number
  superRare: number
  dead: number
  shark: number
}

type WindowStats = {
  activeSeconds: number
  quietSeconds: number
  badSeconds: number
  worstBadStreak: number
  currentBadStreak: number
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

function summarizeFish(counts: FishCounts) {
  return counts.normal + counts.good + counts.rare + counts.superRare + counts.dead
}

function classifyFish(mode: GameMode, stats: WindowStats): Exclude<FishTier, 'superRare'> {
  if (mode === 'study') {
    if (stats.quietSeconds >= 13.5) return 'rare'
    if (stats.quietSeconds >= 9) return 'good'
    if (stats.quietSeconds >= 3.5) return 'normal'
    return 'dead'
  }

  if (stats.activeSeconds >= 12.5) return 'rare'
  if (stats.activeSeconds >= 8) return 'good'
  if (stats.activeSeconds >= 3) return 'normal'
  return 'dead'
}

function qualityText(mode: GameMode, tier: Exclude<FishTier, 'superRare'> | null) {
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

function buildBattle(counts: FishCounts): BattleReport {
  const log: string[] = []
  const fishEaten = { normal: 0, good: 0, rare: 0, superRare: 0 }
  const sharksSummoned = Math.floor(counts.dead / 10)
  const deadFishCombined = sharksSummoned * 10
  const deadLeft = counts.dead - deadFishCombined
  let normal = counts.normal
  let good = counts.good
  let rare = counts.rare
  let superRare = Math.floor(rare / 10)
  const rareFishCombined = superRare * 10
  rare -= rareFishCombined
  const superRareSummoned = superRare
  let shark = sharksSummoned
  let sharksDefeated = 0
  let superRareDefeated = 0

  if (sharksSummoned > 0) log.push(`10 条死鱼合成规则触发，召出 ${sharksSummoned} 条怨念鲨鱼`)
  if (superRareSummoned > 0) log.push(`10 条稀有鱼合体，生成 ${superRareSummoned} 条超级稀有鱼，并从稀有鱼数量中真实扣除 ${rareFishCombined} 条`)

  for (let i = 0; i < shark; i++) {
    let sharkHp = 8
    let resolved = false

    if (superRare > 0) {
      const damage = Math.min(superRare, 2) * 4
      sharkHp -= damage
      log.push(`超级稀有鱼围攻怨念鲨鱼 #${i + 1}，造成 ${damage} 点伤害`)
      if (sharkHp <= 0) {
        sharksDefeated += 1
        resolved = true
        log.push(`怨念鲨鱼 #${i + 1} 被超级稀有鱼击杀`)
      }
    }

    if (!resolved && rare > 0) {
      const damage = Math.min(rare, 2) * 2
      sharkHp -= damage
      log.push(`稀有鱼反击怨念鲨鱼 #${i + 1}，造成 ${damage} 点伤害`)
      if (sharkHp <= 0) {
        sharksDefeated += 1
        resolved = true
        log.push(`怨念鲨鱼 #${i + 1} 被鱼群击杀`)
      }
    }

    if (resolved) continue

    if (superRare > 0) {
      superRare -= 1
      fishEaten.superRare += 1
      superRareDefeated += 1
      log.push(`怨念鲨鱼 #${i + 1} 与超级稀有鱼缠斗后，吞掉 1 条超级稀有鱼`)
      continue
    }

    const eatPriority: Array<'normal' | 'good' | 'rare'> = ['normal', 'good', 'rare']
    let ate = false
    for (const target of eatPriority) {
      if (target === 'normal' && normal > 0) {
        normal -= 1
        fishEaten.normal += 1
        ate = true
        log.push(`怨念鲨鱼 #${i + 1} 吃掉 1 条普通鱼`)
        break
      }
      if (target === 'good' && good > 0) {
        good -= 1
        fishEaten.good += 1
        ate = true
        log.push(`怨念鲨鱼 #${i + 1} 吃掉 1 条优质鱼`)
        break
      }
      if (target === 'rare' && rare > 0) {
        rare -= 1
        fishEaten.rare += 1
        ate = true
        log.push(`怨念鲨鱼 #${i + 1} 吃掉 1 条稀有鱼`)
        break
      }
    }
    if (!ate) log.push(`怨念鲨鱼 #${i + 1} 没追到鱼`)
  }

  shark -= sharksDefeated

  return {
    deadFishCombined,
    rareFishCombined,
    sharksSummoned,
    superRareSummoned,
    sharksDefeated,
    superRareDefeated,
    fishEaten,
    finalCounts: {
      normal,
      good,
      rare,
      superRare,
      dead: deadLeft,
      shark,
    },
    log,
  }
}

export type ReadingResultPayload = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  normalFish: number
  goodFish: number
  rareFish: number
  superRareFish: number
  deadFish: number
  sharkCount: number
  fishResults: FishResult[]
  battleReport: BattleReport
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
  const fishCountsRef = useRef<FishCounts>({ normal: 0, good: 0, rare: 0, superRare: 0, dead: 0, shark: 0 })
  const fishResultsRef = useRef<FishResult[]>([])
  const rareFishNameRef = useRef<string | null>(null)
  const segmentStatesRef = useRef<SegmentState[]>(Array.from({ length: 30 }, () => 'bad'))

  const [sessionMode, setSessionMode] = useState<GameMode>('positive')
  const [sessionPlayer, setSessionPlayer] = useState('')
  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const [displayFish, setDisplayFish] = useState(0)
  const [loopOn, setLoopOn] = useState(false)
  const [meterLevel, setMeterLevel] = useState(0)
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [lastTier, setLastTier] = useState<Exclude<FishTier, 'superRare'> | null>(null)

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
    fishCountsRef.current = { normal: 0, good: 0, rare: 0, superRare: 0, dead: 0, shark: 0 }
    fishResultsRef.current = []
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
    const warnNow = mode === 'study' ? voice.smoothed <= settings.quietThreshold * 1.35 : voice.smoothed >= settings.activeThreshold * 0.55
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
      let rareName: string | undefined
      if (tier === 'rare') {
        rareName = pickRareFishName(effectiveRef.current + fishResultsRef.current.length)
        if (!rareFishNameRef.current) rareFishNameRef.current = rareName
      }
      fishCountsRef.current = { ...fishCountsRef.current, [tier]: fishCountsRef.current[tier] + 1 }
      fishResultsRef.current = [...fishResultsRef.current, { tier, rareFishName: rareName, segments: [...segmentStatesRef.current] }]
      setLastTier(tier)
      setDisplayFish(Math.min(48, summarizeFish(fishCountsRef.current)))
      resetCurrentFish()
    }
  }, loopOn)

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const rawCounts = fishCountsRef.current
    const battleReport = buildBattle(rawCounts)
    const finalCounts = battleReport.finalCounts
    const fishEarned = finalCounts.normal + finalCounts.good + finalCounts.rare + finalCounts.superRare + finalCounts.dead

    const payload: ReadingResultPayload = {
      startedAt,
      endedAt: new Date().toISOString(),
      effectiveSeconds: effectiveRef.current,
      fishEarned,
      normalFish: finalCounts.normal,
      goodFish: finalCounts.good,
      rareFish: finalCounts.rare,
      superRareFish: finalCounts.superRare,
      deadFish: finalCounts.dead,
      sharkCount: finalCounts.shark,
      fishResults: fishResultsRef.current,
      battleReport,
      playerName: sessionPlayerRef.current,
      mode: sessionModeRef.current,
      fishAtEnd: fishEarned,
      rareFishUnlocked: rawCounts.rare > 0,
      rareFishName: rawCounts.rare > 0 ? rareFishNameRef.current ?? pickRareFishName(effectiveRef.current) : undefined,
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
  const previewBattle = buildBattle(fishCounts)
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
          normalCount={previewBattle.finalCounts.normal}
          goodCount={previewBattle.finalCounts.good}
          rareCount={previewBattle.finalCounts.rare}
          superRareCount={previewBattle.finalCounts.superRare}
          deadCount={previewBattle.finalCounts.dead}
          sharkCount={previewBattle.finalCounts.shark}
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
          <p style={{ margin: '0.7rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>累计时长 {effectiveSeconds.toFixed(1)} 秒 · 已结算 {displayFish} 条鱼/死鱼</p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--accent-soft)', fontSize: '0.92rem', fontWeight: 700 }}>
            普通鱼 {fishCounts.normal} · 优质鱼 {fishCounts.good} · 稀有鱼 {fishCounts.rare} · 死鱼 {fishCounts.dead}
          </p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--sand)', fontSize: '0.9rem', fontWeight: 700 }}>
            预览：超级稀有鱼 {previewBattle.finalCounts.superRare} · 怨念鲨鱼 {previewBattle.finalCounts.shark}
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
