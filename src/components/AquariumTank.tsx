import { useEffect, useRef, useCallback } from 'react'
import type { LiveShark } from '../modules/shark'
import { SHARK_EGG_HATCH_SECONDS } from '../modules/shark'

type FishTier = 'normal' | 'good' | 'rare' | 'superRare' | 'dead'

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
  skillPulse: number   // 0-1，技能激活程度
  skillCooldown: number // 技能冷却计时
  hp: number   // 当前血量
  maxHp: number // 最大血量
  hitPulse: number // 受击闪白特效 0-1
}

type Shark = {
  x: number
  y: number
  vx: number
  phase: number
  size: number
  hp: number
  bitePulse: number
  targetX: number
  targetY: number
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
      skillPulse: 0,
      skillCooldown: 0,
      hp: 0, maxHp: 0, hitPulse: 0,
    }
  }

  if (tier === 'superRare') {
    return {
      x: Math.random() * (w - 80) + 40,
      y: Math.random() * (h * 0.45) + h * 0.12,
      vx: (Math.random() * 0.65 + 0.46) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.22,
      phase: Math.random() * Math.PI * 2,
      tier,
      variant: i % 3,
      w: 58,
      h: 28,
      hue: 284,
      glow: 'rgba(217,70,239,0.6)',
      skillPulse: 0,
      skillCooldown: Math.random() * 60,
      hp: 10, maxHp: 10, hitPulse: 0,
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
      vx: (Math.random() * 0.45 + 0.28) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.18,
      phase: Math.random() * Math.PI * 2,
      tier,
      variant,
      w: 44 + (i % 2) * 4,
      h: 22 + (i % 2) * 3,
      hue: palette.hue,
      glow: palette.glow,
      skillPulse: 0,
      skillCooldown: Math.random() * 80,
      hp: 3, maxHp: 3, hitPulse: 0,
    }
  }

  if (tier === 'good') {
    return {
      x: Math.random() * (w - 50) + 25,
      y: Math.random() * (h * 0.54) + h * 0.12,
      vx: (Math.random() * 0.46 + 0.22) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.22,
      phase: Math.random() * Math.PI * 2,
      tier,
      variant: i % 2,
      w: 34 + (i % 3) * 3,
      h: 18 + (i % 2) * 2,
      hue: 186 + Math.random() * 16,
      glow: 'rgba(34, 211, 238, 0.28)',
      skillPulse: 0,
      skillCooldown: 0,
      hp: 2, maxHp: 2, hitPulse: 0,
    }
  }

  return {
    x: Math.random() * (w - 40) + 20,
    y: Math.random() * (h * 0.58) + h * 0.14,
    vx: (Math.random() * 0.35 + 0.14) * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * 0.24,
    phase: Math.random() * Math.PI * 2,
    tier,
    variant: i % 2,
    w: 24 + (i % 3) * 3,
    h: 13 + (i % 2) * 2,
    hue: 214 + Math.random() * 12,
    glow: 'rgba(96, 165, 250, 0.12)',
    skillPulse: 0,
    skillCooldown: 0,
    hp: 1, maxHp: 1, hitPulse: 0,
  }
}

function makeShark(i: number, w: number, h: number): Shark {
  const x = Math.random() * (w - 120) + 60
  const y = Math.random() * (h * 0.46) + h * 0.18
  return {
    x,
    y,
    vx: (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.18),
    phase: Math.random() * Math.PI * 2 + i,
    size: 78 + (i % 2) * 12,
    hp: 8,
    bitePulse: 0,
    targetX: x,
    targetY: y,
  }
}

export type FishPositionMap = {
  dead: Array<{ x: number; y: number }>
  normal: Array<{ x: number; y: number; hp: number; maxHp: number }>
  good: Array<{ x: number; y: number; hp: number; maxHp: number }>
  rare: Array<{ x: number; y: number; hp: number; maxHp: number }>
  superRare: Array<{ x: number; y: number; hp: number; maxHp: number }>
}

