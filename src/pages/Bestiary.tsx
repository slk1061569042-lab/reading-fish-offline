import { Link } from 'react-router-dom'
import { getAchievements, getRareFishDex, loadRecords } from '../modules/storage'

const RARE_GLOW: Record<string, [string, string]> = {
  '晨光蝶尾':  ['#fde68a', '#38bdf8'],
  '静海流金':  ['#67e8f9', '#1d4ed8'],
  '银月纱鳍':  ['#e2e8f0', '#7dd3fc'],
  '晚霞星鳞':  ['#f9a8d4', '#f59e0b'],
  '深渊暗鳞':  ['#6d28d9', '#4f46e5'],
  '极光霜鳍':  ['#bae6fd', '#0891b2'],
  '赤焰烈尾':  ['#fca5a5', '#dc2626'],
  '苍穹云斑':  ['#e0f2fe', '#38bdf8'],
}

function RareFishBadge({ name }: { name: string }) {
  const [c1, c2] = RARE_GLOW[name] ?? ['#7dd3fc', '#38bdf8']
  const id = `fg-${name}`
  return (
    <svg viewBox="0 0 160 90" style={{ width: '100%', height: '100%' }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <ellipse cx="88" cy="45" rx="34" ry="20" fill={`url(#${id})`} />
      <path d="M52 45 L18 26 L18 64 Z" fill={c2} opacity="0.92" />
      <path d="M84 24 C95 10,120 8,130 24" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M86 66 C100 76,122 78,132 61" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.75" />
      <circle cx="101" cy="39" r="5.5" fill="#fff" />
      <circle cx="103" cy="39" r="2.4" fill="#082f49" />
      <circle cx="116" cy="31" r="2.4" fill="#fff" opacity="0.75" />
      <circle cx="124" cy="49" r="1.8" fill="#fff" opacity="0.55" />
    </svg>
  )
}

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
  const rareFishDex = getRareFishDex(records)
  const achievements = getAchievements(records)

  const unlockedSpecies = rareFishDex.filter(e => e.unlocked).length
  const unlockedAch = achievements.filter(a => a.unlocked).length
  const totalSpecies = rareFishDex.length
  const totalAch = achievements.length

  return (
    <>
      <header>
        <h1 className="page-title">鱼类图鉴</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          图鉴 {unlockedSpecies}/{totalSpecies} · 成就 {unlockedAch}/{totalAch}
        </p>
      </header>

      {/* 稀有鱼图鉴 */}
      <div className="card">
        <strong>稀有鱼图鉴</strong>
        <p style={{ margin: '0.35rem 0 0.85rem', color: 'var(--muted)', fontSize: '0.86rem' }}>
          只有真正刷出过的稀有鱼才会解锁
        </p>
        {rareFishDex.filter(e => e.unlocked).length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>还没有解锁任何稀有鱼，继续努力朗读吧！</p>
        ) : (
          <div className="badge-grid">
            {rareFishDex.filter(e => e.unlocked).map((entry) => (
              <div key={entry.id} className="badge-item badge-item--unlocked">
                <div className="badge-item__art badge-item__art--fish">
                  <RareFishBadge name={entry.name} />
                </div>
                <div className="badge-item__label">{entry.name}</div>
                <div className="badge-item__sub">{entry.count} 次</div>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* 成就 */}
      <div className="card">
        <strong>成就徽章</strong>
        <p style={{ margin: '0.35rem 0 0.85rem', color: 'var(--muted)', fontSize: '0.86rem' }}>
          已解锁 {unlockedAch} / {totalAch}
        </p>
        <div className="badge-grid">
          {achievements.map((ach) => (
            <div key={ach.id} className={`badge-item${ach.unlocked ? ' badge-item--unlocked' : ' badge-item--locked'}`}>
              <div className="badge-item__art badge-item__art--achievement"
                style={ach.unlocked ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(16,185,129,0.4) 100%)', border: '1px solid rgba(99,102,241,0.4)' } : undefined}
              >
                <span className="badge-item__icon">{ach.icon}</span>
                {!ach.unlocked && <span className="badge-item__lock badge-item__lock--sm">🔒</span>}
              </div>
              <div className="badge-item__label">
                {ach.unlocked ? ach.name : '???'}
              </div>
              {ach.unlocked ? (
                <div className="badge-item__sub">{formatShort(ach.unlockedAt)}</div>
              ) : (
                <div className="badge-item__sub badge-item__sub--locked">{ach.unlockHint}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="home-actions">
        <Link to="/records"><button type="button" className="secondary">看记录</button></Link>
        <Link to="/"><button type="button" className="secondary">回首页</button></Link>
      </div>
    </>
  )
}
