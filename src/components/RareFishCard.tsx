type Props = {
  name: string
  subtitle?: string
  compact?: boolean
}

function glowByName(name: string): [string, string] {
  const map: Array<[string, [string, string]]> = [
    ['晨光', ['#fde68a', '#38bdf8']],
    ['静海', ['#67e8f9', '#1d4ed8']],
    ['银月', ['#e2e8f0', '#7dd3fc']],
    ['晚霞', ['#f9a8d4', '#f59e0b']],
    ['深渊', ['#6d28d9', '#4f46e5']],
    ['极光', ['#bae6fd', '#0891b2']],
    ['赤焰', ['#fca5a5', '#dc2626']],
    ['苍穹', ['#e0f2fe', '#38bdf8']],
  ]

  for (const [key, colors] of map) {
    if (name.includes(key)) return colors
  }
  return ['#7dd3fc', '#38bdf8']
}

export function RareFishCard({ name, subtitle = '稀有鱼', compact = false }: Props) {
  const [c1, c2] = glowByName(name)

  return (
    <div className={`rare-card ${compact ? 'compact' : ''}`}>
      <div className="rare-card__art" style={{ ['--rare1' as string]: c1, ['--rare2' as string]: c2 }}>
        <div className="rare-card__bubble rare-card__bubble--a" />
        <div className="rare-card__bubble rare-card__bubble--b" />
        <svg viewBox="0 0 160 90" className="rare-card__fish" aria-hidden>
          <defs>
            <linearGradient id={`fish-grad-${name}`} x1="0" x2="1">
              <stop offset="0%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          </defs>
          <ellipse cx="88" cy="45" rx="34" ry="20" fill={`url(#fish-grad-${name})`} />
          <path d="M52 45 L18 26 L18 64 Z" fill={c2} opacity="0.92" />
          <path d="M84 24 C95 10,120 8,130 24" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
          <path d="M86 66 C100 76,122 78,132 61" stroke={c1} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.75" />
          <circle cx="101" cy="39" r="5.5" fill="#fff" />
          <circle cx="103" cy="39" r="2.4" fill="#082f49" />
          <circle cx="116" cy="31" r="2.4" fill="#fff" opacity="0.75" />
          <circle cx="124" cy="49" r="1.8" fill="#fff" opacity="0.55" />
        </svg>
      </div>
      <div className="rare-card__body">
        <div className="rare-card__badge">RARE</div>
        <div className="rare-card__name">{name}</div>
        <div className="rare-card__subtitle">{subtitle}</div>
      </div>
    </div>
  )
}
