import { useEffect, useId, useRef, useState } from 'react'
import CompassDetails from './CompassDetails'
import { capabilities, compassFrame } from './compassMotion'

function point(radius: number, angle: number) {
  return [Math.sin(angle) * radius, -Math.cos(angle) * radius]
}

const initialFrame = compassFrame(0)

export default function Compass() {
  const id = useId()
  const [started, setStarted] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const nodes = svg.querySelectorAll<SVGGElement>('[data-capability]')
    const routes = svg.querySelectorAll<SVGGElement>('[data-route]')
    const needle = svg.querySelector<SVGGElement>('[data-needle]')
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let elapsed = 0
    let last = 0
    let frameId = 0
    let onScreen = true

    const draw = (seconds: number) => {
      const frame = compassFrame(seconds)
      frame.nodes.forEach((node, i) => nodes[i].setAttribute('transform', `translate(${node.x} ${node.y})`))
      frame.routes.forEach((path, i) => routes[i].querySelectorAll('path').forEach(element => element.setAttribute('d', path)))
      needle?.setAttribute('transform', `rotate(${frame.angle})`)
    }
    const tick = (time: number) => {
      if (last) elapsed += Math.min(time - last, 100) / 1000
      last = time
      draw(elapsed)
      frameId = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frameId)
      last = 0
      const ambientPlaying = onScreen && !document.hidden && !preference.matches
      const playing = started && ambientPlaying
      svg.dataset.ambient = ambientPlaying ? 'playing' : 'paused'
      svg.dataset.motion = playing ? 'playing' : 'paused'
      if (preference.matches) draw(0)
      if (playing) frameId = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    observer.observe(svg)
    preference.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      preference.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [started])

  return (
    <svg ref={svgRef} className="compass" data-motion="paused" viewBox="-320 -320 640 640" role="group" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Cernan software compass</title>
      <desc id={`${id}-description`}>Six connected capabilities spell CERNAN clockwise: Create, Engineer, Research, Neural, Automate, Navigate. Signals flow between intricate interface layers, software architecture, research contours, neural networks, automation branches, and navigation maps.</desc>
      <g className="dial">
        <circle r="244" className="fine faint" />
        <circle r="237" className="rim" />
        <circle r="232" className="fine" />
        {Array.from({ length: 180 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 2})`} d={`M0,-229 V-${i % 15 === 0 ? 211 : i % 5 === 0 ? 216 : 222}`} className={i % 15 === 0 ? 'major-tick' : 'tick'} />
        ))}
        <circle r="207" className="fine faint" />
        {Array.from({ length: 12 }, (_, i) => (
          <text key={i} transform={`rotate(${i * 30}) translate(0 -200)`} className="degree">{String(i * 30).padStart(3, '0')}</text>
        ))}
        <circle r="196" className="fine" />
        <circle r="192" className="fine faint" />
        {['N', 'E', 'S', 'W'].map((label, i) => {
          const [x, y] = point(261, i * Math.PI / 2)
          return <text key={label} x={x} y={y + 4} className={`cardinal ${i === 0 ? 'north' : ''}`}>{label}</text>
        })}
        {[0, 90, 180, 270].map((angle) => <g key={angle} transform={`rotate(${angle})`}><path d="M-3,-242 L0,-248 L3,-242 Z" className="index-marker" /><path d="M0,-190 V-182" className="major-tick" /></g>)}
      </g>

      <g className="software-system">
        {initialFrame.routes.map((path,i) => <g key={path} data-route={i}>
          <path d={path} className="trace" />
          <path d={path} pathLength="100" className="signal" style={{animationDelay:`${-i*1.1}s`}} />
        </g>)}
        {capabilities.map(({name,x,y,port,labelY},i) => <g key={name} data-capability={name} transform={`translate(${x} ${y})`}>
          <CompassDetails index={i} />
          <text y={labelY} className="system-label"><tspan className="capability-initial">{name[0]}</tspan>{name.slice(1).toUpperCase()}</text>
          <circle cx={port[0]} cy={port[1]} r="1.8" className="connection-port" />
        </g>)}
      </g>

      <g className="needle-bearing">
        <circle r="26" className="bearing-base" /><circle r="22" className="fine" />
        {[0, 90, 180, 270].map((angle) => <circle key={angle} transform={`rotate(${angle})`} cy="24" r="1" className="solid" />)}
      </g>
      <g data-needle transform="rotate(35)">
        <g className="compass-needle">
          <path d="M0,-283 L17,-24 L13,17 L0,283 L-17,24 L-13,-17 Z" className="needle-clearance" />
          <path d="M0,-283 L17,-24 L0,0 L-13,-17 Z" className="needle-north" />
          <path d="M0,283 L-17,24 L0,0 L13,17 Z" className="needle-south" />
          <path d="M0,-283 V-32 M0,32 V283" className="needle-spine" />
          <path d="M0,-243 L7,-99 L0,-116 Z" className="needle-inlay" />
          <path d="M-7,95 L0,232 L0,110 Z" className="needle-inlay-south" />
          <circle r="15" className="hub" /><circle r="11" /><circle r="6" className="hub-inner" />
          <path d="M-3,0 H3" className="hub-slot" />
        </g>
      </g>
      <g
        className="compass-trigger"
        role="button"
        tabIndex={0}
        aria-label={started ? 'Compass rotation started' : 'Rotate compass toward east'}
        aria-disabled={started}
        onClick={() => setStarted(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setStarted(true)
          }
        }}
      >
        <circle r="25" className="hub-hit-area" />
        <circle r="29" className="hub-focus-ring" />
      </g>
    </svg>
  )
}
