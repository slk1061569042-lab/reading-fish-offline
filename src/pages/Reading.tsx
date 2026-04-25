import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AquariumTank, type FishPositionMap, type AquariumHandle } from '../components/AquariumTank'
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
import { loadProfile, saveProfile, loadSettings, loadRecords, type BattleReport, type FishResult, type FishTier, type GameMode, type GameSettings, type SegmentState } from '../modules/storage'
import { buildBattle, countTankPopulation, createEmptyFishCounts, sumGeneratedFish, type GeneratedFishCounts } from '../modules/battle'
import { makeLiveShark, checkSharkLevelUp, getSharkSpeed, getSharkStatsByLevel, calcSharkDamage, calcSharkHealOnEat, calcSharkComboChance, SHARK_EXP_TABLE, SHARK_AWAKENING_SECONDS, SHARK_DYING_SECONDS, SHARK_EGG_HATCH_SECONDS, SHARK_HATCHING_SECONDS } from '../modules/shark'
import type { LiveShark } from '../modules/shark'
import { SUPER_RARE_DEX, SUPER_RARE_SKILL_COOLDOWN, checkSuperRareUnlock, getUnlockedSuperRareIds, unlockSuperRareId, pickRandomSuperRare } from '../modules/superRareDex'
import type { UnlockStats } from '../modules/superRareDex'

export type ReadingStatus = 'idle' | 'requesting' | 'active' | 'quiet' | 'error'

const RARE_GLOW: Record<string, [string, string]> = {
  '晨光蝶尾': ['#fde68a', '#38bdf8'],
  '静海流金': ['#67e8f9', '#1d4ed8'],
  '银月纱鳍': ['#e2e8f0', '#7dd3fc'],
  '晚霞星鳞': ['#f9a8d4', '#f59e0b'],
  '深渊暗鳞': ['#6d28d9', '#4f46e5'],
  '极光霜鳍': ['#bae6fd', '#0891b2'],
  '赤焰烈尾': ['#fca5a5', '#dc2626'],
  '苍穹云斑': ['#e0f2fe', '#38bdf8'],
}

