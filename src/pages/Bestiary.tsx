import { Link } from 'react-router-dom'
import { getBestiary, latestRareFish, listRareFish, loadRecords } from '../modules/storage'
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
  const rareFishList = listRareFish(records)

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
        <strong>已获得稀有鱼</strong>
        {rareFishList.length > 0 ? (
          <div className="rare-grid" style={{ marginTop: '0.75rem' }}>
            {rareFishList.map((item) => (
              <RareFishCard key={`${item.id}-bestiary-rare`} name={item.rareFishName!} subtitle={`${item.playerName || '未命名玩家'} · ${formatShort(item.endedAt)}`} compact />
            ))}
          </div>
        ) : (
          <p style={{ margin: '0.6rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>你还没有记录到已获得的稀有鱼。只要本轮真正刷出过，结束结算后就会进这里。</p>
        )}
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
          <li>稀有鱼：本轮实际刷出过稀有鱼就解锁，并进入“已获得稀有鱼”列表</li>
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
