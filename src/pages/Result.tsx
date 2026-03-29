import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { RareFishCard } from '../components/RareFishCard'
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
  rareFishUnlocked?: boolean
  rareFishName?: string
  rareFishBroken?: boolean
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s.toFixed(0)} 秒`
}

function modeLabel(mode: GameMode): string {
  if (mode === 'reverse') return '守护模式'
  if (mode === 'study') return '自习模式'
  return '朗读模式'
}

function stageLabel(sec: number) {
  if (sec >= 1200) return '超长坚持'
  if (sec >= 900) return '长时专注'
  if (sec >= 600) return '稳定鱼群'
  if (sec >= 300) return '进入节奏'
  return '起步中'
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
      rareFishUnlocked: data.rareFishUnlocked,
      rareFishName: data.rareFishName,
    })
  }, [data])

  if (!data) {
    return (
      <>
        <h1 className="page-title">暂无结果</h1>
        <p style={{ color: 'var(--muted)' }}>请先完成一次会话。</p>
        <Link to="/reading"><button type="button">去开始</button></Link>
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
          <p style={{ margin: 0, fontSize: '1.1rem' }}><strong>{data.fishEarned}</strong> 条普通鱼</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>有效时长 {formatDuration(data.effectiveSeconds)}</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--accent-soft)', fontSize: '0.9rem', fontWeight: 600 }}>达成阶段：{stageLabel(data.effectiveSeconds)}</p>
          {data.rareFishUnlocked ? (
            <div style={{ marginTop: '0.75rem' }}>
              <RareFishCard name={data.rareFishName!} subtitle="本节课解锁" />
            </div>
          ) : data.mode === 'study' ? (
            <p style={{ margin: '0.35rem 0 0', color: data.rareFishBroken ? 'var(--warn)' : 'var(--muted)', fontSize: '0.9rem' }}>
              {data.rareFishBroken ? '中途有声音打断，本轮未拿到稀有鱼。' : '本轮未达到 20 分钟连续安静。'}
            </p>
          ) : null}
          {reverseDelta !== null && (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
              守护结果：起始 {data.fishAtStart} 条 → 结束 {data.fishAtEnd} 条（{reverseDelta >= 0 ? '+' : ''}{reverseDelta}）
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link to="/reading"><button type="button">再来一轮</button></Link>
        <button type="button" className="secondary" onClick={() => navigate('/records')}>查看记录</button>
        <Link to="/"><button type="button" className="secondary">回首页</button></Link>
      </div>
    </>
  )
}
