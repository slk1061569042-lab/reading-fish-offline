import { useEffect, useRef } from 'react'

/**
 * Stable requestAnimationFrame loop; callback receives delta time in ms.
 */
export function useGameLoop(
  callback: (dtMs: number) => void,
  enabled: boolean,
): void {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dtMs = Math.min(100, now - last)
      last = now
      cbRef.current(dtMs)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
}
