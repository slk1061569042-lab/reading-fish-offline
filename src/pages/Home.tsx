import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { loadProfile, saveProfile, loadSettings } from '../modules/storage'

function modeLabel(mode: string): string {
  switch (mode) {
    case 'reverse':
      return '当前模式：守护鱼缸'
    case 'study':
      return '当前模式：自习养鱼'
    default:
      return '当前模式：朗读养鱼'
  }
}

export function Home() {
  const [playerName, setPlayerName] = useState('')
  const [currentMode, setCurrentMode] = useState('positive')

  useEffect(() => {
    const p = loadProfile()
    const s = loadSettings()
    setPlayerName(p.playerName)
    setCurrentMode(s.mode)
  }, [])

  useEffect(() => {
    const p = loadProfile()
    saveProfile({ playerName, mode: p.mode })
  }, [playerName])

  return (
    <>
      <header>
        <h1 className="page-title">早读养鱼</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          保持朗读，或者保持安静专注，让你的鱼缸慢慢热闹起来。
        </p>
      </header>

      <div className="card home-profile">
        <label className="settings-field">
          <span className="settings-field__label">玩家昵称</span>
          <span className="settings-field__hint">会显示在结果与记录里，仅保存在本机。</span>
          <input
            type="text"
            maxLength={48}
            placeholder="可选"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="mode-hint">{modeLabel(currentMode)}</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={8} />
        <div style={{ padding: '0.85rem 1rem 1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            需要麦克风权限；只在本地做音量检测，不上传录音。模式切换已移到设置页。
          </p>
          <div className="home-actions">
            <Link to="/reading">
              <button type="button">开始</button>
            </Link>
            <Link to="/records">
              <button type="button" className="secondary">记录</button>
            </Link>
            <Link to="/settings">
              <button type="button" className="secondary">设置</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>模式说明</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <li>朗读：出声越稳定，鱼越多</li>
          <li>守护：初始有鱼，安静太久会掉鱼</li>
          <li>自习：越安静越能养出更多鱼，还会进化</li>
        </ul>
      </div>
    </>
  )
}
