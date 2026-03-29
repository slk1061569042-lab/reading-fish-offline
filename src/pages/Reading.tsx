import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
  warnSeconds: number
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

function sumRawFish(counts: FishCounts) {
  return counts.normal + counts.good + counts.rare + counts.dead
}

function DebugButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="debug-panel__button secondary" onClick={onClick}>
      {children}
    </button>
  )
}

function classifyFish(mode: GameMode, stats: WindowStats): Exclude<FishTier, 'superRare'> {
  if (mode === 'study') {
    const stableQuiet = stats.quietSeconds + stats.warnSeconds * 0.65
    if (stableQuiet >= 13) return 'rare'
    if (stableQuiet >= 8.5) return 'good'
    if (stableQuiet >= 4.5) return 'normal'
    return 'dead'
  }

  const effectiveActive = stats.activeSeconds + stats.warnSeconds * 0.6
  if (effectiveActive >= 12) return 'rare'
  if (effectiveActive >= 7.5) return 'good'
  if (effectiveActive >= 4.2) return 'normal'
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
  const statsRef = useRef<WindowStats>({ activeSeconds: 0, quietSeconds: 0, warnSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 })
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
  const [showDebugPanel, setShowDebugPanel] = useState(false)

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
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, warnSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 }
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
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, warnSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 }
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

    if (segmentState === 'good') {
      statsRef.current.currentBadStreak = 0
      if (mode === 'study') statsRef.current.quietSeconds += dt
      else statsRef.current.activeSeconds += dt
    } else if (segmentState === 'warn') {
      statsRef.current.currentBadStreak = 0
      statsRef.current.warnSeconds += dt
      if (mode === 'study') statsRef.current.quietSeconds += dt * 0.35
      else statsRef.current.activeSeconds += dt * 0.35
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

  const injectFish = useCallback((tier: Exclude<FishTier, 'superRare'>, amount = 1) => {
    if (amount <= 0) return
    const nextCounts = { ...fishCountsRef.current }
    const nextResults = [...fishResultsRef.current]
    let firstRareName: string | null = null

    for (let i = 0; i < amount; i += 1) {
      nextCounts[tier] += 1
      let rareName: string | undefined
      if (tier === 'rare') {
        rareName = pickRareFishName(effectiveRef.current + nextResults.length + i)
        if (!rareFishNameRef.current && !firstRareName) firstRareName = rareName
      }
      nextResults.push({
        tier,
        rareFishName: rareName,
        segments: Array.from({ length: 30 }, () => (tier === 'dead' ? 'bad' : tier === 'rare' ? 'good' : tier === 'good' ? 'warn' : 'good')),
      })
    }

    if (firstRareName) rareFishNameRef.current = firstRareName
    fishCountsRef.current = nextCounts
    fishResultsRef.current = nextResults
    setLastTier(tier)
    setDisplayFish(Math.min(48, sumRawFish(nextCounts)))
  }, [])

  const progressPct = Math.min(100, (progressSeconds / FISH_WINDOW_SECONDS) * 100)
  const progressSegments = 30
  const fishCounts = fishCountsRef.current
  const previewBattle = buildBattle(fishCounts)
  const subtitle = qualityText(sessionMode, lastTier)

  return (
    <section className="reading-immersive">
      <div className="reading-immersive__tank">
        <AquariumTank
          className="reading-immersive__canvas"
          full
          normalCount={previewBattle.finalCounts.normal}
          goodCount={previewBattle.finalCounts.good}
          rareCount={previewBattle.finalCounts.rare}
          superRareCount={previewBattle.finalCounts.superRare}
          deadCount={previewBattle.finalCounts.dead}
          sharkCount={previewBattle.finalCounts.shark}
        />
      </div>

      <div className="reading-immersive__overlay">
        <header className="reading-hero">
          <div className="reading-hero__copy">
            <div className="reading-hero__eyebrow">{modeUiLabel(sessionMode)}</div>
            <h1 className="page-title reading-hero__title">{sessionPlayer || '未命名玩家'}</h1>
            <p className={`reading-hero__subtitle${lastTier === 'dead' ? ' is-danger' : ''}`}>{subtitle}</p>
          </div>
          <div className="reading-hero__meta">
            <div className={`status-pill ${uiStatus}`} role="status" aria-live="polite">
              <span className="dot" />
              {statusLabel(uiStatus)}
            </div>
            <div className="reading-hero__runtime">累计 {effectiveSeconds.toFixed(1)} 秒</div>
          </div>
        </header>

        {errorMessage ? <p className="reading-error">{errorMessage}</p> : null}

        <div className="reading-hud">
          <section className="card reading-hud-card reading-hud-card--meter">
            <div className="reading-hud-card__label">声音监测</div>
            <div className="reading-hud-card__title">当前鱼苗结算进度</div>
            <div className="reading-hud-card__meter">
              <VolumeMeter level={meterLevel} activeThreshold={settingsRef.current.activeThreshold} quietThreshold={settingsRef.current.quietThreshold} />
            </div>
            <div className="reading-progress-head">
              <span>固定 15 秒结算</span>
              <strong>{progressSeconds.toFixed(1)} / 15s</strong>
            </div>
            <div className="progress-wrap progress-segments" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              {Array.from({ length: progressSegments }).map((_, i) => {
                const filled = progressPct >= ((i + 1) / progressSegments) * 100
                const state = segmentStatesRef.current[i]
                return <span key={i} className={`progress-segment ${filled ? `is-filled is-${state}` : ''}`} />
              })}
            </div>
          </section>

          <section className="card reading-hud-card reading-hud-card--summary">
            <div className="reading-hud-card__label">鱼缸概览</div>
            <div className="reading-hud-stats">
              <div className="reading-stat">
                <span>已结算</span>
                <strong>{displayFish}</strong>
              </div>
              <div className="reading-stat">
                <span>普通</span>
                <strong>{fishCounts.normal}</strong>
              </div>
              <div className="reading-stat">
                <span>优质</span>
                <strong>{fishCounts.good}</strong>
              </div>
              <div className="reading-stat">
                <span>稀有</span>
                <strong>{fishCounts.rare}</strong>
              </div>
              <div className="reading-stat">
                <span>死鱼</span>
                <strong>{fishCounts.dead}</strong>
              </div>
              <div className="reading-stat reading-stat--alert">
                <span>合体预览</span>
                <strong>超稀有 {previewBattle.finalCounts.superRare} · 鲨鱼 {previewBattle.finalCounts.shark}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="floating-actions floating-actions--reading">
          {uiStatus === 'idle' || uiStatus === 'error' ? (
            <button type="button" onClick={startReading}>{uiStatus === 'error' ? '重试' : '开始'}</button>
          ) : (
            <>
              <button type="button" onClick={endSession}>结束</button>
              <button type="button" className="secondary" onClick={resetLocal}>重置</button>
              <Link to="/"><button type="button" className="secondary">首页</button></Link>
            </>
          )}
          <button type="button" className="secondary" onClick={() => setShowDebugPanel((v) => !v)}>
            {showDebugPanel ? '收起测试入口' : '测试入口'}
          </button>
        </div>

        {showDebugPanel ? (
          <div className="debug-panel card">
            <div className="debug-panel__title">临时调试入口</div>
            <div className="debug-panel__hint">仅用于快速生成鱼和排查规则，后续可直接删除。</div>
            <div className="debug-panel__actions">
              <DebugButton onClick={() => injectFish('normal')}>+1 普通鱼</DebugButton>
              <DebugButton onClick={() => injectFish('good')}>+1 优质鱼</DebugButton>
              <DebugButton onClick={() => injectFish('rare')}>+1 稀有鱼</DebugButton>
              <DebugButton onClick={() => injectFish('dead')}>+1 死鱼</DebugButton>
              <DebugButton onClick={() => injectFish('dead', 10)}>+10 死鱼（测鲨鱼）</DebugButton>
              <DebugButton onClick={() => injectFish('rare', 10)}>+10 稀有鱼（测超稀有）</DebugButton>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
