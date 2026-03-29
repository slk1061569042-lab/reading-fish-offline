import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { RareFishCard } from '../components/RareFishCard'
import { latestRareFish, loadProfile, saveProfile, loadRecords, loadSettings, saveSettings } from '../modules/storage'

export function Home() {
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const [latestRare, setLatestRare] = useState(() => latestRareFish(loadRecords()))

  useEffect(() => {
    const p = loadProfile()
    setPlayerName(p.playerName)
    setLatestRare(latestRareFish(loadRecords()))
  }, [])

  useEffect(() => {
    const p = loadProfile()
    saveProfile({ playerName, mode: p.mode })
  }, [playerName])

  const startWithMode = (mode: 'positive' | 'study') => {
    const settings = loadSettings()
    saveSettings({ ...settings, mode })
    navigate('/reading')
  }

  return (
    <>
      <header>
        <h1 className="page-title">养鱼课堂</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>选择一张卡片开始：早读养鱼，或者自习养鱼。</p>
      </header>

      <div className="card home-profile">
        <label className="settings-field">
          <span className="settings-field__label">玩家昵称</span>
          <span className="settings-field__hint">会显示在结果与记录里，仅保存在本机。</span>
          <input type="text" maxLength={48} placeholder="可选" value={playerName} onChange={(e) => setPlayerName(e.target.value)} autoComplete="off" />
        </label>
      </div>

      <div className="mode-card-grid">
        <button type="button" className="mode-entry-card" onClick={() => startWithMode('positive')}>
          <div className="mode-entry-card__tank"><AquariumTank fishCount={8} /></div>
          <div className="mode-entry-card__body">
            <div className="mode-entry-card__title">早读养鱼</div>
            <div className="mode-entry-card__desc">持续出声朗读，越稳定鱼越多。</div>
          </div>
        </button>

        <button type="button" className="mode-entry-card mode-entry-card--study" onClick={() => startWithMode('study')}>
          <div className="mode-entry-card__tank"><AquariumTank fishCount={5} /></div>
          <div className="mode-entry-card__body">
            <div className="mode-entry-card__title">自习养鱼</div>
            <div className="mode-entry-card__desc">连续安静专注，逐步养出稀有鱼与超级稀有鱼。</div>
          </div>
        </button>
      </div>

      <div className="card">
        <div className="home-actions">
          <Link to="/records"><button type="button" className="secondary">记录</button></Link>
          <Link to="/bestiary"><button type="button" className="secondary">图鉴</button></Link>
          <Link to="/settings"><button type="button" className="secondary">设置</button></Link>
        </div>
      </div>

      {latestRare ? (
        <div className="card">
          <strong>最近获得的稀有鱼</strong>
          <div style={{ marginTop: '0.75rem' }}>
            <RareFishCard name={latestRare.rareFishName!} subtitle={`${latestRare.playerName || '未命名玩家'} · 最新解锁`} compact />
          </div>
        </div>
      ) : (
        <div className="card">
          <strong>图鉴目标</strong>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>先解锁稀有鱼，再凑够 10 条合体出超级稀有鱼，最后对抗怨念鲨鱼。</p>
        </div>
      )}
    </>
  )
}
