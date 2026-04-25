/** Local persistence: profile, tunable settings, and session records. Migrates legacy v1 records key. */

export type GameMode = 'positive' | 'reverse' | 'study'
export type SegmentState = 'good' | 'warn' | 'bad'
export type FishTier = 'normal' | 'good' | 'rare' | 'superRare' | 'dead'
export type BestiarySpecies = 'normal' | 'good' | 'rare' | 'superRare' | 'dead' | 'shark'
export type RareFishSpeciesId = 'dawn-butterfly' | 'calm-gold' | 'moon-veil' | 'sunset-star' | 'abyss-dark' | 'aurora-frost' | 'crimson-blaze' | 'sky-cloud'

export type FishResult = {
  tier: Exclude<FishTier, 'superRare'>
  rareFishName?: string
  segments: SegmentState[]
}

export type BattleReport = {
  deadFishCombined: number
  rareFishCombined: number
  sharksSummoned: number
  superRareSummoned: number
  sharksDefeated: number
  superRareDefeated: number
  fishEaten: {
    normal: number
    good: number
    rare: number
    superRare: number
  }
  log: string[]
  finalCounts: {
    normal: number
    good: number
    rare: number
    superRare: number
    dead: number
    shark: number
  }
}

export type FinalTankCounts = BattleReport['finalCounts']

export type BestiaryEntry = {
  id: BestiarySpecies
  name: string
  unlocked: boolean
  unlockedAt?: string
  count: number
  description: string
  unlockHint: string
}

export type RareFishDexEntry = {
  id: RareFishSpeciesId
  name: string
  order: number
  unlocked: boolean
  unlockedAt?: string
  count: number
  skill: string
  description: string
  unlockHint: string
}

const RARE_FISH_DEX: Array<{
  id: RareFishSpeciesId
  name: string
  order: number
  skill: string
  description: string
  unlockHint: string
}> = [
  {
    id: 'dawn-butterfly',
    name: '晨光蝶尾',
    order: 1,
    skill: '晨翼反击：参与对怨念鲨鱼的第一轮反击。',
    description: '偏进攻型的稀有鱼，出现时代表这一轮朗读质量非常稳。',
    unlockHint: '第一次真正刷出晨光蝶尾。',
  },
  {
    id: 'calm-gold',
    name: '静海流金',
    order: 2,
    skill: '静海护场：提高鱼群在混战中的稳定性。',
    description: '偏防守型的稀有鱼，金色流纹明显，适合作为队伍稳定器。',
    unlockHint: '第一次真正刷出静海流金。',
  },
  {
    id: 'moon-veil',
    name: '银月纱鳍',
    order: 3,
    skill: '月纱加护：为高阶鱼提供额外生存加成。',
    description: '偏辅助型的稀有鱼，银白鳍纱明显，适合后排支援。',
    unlockHint: '第一次真正刷出银月纱鳍。',
  },
  {
    id: 'sunset-star',
    name: '晚霞星鳞',
    order: 4,
    skill: '霞鳞爆发：在关键回合提供更高伤害。',
    description: '偏爆发型的稀有鱼，晚霞色鳞片明显，是高压回合的输出点。',
    unlockHint: '第一次真正刷出晚霞星鳞。',
  },
  {
    id: 'abyss-dark',
    name: '深渊暗鳞',
    order: 5,
    skill: '深渊压制：降低怨念鲨鱼的攻击力一回合。',
    description: '来自深海的神秘个体，暗色鳞片几乎不反光，擅长压制强敌。',
    unlockHint: '第一次真正刷出深渊暗鳞。',
  },
  {
    id: 'aurora-frost',
    name: '极光霜鳍',
    order: 6,
    skill: '霜鳍护盾：为鱼群提供一次格挡，减少被吃数量。',
    description: '极地冰川孕育的稀有种，霜蓝色鳍膜在光下折射极光色彩。',
    unlockHint: '第一次真正刷出极光霜鳍。',
  },
  {
    id: 'crimson-blaze',
    name: '赤焰烈尾',
    order: 7,
    skill: '烈焰冲锋：首轮攻击伤害翻倍。',
    description: '火红色尾鳍如烈焰，爆发力极强，是近战主力。',
    unlockHint: '第一次真正刷出赤焰烈尾。',
  },
  {
    id: 'sky-cloud',
    name: '苍穹云斑',
    order: 8,
    skill: '云斑迷踪：使己方鱼群本回合有几率躲避攻击。',
    description: '身上布满云状斑纹，行动飘逸，擅长规避伤害。',
    unlockHint: '第一次真正刷出苍穹云斑。',
  },
]

