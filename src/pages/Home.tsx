import { Link } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'

export function Home() {
  return (
    <>
      <header>
        <h1 className="page-title">Reading Fish</h1>
        <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
          出声阅读时累积时间，每满 15 秒有效阅读钓到一条小鱼。纯前端、离线可玩。
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={5} />
        <div style={{ padding: '0.85rem 1rem 1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            需要麦克风权限；用音量能量检测是否在朗读，不会上传录音或调用云端。
          </p>
          <Link to="/reading">
            <button type="button">开始阅读</button>
          </Link>
        </div>
      </div>

      <div className="card">
        <strong>怎么玩</strong>
        <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <li>点「开始阅读」并允许麦克风</li>
          <li>大声朗读，状态为「正在阅读」时才会计时</li>
          <li>进度条满一圈得到一条鱼</li>
          <li>结束会话后可在「记录」里看统计</li>
        </ol>
      </div>
    </>
  )
}
