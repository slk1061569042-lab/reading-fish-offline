import { useEffect, useRef } from 'react'

type FishTier = 'normal' | 'good' | 'rare' | 'dead'

type Fish = {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  tier: FishTier
  w: number
  h: number
  hue: number
  glow: string
}

function makeFish(i: number, w: number, h: number, tier: FishTier): Fish {
  if (tier === 'dead') {
    return {
      x: Math.random() * (w - 50) + 25,
      y: Math.random() * (h * 0.4) + h * 0.2,
      vx: (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.04),
      vy: -0.12 - Math.random() * 0.04,
      phase: Math.random() * Math.PI * 2,
      tier,
      w: 30 + (i % 2) * 3,
      h: 16 + (i % 2) * 2,
      hue: 0,
      glow: 'rgba(255,255,255,0)',
    }
  }

  if (tier === 'rare') {
    return {
      x: Math.random() * (w - 60) + 30,
      y: Math.random() * (h * 0.5) + h * 0.12,
      vx: (Math.random() * 0.32 + 0.12) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      tier,
      w: 44 + (i % 2) * 4,
      h: 22 + (i % 2) * 3,
      hue: 46 + Math.random() * 10,
      glow: 'rgba(253, 224, 71, 0.55)',
    }
  }

  if (tier === 'good') {
    return {
      x: Math.random() * (w - 50) + 25,
      y: Math.random() * (h * 0.54) + h * 0.12,
      vx: (Math.random() * 0.4 + 0.16) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.22,
      phase: Math.random() * Math.PI * 2,
      tier,
      w: 34 + (i % 3) * 3,
      h: 18 + (i % 2) * 2,
      hue: 186 + Math.random() * 16,
      glow: 'rgba(34, 211, 238, 0.28)',
    }
  }

  return {
    x: Math.random() * (w - 40) + 20,
    y: Math.random() * (h * 0.58) + h * 0.14,
    vx: (Math.random() * 0.45 + 0.18) * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * 0.24,
    phase: Math.random() * Math.PI * 2,
    tier,
    w: 24 + (i % 3) * 3,
    h: 13 + (i % 2) * 2,
    hue: 214 + Math.random() * 12,
    glow: 'rgba(96, 165, 250, 0.12)',
  }
}

type Props = {
  fishCount?: number
  normalCount?: number
  goodCount?: number
  rareCount?: number
  deadCount?: number
  className?: string
  full?: boolean
}