function countGeneratedTier(record: ReadingRecord, tier: Exclude<FishTier, 'superRare'>): number {
  if (record.fishResults?.length) {
    return record.fishResults.filter((item) => item.tier === tier).length
  }
  if (tier === 'normal') return record.normalFish ?? 0
  if (tier === 'good') return record.goodFish ?? 0
  if (tier === 'rare') return record.rareFish ?? 0
  return record.deadFish ?? 0
}

function hasGeneratedRare(record: ReadingRecord): boolean {
  return countGeneratedTier(record, 'rare') > 0 || !!record.rareFishUnlocked || !!record.rareFishName
}

export type UserProfile = {
  playerName: string
  mode: GameMode
}

export type GameSettings = {
  mode: GameMode
  activeThreshold: number
  quietThreshold: number
  quietHoldMs: number
  fishEverySeconds: number
  reverseInitialFish: number
}

export type ReadingRecord = {
  id: string
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  normalFish?: number
  goodFish?: number
  rareFish?: number
  superRareFish?: number
  deadFish?: number
  sharkCount?: number
  fishResults?: FishResult[]
  battleReport?: BattleReport
  playerName?: string
  mode?: GameMode
  fishAtStart?: number
  fishAtEnd?: number
  rareFishName?: string
  rareFishUnlocked?: boolean
}

export type AppSaveV2 = {
  v: 2
  profile: UserProfile
  settings: GameSettings
  records: ReadingRecord[]
}

const LEGACY_RECORDS_KEY = 'reading-fish.records.v1'
const STORAGE_KEY = 'reading-fish.app.v2'

export const DEFAULT_PROFILE: UserProfile = {
  playerName: '',
  mode: 'positive',
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'positive',
  activeThreshold: 0.009,
  quietThreshold: 0.0045,
  quietHoldMs: 450,
  fishEverySeconds: 15,
  reverseInitialFish: 5,
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isSegmentState(x: unknown): x is SegmentState {
  return x === 'good' || x === 'warn' || x === 'bad'
}

function isFishTier(x: unknown): x is FishTier {
  return x === 'normal' || x === 'good' || x === 'rare' || x === 'superRare' || x === 'dead'
}

function isFishResult(x: unknown): x is FishResult {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return isFishTier(o.tier) && o.tier !== 'superRare' && Array.isArray(o.segments) && o.segments.every(isSegmentState)
}

function isBattleReport(x: unknown): x is BattleReport {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return Array.isArray(o.log)
}

function isRecord(x: unknown): x is ReadingRecord {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.startedAt === 'string' &&
    typeof o.endedAt === 'string' &&
    typeof o.effectiveSeconds === 'number' &&
    typeof o.fishEarned === 'number'
  )
}

function isGameMode(x: unknown): x is GameMode {
  return x === 'positive' || x === 'reverse' || x === 'study'
}

function clampSettings(s: Partial<GameSettings>): GameSettings {
  const active = clampNum(s.activeThreshold, DEFAULT_SETTINGS.activeThreshold, 0.001, 0.08)
  let quiet = clampNum(s.quietThreshold, DEFAULT_SETTINGS.quietThreshold, 0.0005, 0.06)
  if (quiet >= active) quiet = Math.max(0.0005, active * 0.75)
  return {
    mode: isGameMode(s.mode) ? s.mode : DEFAULT_SETTINGS.mode,
    activeThreshold: active,
    quietThreshold: quiet,
    quietHoldMs: Math.round(clampNum(s.quietHoldMs, DEFAULT_SETTINGS.quietHoldMs, 100, 3000)),
    fishEverySeconds: clampNum(s.fishEverySeconds, DEFAULT_SETTINGS.fishEverySeconds, 3, 120),
    reverseInitialFish: Math.round(clampNum(s.reverseInitialFish, DEFAULT_SETTINGS.reverseInitialFish, 0, 24)),
  }
}

function clampNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeProfile(p: Partial<UserProfile> | undefined): UserProfile {
  const name = typeof p?.playerName === 'string' ? p.playerName.slice(0, 48) : DEFAULT_PROFILE.playerName
  const mode = isGameMode(p?.mode) ? p.mode : DEFAULT_PROFILE.mode
  return { playerName: name.trim(), mode }
}

