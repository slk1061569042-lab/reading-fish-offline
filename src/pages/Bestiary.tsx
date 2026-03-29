import { Link } from 'react-router-dom'
import { getBestiary, getRareFishDex, latestRareFish, loadRecords } from '../modules/storage'
import { RareFishCard } from '../components/RareFishCard'

function formatShort(iso?: string) {
  if (!iso) return '未解锁'
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

export function Bestiary() {
  const records = loadRecords()
  const entries = getBestiary(records)
  const latestRare = latestRareFish(records)
  const rareFishDex = getRareFishDex(records)

  return (
    <>
      <header>
        <h1 className="page-title">鱼类图鉴</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>图鉴解锁按“实际获得过/生成过”计算，不按最终剩余数量卡你。</p>
      </header>

      {latestRare ? (
        <div className="card">
          <strong>最近获得的稀有鱼</strong>
          <div style={{ marginTop: '0.75rem' }}>
            <RareFishCard name={latestRare.rareFishName!} subtitle={`${latestRare.playerName || '未命名玩家'} · ${formatShort(latestRare.endedAt)}`} compact />
          </div>
        </div>
      ) : null}

      <div className="card">
        <strong>稀有鱼图鉴（按解锁顺序）</strong>
        <p style={{ margin: '0.45rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>只有真正出现过的稀有鱼才会解锁；没刷出来的只显示剪影和解锁条件。</p>
        <div className="rare-grid" style={{ marginTop: '0.75rem' }}>
          {rareFishDex.map((entry) => (
            <div key={entry.id} className={`card bestiary-card ${entry.unlocked ? 'is-unlocked' : 'is-locked'}`} style={{ margin: 0 }}>
              {entry.unlocked ? (
                <RareFishCard name={entry.name} subtitle={`#${entry.order} · 已出现 ${entry.count} 次`} compact />
              ) : (
                <div className="rare-card compact" style={{ opacity: 0.55 }}>
                  <div className="rare-card__art">
                    <div className="bestiary-card__lock">?</div>
                  </div>
                  <div className="rare-card__body">
                    <div className="rare-card__badge">LOCKED</div>
                    <div className="rare-card__name">???</div>
                    <div className="rare-card__subtitle">#${entry.order} · 未解锁</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.65rem', fontSize: '0.88rem', color: 'var(--muted)' }}>
                <div><strong>{entry.unlocked ? entry.name : `未解锁稀有鱼 #${entry.order}`}</strong></div>
                <div style={{ marginTop: '0.25rem' }}>{entry.unlocked ? `首次解锁：${formatShort(entry.unlockedAt)}` : `条件：${entry.unlockHint}`}</div>
                <div style={{ marginTop: '0.25rem', color: 'var(--sand)' }}>技能：{entry.unlocked ? entry.skill : '解锁后显示'}</div>
                <div style={{ marginTop: '0.25rem' }}>{entry.unlocked ? entry.description : '尚未在真实结算中出现。'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bestiary-grid">
        {entries.map((entry) => (
          <div key={entry.id} className={`card bestiary-card ${entry.unlocked ? 'is-unlocked' : 'is-locked'}`}>
            <div className="bestiary-card__art" aria-hidden>
              <div className={`bestiary-silhouette kind-${entry.id}`} />
              {!entry.unlocked ? <div className="bestiary-card__lock">?</div> : null}
            </div>
            <div className="bestiary-card__body">
              <div className="bestiary-card__top">
                <strong>{entry.unlocked ? entry.name : '未解锁'}</strong>
                <span>{entry.count} 次</span>
              </div>
              <div className="bestiary-card__time">{entry.unlocked ? `首次解锁：${formatShort(entry.unlockedAt)}` : `条件：${entry.unlockHint}`}</div>
              <p className="bestiary-card__desc">{entry.unlocked ? entry.description : '剪影状态，尚未收入图鉴。'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <strong>解锁规则</strong>
        <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <li>普通鱼 / 优质鱼：本轮实际生成过就解锁</li>
          <li>稀有鱼总类：只要本轮实际刷出过任意稀有鱼就解锁</li>
          <li>稀有鱼单卡：只有该名字的稀有鱼真实出现过，才会按顺序解锁该卡</li>
          <li>超级稀有鱼：本轮真的触发过 10 稀有鱼合体才解锁</li>
          <li>死鱼：本轮实际生成过死鱼就解锁</li>
          <li>怨念鲨鱼：本轮真的触发过 10 死鱼合成才解锁</li>
        </ul>
      </div>

      <div className="home-actions">
        <Link to="/records"><button type="button" className="secondary">看记录</button></Link>
        <Link to="/"><button type="button" className="secondary">回首页</button></Link>
      </div>
    </>
  )
}
