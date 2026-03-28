import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AquariumTank } from '../components/AquariumTank'
import { useGameLoop } from '../hooks/useGameLoop'
import {
  createVoiceStateMachine,
  defaultAudioConfig,
  sampleRms,
  startMicPipeline,
  stopMicPipeline,
  type MicPipeline,
} from '../modules/audioDetector'

const FISH_EVERY_SEC = 15

export type ReadingStatus = 'idle' | 'requesting' | 'active' | 'quiet' | 'error'

function statusLabel(s: ReadingStatus): string {
  switch (s) {
    case 'idle':
      return '待命'
    case 'requesting':
      return '请求麦克风权限…'
    case 'active':
      return '正在阅读'
    case 'quiet':
      return '安静 / 已暂停'
    case 'error':
      return '出错了'
    default:
      return s
  }
}

function statusClass(s: ReadingStatus): string {
  switch (s) {
    case 'idle':
      return 'idle'
    case 'requesting':
      return 'requesting'
    case 'active':
      return 'active'
    case 'quiet':
      return 'quiet'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

export function Reading() {
  const navigate = useNavigate()
  const [uiStatus, setUiStatus] = useState<ReadingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pipelineRef = useRef<MicPipeline | null>(null)
  const voiceRef = useRef(createVoiceStateMachine(defaultAudioConfig))
  const startedAtRef = useRef<string | null>(null)

  const [effectiveSeconds, setEffectiveSeconds] = useState(0)
  const effectiveRef = useRef(0)
  const [loopOn, setLoopOn] = useState(false)

  const fishEarnedLive = Math.floor(effectiveSeconds / FISH_EVERY_SEC)
  const intoFish = effectiveSeconds % FISH_EVERY_SEC
  const progressPct = (intoFish / FISH_EVERY_SEC) * 100
  const fishInTank = Math.min(24, fishEarnedLive)

  const cleanupMic = useCallback(() => {
    stopMicPipeline(pipelineRef.current)
    pipelineRef.current = null
    voiceRef.current.reset()
    setLoopOn(false)
  }, [])

  useEffect(() => {
    return () => cleanupMic()
  }, [cleanupMic])

  const startReading = useCallback(async () => {
    setErrorMessage(null)
    setUiStatus('requesting')
    cleanupMic()

    try {
      const pipeline = await startMicPipeline(defaultAudioConfig)
      pipelineRef.current = pipeline
      if (pipeline.context.state === 'suspended') {
        await pipeline.context.resume()
      }
      startedAtRef.current = new Date().toISOString()
      voiceRef.current.reset()
      setUiStatus('quiet')
      setLoopOn(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法访问麦克风'
      setErrorMessage(msg)
      setUiStatus('error')
      cleanupMic()
    }
  }, [cleanupMic])

  useGameLoop(
    (dtMs) => {
      const pipe = pipelineRef.current
      if (!pipe) return

      const rms = sampleRms(pipe)
      const voice = voiceRef.current
      voice.update(rms, dtMs)

      if (voice.isActive) {
        setUiStatus('active')
        const next = effectiveRef.current + dtMs / 1000
        effectiveRef.current = next
        setEffectiveSeconds(next)
      } else {
        setUiStatus('quiet')
      }
    },
    loopOn,
  )

  const endSession = useCallback(() => {
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const eff = effectiveRef.current
    const fish = Math.floor(eff / FISH_EVERY_SEC)
    cleanupMic()
    setUiStatus('idle')
    startedAtRef.current = null
    effectiveRef.current = 0
    setEffectiveSeconds(0)
    navigate('/result', {
      state: {
        startedAt,
        endedAt: new Date().toISOString(),
        effectiveSeconds: eff,
        fishEarned: fish,
      },
    })
  }, [cleanupMic, navigate])

  const resetLocal = useCallback(() => {
    cleanupMic()
    setUiStatus('idle')
    setErrorMessage(null)
    startedAtRef.current = null
    effectiveRef.current = 0
    setEffectiveSeconds(0)
  }, [cleanupMic])

  return (
    <>
      <header>
        <h1 className="page-title">阅读中</h1>
        <div
          className={`status-pill ${statusClass(uiStatus)}`}
          role="status"
          aria-live="polite"
          style={{ marginTop: '0.5rem' }}
        >
          <span className="dot" />
          {statusLabel(uiStatus)}
        </div>
      </header>

      {errorMessage && (
        <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem' }}>{errorMessage}</p>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AquariumTank fishCount={fishInTank} />
        <div style={{ padding: '0.75rem 1rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 6 }}>
            <span>下一条鱼</span>
            <span>
              {intoFish.toFixed(1)} / {FISH_EVERY_SEC}s
            </span>
          </div>
          <div className="progress-wrap" role="progressbar" aria-valuenow={intoFish} aria-valuemin={0} aria-valuemax={FISH_EVERY_SEC}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            有效阅读 {effectiveSeconds.toFixed(1)} 秒 · 已得 {fishEarnedLive} 条鱼
          </p>
        </div>
      </div>

      <div className="card">
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
          提示：环境较吵时可适当提高朗读音量；停顿超过约半秒会进入「安静 / 已暂停」，该段时间不计入有效阅读。
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {uiStatus === 'idle' || uiStatus === 'error' ? (
          <button type="button" onClick={startReading}>
            {uiStatus === 'error' ? '重试麦克风' : '开始麦克风'}
          </button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={endSession}>
              结束并查看结果
            </button>
            <button type="button" className="secondary" onClick={resetLocal}>
              重置
            </button>
          </>
        )}
      </div>
    </>
  )
}
