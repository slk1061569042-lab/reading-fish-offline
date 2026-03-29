import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RareFishCard } from '../components/RareFishCard'
import { clearAllRecords, listRareFish, loadRecords, recordStats, type ReadingRecord } from '../modules/storage'

function formatShort(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m${s}s`
}

function modeLabel(r: ReadingRecord): string {
  if (r.mode === 'reverse') return '守护'
  if (r.mode === 'study') return '自习'
  return '早读'
}

export function Records() {
  const [records, setRecords] = useState<ReadingRecord[]>(() => loadRecords())
  const stats = useMemo(() => recordStats(records), [records])
  const rareFish = useMemo(() => listRareFish(records), [records])

  const clearAll = () => {
    if (!records.length) return
    if (!window.confirm('确定清空全部本地记录？')) return
    clearAllRecords()
    setRecords([])
  }

  return (
    <>
      <header>
        <h1 className="page-title">养鱼记录</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          数据仅存于本机浏览器（localStorage）。
        </p>
      </header>

      <div className="card">
        <strong>汇总</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.92rem' }}>
          <li>会话次数：{stats.sessionCount}</li>
          <li>累计时长：{formatDuration(stats.totalEffectiveSeconds)}</li>
          <li>累计鱼数：{stats.totalFish}</li>
          <li>普通 / 优质 / 稀有：{stats.totalNormalFish} / {stats.totalGoodFish} / {stats.totalRareFish}</li>
          <li>早读 / 守护 / 自习：{stats.positiveSessions} / {stats.reverseSessions} / {stats.studySessions}</li>
        </ul>
      </div>

      {rareFish.length > 0 && (
        <div className="card">
          <strong>稀有鱼图鉴</strong>
          <div className="rare-grid" style={{ marginTop: '0.75rem' }}>
            {rareFish.map((r) => (
              <RareFishCard
                key={`${r.id}-rare`}
                name={r.rareFishName!}
                subtitle={`${r.playerName || '未命名玩家'} · ${formatShort(r.endedAt)}`}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--muted)' }}>还没有记录，去养一会儿鱼吧。</p>
          <Link to="/" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
            <button type="button">回首页</button>
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.5rem 0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.45rem' }}>
            <strong>最近会话</strong>
            <button type="button" className="secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={clearAll}>清空</button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {records.map((r) => (
              <li key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem 0.75rem', padding: '0.55rem 0.45rem', borderTop: '1px solid rgba(125, 211, 252, 0.12)', fontSize: '0.88rem' }}>
                <div>
                  <div style={{ color: 'var(--muted)' }}>{formatShort(r.endedAt)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                    {(r.playerName || '未命名玩家')} · {modeLabel(r)}
                  </div>
                </div>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>
                  {(r.normalFish ?? r.fishEarned)} / {r.goodFish ?? 0} / {r.rareFish ?? 0} · {formatDuration(r.effectiveSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to="/">
        <button type="button" className="secondary">回首页</button>
      </Link>
    </>
  )
}