function normalizeRecord(r: ReadingRecord): ReadingRecord {
  return {
    ...r,
    fishResults: Array.isArray(r.fishResults) ? r.fishResults.filter(isFishResult) : undefined,
    battleReport: isBattleReport(r.battleReport) ? r.battleReport : undefined,
  }
}

function sanitizeCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

function normalizeFinalTankCounts(value: Partial<FinalTankCounts> | undefined): FinalTankCounts {
  return {
    normal: sanitizeCount(value?.normal),
    good: sanitizeCount(value?.good),
    rare: sanitizeCount(value?.rare),
    superRare: sanitizeCount(value?.superRare),
    dead: sanitizeCount(value?.dead),
    shark: sanitizeCount(value?.shark),
  }
}

export function sumFinalTankCounts(counts: FinalTankCounts): number {
  return counts.normal + counts.good + counts.rare + counts.superRare + counts.dead + counts.shark
}

export function getRecordFinalCounts(record: ReadingRecord): FinalTankCounts {
  if (record.battleReport?.finalCounts) return normalizeFinalTankCounts(record.battleReport.finalCounts)
  return normalizeFinalTankCounts({
    normal: record.normalFish ?? record.fishEarned,
    good: record.goodFish,
    rare: record.rareFish,
    superRare: record.superRareFish,
    dead: record.deadFish,
    shark: record.sharkCount,
  })
}

function parseSave(raw: string | null): AppSaveV2 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    if (o.v !== 2) return null
    const records = Array.isArray(o.records) ? o.records.filter(isRecord).map(normalizeRecord) : []
    const profile = normalizeProfile(o.profile as Partial<UserProfile> | undefined)
    const settings = clampSettings((o.settings as Partial<GameSettings>) ?? {})
    return { v: 2, profile, settings, records }
  } catch {
    return null
  }
}

function loadLegacyRecordsOnly(): ReadingRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_RECORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord).map(normalizeRecord)
  } catch {
    return []
  }
}

export function loadAppSave(): AppSaveV2 {
  const existing = parseSave(localStorage.getItem(STORAGE_KEY))
  if (existing) return existing

  const legacy = loadLegacyRecordsOnly()
  const save: AppSaveV2 = {
    v: 2,
    profile: { ...DEFAULT_PROFILE },
    settings: { ...DEFAULT_SETTINGS },
    records: legacy,
  }
  persist(save)
  if (legacy.length) {
    try {
      localStorage.removeItem(LEGACY_RECORDS_KEY)
    } catch {
      /* ignore */
    }
  }
  return save
}

function persist(save: AppSaveV2): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

export function loadProfile(): UserProfile {
  const save = loadAppSave()
  if (!save.profile.mode && save.settings.mode) {
    save.profile.mode = save.settings.mode
    persist(save)
  }
  return { ...save.profile }
}

export function saveProfile(profile: UserProfile): void {
  const s = loadAppSave()
  s.profile = normalizeProfile(profile)
  persist(s)
}

export function loadSettings(): GameSettings {
  const save = loadAppSave()
  if (!isGameMode(save.settings.mode) && isGameMode(save.profile.mode)) {
    save.settings.mode = save.profile.mode
    persist(save)
  }
  return { ...save.settings }
}

export function saveSettings(settings: GameSettings): void {
  const s = loadAppSave()
  s.settings = clampSettings(settings)
  s.profile.mode = s.settings.mode
  persist(s)
}

export function resetSettingsToDefault(): GameSettings {
  const s = loadAppSave()
  s.settings = { ...DEFAULT_SETTINGS }
  s.profile.mode = DEFAULT_SETTINGS.mode
  persist(s)
  return { ...DEFAULT_SETTINGS }
}

export function loadRecords(): ReadingRecord[] {
  return [...loadAppSave().records]
}

export function appendRecord(entry: Omit<ReadingRecord, 'id'>): ReadingRecord {
  const s = loadAppSave()
  const full: ReadingRecord = normalizeRecord({ ...entry, id: uid() })
  s.records = [full, ...s.records]
  persist(s)
  return full
}

export function clearAllRecords(): void {
  const s = loadAppSave()
  s.records = []
  persist(s)
}

