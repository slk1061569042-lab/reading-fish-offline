import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { RareFishCard } from '../components/RareFishCard'
import { appendRecord, sumFinalTankCounts, type BattleReport, type FishResult, type GameMode } from '../modules/storage'

export type ResultLocationState = {
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

function tierLabel(tier: FishResult['tier']) {
  switch (tier) {
    case 'rare': return '稀有鱼'
    case 'good': return '优质鱼'
    case 'dead': return '死鱼'
    default: return '普通鱼'
  }
}

export function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const data = location.state as ResultLocationState | null
  const savedRef = useRef(false)
  const finalCounts = data?.battleReport.finalCounts
  const totalDisplayed = finalCounts ? sumFinalTankCounts(finalCounts) : 0

  useEffect(() => {
    if (!data || !finalCounts || savedRef.current) return
    savedRef.current = true
    appendRecord({
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      effectiveSeconds: data.effectiveSeconds,
      fishEarned: totalDisplayed,
      normalFish: finalCounts.normal,
      goodFish: finalCounts.good,
      rareFish: finalCounts.rare,
      superRareFish: finalCounts.superRare,
      deadFish: finalCounts.dead,
      sharkCount: finalCounts.shark,
      fishResults: data.fishResults,
      battleReport: data.battleReport,
      playerName: data.playerName,
      mode: data.mode,
      fishAtStart: data.fishAtStart,
      fishAtEnd: totalDisplayed,
      rareFishUnlocked: data.rareFishUnlocked,
      rareFishName: data.rareFishName,
    })
  }, [data, finalCounts, totalDisplayed])

  if (!data || !finalCounts) {
    return <><h1 className="page-title">暂无结果</h1><p style={{ color: 'var(--muted)' }}>请先完成一次会话。</p><Link to="/"><button type="button">回首页</button></Link></>
  }

  return (
    <>
      <header>
        <h1 className="page-title">本次收获</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>{data.playerName || '未命名玩家'} · {modeLabel(data.mode)} · 已保存到本地记录。</p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank normalCount={finalCounts.normal} goodCount={finalCounts.good} rareCount={finalCounts.rare} superRareCount={finalCounts.superRare} deadCount={finalCounts.dead} sharkCount={finalCounts.shark} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}><strong>{totalDisplayed}</strong> 条最终留存</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>总时长 {formatDuration(data.effectiveSeconds)}</p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--accent-soft)', fontSize: '0.9rem', fontWeight: 600 }}>
            普通鱼 {finalCounts.normal} · 优质鱼 {finalCounts.good} · 稀有鱼 {finalCounts.rare} · 超级稀有鱼 {finalCounts.superRare} · 死鱼 {finalCounts.dead} · 怨念鲨鱼 {finalCounts.shark}
          </p>
          {data.rareFishUnlocked && data.rareFishName ? <div style={{ marginTop: '0.75rem' }}><RareFishCard name={data.rareFishName} subtitle="本轮首条稀有鱼" /></div> : null}
        </div>
      </div>

      <div className="card">
        <strong>本轮生成详情</strong>
        <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
          {data.fishResults.map((result, idx) => (
            <div key={idx} style={{ border: '1px solid rgba(125,211,252,0.14)', borderRadius: 12, padding: '0.65rem 0.75rem', background: 'rgba(3,25,39,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <strong>第 {idx + 1} 条：{tierLabel(result.tier)}</strong>
                {result.rareFishName ? <span style={{ color: 'var(--sand)', fontSize: '0.82rem' }}>{result.rareFishName}</span> : null}
              </div>
              <div className="progress-wrap progress-segments" style={{ marginTop: '0.45rem' }}>
                {result.segments.map((seg, i) => <span key={i} className={`progress-segment is-filled is-${seg}`} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <strong>战报</strong>
        <ul style={{ margin: '0.65rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <li>死鱼合成：{data.battleReport.deadFishCombined} 条 → 怨念鲨鱼 {data.battleReport.sharksSummoned} 条</li>
          <li>稀有鱼合体：{data.battleReport.rareFishCombined} 条 → 超级稀有鱼 {data.battleReport.superRareSummoned} 条</li>
          <li>鲨鱼击杀：{data.battleReport.sharksDefeated} 条</li>
          <li>超级稀有鱼阵亡：{data.battleReport.superRareDefeated} 条</li>
          <li>被吃掉：普通鱼 {data.battleReport.fishEaten.normal} · 优质鱼 {data.battleReport.fishEaten.good} · 稀有鱼 {data.battleReport.fishEaten.rare} · 超级稀有鱼 {data.battleReport.fishEaten.superRare}</li>
        </ul>
        <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.8rem' }}>
          {data.battleReport.log.map((line, idx) => {
            const eaten = line.includes('吃掉') || line.includes('吞掉')
            return (
              <div key={idx} style={{ fontSize: '0.86rem', color: eaten ? 'var(--danger)' : 'var(--muted)', padding: '0.45rem 0.55rem', borderRadius: 10, background: eaten ? 'rgba(248,113,113,0.12)' : 'rgba(2, 132, 199, 0.08)' }}>
                {eaten ? `💥 ${line}` : line}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link to="/"><button type="button">回首页</button></Link>
        <button type="button" className="secondary" onClick={() => navigate('/records')}>查看记录</button>
        <button type="button" className="secondary" onClick={() => navigate('/bestiary')}>打开图鉴</button>
      </div>
    </>
  )
}
