import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { appendRecord, type GameMode } from '../modules/storage'

export type ResultLocationState = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
  playerName: string
  mode: GameMode
  fishAtStart?: number
  fishAtEnd?: number
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s.toFixed(0)} 秒`
}

function modeLabel(mode: GameMode): string {
  return mode === 'positive' ? '正向模式' : '守护模式'
}

export function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const data = location.state as ResultLocationState | null
  const savedRef = useRef(false)

  useEffect(() => {
    if (!data || savedRef.current) return
    savedRef.current = true
    appendRecord({
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      effectiveSeconds: data.effectiveSeconds,
      fishEarned: data.fishEarned,
      playerName: data.playerName,
      mode: data.mode,
      fishAtStart: data.fishAtStart,
      fishAtEnd: data.fishAtEnd,
    })
  }, [data])

  if (!data) {
    return (
      <>
        <h1 className="page-title">暂无结果</h1>
        <p style={{ color: 'var(--muted)' }}>请先完成一次阅读会话。</p>
        <Link to="/reading">
          <button type="button">去阅读</button>
        </Link>
      </>
    )
  }

  const showFish = Math.min(24, Math.max(1, data.fishEarned))
  const reverseDelta =
    data.mode === 'reverse' && typeof data.fishAtStart === 'number' && typeof data.fishAtEnd === 'number'
      ? data.fishAtEnd - data.fishAtStart
      : null

  return (
    <>
      <header>
        <h1 className="page-title">本次收获</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          {data.playerName || '未命名玩家'} · {modeLabel(data.mode)} · 已保存到本地记录。
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={showFish} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>
            <strong>{data.fishEarned}</strong> 条鱼
          </p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            有效阅读 {formatDuration(data.effectiveSeconds)}
          </p>
          {reverseDelta !== null && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
              守护结果：起始 {data.fishAtStart} 条 → 结束 {data.fishAtEnd} 条（{reverseDelta >= 0 ? '+' : ''}{reverseDelta}）
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link to="/reading">
          <button type="button">再读一轮</button>
        </Link>
        <button type="button" className="secondary" onClick={() => navigate('/records')}>
          查看记录
        </button>
        <Link to="/">
          <button type="button" className="secondary">
            回首页
          </button>
        </Link>
      </div>
    </>
  )
}
