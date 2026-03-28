export type ReadingRecord = {
  id: string
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
}

const KEY = 'reading-fish.records.v1'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadRecords(): ReadingRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord)
  } catch {
    return []
  }
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

export function appendRecord(entry: Omit<ReadingRecord, 'id'>): ReadingRecord {
  const full: ReadingRecord = { ...entry, id: uid() }
  const next = [full, ...loadRecords()]
  localStorage.setItem(KEY, JSON.stringify(next))
  return full
}

export function recordStats(records: ReadingRecord[]) {
  const totalFish = records.reduce((s, r) => s + r.fishEarned, 0)
  const totalEffective = records.reduce((s, r) => s + r.effectiveSeconds, 0)
  return {
    sessionCount: records.length,
    totalFish,
    totalEffectiveSeconds: totalEffective,
  }
}