function RareUnlockToast({ name, onDone }: { name: string; onDone: () => void }) {
  const [c1, c2] = RARE_GLOW[name] ?? ['#7dd3fc', '#38bdf8']
  const id = `toast-${name}`
  useEffect(() => {
    const t = setTimeout(onDone, 3800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="rare-unlock-toast" role="status" aria-live="polite">
      <div className="rare-unlock-toast__label">✨ 稀有鱼解锁</div>
      <svg viewBox="0 0 160 90" className="rare-unlock-toast__fish" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <ellipse cx="88" cy="45" rx="34" ry="20" fill={`url(#${id})`} />
        <path d="M52 45 L18 26 L18 64 Z" fill={c2} opacity="0.92" />
        <path d="M84 24 C95 10,120 8,130 24" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
        <path d="M86 66 C100 76,122 78,132 61" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.75" />
        <circle cx="101" cy="39" r="5.5" fill="#fff" />
        <circle cx="103" cy="39" r="2.4" fill="#082f49" />
        <circle cx="116" cy="31" r="2.4" fill="#fff" opacity="0.75" />
        <circle cx="124" cy="49" r="1.8" fill="#fff" opacity="0.55" />
      </svg>
      <div className="rare-unlock-toast__name">{name}</div>
      <div className="rare-unlock-toast__sub">已加入图鉴</div>
    </div>
  )
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
const RARE_FISH_NAMES = [
  '晨光蝶尾', '静海流金', '银月纱鳍', '晚霞星鳞',
  '深渊暗鳞', '极光霜鳍', '赤焰烈尾', '苍穹云斑',
]

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
  const fishCountsRef = useRef<GeneratedFishCounts>(createEmptyFishCounts())
  const fishResultsRef = useRef<FishResult[]>([])
  const rareFishNameRef = useRef<string | null>(null)
  const segmentStatesRef = useRef<SegmentState[]>(Array.from({ length: 30 }, () => 'bad'))
  const sharkStateRef = useRef<LiveShark[]>([])
  const sharkIdCounterRef = useRef(0)
  const fishPositionsRef = useRef<FishPositionMap>({ dead: [], normal: [], good: [], rare: [], superRare: [] })
  const aquariumRef = useRef<AquariumHandle | null>(null)
  // 超稀有鱼实例：每条有独立血量、技能冷却、护盾
  type SuperRareInstance = {
    id: string
    hp: number
    maxHp: number
    healTimer: number
    skillCooldown: number
    shieldCharges: number // 护盾层数，可格挡次数
    dexId: string | null
  }
  const superRareInstancesRef = useRef<SuperRareInstance[]>([]) 

  const [sessionMode, setSessionMode] = useState<GameMode>('positive')
  const [sessionPlayer, setSessionPlayer] = useState('')
  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const [generatedCounts, setGeneratedCounts] = useState<GeneratedFishCounts>(createEmptyFishCounts())
  const [loopOn, setLoopOn] = useState(false)
  const [meterLevel, setMeterLevel] = useState(0)
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [lastTier, setLastTier] = useState<Exclude<FishTier, 'superRare'> | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showHud, setShowHud] = useState(false)
  const [unlockedRareName, setUnlockedRareName] = useState<string | null>(null)
  const [mergeAnim, setMergeAnim] = useState<'shark' | 'superRare' | null>(null)
  const [newSuperRareUnlock, setNewSuperRareUnlock] = useState<string | null>(null)
  const [sharksVersion, setSharksVersion] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const cleanupMic = useCallback(() => {
    stopMicPipeline(pipelineRef.current)
    pipelineRef.current = null
    voiceRef.current.reset()
    setLoopOn(false)
  }, [])

  useEffect(() => () => cleanupMic(), [cleanupMic])

  // 初始化1条 dormant 鲨鱼
  useEffect(() => {
    if (sharkStateRef.current.length === 0) {
      const w = window.innerWidth
      const h = window.innerHeight
      sharkIdCounterRef.current += 1
      sharkStateRef.current = [makeLiveShark('shark-' + sharkIdCounterRef.current, w, h)]
      setSharksVersion(v => v + 1)
    }
  }, [])

  const resetCounters = () => {
    effectiveRef.current = 0
    meterAccRef.current = 0
    progressRef.current = 0
    statsRef.current = { activeSeconds: 0, quietSeconds: 0, warnSeconds: 0, badSeconds: 0, worstBadStreak: 0, currentBadStreak: 0 }
    const emptyCounts = createEmptyFishCounts()
    fishCountsRef.current = emptyCounts
    fishResultsRef.current = []
    rareFishNameRef.current = null
    segmentStatesRef.current = Array.from({ length: 30 }, () => 'bad')
    setEffectiveSeconds(0)
    setGeneratedCounts(emptyCounts)
    setMeterLevel(0)
    setProgressSeconds(0)
    setLastTier(null)
    // 重置鲨鱼状态机，回到 dormant
    const canvas = document.querySelector('canvas')
    const sw = canvas?.clientWidth ?? 800
    const sh = canvas?.clientHeight ?? 600
    sharkIdCounterRef.current += 1
    sharkStateRef.current = [makeLiveShark('shark-' + sharkIdCounterRef.current, sw, sh)]
    setSharksVersion(v => v + 1)
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
        // 每条稀有鱼都弹解锁 toast
        rareFishNameRef.current = rareName
        setUnlockedRareName(rareName)
      }
      const nextCounts = { ...fishCountsRef.current, [tier]: fishCountsRef.current[tier] + 1 }
      fishCountsRef.current = nextCounts
      setGeneratedCounts(nextCounts)
      fishResultsRef.current = [...fishResultsRef.current, { tier, rareFishName: rareName, segments: [...segmentStatesRef.current] }]
      setLastTier(tier)
      resetCurrentFish()
      // 检测合成触发
      const b = buildBattle(nextCounts)
      if (b.superRareSummoned > 0) {
        setMergeAnim('superRare')
        setTimeout(() => setMergeAnim(null), 2800)
        // 真正执行合成
        fishCountsRef.current = b.finalCounts
        setGeneratedCounts(b.finalCounts)
        // 初始化超稀有鱼实例
        const unlockedIds2 = getUnlockedSuperRareIds()
        for (let si = 0; si < b.superRareSummoned; si++) {
          const dexEntry2 = pickRandomSuperRare(unlockedIds2) ?? SUPER_RARE_DEX[0]
          superRareInstancesRef.current.push({
            id: `sr-${Date.now()}-${si}`,
            hp: 10, maxHp: 10, healTimer: 0,
            skillCooldown: 0, shieldCharges: 0,
            dexId: dexEntry2?.id ?? null,
          })
        }
      } else if (b.sharksSummoned > 0) {
        setMergeAnim('shark')
        setTimeout(() => setMergeAnim(null), 2800)
      }
    }
  }, loopOn)

  // 鲨鱼状态机：始终运行（独立循环）
  useGameLoop((dtMs) => {
    const dtSec = dtMs / 1000
    for (const shark of sharkStateRef.current) {
      shark.stateTimer += dtSec
      shark.levelUpPulse = Math.max(0, (shark.levelUpPulse ?? 0) - dtSec * 1.5)
      shark.bitePulse = Math.max(0, shark.bitePulse - dtSec * 1.2)

      if (shark.state === 'dormant') {
        if (fishCountsRef.current.dead >= 10) {
          const cx = window.innerWidth * 0.5
          const cy = window.innerHeight * 0.55
          shark.targetX = cx
          shark.targetY = cy
          const dx = cx - shark.x
          const dy = cy - shark.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const speed = 120 * dtSec
          if (dist < 12) {
            shark.state = 'awakening'
            shark.stateTimer = 0
            setSharksVersion(v => v + 1)
          } else {
            shark.x += (dx / dist) * Math.min(speed, dist)
            shark.y += (dy / dist) * Math.min(speed, dist)
            shark.vx = dx > 0 ? 1 : -1
          }
        }
      } else if (shark.state === 'awakening') {
        shark.eyeOpen = Math.min(1, shark.stateTimer / SHARK_AWAKENING_SECONDS)
        if (shark.stateTimer >= SHARK_AWAKENING_SECONDS) {
          shark.state = 'hunting'
          shark.stateTimer = 0
          shark.eyeOpen = 1
          setSharksVersion(v => v + 1)
        }
      } else if (shark.state === 'hunting') {
        shark.eyeOpen = 1
        
        // 获取当前等级配置
        const cfg = getSharkStatsByLevel(shark.level)
        const w = window.innerWidth
        const h = window.innerHeight
        const margin = 80
        const counts = fishCountsRef.current
        
        // 基础速度（含技能加成）
        let speed = getSharkSpeed(shark) * dtSec
        
        // 嗅觉范围（dash技能加成）
        const smellRange = cfg.skill === 'dash' ? cfg.smellRange * 1.2 : cfg.smellRange
        
        // 护盾自动回血（shield技能）
        if (cfg.skill === 'shield' && shark.hp < shark.maxHp) {
          shark.lastHealTime += dtSec
          if (shark.lastHealTime >= 3) {
            shark.lastHealTime = 0
            shark.hp = Math.min(shark.maxHp, shark.hp + 1)
          }
        }
        
        // 远程打击（ranged技能）- 已禁用，鲨鱼必须靠近才能吃
        // if (cfg.skill === 'ranged') { ... }
        
        // 嗅觉系统：用真实鱼位置找最近的食物
        // 优先级：死鱼 > 普通 > 优质 > 稀有 > 超稀有
        let targetFood: { x: number; y: number; priority: number } | null = null
        let minFoodDist = smellRange
        
        const realPositions = fishPositionsRef.current
        const foodPriorityMap: Array<{ type: keyof typeof realPositions; priority: number }> = [
          { type: 'dead', priority: 4 },
          { type: 'normal', priority: 3 },
          { type: 'good', priority: 2 },
          { type: 'rare', priority: 1 },
          { type: 'superRare', priority: 0 },
        ]
        
        for (const { type, priority } of foodPriorityMap) {
          const fishList = realPositions[type]
          if (!fishList || fishList.length === 0) continue
          for (const fish of fishList) {
            const fdx = fish.x - shark.x
            const fdy = fish.y - shark.y
            const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
            if (fdist < minFoodDist) {
              minFoodDist = fdist
              targetFood = { x: fish.x, y: fish.y, priority }
            }
          }
          if (targetFood) break // 找到最高优先级食物就停
        }
        
        // 被攻击检测
        const hasThreat = counts.superRare > 0 || counts.rare > 0
        
        // 计算目标方向
        let tx = shark.targetX
        let ty = shark.targetY
        let dx = tx - shark.x
        let dy = ty - shark.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        
        // 逃跑概率：根据血量和威胁距离
        const hpRatio = shark.hp / shark.maxHp
        const fleeChance = hasThreat ? 
          (hpRatio < 0.3 ? 0.15 : hpRatio < 0.5 ? 0.08 : 0.03) : 0
        
        // 决策：逃跑 > 追击食物 > 随机巡逻
        if (Math.random() < fleeChance) {
          // 逃跑：游向远离威胁的安全区域
          const safeX = counts.superRare > 0 ?
            (shark.x < w * 0.5 ? w - margin * 2 : margin * 2) :
            (shark.x < w * 0.5 ? w - margin : margin)
          tx = safeX
          ty = h * 0.7
          speed *= 1.4
        } else if (targetFood) {
          // 100% 直线追击真实食物位置，速度提升
          tx = targetFood.x
          ty = targetFood.y
          speed *= 1.6 // 追猎加速
        } else if (dist < 20 || Math.random() < 0.015) {
          // 无食物时随机巡逻
          tx = margin + Math.random() * (w - margin * 2)
          ty = margin + Math.random() * (h * 0.8 - margin)
        }
        
        // 更新目标
        tx = Math.max(margin, Math.min(w - margin, tx))
        ty = Math.max(margin, Math.min(h - margin, ty))
        shark.targetX = tx
        shark.targetY = ty
        dx = tx - shark.x
        dy = ty - shark.y
        dist = Math.sqrt(dx * dx + dy * dy)
        
        // 向目标游动
        if (dist > 1) {
          shark.x += (dx / dist) * Math.min(speed, dist)
          shark.y += (dy / dist) * Math.min(speed, dist)
          shark.vx = dx > 0 ? 1 : -1
        }
        
        // 边界限制
        shark.x = Math.max(margin, Math.min(w - margin, shark.x))
        shark.y = Math.max(margin, Math.min(h - margin, shark.y))
        
        // 碰撞进食逻辑：鲨鱼嘴巴接触到食物才能吃
        // 咬合半径 = 鲨鱼尺寸的一半
        const biteRadius = shark.size * 0.55
        const atTarget = dist < biteRadius
        
        // 冷却：吃完一口后有短暂冷却（dash技能缩短）
        const eatCooldown = cfg.skill === 'dash' ? 0.8 : 1.2
        const canEat = atTarget && shark.stateTimer >= eatCooldown
        
        if (canEat) {
          shark.stateTimer = 0
          const eatCounts = { ...fishCountsRef.current }
          let ate: keyof typeof SHARK_EXP_TABLE | null = null
          
          // 优先吃容易抓的，有血量的鱼需扣血至0才死亡
          if (eatCounts.dead > 0) { eatCounts.dead -= 1; ate = 'dead' }
          else if (eatCounts.normal > 0) {
            const res = aquariumRef.current?.biteFish('normal', shark.x, shark.y)
            if (res?.died) { eatCounts.normal -= 1; ate = 'normal' }
            else if (res) { ate = null; shark.bitePulse = 0.6 } // 咬了但没死
            else { eatCounts.normal -= 1; ate = 'normal' } // 兜底
          }
          else if (eatCounts.good > 0) {
            const res = aquariumRef.current?.biteFish('good', shark.x, shark.y)
            if (res?.died) { eatCounts.good -= 1; ate = 'good' }
            else if (res) { ate = null; shark.bitePulse = 0.6 }
            else { eatCounts.good -= 1; ate = 'good' }
          }
          else if (eatCounts.rare > 0) {
            const res = aquariumRef.current?.biteFish('rare', shark.x, shark.y)
            if (res?.died) { eatCounts.rare -= 1; ate = 'rare' }
            else if (res) { ate = null; shark.bitePulse = 0.6 }
            else { eatCounts.rare -= 1; ate = 'rare' }
          }
          else if (eatCounts.superRare > 0) {
            // 超稀有鱼有10点血，咬一下扣1点，血尽才真正死亡
            const srInstance = superRareInstancesRef.current[0]
            if (srInstance) {
              if (srInstance.shieldCharges > 0) {
                // 护盾格挡：消耗一层护盾，本次伤害无效
                srInstance.shieldCharges -= 1
                shark.bitePulse = 0.3 // 撞盾特效
              } else {
                srInstance.hp -= 1
                if (srInstance.hp <= 0) {
                  // 复活技能检测
                  const dex = SUPER_RARE_DEX.find(e => e.id === srInstance.dexId)
                  if (dex?.skill === 'revive' && srInstance.skillCooldown <= 0) {
                    // 时光回溯：复活，进入CD
                    srInstance.hp = srInstance.maxHp
                    srInstance.skillCooldown = 30
                  } else {
                    // 真正死亡：移除实例，扣除数量和底层稀有鱼
                    superRareInstancesRef.current.shift()
                    eatCounts.superRare -= 1
                    eatCounts.rare = Math.max(0, eatCounts.rare - 10)
                  }
                }
              }
            } else {
              // 兜底：没有实例时直接死亡
              eatCounts.superRare -= 1
              eatCounts.rare = Math.max(0, eatCounts.rare - 10)
            }
            ate = 'superRare'
          }
          
          if (ate) {
            shark.exp += SHARK_EXP_TABLE[ate]
            shark.bitePulse = ate === 'superRare' ? 1.5 : 1 // 吃超稀有特效更强
            
            // 吞噬治疗（devour技能）
            const heal = calcSharkHealOnEat(shark)
            if (heal > 0) {
              shark.hp = Math.min(shark.maxHp, shark.hp + heal)
            }
            
            // 连击判定（devour技能）
            if (calcSharkComboChance(shark) > Math.random()) {
              shark.comboCount += 1
              // 连击：立即再吃一次同优先级
              if (eatCounts.dead > 0) { eatCounts.dead -= 1; shark.exp += SHARK_EXP_TABLE.dead }
              else if (eatCounts.normal > 0) { eatCounts.normal -= 1; shark.exp += SHARK_EXP_TABLE.normal }
              else if (eatCounts.good > 0) { eatCounts.good -= 1; shark.exp += SHARK_EXP_TABLE.good }
              shark.bitePulse = 1.2
            } else {
              shark.comboCount = 0
            }
            
            checkSharkLevelUp(shark)
            fishCountsRef.current = eatCounts
            setGeneratedCounts(eatCounts)
            
            // 吃完后重置目标，让鲨鱼去找下一条鱼
            shark.targetX = margin + Math.random() * (w - margin * 2)
            shark.targetY = margin + Math.random() * (h * 0.7 - margin)
          }
        }
        
        // 超稀有鱼技能系统
        for (const sr of superRareInstancesRef.current) {
          sr.skillCooldown = Math.max(0, sr.skillCooldown - dtSec)
          sr.healTimer += dtSec

          const dex = SUPER_RARE_DEX.find(e => e.id === sr.dexId)
          if (!dex || sr.skillCooldown > 0) continue

          const skill = dex.skill
          const cooldown = SUPER_RARE_SKILL_COOLDOWN[skill] ?? 5

          switch (skill) {
            case 'heal': // 治疗其他鱼（给其他超稀有回血）
              if (sr.healTimer >= 3) {
                sr.healTimer = 0
                const target = superRareInstancesRef.current.find(o => o.id !== sr.id && o.hp < o.maxHp)
                if (target) {
                  target.hp = Math.min(target.maxHp, target.hp + 3)
                  sr.skillCooldown = cooldown
                }
              }
              break

            case 'regen': // 再生光环：给所有受伤鱼回血
              if (sr.healTimer >= 2) {
                sr.healTimer = 0
                let healed = false
                for (const other of superRareInstancesRef.current) {
                  if (other.hp < other.maxHp) {
                    other.hp = Math.min(other.maxHp, other.hp + 2)
                    healed = true
                  }
                }
                if (healed) sr.skillCooldown = cooldown
              }
              break

            case 'shield': // 护盾：给随机鱼加护盾
              sr.skillCooldown = cooldown
              const target = superRareInstancesRef.current[Math.floor(Math.random() * superRareInstancesRef.current.length)]
              if (target) target.shieldCharges += 1
              break

            case 'haste': // 急速：暂时提升鲨鱼逃跑速度（反向：让鱼更难被抓）
              sr.skillCooldown = cooldown
              // 效果：下一帧处理，暂时跳过
              break
          }
        }
        // 超稀有鱼存在时造成持续伤害
        const rawDmg = Math.min(fishCountsRef.current.superRare, 2) * 3 + Math.min(fishCountsRef.current.rare, 2) * 2
        if (rawDmg > 0) {
          const actualDmg = calcSharkDamage(shark, rawDmg * 0.012 * dtSec) // 每秒扣血，不再是每次吃才扣
          shark.hp -= actualDmg
          if (shark.hp <= 0) {
            shark.state = 'dying'
            shark.stateTimer = 0
            shark.rotation = 0
            setSharksVersion(v => v + 1)
          }
        }
      } else if (shark.state === 'dying') {
        shark.rotation = Math.min(Math.PI, (shark.stateTimer / SHARK_DYING_SECONDS) * Math.PI)
        shark.y = Math.min(shark.dormantY + 60, shark.y + dtSec * 30)
        if (shark.stateTimer >= SHARK_DYING_SECONDS) {
          shark.state = 'egg'
          shark.stateTimer = 0
          shark.eggSize = 28 + shark.level * 6
          shark.x = shark.dormantX
          shark.y = shark.dormantY
          setSharksVersion(v => v + 1)
        }
      } else if (shark.state === 'egg') {
        if (shark.stateTimer >= SHARK_EGG_HATCH_SECONDS) {
          shark.state = 'hatching'
          shark.stateTimer = 0
          setSharksVersion(v => v + 1)
        }
      } else if (shark.state === 'hatching') {
        if (shark.stateTimer >= SHARK_HATCHING_SECONDS) {
          sharkIdCounterRef.current += 1
          const newShark = makeLiveShark('shark-' + sharkIdCounterRef.current, window.innerWidth, window.innerHeight)
          newShark.state = 'hunting'
          newShark.eyeOpen = 1
          Object.assign(shark, newShark)
          setSharksVersion(v => v + 1)
        }
      }
    }
  }, true)

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const rawCounts = fishCountsRef.current
    const battleReport = buildBattle(rawCounts)
    const finalCounts = battleReport.finalCounts
    const fishEarned = countTankPopulation(finalCounts)

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

    // 超稀有鱼解锁检测
    const allRecords = loadRecords()
    const totalRare = allRecords.reduce((a, r) => a + (r.rareFish ?? 0), 0) + finalCounts.rare
    const totalGood = allRecords.reduce((a, r) => a + (r.goodFish ?? 0), 0) + finalCounts.good
    const sharkHatched = sharkStateRef.current.filter(s => s.state === 'hunting' && s.exp > 0 && s.id.includes('shark-')).length
    const unlockStats: UnlockStats = {
      totalRareFish: totalRare,
      totalGoodFish: totalGood,
      totalSessions: allRecords.length + 1,
      consecutiveDays: 1, // TODO: 从记录计算连续天数
      sharkHatchedCount: sharkHatched,
      singleSessionRareCount: finalCounts.rare,
      singleSessionHasNoDeadFish: rawCounts.dead === 0,
      coexistRareAndSuperRare: finalCounts.rare > 0 && finalCounts.superRare > 0,
      perfectSessionCount: 0, // TODO: 完美场次统计
      fishSavedFromShark: 0,
      sharkEncounterSurvived: 0,
      sharkDamageTanked: 0,
    }
    const unlockedIds = getUnlockedSuperRareIds()
    for (const entry of SUPER_RARE_DEX) {
      if (!unlockedIds.includes(entry.id) && checkSuperRareUnlock(entry, unlockStats, unlockedIds)) {
        unlockSuperRareId(entry.id)
        setNewSuperRareUnlock(entry.name)
      }
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
        // 每条稀有鱼都记录，取最后一条显示 toast
        firstRareName = rareName
      }
      nextResults.push({
        tier,
        rareFishName: rareName,
        segments: Array.from({ length: 30 }, () => (tier === 'dead' ? 'bad' : tier === 'rare' ? 'good' : tier === 'good' ? 'warn' : 'good')),
      })
    }

    if (firstRareName) {
      rareFishNameRef.current = firstRareName
      setUnlockedRareName(firstRareName)
    }
    fishCountsRef.current = nextCounts
    fishResultsRef.current = nextResults
    setGeneratedCounts(nextCounts)
    setLastTier(tier)
    // 检测合成触发，并真正执行合成（更新 counts）
    const b = buildBattle(nextCounts)
    if (b.superRareSummoned > 0) {
      setMergeAnim('superRare')
      setTimeout(() => setMergeAnim(null), 2800)
      // 真正执行合成：用 finalCounts 更新
      fishCountsRef.current = b.finalCounts
      setGeneratedCounts(b.finalCounts)
      // 为每条新合成的超稀有鱼创建带血量的实例
      const unlockedIds = getUnlockedSuperRareIds()
      for (let si = 0; si < b.superRareSummoned; si++) {
        const dexEntry = pickRandomSuperRare(unlockedIds) ?? SUPER_RARE_DEX[0]
        superRareInstancesRef.current.push({
          id: `sr-${Date.now()}-${si}`,
          hp: 10,
          maxHp: 10,
          healTimer: 0,
          skillCooldown: 0,
          shieldCharges: 0,
          dexId: dexEntry?.id ?? null,
        })
      }
    } else if (b.sharksSummoned > 0) {
      setMergeAnim('shark')
      setTimeout(() => setMergeAnim(null), 2800)
    }
    // 死鱼 >= 10 触发 dormant 鲨鱼苏醒
    const dormantShark = sharkStateRef.current.find(s => s.state === 'dormant')
    if (dormantShark && nextCounts.dead >= 10) {
      dormantShark.state = 'awakening'
      dormantShark.stateTimer = 0
      setSharksVersion(v => v + 1)
    }
  }, [])

  const progressPct = Math.min(100, (progressSeconds / FISH_WINDOW_SECONDS) * 100)
  const progressSegments = 30
  const fishCounts = generatedCounts
  const previewBattle = buildBattle(fishCounts)
  // previewCounts 直接用 ref 里的实时数据，避免 buildBattle 每帧重新合成导致超稀有/稀有数量异常
  const previewCounts = fishCountsRef.current
  const displayedFish = countTankPopulation(previewCounts)
  const subtitle = qualityText(sessionMode, lastTier)

  return (
    <section className="reading-immersive">
      <div className="reading-immersive__tank">
        <AquariumTank
          className="reading-immersive__canvas"
          full
          normalCount={previewCounts.normal}
          goodCount={previewCounts.good}
          rareCount={previewCounts.rare}
          superRareCount={previewCounts.superRare}
          deadCount={previewCounts.dead}
          sharkCount={previewCounts.shark}
          sharks={sharkStateRef.current}
          sharksVersion={sharksVersion}
          tankRef={aquariumRef}
          onFishPositions={(pos) => { fishPositionsRef.current = pos }}
        />
      </div>

      <div className="reading-immersive__overlay">
        {unlockedRareName && (
          <RareUnlockToast
            name={unlockedRareName}
            onDone={() => setUnlockedRareName(null)}
          />
        )}
        {newSuperRareUnlock && (
          <RareUnlockToast
            name={`⭐ 超稀有图鉴解锁：${newSuperRareUnlock}`}
            onDone={() => setNewSuperRareUnlock(null)}
          />
        )}
        {mergeAnim && (
          <div className={`merge-anim merge-anim--${mergeAnim}`} key={mergeAnim + Date.now()}>
            <div className="merge-anim__particles">
              {Array.from({length: 8}).map((_, i) => {
                const angle = (i / 8) * Math.PI * 2
                const px = Math.round(Math.cos(angle) * 52)
                const py = Math.round(Math.sin(angle) * 52)
                return (
                  <span key={i} className="merge-anim__particle" style={{'--i': i, '--px': `${px}px`, '--py': `${py}px`} as React.CSSProperties} />
                )
              })}
            </div>
            <div className="merge-anim__label">
              {mergeAnim === 'superRare' ? '✨ 超级稀有鱼 诞生！' : '💀 怨念鲨鱼 召唤！'}
            </div>
          </div>
        )}
        <header className="reading-hero">
          <div className="reading-hero__copy">
            <div className="reading-hero__eyebrow">{modeUiLabel(sessionMode)}</div>
            {editingName ? (
              <input
                className="page-title reading-hero__title reading-hero__name-input"
                value={nameInput}
                autoFocus
                maxLength={20}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  const name = nameInput.trim() || '未命名玩家'
                  setSessionPlayer(name)
                  sessionPlayerRef.current = name
                  const profile = loadProfile()
                  saveProfile({ ...profile, playerName: name })
                  setEditingName(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
            ) : (
              <h1
                className="page-title reading-hero__title"
                title="点击修改名字"
                style={{ cursor: 'pointer' }}
                onClick={() => { setNameInput(sessionPlayer || ''); setEditingName(true) }}
              >
                {sessionPlayer || '未命名玩家'} ✏️
              </h1>
            )}
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

        {/* 迷你状态栏：始终可见，显示计时 + 进度条 */}
        <div className="reading-mini-hud">
          <div className="reading-mini-hud__progress">
            {Array.from({ length: progressSegments }).map((_, i) => {
              const filled = progressPct >= ((i + 1) / progressSegments) * 100
              const state = segmentStatesRef.current[i]
              return <span key={i} className={`progress-segment ${filled ? `is-filled is-${state}` : ''}`} />
            })}
          </div>
          <div className="reading-mini-hud__info">
            <span>{progressSeconds.toFixed(1)} / 15s</span>
            <span>🐟 {displayedFish}</span>
            <button type="button" className="reading-mini-hud__toggle" onClick={() => setShowHud(v => !v)} aria-label="详情">
              {showHud ? '▾' : '▸'} 详情
            </button>
          </div>
        </div>

        {/* 可折叠 HUD 面板 */}
        {showHud && (
        <div className="reading-hud">
          <section className="card reading-hud-card reading-hud-card--meter">
            <div className="reading-hud-card__label">声音监测</div>
            <div className="reading-hud-card__meter">
              <VolumeMeter level={meterLevel} activeThreshold={settingsRef.current.activeThreshold} quietThreshold={settingsRef.current.quietThreshold} />
            </div>
            <div className="reading-progress-head">
              <span>固定 15 秒结算</span>
              <strong>{progressSeconds.toFixed(1)} / 15s</strong>
            </div>
          </section>

          <section className="card reading-hud-card reading-hud-card--summary">
            <div className="reading-hud-card__label">鱼缸概览</div>
            <div className="reading-hud-stats">
              <div className="reading-stat">
                <span>当前显示</span>
                <strong>{displayedFish}</strong>
              </div>
              <div className="reading-stat">
                <span>普通</span>
                <strong>{previewCounts.normal}</strong>
              </div>
              <div className="reading-stat">
                <span>优质</span>
                <strong>{previewCounts.good}</strong>
              </div>
              <div className="reading-stat">
                <span>稀有</span>
                <strong>{previewCounts.rare}</strong>
              </div>
              <div className="reading-stat">
                <span>超稀有</span>
                <strong>{previewCounts.superRare}</strong>
              </div>
              {superRareInstancesRef.current.length > 0 && (
                <div className="reading-sr-hp-list">
                  {superRareInstancesRef.current.map((sr) => {
                    const ratio = sr.hp / sr.maxHp
                    const barColor = ratio > 0.6 ? '#4ade80' : ratio > 0.3 ? '#facc15' : '#f87171'
                    const dex = SUPER_RARE_DEX.find(e => e.id === sr.dexId)
                    return (
                      <div key={sr.id} className="reading-sr-hp-item">
                        <span className="reading-sr-hp-name">{dex?.name ?? '???'}</span>
                        <div className="reading-sr-hp-bar-bg">
                          <div className="reading-sr-hp-bar-fill" style={{ width: `${ratio * 100}%`, background: barColor }} />
                        </div>
                        <span className="reading-sr-hp-text" style={{ color: barColor }}>{sr.hp}/{sr.maxHp}</span>
                        {sr.shieldCharges > 0 && <span className="reading-sr-shield">🛡×{sr.shieldCharges}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="reading-stat">
                <span>死鱼</span>
                <strong>{previewCounts.dead}</strong>
              </div>
              <div className="reading-stat reading-stat--alert">
                <span>怨念鲨鱼</span>
                <strong>{previewCounts.shark}</strong>
              </div>
            </div>
            <div className="reading-hud-battle-summary">
              <div className="reading-hud-battle-summary__row">
                <span>召出鲨鱼 {previewBattle.sharksSummoned}</span>
                <span>剩余鲨鱼 {previewCounts.shark}</span>
              </div>
              <div className="reading-hud-battle-summary__row">
                <span>吃掉小鱼 {previewBattle.fishEaten.normal + previewBattle.fishEaten.good + previewBattle.fishEaten.rare}</span>
                <span>超稀有阵亡 {previewBattle.superRareDefeated}</span>
              </div>
            </div>
            <div className="reading-hud-card__foot" style={{ marginTop: '0.7rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
              原始生成 {sumGeneratedFish(fishCounts)} 条，当前鱼缸按战斗后数量实时显示。
            </div>
          </section>
        </div>
        )}

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
            <div className="debug-panel__hint" style={{ marginTop: '0.35rem' }}>
              原始：普通 {fishCounts.normal} / 优质 {fishCounts.good} / 稀有 {fishCounts.rare} / 死鱼 {fishCounts.dead}
            </div>
            <div className="debug-panel__hint">
              战后：普通 {previewCounts.normal} / 优质 {previewCounts.good} / 稀有 {previewCounts.rare} / 超稀有 {previewCounts.superRare} / 死鱼 {previewCounts.dead} / 鲨鱼 {previewCounts.shark}
            </div>
            <div className="debug-panel__hint">
              战报：召出鲨鱼 {previewBattle.sharksSummoned} / 击杀鲨鱼 {previewBattle.sharksDefeated} / 超稀有阵亡 {previewBattle.superRareDefeated}
            </div>
            <div className="debug-panel__hint">
              吞食：普通 {previewBattle.fishEaten.normal} / 优质 {previewBattle.fishEaten.good} / 稀有 {previewBattle.fishEaten.rare} / 超稀有 {previewBattle.fishEaten.superRare}
            </div>
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
