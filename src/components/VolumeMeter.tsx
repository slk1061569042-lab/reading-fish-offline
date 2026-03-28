type Props = {
  /** Smoothed RMS ~0–0.1 typical speech */
  level: number
  activeThreshold: number
  quietThreshold: number
  className?: string
}

/** Horizontal meter with quiet/active threshold markers. */
export function VolumeMeter({ level, activeThreshold, quietThreshold, className }: Props) {
  const max = Math.max(0.035, activeThreshold * 1.6, quietThreshold * 2)
  const pct = Math.min(100, (level / max) * 100)
  const qPct = Math.min(100, (quietThreshold / max) * 100)
  const aPct = Math.min(100, (activeThreshold / max) * 100)

  return (
    <div className={`volume-meter ${className ?? ''}`} aria-label="实时音量">
      <div className="volume-meter__track">
        <div className="volume-meter__fill" style={{ width: `${pct}%` }} />
        <div className="volume-meter__mark volume-meter__mark--quiet" style={{ left: `${qPct}%` }} title="静音阈值" />
        <div className="volume-meter__mark volume-meter__mark--active" style={{ left: `${aPct}%` }} title="朗读阈值" />
      </div>
      <div className="volume-meter__legend">
        <span>音量</span>
        <span className="volume-meter__vals">
          {level.toFixed(4)} · 静 {quietThreshold.toFixed(3)} / 读 {activeThreshold.toFixed(3)}
        </span>
      </div>
    </div>
  )
}