export function AquariumTank({ fishCount = 0, normalCount, goodCount, rareCount, deadCount, className, full = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<Fish[]>([])
  const countsRef = useRef({ normal: 0, good: 0, rare: 0, dead: 0 })

  countsRef.current = {
    normal: Math.max(0, Math.min(24, normalCount ?? fishCount)),
    good: Math.max(0, Math.min(24, goodCount ?? 0)),
    rare: Math.max(0, Math.min(24, rareCount ?? 0)),
    dead: Math.max(0, Math.min(24, deadCount ?? 0)),
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    let last = performance.now()
    let t = 0

    const syncFishPool = (w: number, h: number) => {
      const current = fishRef.current
      const desiredCounts = countsRef.current

      const next: Fish[] = []
      const tierOrder: FishTier[] = ['dead', 'rare', 'good', 'normal']

      for (const tier of tierOrder) {
        const existing = current.filter((f) => f.tier === tier)
        const target = desiredCounts[tier]

        for (let i = 0; i < target; i++) {
          next.push(existing[i] ?? makeFish(i, w, h, tier))
        }
      }

      fishRef.current = next
    }

    const draw = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67
      last = now
      t += dt * 0.02

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      syncFishPool(w, h)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const grd = ctx.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, 'rgba(56, 189, 248, 0.42)')
      grd.addColorStop(0.45, 'rgba(14, 116, 144, 0.58)')
      grd.addColorStop(1, 'rgba(8, 47, 73, 0.97)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 12; i++) {
        const bx = ((i * 73 + t * 40) % (w + 40)) - 20
        const by = (h * 0.14 + Math.sin(t + i) * 10 + i * 17) % (h * 0.78)
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.05})`
        ctx.ellipse(bx, by, 4 + (i % 2), 6 + (i % 2), 0, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = 'rgba(253, 230, 138, 0.48)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, h - 18)
      for (let x = 0; x <= w; x += 16) {
        ctx.lineTo(x, h - 18 - Math.sin(x * 0.08 + t * 2) * 4)
      }
      ctx.stroke()

      ctx.fillStyle = 'rgba(251, 191, 36, 0.36)'
      ctx.fillRect(0, h - 14, w, 14)

      for (const f of fishRef.current) {
        if (f.tier === 'dead') {
          f.phase += dt * 0.03
          const surfaceY = h * 0.12 + Math.sin(f.phase) * 3
          f.x += f.vx * dt
          if (f.y > surfaceY) {
            f.y = Math.max(surfaceY, f.y + f.vy * dt)
          } else {
            f.y = surfaceY
          }
          if (f.x < 24 || f.x > w - 24) {
            f.vx *= -1
            f.x = Math.max(24, Math.min(w - 24, f.x))
          }

          ctx.save()
          ctx.translate(f.x, f.y)
          ctx.rotate(Math.PI / 10)
          ctx.fillStyle = 'rgba(226, 232, 240, 0.98)'
          ctx.beginPath()
          ctx.ellipse(0, 0, f.w * 0.5, f.h * 0.5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(148, 163, 184, 0.95)'
          ctx.beginPath()
          ctx.ellipse(0, 2, f.w * 0.42, f.h * 0.32, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(100, 116, 139, 0.95)'
          ctx.beginPath()
          ctx.moveTo(-f.w * 0.45, 0)
          ctx.lineTo(-f.w * 0.95, -f.h * 0.35)
          ctx.lineTo(-f.w * 0.95, f.h * 0.35)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.95)'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(f.w * 0.12, -f.h * 0.18)
          ctx.lineTo(f.w * 0.28, -f.h * 0.05)
          ctx.moveTo(f.w * 0.28, -f.h * 0.18)
          ctx.lineTo(f.w * 0.12, -f.h * 0.05)
          ctx.stroke()
          ctx.restore()
          continue
        }

        f.phase += dt * (f.tier === 'rare' ? 0.04 : 0.06)
        f.x += f.vx * dt
        f.y += f.vy * dt + Math.sin(f.phase) * (f.tier === 'rare' ? 0.1 : 0.15) * dt
        if (f.x < 16 || f.x > w - 16) {
          f.vx *= -1
          f.x = Math.max(16, Math.min(w - 16, f.x))
        }
        if (f.y < h * 0.08 || f.y > h * 0.72) {
          f.vy *= -1
          f.y = Math.max(h * 0.08, Math.min(h * 0.72, f.y))
        }

        const flip = f.vx < 0 ? -1 : 1
        ctx.save()
        ctx.translate(f.x, f.y)
        ctx.scale(flip, 1)
        if (f.tier !== 'normal') {
          ctx.shadowBlur = f.tier === 'rare' ? 18 : 10
          ctx.shadowColor = f.glow
        }
        ctx.fillStyle = `hsl(${f.hue} 85% ${f.tier === 'rare' ? '62%' : f.tier === 'good' ? '60%' : '58%'})`
        ctx.beginPath()
        ctx.ellipse(0, 0, f.w * 0.5, f.h * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsl(${f.hue} 78% ${f.tier === 'rare' ? '52%' : f.tier === 'good' ? '47%' : '45%'})`
        ctx.beginPath()
        ctx.moveTo(-f.w * 0.45, 0)
        ctx.lineTo(-f.w * 0.98, -f.h * 0.38)
        ctx.lineTo(-f.w * 0.98, f.h * 0.38)
        ctx.closePath()
        ctx.fill()
        if (f.tier === 'rare') {
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.beginPath()
          ctx.moveTo(f.w * 0.05, -f.h * 0.55)
          ctx.lineTo(f.w * 0.18, -f.h * 0.92)
          ctx.lineTo(f.w * 0.32, -f.h * 0.5)
          ctx.closePath()
          ctx.fill()
        }
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(f.w * 0.2, -f.h * 0.12, f.tier === 'rare' ? 3.6 : 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0c4a6e'
        ctx.beginPath()
        ctx.arc(f.w * 0.22, -f.h * 0.1, 1.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ width: '100%', height: full ? 'min(62dvh, 560px)' : 'clamp(180px, 48vw, 300px)', display: 'block', borderRadius: 12 }}
    />
  )
}
