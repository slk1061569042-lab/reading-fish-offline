import { useEffect, useRef } from 'react'

type Fish = {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  hue: number
  w: number
  h: number
}

function makeFish(i: number, w: number, h: number): Fish {
  return {
    x: Math.random() * (w - 40) + 20,
    y: Math.random() * (h * 0.55) + h * 0.12,
    vx: (Math.random() * 0.45 + 0.15) * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * 0.25,
    phase: Math.random() * Math.PI * 2,
    hue: 185 + (i % 5) * 14 + Math.random() * 10,
    w: 26 + (i % 4) * 4,
    h: 14 + (i % 3) * 2,
  }
}

type Props = {
  fishCount: number
  className?: string
}

export function AquariumTank({ fishCount, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<Fish[]>([])
  const targetRef = useRef(0)
  targetRef.current = Math.max(0, Math.min(24, fishCount))

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

    const draw = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67
      last = now
      t += dt * 0.02

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const target = targetRef.current

      while (fishRef.current.length < target) {
        fishRef.current.push(makeFish(fishRef.current.length, w, h))
      }
      while (fishRef.current.length > target) {
        fishRef.current.pop()
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const grd = ctx.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, 'rgba(56, 189, 248, 0.35)')
      grd.addColorStop(0.45, 'rgba(14, 116, 144, 0.5)')
      grd.addColorStop(1, 'rgba(8, 47, 73, 0.95)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 10; i++) {
        const bx = ((i * 73 + t * 40) % (w + 40)) - 20
        const by = (h * 0.15 + Math.sin(t + i) * 8 + i * 17) % (h * 0.75)
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.04})`
        ctx.ellipse(bx, by, 4 + (i % 2), 6 + (i % 2), 0, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = 'rgba(253, 230, 138, 0.45)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, h - 18)
      for (let x = 0; x <= w; x += 16) {
        ctx.lineTo(x, h - 18 - Math.sin(x * 0.08 + t * 2) * 4)
      }
      ctx.stroke()

      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)'
      ctx.fillRect(0, h - 14, w, 14)

      for (const f of fishRef.current) {
        f.phase += dt * 0.06
        f.x += f.vx * dt
        f.y += f.vy * dt + Math.sin(f.phase) * 0.15 * dt

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

        ctx.fillStyle = `hsl(${f.hue} 85% 58%)`
        ctx.beginPath()
        ctx.ellipse(0, 0, f.w * 0.5, f.h * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `hsl(${f.hue} 70% 45%)`
        ctx.beginPath()
        ctx.moveTo(-f.w * 0.45, 0)
        ctx.lineTo(-f.w * 0.95, -f.h * 0.35)
        ctx.lineTo(-f.w * 0.95, f.h * 0.35)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(f.w * 0.2, -f.h * 0.12, 3.2, 0, Math.PI * 2)
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
      style={{ width: '100%', height: 'clamp(160px, 38vw, 220px)', display: 'block', borderRadius: 12 }}
    />
  )
}
