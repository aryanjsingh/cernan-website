import { useEffect, useRef } from 'react'

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const host = canvas.parentElement!
    let layers: HTMLCanvasElement[] = []
    let width = 0
    let height = 0
    let frame = 0
    let lastTime = 0
    let elapsed = 0
    let visible = true
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

    function paint() {
      if (!context) return
      context.clearRect(0, 0, width, height)
      layers.forEach((layer, index) => {
        const depth = (index + 1) / 3
        const driftX = reduced.matches ? 0 : Math.sin(elapsed * .13 + index) * width * .006
        const driftY = reduced.matches ? 0 : Math.sin(elapsed * .1 + index * 2) * height * .005
        context.drawImage(layer, -width * .07 + driftX + pointer.x * depth,
          -height * .07 + driftY + pointer.y * depth, width * 1.14, height * 1.14)
      })
    }

    function tick(time: number) {
      frame = 0
      if (lastTime && time - lastTime < 1000 / 30) {
        frame = requestAnimationFrame(tick)
        return
      }
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0
      lastTime = time
      elapsed += delta
      const ease = 1 - Math.exp(-delta * 3)
      pointer.x += (pointer.targetX - pointer.x) * ease
      pointer.y += (pointer.targetY - pointer.y) * ease
      paint()
      frame = requestAnimationFrame(tick)
    }

    function syncMotion() {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      if (reduced.matches) {
        pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0
        paint()
      } else if (!document.hidden && visible) frame = requestAnimationFrame(tick)
    }

    function move(event: PointerEvent) {
      if (reduced.matches || event.pointerType === 'touch') return
      const bounds = host.getBoundingClientRect()
      pointer.targetX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * width * .05
      pointer.targetY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * height * .05
    }
    function leave() { pointer.targetX = pointer.targetY = 0 }

    function draw() {
      if (!canvas || !context) return
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      layers = Array.from({ length: 3 }, () => {
        const layer = document.createElement('canvas')
        layer.width = Math.round(width * 1.14 * ratio)
        layer.height = Math.round(height * 1.14 * ratio)
        return layer
      })
      const brushes = layers.map(layer => {
        const brush = layer.getContext('2d')!
        brush.setTransform(ratio, 0, 0, ratio, width * .07 * ratio, height * .07 * ratio)
        return brush
      })
      const dark = document.documentElement.dataset.theme === 'dark'
      let seed = 1739
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 4294967296
      }
      const count = Math.min(30000, Math.round(width * height / 38))
      for (let i = 0; i < count; i++) {
        const u = random() * 1.14 - .07
        const depth = random()
        const spread = (random() + random() + random() - 1.5) * .21
        const crest = .79 + Math.sin(u * 7.5 - .8 + depth * 2) * .065
          - .22 * Math.exp(-(((u - .94) / .17) ** 2))
        const y = (crest + spread + depth * .12) * height
        const edgeFade = Math.min(1, Math.max(0, (y / height - .49) * 7))
          * Math.min(1, Math.max(0, (1.05 - y / height) * 7))
        const opacity = (.06 + random() * .28) * edgeFade
        const size = .6 + random() * 1.1
        const brush = brushes[Math.min(2, Math.floor(depth * 3))]
        brush.fillStyle = dark ? `rgba(164,164,164,${opacity})` : `rgba(70,70,70,${opacity * .7})`
        brush.fillRect(u * width, y, size, size)
      }
      paint()
    }

    const resize = new ResizeObserver(draw)
    resize.observe(canvas)
    const theme = new MutationObserver(draw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      syncMotion()
    })
    intersection.observe(host)
    host.addEventListener('pointermove', move, { passive: true })
    host.addEventListener('pointerleave', leave)
    document.addEventListener('visibilitychange', syncMotion)
    reduced.addEventListener('change', syncMotion)
    draw()
    syncMotion()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      theme.disconnect()
      intersection.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
      document.removeEventListener('visibilitychange', syncMotion)
      reduced.removeEventListener('change', syncMotion)
    }
  }, [])

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />
}