export function recordStats(records: ReadingRecord[]) {
  const totalFish = records.reduce((acc, r) => acc + sumFinalTankCounts(getRecordFinalCounts(r)), 0)
  const totalEffective = records.reduce((acc, r) => acc + r.effectiveSeconds, 0)
  const reverseSessions = records.filter((r) => r.mode === 'reverse').length
  const studySessions = records.filter((r) => r.mode === 'study').length
  const positiveSessions = records.filter((r) => r.mode === 'positive' || r.mode === undefined).length
  const rareFishSessions = records.filter((r) => r.rareFishUnlocked).length
  const totalNormalFish = records.reduce((acc, r) => acc + getRecordFinalCounts(r).normal, 0)
  const totalGoodFish = records.reduce((acc, r) => acc + getRecordFinalCounts(r).good, 0)
  const totalRareFish = records.reduce((acc, r) => acc + getRecordFinalCounts(r).rare, 0)
  const totalSuperRareFish = records.reduce((acc, r) => acc + getRecordFinalCounts(r).superRare, 0)
  const totalDeadFish = records.reduce((acc, r) => acc + getRecordFinalCounts(r).dead, 0)
  const totalSharks = records.reduce((acc, r) => acc + getRecordFinalCounts(r).shark, 0)
  const totalSharksDefeated = records.reduce((acc, r) => acc + (r.battleReport?.sharksDefeated ?? 0), 0)
  return {
    sessionCount: records.length,
    totalFish,
    totalEffectiveSeconds: totalEffective,
    reverseSessions,
    studySessions,
    positiveSessions,
    rareFishSessions,
    totalNormalFish,
    totalGoodFish,
    totalRareFish,
    totalSuperRareFish,
    totalDeadFish,
    totalSharks,
    totalSharksDefeated,
  }
}

export function listRareFish(records: ReadingRecord[]): ReadingRecord[] {
  return records.filter((r) => hasGeneratedRare(r) && r.rareFishName)
}

export function latestRareFish(records: ReadingRecord[]): ReadingRecord | null {
  return listRareFish(records)[0] ?? null
}

function findRareFishUnlockedAt(records: ReadingRecord[], rareFishName: string): string | undefined {
  const ordered = [...records].reverse()
  for (const record of ordered) {
    const matched = record.fishResults?.some((item) => item.tier === 'rare' && item.rareFishName === rareFishName)
    if (matched) return record.endedAt
    if (record.rareFishName === rareFishName && hasGeneratedRare(record)) return record.endedAt
  }
  return undefined
}

export function getRareFishDex(records: ReadingRecord[]): RareFishDexEntry[] {
  return RARE_FISH_DEX.map((spec) => {
    let count = 0
    for (const record of records) {
      if (record.fishResults?.length) {
        count += record.fishResults.filter((item) => item.tier === 'rare' && item.rareFishName === spec.name).length
      } else if (record.rareFishName === spec.name && hasGeneratedRare(record)) {
        count += Math.max(1, record.rareFish ?? 0)
      }
    }

    return {
      id: spec.id,
      name: spec.name,
      order: spec.order,
      unlocked: count > 0,
      unlockedAt: count > 0 ? findRareFishUnlockedAt(records, spec.name) : undefined,
      count,
      skill: spec.skill,
      description: spec.description,
      unlockHint: spec.unlockHint,
    }
  })
}

function firstUnlockedAt(records: ReadingRecord[], predicate: (r: ReadingRecord) => boolean): string | undefined {
  const match = [...records].reverse().find(predicate)
  return match?.endedAt
}

