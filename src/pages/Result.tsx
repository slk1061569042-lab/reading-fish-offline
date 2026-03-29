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
  normalFish: number
  goodFish: number
  rareFish: number
  deadFish: number
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
  if (mode === 'reverse') return '守护鱼缸'
  if (mode === 'study') return '自习养鱼'
  return '早读养鱼'
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
      normalFish: data.normalFish,
      goodFish: data.goodFish,
      rareFish: data.rareFish,
      deadFish: data.deadFish,
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
        <Link to="/"><button type="button">回首页</button></Link>
      </>
    )
  }

  return (
    <>
      <header>
        <h1 className="page-title">本次收获</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          {data.playerName || '未命名玩家'} · {modeLabel(data.mode)} · 已保存到本地记录。
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank normalCount={data.normalFish} goodCount={data.goodFish} rareCount={data.rareFish} deadCount={data.deadFish} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}><strong>{data.fishEarned}</strong> 条结果</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>总时长 {formatDuration(data.effectiveSeconds)}</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--accent-soft)', fontSize: '0.9rem', fontWeight: 600 }}>
            普通鱼 {data.normalFish} · 优质鱼 {data.goodFish} · 稀有鱼 {data.rareFish} · 死鱼 {data.deadFish}
          </p>
          {data.rareFishUnlocked && data.rareFishName ? (
            <div style={{ marginTop: '0.75rem' }}>
              <RareFishCard name={data.rareFishName} subtitle="本轮首条稀有鱼" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          {data.mode === 'study'
            ? '自习养鱼按固定 15 秒结算，干扰严重会生成死鱼。'
            : data.mode === 'positive'
              ? '早读养鱼按固定 15 秒结算，朗读质量过差会生成死鱼。'
              : '守护鱼缸仍保留兼容展示。'}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link to="/"><button type="button">回首页</button></Link>
        <button type="button" className="secondary" onClick={() => navigate('/records')}>查看记录</button>
      </div>
    </>
  )
}
