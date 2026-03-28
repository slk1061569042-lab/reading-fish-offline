/** Local persistence: profile, tunable settings, and session records. Migrates legacy v1 records key. */

export type GameMode = 'positive' | 'reverse' | 'study'

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
  playerName?: string
  mode?: GameMode
  fishAtStart?: number
  fishAtEnd?: number
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
    reverseInitialFish: Math.round(
      clampNum(s.reverseInitialFish, DEFAULT_SETTINGS.reverseInitialFish, 0, 24),
    ),
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

function parseSave(raw: string | null): AppSaveV2 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    if (o.v !== 2) return null
    const records = Array.isArray(o.records) ? o.records.filter(isRecord) : []
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
    return parsed.filter(isRecord)
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
  const full: ReadingRecord = { ...entry, id: uid() }
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
  return {
    sessionCount: records.length,
    totalFish,
    totalEffectiveSeconds: totalEffective,
    reverseSessions,
    studySessions,
    positiveSessions,
  }
}
