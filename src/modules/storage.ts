/** Local persistence: profile, tunable settings, and session records. Migrates legacy v1 records key. */

export type GameMode = 'positive' | 'reverse' | 'study'
export type SegmentState = 'good' | 'warn' | 'bad'
export type FishTier = 'normal' | 'good' | 'rare' | 'superRare' | 'dead'
export type BestiarySpecies = 'normal' | 'good' | 'rare' | 'superRare' | 'dead' | 'shark'

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

export type BestiaryEntry = {
  id: BestiarySpecies
  name: string
  unlocked: boolean
  unlockedAt?: string
  count: number
  description: string
  unlockHint: string
}

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
  activeThreshold: 0.012,
  quietThreshold: 0.006,
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
  const totalFish = records.reduce((acc, r) => acc + r.fishEarned, 0)
  const totalEffective = records.reduce((acc, r) => acc + r.effectiveSeconds, 0)
  const reverseSessions = records.filter((r) => r.mode === 'reverse').length
  const studySessions = records.filter((r) => r.mode === 'study').length
  const positiveSessions = records.filter((r) => r.mode === 'positive' || r.mode === undefined).length
  const rareFishSessions = records.filter((r) => r.rareFishUnlocked).length
  const totalNormalFish = records.reduce((acc, r) => acc + (r.normalFish ?? r.fishEarned), 0)
  const totalGoodFish = records.reduce((acc, r) => acc + (r.goodFish ?? 0), 0)
  const totalRareFish = records.reduce((acc, r) => acc + (r.rareFish ?? 0), 0)
  const totalSuperRareFish = records.reduce((acc, r) => acc + (r.superRareFish ?? r.battleReport?.finalCounts.superRare ?? 0), 0)
  const totalDeadFish = records.reduce((acc, r) => acc + (r.deadFish ?? 0), 0)
  const totalSharks = records.reduce((acc, r) => acc + (r.sharkCount ?? r.battleReport?.finalCounts.shark ?? 0), 0)
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