export type AquariumHandle = {
  biteFish: (tier: Exclude<FishTier, 'dead'>, sharkX: number, sharkY: number) => { died: boolean; hp: number; maxHp: number } | null
}

type Props = {
  fishCount?: number
  normalCount?: number
  goodCount?: number
  rareCount?: number
  superRareCount?: number
  deadCount?: number
  sharkCount?: number
  sharks?: LiveShark[]
  sharksVersion?: number
  className?: string
  full?: boolean
  onFishPositions?: (positions: FishPositionMap) => void
  tankRef?: React.MutableRefObject<AquariumHandle | null>
}

export function AquariumTank({ fishCount = 0, normalCount, goodCount, rareCount, superRareCount, deadCount, sharkCount, sharks: liveSharks = [], className, full = false, onFishPositions, tankRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<Fish[]>([])
  const sharksRef = useRef<Shark[]>([])
  const liveSharksRef = useRef<LiveShark[]>([])
  const countsRef = useRef({ normal: 0, good: 0, rare: 0, superRare: 0, dead: 0, shark: 0 })

  // 暴露给父组件：鲨鱼咬一口指定 tier 的最近鱼，扣血，血尽移除
  const biteFish = useCallback((tier: Exclude<FishTier, 'dead'>, sharkX: number, sharkY: number) => {
    const list = fishRef.current
    let closest: Fish | null = null
    let minDist = Infinity
    for (const f of list) {
      if (f.tier !== tier || f.hp <= 0) continue
      const dx = f.x - sharkX
      const dy = f.y - sharkY
      const d = dx * dx + dy * dy
      if (d < minDist) { minDist = d; closest = f }
    }
    if (!closest) return null
    closest.hp -= 1
    closest.hitPulse = 1 // 受击闪白
    const died = closest.hp <= 0
    if (died) {
      // 血尽：从 fishRef 移除
      fishRef.current = list.filter(f => f !== closest)
    }
    return { died, hp: closest.hp, maxHp: closest.maxHp }
  }, [])

  // 挂载 handle
  useEffect(() => {
    if (tankRef) tankRef.current = { biteFish }
    return () => { if (tankRef) tankRef.current = null }
  }, [tankRef, biteFish])

  countsRef.current = {
    normal: Math.max(0, Math.min(48, normalCount ?? fishCount)),
    good: Math.max(0, Math.min(48, goodCount ?? 0)),
    rare: Math.max(0, Math.min(48, rareCount ?? 0)),
    superRare: Math.max(0, Math.min(12, superRareCount ?? 0)),
    dead: Math.max(0, Math.min(48, deadCount ?? 0)),
    shark: Math.max(0, Math.min(12, sharkCount ?? 0)),
  }
  liveSharksRef.current = liveSharks

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
      const tierOrder: FishTier[] = ['dead', 'superRare', 'rare', 'good', 'normal']
      for (const tier of tierOrder) {
        const existing = current.filter((f) => f.tier === tier)
        const target = desiredCounts[tier]
        for (let i = 0; i < target; i++) next.push(existing[i] ?? makeFish(i, w, h, tier))
      }
      fishRef.current = next

      const sharkCurrent = sharksRef.current
      const sharkTarget = desiredCounts.shark
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
      const liveSharks = liveSharksRef.current
      for (let i = 0; i < sharks.length; i++) {
        const shark = sharks[i]
        shark.phase += dt * 0.045
        shark.bitePulse = Math.max(0, shark.bitePulse - dt * 0.08)
        // 鲨鱼位置由外部状态机驱动（liveSharks），这里只同步绘制
        const live = liveSharks[i]
        if (live) {
          shark.x = live.x
          shark.y = live.y
          shark.vx = live.vx
          shark.bitePulse = live.bitePulse ?? 0
        }
        // 边界反弹（仅兜底，状态机应该已处理）
        if (shark.x < 30 || shark.x > w - 30) shark.vx *= -1
      }

      const fishList = fishRef.current
      for (const f of fishList) {
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

        // 只对 hunting 状态的 LiveShark 产生逃跑反应和技能攻击
        const huntingLiveSharks = liveSharksRef.current.filter(ls => ls.state === 'hunting')
        const nearbyShark = sharks.find((s) => Math.abs(s.x - f.x) < 90 && Math.abs(s.y - f.y) < 48)
        if (nearbyShark) {
          const boost = f.tier === 'superRare' ? 0.08 : f.tier === 'rare' ? 0.05 : f.tier === 'good' ? 0.035 : 0.025
          f.vx += Math.sign(f.x - nearbyShark.x) * boost
        }

        // 技能系统：稀有鱼和超稀有鱼只攻击 hunting 状态的鲨鱼
        if (f.tier === 'rare' || f.tier === 'superRare') {
          f.skillCooldown = Math.max(0, f.skillCooldown - dt)
          f.skillPulse = Math.max(0, f.skillPulse - dt * 0.9)
          f.hitPulse = Math.max(0, f.hitPulse - dt * 3) // 受击闪白快速消退
          const skillRange = f.tier === 'superRare' ? 160 : 120
          const closestShark = huntingLiveSharks.reduce((best: LiveShark | null, s) => {
            const d = Math.hypot(s.x - f.x, s.y - f.y)
            if (d < skillRange && (!best || d < Math.hypot(best.x - f.x, best.y - f.y))) return s
            return best
          }, null)
          if (closestShark && f.skillCooldown <= 0) {
            f.skillPulse = 1
            f.skillCooldown = f.tier === 'superRare' ? 90 : 120
            // 在 ctx 坐标系外（world space）画技能光束
            const beamCount = f.tier === 'superRare' ? 3 : 1
            for (let b = 0; b < beamCount; b++) {
              const spread = (b - (beamCount - 1) / 2) * 0.18
              const dx = closestShark.x - f.x
              const dy = closestShark.y - f.y
              const ang = Math.atan2(dy, dx) + spread
              const len = Math.hypot(dx, dy)
              ctx.save()
              ctx.strokeStyle = f.tier === 'superRare'
                ? `hsla(${f.hue},100%,85%,0.85)`
                : `hsla(${f.hue},100%,80%,0.75)`
              ctx.lineWidth = f.tier === 'superRare' ? 4 : 2.5
              ctx.shadowBlur = f.tier === 'superRare' ? 22 : 14
              ctx.shadowColor = f.glow
              ctx.beginPath()
              ctx.moveTo(f.x, f.y)
              ctx.lineTo(f.x + Math.cos(ang) * len, f.y + Math.sin(ang) * len)
              ctx.stroke()
              // 光束头部光晕
              ctx.beginPath()
              ctx.arc(closestShark.x, closestShark.y, f.tier === 'superRare' ? 18 : 10, 0, Math.PI * 2)
              ctx.fillStyle = f.tier === 'superRare'
                ? `hsla(${f.hue},100%,80%,0.45)`
                : `hsla(${f.hue},100%,75%,0.35)`
              ctx.shadowBlur = 28
              ctx.fill()
              ctx.restore()
            }
            closestShark.bitePulse = Math.min(1, closestShark.bitePulse + 0.5)
          } else if (closestShark && f.skillPulse > 0) {
            // 持续充能光点
            ctx.save()
            ctx.beginPath()
            ctx.arc(f.x, f.y, (f.tier === 'superRare' ? 18 : 12) * f.skillPulse, 0, Math.PI * 2)
            ctx.fillStyle = `hsla(${f.hue},100%,85%,${0.3 * f.skillPulse})`
            ctx.shadowBlur = 20 * f.skillPulse
            ctx.shadowColor = f.glow
            ctx.fill()
            ctx.restore()
          }
        }

        f.phase += dt * (f.tier === 'superRare' ? 0.055 : f.tier === 'rare' ? 0.04 : 0.06)
        f.x += f.vx * dt
        f.y += f.vy * dt + Math.sin(f.phase) * (f.tier === 'superRare' ? 0.18 : f.tier === 'rare' ? 0.1 : 0.15) * dt
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
        if (f.tier === 'superRare') {
          // 流光外环1
          ctx.save()
          const ang1 = f.phase * 1.8
          ctx.rotate(ang1)
          ctx.strokeStyle = `hsla(${f.hue},100%,80%,0.55)`
          ctx.lineWidth = 3.5
          ctx.shadowBlur = 28
          ctx.shadowColor = f.glow
          ctx.beginPath()
          ctx.ellipse(0, 0, f.w * 0.78, f.h * 0.78, 0, 0, Math.PI * 1.4)
          ctx.stroke()
          ctx.restore()
          // 流光外环2（反向）
          ctx.save()
          ctx.rotate(-ang1 * 0.7)
          ctx.strokeStyle = `hsla(${(f.hue + 60) % 360},100%,85%,0.35)`
          ctx.lineWidth = 2
          ctx.shadowBlur = 18
          ctx.shadowColor = `hsla(${(f.hue + 60) % 360},100%,80%,0.5)`
          ctx.beginPath()
          ctx.ellipse(0, 0, f.w * 0.65, f.h * 0.65, 0, 0, Math.PI * 1.1)
          ctx.stroke()
          ctx.restore()
          // 粒子光点
          for (let p = 0; p < 5; p++) {
            const pa = ang1 + (p / 5) * Math.PI * 2
            const px = Math.cos(pa) * f.w * 0.72
            const py = Math.sin(pa) * f.h * 0.72
            ctx.beginPath()
            ctx.arc(px, py, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = `hsla(${f.hue},100%,95%,${0.5 + 0.4 * Math.sin(ang1 + p)})`
            ctx.shadowBlur = 10
            ctx.shadowColor = f.glow
            ctx.fill()
          }
          ctx.shadowBlur = 32
          ctx.shadowColor = f.glow
        } else if (f.tier !== 'normal') {
          ctx.shadowBlur = f.tier === 'rare' ? 18 : 10
          ctx.shadowColor = f.glow
        }
        ctx.fillStyle = `hsl(${f.hue} 85% ${f.tier === 'superRare' ? '68%' : f.tier === 'rare' ? '62%' : f.tier === 'good' ? '60%' : '58%'})`
        ctx.beginPath()
        ctx.ellipse(0, 0, f.w * 0.5, f.h * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsl(${f.hue} 78% ${f.tier === 'superRare' ? '54%' : f.tier === 'rare' ? '52%' : f.tier === 'good' ? '47%' : '45%'})`
        ctx.beginPath()
        ctx.moveTo(-f.w * 0.45, 0)
        ctx.lineTo(-f.w * 0.98, -f.h * 0.38)
        ctx.lineTo(-f.w * 0.98, f.h * 0.38)
        ctx.closePath()
        ctx.fill()
        if (f.tier === 'rare') drawRareAccent(f)
        if (f.tier === 'superRare') {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = 2.4
          ctx.beginPath()
          ctx.moveTo(-f.w * 0.05, -f.h * 0.72)
          ctx.lineTo(f.w * 0.08, -f.h * 1.02)
          ctx.lineTo(f.w * 0.2, -f.h * 0.72)
          ctx.stroke()
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.beginPath()
          ctx.arc(f.w * 0.08, -f.h * 0.62, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(f.w * 0.2, -f.h * 0.12, f.tier === 'superRare' ? 4 : f.tier === 'rare' ? 3.6 : 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0c4a6e'
        ctx.beginPath()
        ctx.arc(f.w * 0.22, -f.h * 0.1, 1.4, 0, Math.PI * 2)
        ctx.fill()

        // 受击闪白
        if (f.hitPulse > 0) {
          ctx.globalAlpha = f.hitPulse * 0.7
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.ellipse(0, 0, f.w * 0.55, f.h * 0.55, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }

        ctx.restore()

        // 血量格（有血量才显示）
        if (f.maxHp > 0 && f.hp < f.maxHp) {
          const barW = f.w * 0.9
          const barH = 4
          const bx = f.x - barW / 2
          const by = f.y - f.h - 8
          const ratio = f.hp / f.maxHp
          // 背景
          ctx.fillStyle = 'rgba(0,0,0,0.45)'
          ctx.fillRect(bx, by, barW, barH)
          // 血量颜色：高绿、中黄、低红
          const barColor = ratio > 0.6 ? '#4ade80' : ratio > 0.3 ? '#facc15' : '#f87171'
          ctx.fillStyle = barColor
          ctx.fillRect(bx, by, barW * ratio, barH)
        }
      }

      for (const shark of sharks) {
        const flip = shark.vx < 0 ? -1 : 1
        const biteOpen = 1 + shark.bitePulse * 0.24
        ctx.save()
        ctx.translate(shark.x, shark.y)
        ctx.scale(flip, 1)

        ctx.strokeStyle = `rgba(248,113,113,${0.22 + shark.bitePulse * 0.32})`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.ellipse(0, 0, shark.size * (0.72 + shark.bitePulse * 0.08), shark.size * (0.34 + shark.bitePulse * 0.04), 0, 0, Math.PI * 2)
        ctx.stroke()

        ctx.shadowBlur = 22
        ctx.shadowColor = 'rgba(248,113,113,0.36)'
        ctx.fillStyle = 'rgba(51,65,85,0.98)'
        ctx.beginPath()
        ctx.moveTo(-shark.size * 0.58, 0)
        ctx.lineTo(-shark.size * 1.02, -shark.size * 0.21)
        ctx.lineTo(-shark.size * 1.02, shark.size * 0.21)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.ellipse(-shark.size * 0.02, 0, shark.size * 0.58, shark.size * 0.24, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(-shark.size * 0.06, -shark.size * 0.18)
        ctx.lineTo(shark.size * 0.16, -shark.size * 0.52)
        ctx.lineTo(shark.size * 0.33, -shark.size * 0.14)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = 'rgba(239,68,68,0.94)'
        ctx.beginPath()
        ctx.moveTo(shark.size * 0.3, 0)
        ctx.lineTo(shark.size * 0.54, -shark.size * 0.1 * biteOpen)
        ctx.lineTo(shark.size * 0.54, shark.size * 0.1 * biteOpen)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = 'rgba(255,255,255,0.94)'
        ctx.lineWidth = 1.25
        ctx.beginPath()
        for (let i = 0; i < 4; i++) {
          const toothX = shark.size * (0.14 + i * 0.08)
          ctx.moveTo(toothX, shark.size * 0.015)
          ctx.lineTo(toothX + 4, shark.size * 0.08 * biteOpen)
          ctx.lineTo(toothX + 8, shark.size * 0.015)
        }
        ctx.stroke()

        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(shark.size * 0.18, -shark.size * 0.06, 3.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7f1d1d'
        ctx.beginPath()
        ctx.arc(shark.size * 0.21, -shark.size * 0.06, 1.8, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()

        if (shark.bitePulse > 0.05) {
          ctx.save()
          ctx.strokeStyle = `rgba(248,113,113,${0.18 + shark.bitePulse * 0.22})`
          ctx.lineWidth = 2
          ctx.setLineDash([5, 6])
          ctx.beginPath()
          ctx.moveTo(shark.x, shark.y)
          ctx.lineTo(shark.targetX, shark.targetY)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = `rgba(248,113,113,${0.16 + shark.bitePulse * 0.24})`
          ctx.beginPath()
          ctx.arc(shark.targetX, shark.targetY, 10 + shark.bitePulse * 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(shark.x - shark.size * 0.28, shark.y + shark.size * 0.34, shark.size * 0.56, 4)
        ctx.fillStyle = shark.hp > 4 ? 'rgba(34,197,94,0.95)' : shark.hp > 2 ? 'rgba(250,204,21,0.95)' : 'rgba(239,68,68,0.95)'
        ctx.fillRect(shark.x - shark.size * 0.28, shark.y + shark.size * 0.34, shark.size * 0.56 * (shark.hp / 8), 4)
        ctx.restore()
      }

      // --- LiveShark prop lifecycle rendering ---
      for (const ls of liveSharksRef.current) {
        const s = ls.size || 78

        if (ls.state === 'egg' || ls.state === 'hatching') {
          // 蛋状态：画一个会摇晃的蛋，hatching 时裂缝渐显
          const eggR = ls.eggSize || 32
          const hatchProgress = ls.state === 'hatching' ? Math.min(1, ls.stateTimer / 2) : 0
          const wobble = ls.state === 'hatching' ? Math.sin(t * 18) * 0.18 * hatchProgress : 0
          const eggHatchRatio = ls.state === 'egg' ? Math.min(1, ls.stateTimer / SHARK_EGG_HATCH_SECONDS) : 1
          ctx.save()
          ctx.translate(ls.x, ls.y)
          ctx.rotate(wobble)
          // 蛋体
          ctx.shadowBlur = 18
          ctx.shadowColor = 'rgba(148,163,184,0.5)'
          ctx.fillStyle = `hsl(220,18%,${78 + hatchProgress * 8}%)`
          ctx.beginPath()
          ctx.ellipse(0, 0, eggR * 0.7, eggR, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
          // 孵化进度光晕
          if (eggHatchRatio > 0) {
            ctx.strokeStyle = `rgba(250,204,21,${0.18 + eggHatchRatio * 0.45})`
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.ellipse(0, 0, eggR * 0.7 + 4, eggR + 4, 0, 0, Math.PI * 2 * eggHatchRatio)
            ctx.stroke()
          }
          // 裂缝
          if (hatchProgress > 0.1) {
            ctx.strokeStyle = `rgba(51,65,85,${0.5 + hatchProgress * 0.4})`
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(-eggR * 0.2, -eggR * 0.3)
            ctx.lineTo(0, -eggR * 0.05)
            ctx.lineTo(eggR * 0.18, -eggR * 0.35)
            ctx.stroke()
          }
          ctx.restore()
          continue
        }

        if (ls.state === 'dormant') {
          // 休眠：静止在底部，闭眼，轻微呼吸
          const breathe = Math.sin(t * 1.2) * 0.04
          const flip = ls.vx < 0 ? -1 : 1
          ctx.save()
          ctx.translate(ls.x, ls.y)
          ctx.scale(flip * (1 + breathe), 1 + breathe * 0.5)
          ctx.globalAlpha = 1
          ctx.shadowBlur = 10
          ctx.shadowColor = 'rgba(100,116,139,0.3)'
          ctx.fillStyle = 'rgba(51,65,85,0.95)'
          ctx.beginPath()
          ctx.ellipse(0, 0, s * 0.58, s * 0.24, 0, 0, Math.PI * 2)
          ctx.fill()
          // 尾巴
          ctx.beginPath()
          ctx.moveTo(-s * 0.58, 0)
          ctx.lineTo(-s * 1.02, -s * 0.21)
          ctx.lineTo(-s * 1.02, s * 0.21)
          ctx.closePath()
          ctx.fill()
          // 背鳍
          ctx.beginPath()
          ctx.moveTo(-s * 0.06, -s * 0.18)
          ctx.lineTo(s * 0.16, -s * 0.52)
          ctx.lineTo(s * 0.33, -s * 0.14)
          ctx.closePath()
          ctx.fill()
          // 闭眼线
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(s * 0.14, -s * 0.06)
          ctx.lineTo(s * 0.24, -s * 0.06)
          ctx.stroke()
          // zzz
          ctx.globalAlpha = 0.45 + Math.sin(t * 1.5) * 0.2
          ctx.fillStyle = 'rgba(186,230,253,0.9)'
          ctx.font = `${Math.round(s * 0.18)}px sans-serif`
          ctx.fillText('z', s * 0.3, -s * 0.38)
          ctx.font = `${Math.round(s * 0.14)}px sans-serif`
          ctx.fillText('z', s * 0.44, -s * 0.52)
          ctx.globalAlpha = 1
          ctx.restore()
          continue
        }

        if (ls.state === 'awakening') {
          // 唤醒：眼睛渐开，光晕扩散
          const awakeP = Math.min(1, ls.stateTimer / 2)
          const flip = ls.vx < 0 ? -1 : 1
          ctx.save()
          ctx.translate(ls.x, ls.y)
          ctx.scale(flip, 1)
          ctx.globalAlpha = 0.72 + awakeP * 0.28
          ctx.shadowBlur = 8 + awakeP * 22
          ctx.shadowColor = `rgba(248,113,113,${0.2 + awakeP * 0.4})`
          ctx.fillStyle = 'rgba(51,65,85,0.98)'
          ctx.beginPath()
          ctx.ellipse(0, 0, s * 0.58, s * 0.24, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-s * 0.58, 0)
          ctx.lineTo(-s * 1.02, -s * 0.21)
          ctx.lineTo(-s * 1.02, s * 0.21)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-s * 0.06, -s * 0.18)
          ctx.lineTo(s * 0.16, -s * 0.52)
          ctx.lineTo(s * 0.33, -s * 0.14)
          ctx.closePath()
          ctx.fill()
          // 眼睛渐开
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(s * 0.18, -s * 0.06, 3.8 * awakeP, 0, Math.PI * 2)
          ctx.fill()
          if (awakeP > 0.5) {
            ctx.fillStyle = '#7f1d1d'
            ctx.beginPath()
            ctx.arc(s * 0.21, -s * 0.06, 1.8 * awakeP, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
          continue
        }

        if (ls.state === 'dying') {
          // 死亡：翻身，透明度下降
          const dyingP = Math.min(1, ls.stateTimer / 3)
          const rot = ls.rotation || (dyingP * Math.PI)
          ctx.save()
          ctx.translate(ls.x, ls.y)
          ctx.rotate(rot)
          ctx.globalAlpha = Math.max(0, 1 - dyingP * 0.9)
          ctx.shadowBlur = 0
          ctx.fillStyle = 'rgba(71,85,105,0.85)'
          ctx.beginPath()
          ctx.ellipse(0, 0, s * 0.58, s * 0.24, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-s * 0.58, 0)
          ctx.lineTo(-s * 1.02, -s * 0.21)
          ctx.lineTo(-s * 1.02, s * 0.21)
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.restore()
          continue
        }

        // hunting 状态：使用完整渲染（复用内部 Shark 渲染逻辑的简化版）
        {
          const flip = ls.vx < 0 ? -1 : 1
          const biteOpen = 1 + ls.bitePulse * 0.24
          ctx.save()
          ctx.translate(ls.x, ls.y)
          ctx.scale(flip, 1)
          // 升级光环
          if (ls.levelUpPulse > 0.01) {
            ctx.save()
            ctx.globalAlpha = ls.levelUpPulse * 0.6
            ctx.strokeStyle = 'rgba(250,204,21,0.9)'
            ctx.lineWidth = 3
            ctx.shadowBlur = 28
            ctx.shadowColor = 'rgba(250,204,21,0.7)'
            ctx.beginPath()
            ctx.ellipse(0, 0, s * 0.9 + (1 - ls.levelUpPulse) * 20, s * 0.4 + (1 - ls.levelUpPulse) * 10, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
          }
          ctx.strokeStyle = `rgba(248,113,113,${0.22 + ls.bitePulse * 0.32})`
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.ellipse(0, 0, s * (0.72 + ls.bitePulse * 0.08), s * (0.34 + ls.bitePulse * 0.04), 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.shadowBlur = 22
          ctx.shadowColor = 'rgba(248,113,113,0.36)'
          ctx.fillStyle = 'rgba(51,65,85,0.98)'
          ctx.beginPath()
          ctx.moveTo(-s * 0.58, 0)
          ctx.lineTo(-s * 1.02, -s * 0.21)
          ctx.lineTo(-s * 1.02, s * 0.21)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(-s * 0.02, 0, s * 0.58, s * 0.24, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-s * 0.06, -s * 0.18)
          ctx.lineTo(s * 0.16, -s * 0.52)
          ctx.lineTo(s * 0.33, -s * 0.14)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = 'rgba(239,68,68,0.94)'
          ctx.beginPath()
          ctx.moveTo(s * 0.3, 0)
          ctx.lineTo(s * 0.54, -s * 0.1 * biteOpen)
          ctx.lineTo(s * 0.54, s * 0.1 * biteOpen)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.94)'
          ctx.lineWidth = 1.25
          ctx.beginPath()
          for (let i = 0; i < 4; i++) {
            const toothX = s * (0.14 + i * 0.08)
            ctx.moveTo(toothX, s * 0.015)
            ctx.lineTo(toothX + 4, s * 0.08 * biteOpen)
            ctx.lineTo(toothX + 8, s * 0.015)
          }
          ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(s * 0.18, -s * 0.06, 3.8 * ls.eyeOpen, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#7f1d1d'
          ctx.beginPath()
          ctx.arc(s * 0.21, -s * 0.06, 1.8, 0, Math.PI * 2)
          ctx.fill()
          // 等级标签
          if (ls.level > 1) {
            ctx.save()
            ctx.scale(flip, 1)
            ctx.fillStyle = 'rgba(250,204,21,0.95)'
            ctx.font = `bold ${Math.round(s * 0.22)}px sans-serif`
            ctx.fillText(`Lv${ls.level}`, -s * 0.18, -s * 0.42)
            ctx.restore()
          }
          ctx.restore()
          // 咬合追踪线
          if (ls.bitePulse > 0.05) {
            ctx.save()
            ctx.strokeStyle = `rgba(248,113,113,${0.18 + ls.bitePulse * 0.22})`
            ctx.lineWidth = 2
            ctx.setLineDash([5, 6])
            ctx.beginPath()
            ctx.moveTo(ls.x, ls.y)
            ctx.lineTo(ls.targetX, ls.targetY)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = `rgba(248,113,113,${0.16 + ls.bitePulse * 0.24})`
            ctx.beginPath()
            ctx.arc(ls.targetX, ls.targetY, 10 + ls.bitePulse * 8, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          // 血条
          ctx.save()
          ctx.fillStyle = 'rgba(255,255,255,0.8)'
          ctx.fillRect(ls.x - s * 0.28, ls.y + s * 0.34, s * 0.56, 4)
          const hpRatio = ls.hp / ls.maxHp
          ctx.fillStyle = hpRatio > 0.5 ? 'rgba(34,197,94,0.95)' : hpRatio > 0.25 ? 'rgba(250,204,21,0.95)' : 'rgba(239,68,68,0.95)'
          ctx.fillRect(ls.x - s * 0.28, ls.y + s * 0.34, s * 0.56 * hpRatio, 4)
          ctx.restore()
        }
      }
      // --- LiveShark prop lifecycle rendering end ---

      // 暴露真实鱼位置给父组件（每帧回调）
      if (onFishPositions) {
        const positions: FishPositionMap = { dead: [], normal: [], good: [], rare: [], superRare: [] }
        for (const f of fishRef.current) {
          if (f.tier === 'dead') {
            positions.dead.push({ x: f.x, y: f.y })
          } else if (f.tier in positions) {
            ;(positions[f.tier as Exclude<keyof FishPositionMap, 'dead'>]).push({ x: f.x, y: f.y, hp: f.hp, maxHp: f.maxHp })
          }
        }
        onFishPositions(positions)
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
      style={{
        width: '100%',
        height: full ? '100%' : 'clamp(180px, 48vw, 300px)',
        display: 'block',
        borderRadius: full ? 0 : 12,
      }}
    />
  )
}
