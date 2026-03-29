import { useEffect, useRef } from 'react'

type FishTier = 'normal' | 'good' | 'rare' | 'dead'

type Fish = {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  tier: FishTier
  variant: number
  w: number
  h: number
  hue: number
  glow: string
  hiddenUntil?: number
}

type Shark = {
  x: number
  y: number
  vx: number
  phase: number
  size: number
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
      variant: 0,
      w: 30 + (i % 2) * 3,
      h: 16 + (i % 2) * 2,
      hue: 0,
      glow: 'rgba(255,255,255,0)',
    }
  }

  if (tier === 'rare') {
    const variant = i % 4
    const rarePalettes = [
      { hue: 46, glow: 'rgba(253,224,71,0.55)' },
      { hue: 320, glow: 'rgba(244,114,182,0.45)' },
      { hue: 186, glow: 'rgba(103,232,249,0.42)' },
      { hue: 255, glow: 'rgba(167,139,250,0.42)' },
    ]
    const palette = rarePalettes[variant]!
    return {
      x: Math.random() * (w - 60) + 30,
      y: Math.random() * (h * 0.5) + h * 0.12,
      vx: (Math.random() * 0.32 + 0.12) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      tier,
      variant,
      w: 44 + (i % 2) * 4,
      h: 22 + (i % 2) * 3,
      hue: palette.hue,
      glow: palette.glow,
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
      variant: i % 2,
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
    variant: i % 2,
    w: 24 + (i % 3) * 3,
    h: 13 + (i % 2) * 2,
    hue: 214 + Math.random() * 12,
    glow: 'rgba(96, 165, 250, 0.12)',
  }
}

function makeShark(i: number, w: number, h: number): Shark {
  return {
    x: Math.random() * (w - 120) + 60,
    y: Math.random() * (h * 0.46) + h * 0.18,
    vx: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.18),
    phase: Math.random() * Math.PI * 2 + i,
    size: 66 + (i % 2) * 10,
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
  const sharksRef = useRef<Shark[]>([])
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
        for (let i = 0; i < target; i++) next.push(existing[i] ?? makeFish(i, w, h, tier))
      }
      fishRef.current = next

      const sharkCurrent = sharksRef.current
      const sharkTarget = desiredCounts.dead
      const sharkNext: Shark[] = []
      for (let i = 0; i < sharkTarget; i++) sharkNext.push(sharkCurrent[i] ?? makeShark(i, w, h))
      sharksRef.current = sharkNext
    }

    const drawRareAccent = (fish: Fish) => {
      switch (fish.variant) {
        case 0:
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.beginPath()
          ctx.moveTo(fish.w * 0.05, -fish.h * 0.55)
          ctx.lineTo(fish.w * 0.18, -fish.h * 0.92)
          ctx.lineTo(fish.w * 0.32, -fish.h * 0.5)
          ctx.closePath()
          ctx.fill()
          break
        case 1:
          ctx.strokeStyle = 'rgba(255,255,255,0.78)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(fish.w * 0.02, 0, fish.h * 0.62, -0.9, 0.9)
          ctx.stroke()
          break
        case 2:
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.beginPath()
          ctx.ellipse(-fish.w * 0.02, -fish.h * 0.55, fish.w * 0.14, fish.h * 0.16, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(fish.w * 0.18, -fish.h * 0.52, fish.w * 0.11, fish.h * 0.13, 0, 0, Math.PI * 2)
          ctx.fill()
          break
        case 3:
          ctx.strokeStyle = 'rgba(255,255,255,0.88)'
          ctx.lineWidth = 2.2
          ctx.beginPath()
          ctx.moveTo(-fish.w * 0.08, -fish.h * 0.62)
          ctx.lineTo(fish.w * 0.1, -fish.h * 0.92)
          ctx.lineTo(fish.w * 0.32, -fish.h * 0.62)
          ctx.stroke()
          break
      }
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
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h - 18 - Math.sin(x * 0.08 + t * 2) * 4)
      ctx.stroke()
      ctx.fillStyle = 'rgba(251, 191, 36, 0.36)'
      ctx.fillRect(0, h - 14, w, 14)

      const sharks = sharksRef.current
      const fishList = fishRef.current

      for (const shark of sharks) {
        shark.phase += dt * 0.045
        const prey = fishList.find((f) => (f.tier === 'normal' || f.tier === 'good') && (!f.hiddenUntil || f.hiddenUntil < now))
        if (prey) {
          shark.vx += Math.sign(prey.x - shark.x) * 0.012
          shark.vx = Math.max(-1.2, Math.min(1.2, shark.vx))
          shark.y += Math.sign(prey.y - shark.y) * 0.18 * dt
          if (Math.abs(shark.x - prey.x) < shark.size * 0.3 && Math.abs(shark.y - prey.y) < shark.size * 0.18) {
            prey.hiddenUntil = now + 1800
            prey.x = Math.random() * (w - 40) + 20
            prey.y = Math.random() * (h * 0.58) + h * 0.14
          }
        }
        shark.x += shark.vx * dt
        shark.y += Math.sin(shark.phase) * 0.18 * dt
        if (shark.x < 30 || shark.x > w - 30) shark.vx *= -1
      }

      for (const f of fishList) {
        if (f.hiddenUntil && f.hiddenUntil > now) continue

        if (f.tier === 'dead') {
          f.phase += dt * 0.03
          const surfaceY = h * 0.12 + Math.sin(f.phase) * 3
          f.x += f.vx * dt
          if (f.y > surfaceY) f.y = Math.max(surfaceY, f.y + f.vy * dt)
          else f.y = surfaceY
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

        const nearbyShark = sharks.find((s) => Math.abs(s.x - f.x) < 80 && Math.abs(s.y - f.y) < 40)
        if (nearbyShark) f.vx += Math.sign(f.x - nearbyShark.x) * 0.04

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
        if (f.tier === 'rare') drawRareAccent(f)
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

      for (const shark of sharks) {
        const flip = shark.vx < 0 ? -1 : 1
        ctx.save()
        ctx.translate(shark.x, shark.y)
        ctx.scale(flip, 1)
        ctx.shadowBlur = 16
        ctx.shadowColor = 'rgba(248,113,113,0.28)'
        ctx.fillStyle = 'rgba(71,85,105,0.96)'
        ctx.beginPath()
        ctx.moveTo(-shark.size * 0.52, 0)
        ctx.lineTo(-shark.size * 0.92, -shark.size * 0.18)
        ctx.lineTo(-shark.size * 0.92, shark.size * 0.18)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(0, 0, shark.size * 0.52, shark.size * 0.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(-shark.size * 0.05, -shark.size * 0.16)
        ctx.lineTo(shark.size * 0.14, -shark.size * 0.45)
        ctx.lineTo(shark.size * 0.28, -shark.size * 0.12)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(239,68,68,0.85)'
        ctx.beginPath()
        ctx.moveTo(shark.size * 0.28, 0)
        ctx.lineTo(shark.size * 0.48, -shark.size * 0.08)
        ctx.lineTo(shark.size * 0.48, shark.size * 0.08)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(shark.size * 0.16, -shark.size * 0.05, 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7f1d1d'
        ctx.beginPath()
        ctx.arc(shark.size * 0.19, -shark.size * 0.05, 1.6, 0, Math.PI * 2)
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

  return <canvas ref={canvasRef} className={className} aria-hidden style={{ width: '100%', height: full ? 'min(62dvh, 560px)' : 'clamp(180px, 48vw, 300px)', display: 'block', borderRadius: 12 }} />
}