export function getBestiary(records: ReadingRecord[]): BestiaryEntry[] {
  const totalNormal = records.reduce((acc, r) => acc + countGeneratedTier(r, 'normal'), 0)
  const totalGood = records.reduce((acc, r) => acc + countGeneratedTier(r, 'good'), 0)
  const totalRare = records.reduce((acc, r) => acc + countGeneratedTier(r, 'rare'), 0)
  const totalSuperRare = records.reduce((acc, r) => acc + (r.battleReport?.superRareSummoned ?? 0), 0)
  const totalDead = records.reduce((acc, r) => acc + countGeneratedTier(r, 'dead'), 0)
  const totalShark = records.reduce((acc, r) => acc + (r.battleReport?.sharksSummoned ?? 0), 0)

  return [
    {
      id: 'normal',
      name: '普通鱼',
      unlocked: totalNormal > 0,
      unlockedAt: firstUnlockedAt(records, (r) => countGeneratedTier(r, 'normal') > 0),
      count: totalNormal,
      description: '基础收获，稳定养成的主力鱼群。',
      unlockHint: '完成一次普通质量结算。',
    },
    {
      id: 'good',
      name: '优质鱼',
      unlocked: totalGood > 0,
      unlockedAt: firstUnlockedAt(records, (r) => countGeneratedTier(r, 'good') > 0),
      count: totalGood,
      description: '更活跃更快的鱼，表现稳定时获得。',
      unlockHint: '提升朗读/自习质量，拿到优质结算。',
    },
    {
      id: 'rare',
      name: '稀有鱼',
      unlocked: records.some(hasGeneratedRare),
      unlockedAt: firstUnlockedAt(records, (r) => hasGeneratedRare(r)),
      count: totalRare,
      description: '具备反击能力的珍稀个体。',
      unlockHint: '拿到高质量结算，解锁第一条稀有鱼。',
    },
    {
      id: 'superRare',
      name: '超级稀有鱼',
      unlocked: totalSuperRare > 0,
      unlockedAt: firstUnlockedAt(records, (r) => (r.battleReport?.superRareSummoned ?? 0) > 0),
      count: totalSuperRare,
      description: '10 条稀有鱼合体后诞生，拥有生命值和攻击力。',
      unlockHint: '累计 10 条稀有鱼完成合体。',
    },
    {
      id: 'dead',
      name: '死鱼',
      unlocked: totalDead > 0,
      unlockedAt: firstUnlockedAt(records, (r) => countGeneratedTier(r, 'dead') > 0),
      count: totalDead,
      description: '质量崩坏时出现，也是怨念鲨鱼的合成材料。',
      unlockHint: '经历一次失败结算。',
    },
    {
      id: 'shark',
      name: '怨念鲨鱼',
      unlocked: totalShark > 0,
      unlockedAt: firstUnlockedAt(records, (r) => (r.battleReport?.sharksSummoned ?? 0) > 0),
      count: totalShark,
      description: '由 10 条死鱼合成，会追猎鱼群并参与战斗。',
      unlockHint: '累计 10 条死鱼，召出第一条怨念鲨鱼。',
    },
  ]
}

// ── Achievement system ──
export type AchievementId =
  | 'first-session'
  | 'total-30min'
  | 'total-2h'
  | 'total-5h'
  | 'fish-50'
  | 'fish-200'
  | 'fish-1000'
  | 'rare-first'
  | 'rare-10'
  | 'all-rare-species'
  | 'super-rare-first'
  | 'super-rare-3'
  | 'shark-first'
  | 'shark-defeated'
  | 'shark-5-defeated'
  | 'no-dead-session'
  | 'sessions-10'
  | 'sessions-30'

export type AchievementEntry = {
  id: AchievementId
  name: string
  description: string
  unlockHint: string
  unlocked: boolean
  unlockedAt?: string
  icon: string
}

