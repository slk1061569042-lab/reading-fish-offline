import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { appendRecord } from '../modules/storage'

export type ResultLocationState = {
  startedAt: string
  endedAt: string
  effectiveSeconds: number
  fishEarned: number
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s.toFixed(0)} 秒`
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

  const showFish = Math.min(24, data.fishEarned)

  return (
    <>
      <header>
        <h1 className="page-title">本次收获</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          已保存到本地记录。
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={Math.max(1, showFish)} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1.1rem' }}>
            <strong>{data.fishEarned}</strong> 条鱼
          </p>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            有效阅读 {formatDuration(data.effectiveSeconds)}
          </p>
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
