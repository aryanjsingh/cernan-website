import { useEffect, useRef } from 'react'

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    function draw() {
      if (!canvas || !context) return
      const { width, height } = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const dark = document.documentElement.dataset.theme === 'dark'
      let seed = 1739
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 4294967296
      }
      const count = Math.min(30000, Math.round(width * height / 38))
      for (let i = 0; i < count; i++) {
        const u = random()
        const depth = random()
        const spread = (random() + random() + random() - 1.5) * .21
        const crest = .79 + Math.sin(u * 7.5 - .8 + depth * 2) * .065
          - .22 * Math.exp(-(((u - .94) / .17) ** 2))
        const y = (crest + spread + depth * .12) * height
        const edgeFade = Math.min(1, Math.max(0, (y / height - .49) * 7))
          * Math.min(1, Math.max(0, (1.05 - y / height) * 7))
        const opacity = (.06 + random() * .28) * edgeFade
        const size = .6 + random() * 1.1
        context.fillStyle = dark ? `rgba(164,164,164,${opacity})` : `rgba(70,70,70,${opacity * .7})`
        context.fillRect(u * width, y, size, size)
      }
    }

    const resize = new ResizeObserver(draw)
    resize.observe(canvas)
    const theme = new MutationObserver(draw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    draw()
    return () => { resize.disconnect(); theme.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />
}