export function getAchievements(records: ReadingRecord[]): AchievementEntry[] {
  const totalSeconds = records.reduce((a, r) => a + r.effectiveSeconds, 0)
  const totalFish = records.reduce((a, r) => a + sumFinalTankCounts(getRecordFinalCounts(r)), 0)
  const totalRare = records.reduce((a, r) => a + countGeneratedTier(r, 'rare'), 0)
  const totalSuperRare = records.reduce((a, r) => a + (r.battleReport?.superRareSummoned ?? 0), 0)
  const totalSharks = records.reduce((a, r) => a + (r.battleReport?.sharksSummoned ?? 0), 0)
  const totalSharksDefeated = records.reduce((a, r) => a + (r.battleReport?.sharksDefeated ?? 0), 0)
  const rareDex = getRareFishDex(records)
  const allRareUnlocked = rareDex.every(e => e.unlocked)
  const hasNoDeadSession = records.some(r => countGeneratedTier(r, 'dead') === 0 && r.effectiveSeconds >= 30)

  function first(pred: (r: ReadingRecord) => boolean): string | undefined {
    return [...records].reverse().find(pred)?.endedAt
  }

  const defs: Array<Omit<AchievementEntry, 'unlocked' | 'unlockedAt'> & { check: boolean; when?: string }> = [
    { id: 'first-session', name: '初次下水', icon: '🐠', description: '完成第一次养鱼会话。', unlockHint: '完成任意一次养鱼。', check: records.length >= 1, when: records.length >= 1 ? first(() => true) : undefined },
    { id: 'sessions-10', name: '坚持十回', icon: '📅', description: '累计完成 10 次养鱼会话。', unlockHint: '累计完成 10 次会话。', check: records.length >= 10, when: records.length >= 10 ? records[records.length - 10]?.endedAt : undefined },
    { id: 'sessions-30', name: '月度鱼农', icon: '🗓️', description: '累计完成 30 次养鱼会话。', unlockHint: '累计完成 30 次会话。', check: records.length >= 30, when: records.length >= 30 ? records[records.length - 30]?.endedAt : undefined },
    { id: 'total-30min', name: '半小时达人', icon: '⏱️', description: '累计有效时长达到 30 分钟。', unlockHint: '累计养鱼 30 分钟。', check: totalSeconds >= 1800, when: first((_r, idx = 0, arr = records) => { let s = 0; for (let i = arr.length - 1; i >= 0; i--) { s += arr[i].effectiveSeconds; if (s >= 1800) { idx = i; break; } } return idx === records.indexOf(_r) && totalSeconds >= 1800 }) },
    { id: 'total-2h', name: '两小时专注', icon: '🕰️', description: '累计有效时长达到 2 小时。', unlockHint: '累计养鱼 2 小时。', check: totalSeconds >= 7200 },
    { id: 'total-5h', name: '五小时鱼王', icon: '👑', description: '累计有效时长达到 5 小时。', unlockHint: '累计养鱼 5 小时。', check: totalSeconds >= 18000 },
    { id: 'fish-50', name: '小鱼池', icon: '🐟', description: '累计结算鱼数达到 50 条。', unlockHint: '累计获得 50 条鱼。', check: totalFish >= 50 },
    { id: 'fish-200', name: '中型鱼缸', icon: '🐡', description: '累计结算鱼数达到 200 条。', unlockHint: '累计获得 200 条鱼。', check: totalFish >= 200 },
    { id: 'fish-1000', name: '万鱼朝宗', icon: '🌊', description: '累计结算鱼数达到 1000 条。', unlockHint: '累计获得 1000 条鱼。', check: totalFish >= 1000 },
    { id: 'rare-first', name: '初见稀有', icon: '✨', description: '第一次获得稀有鱼。', unlockHint: '拿到第一条稀有鱼。', check: totalRare >= 1, when: first(r => countGeneratedTier(r, 'rare') > 0) },
    { id: 'rare-10', name: '稀有常客', icon: '💎', description: '累计获得 10 条稀有鱼。', unlockHint: '累计获得 10 条稀有鱼。', check: totalRare >= 10 },
    { id: 'all-rare-species', name: '四鱼齐聚', icon: '🌟', description: '解锁全部 4 种稀有鱼。', unlockHint: '每种稀有鱼各出现一次。', check: allRareUnlocked },
    { id: 'super-rare-first', name: '传说诞生', icon: '🦋', description: '首次触发 10 稀有鱼合体，生成超级稀有鱼。', unlockHint: '累计 10 条稀有鱼完成合体。', check: totalSuperRare >= 1, when: first(r => (r.battleReport?.superRareSummoned ?? 0) > 0) },
    { id: 'super-rare-3', name: '三传并立', icon: '🏆', description: '累计召出 3 条超级稀有鱼。', unlockHint: '累计召出 3 条超级稀有鱼。', check: totalSuperRare >= 3 },
    { id: 'shark-first', name: '鲨鱼降临', icon: '🦈', description: '第一次因死鱼召出怨念鲨鱼。', unlockHint: '累计 10 条死鱼，召出怨念鲨鱼。', check: totalSharks >= 1, when: first(r => (r.battleReport?.sharksSummoned ?? 0) > 0) },
    { id: 'shark-defeated', name: '鱼群反杀', icon: '⚔️', description: '首次击杀怨念鲨鱼。', unlockHint: '让稀有鱼或超级稀有鱼击杀一条怨念鲨鱼。', check: totalSharksDefeated >= 1, when: first(r => (r.battleReport?.sharksDefeated ?? 0) > 0) },
    { id: 'shark-5-defeated', name: '五杀鲨神', icon: '🗡️', description: '累计击杀 5 条怨念鲨鱼。', unlockHint: '累计击杀 5 条怨念鲨鱼。', check: totalSharksDefeated >= 5 },
    { id: 'no-dead-session', name: '零死亡', icon: '🛡️', description: '完成一次没有死鱼的养鱼会话（至少 30 秒）。', unlockHint: '一次会话全程没有死鱼。', check: hasNoDeadSession, when: first(r => countGeneratedTier(r, 'dead') === 0 && r.effectiveSeconds >= 30) },
  ]

  return defs.map(({ check, when, ...rest }) => ({
    ...rest,
    unlocked: check,
    unlockedAt: check ? when : undefined,
  }))
}
