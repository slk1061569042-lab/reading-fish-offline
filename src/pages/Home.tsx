import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { loadProfile, saveProfile, type GameMode } from '../modules/storage'

function modeLabel(m: GameMode): string {
  return m === 'positive' ? '正向 · 读得越久鱼越多' : '反向 · 安静太久会失鱼'
}

export function Home() {
  const [playerName, setPlayerName] = useState('')
  const [mode, setMode] = useState<GameMode>('positive')

  useEffect(() => {
    const p = loadProfile()
    setPlayerName(p.playerName)
    setMode(p.mode)
  }, [])

  useEffect(() => {
    saveProfile({ playerName, mode })
  }, [playerName, mode])

  return (
    <>
      <header>
        <h1 className="page-title">Reading Fish</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          出声阅读时累积时间，每满一段有效阅读钓到一条小鱼；反向模式从满缸开始，安静过久会失去小鱼。纯前端、离线可玩。
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
        <div className="mode-switch" role="group" aria-label="游戏模式">
          <button
            type="button"
            className={mode === 'positive' ? '' : 'secondary'}
            onClick={() => setMode('positive')}
          >
            正向
          </button>
          <button
            type="button"
            className={mode === 'reverse' ? '' : 'secondary'}
            onClick={() => setMode('reverse')}
          >
            反向
          </button>
        </div>
        <p className="mode-hint">{modeLabel(mode)}</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={5} />
        <div style={{ padding: '0.85rem 1rem 1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            需要麦克风权限；用音量能量检测是否在朗读，不会上传录音或调用云端。
          </p>
          <div className="home-actions">
            <Link to="/reading">
              <button type="button">开始阅读</button>
            </Link>
            <Link to="/settings">
              <button type="button" className="secondary">
                设置
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>怎么玩</strong>
        <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <li>选好模式，点「开始阅读」并允许麦克风</li>
          <li>大声朗读，状态为「正在阅读」时正向才计时得鱼</li>
          <li>正向：进度条满一圈得到一条鱼；反向：保持朗读维持鱼群</li>
          <li>结束会话后可在「记录」里看统计</li>
        </ol>
      </div>
    </>
  )
}
