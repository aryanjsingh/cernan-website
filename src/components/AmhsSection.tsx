import { useEffect, useRef } from 'react'
import { Camera, ItemView, VIEW, type Ctx, type Item, type V3 } from './fab/engine'
import { BELT_POINTS, M, amrItem, buildWorld, craneItem, vehicleItem } from './fab/world'
import { AMR_LENGTH, HOIST_MAX, INTERBAY, LOOP_LENGTH, RAIL_Z, STOCKER, amrPoint, loopPoint, type Station } from './amhs/layout'

const FLEET = 6
const SHUTTLES = 3
const START_X = 0.6
const END_X = 29
const FAR = 34
const EYE = 1.62
/** The pen starts sketching things DRAW_FAR metres ahead and has finished them by DRAW_NEAR. */
const DRAW_FAR = 30
const DRAW_NEAR = 13

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mod = (v: number, m: number) => ((v % m) + m) % m
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

type Mode = 'drive' | 'lower' | 'dwell' | 'raise'
type Vehicle = { id: number; s: number; v: number; mode: Mode; t: number; target: Station | null; carrying: boolean }

export default function AmhsSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const floorRef = useRef<SVGGElement>(null)
  const sceneRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const svg = svgRef.current, floorLayer = floorRef.current, sceneLayer = sceneRef.current, track = trackRef.current, stage = stageRef.current
    if (!svg || !floorLayer || !sceneLayer || !track || !stage) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const world = buildWorld()
    const stations = world.stations.map(s => ({ ...s }))
    const reserved = new Set<number>()

    const fleet: Vehicle[] = Array.from({ length: FLEET }, (_, id) => ({ id, s: (id * LOOP_LENGTH) / FLEET + 2, v: 0, mode: 'drive', t: 0, target: null, carrying: id % 2 === 0 }))
    const fleetItems = fleet.map(v => vehicleItem(700 + v.id, 1000 + v.id))
    const shuttleX = Array.from({ length: SHUTTLES }, (_, i) => INTERBAY.x0 + (i * (INTERBAY.x1 - INTERBAY.x0)) / SHUTTLES)
    const shuttleItems = shuttleX.map((_, i) => vehicleItem(800 + i, 3000 + i))
    const amrS = [0, AMR_LENGTH / 2]
    const amrItems = [amrItem(901, true, 2000), amrItem(902, false, 2001)]
    const cranes = [{ row: 'A' as const, a: 1.0, c: 2.0, ta: 2.4, tc: 3.2, wait: 0 }, { row: 'B' as const, a: 3.0, c: 2.6, ta: 1.0, tc: 1.6, wait: 0.5 }]
    const craneItems = cranes.map((c, i) => craneItem(950 + i, c.row))

    const floorViews = world.floor.map(item => new ItemView(item, floorLayer))
    const actorItems: Item[] = [...fleetItems, ...shuttleItems, ...amrItems, ...craneItems]
    const views = [...world.items, ...actorItems].map(item => new ItemView(item, sceneLayer))
    const offsets = new Map<Item, V3[]>()
    actorItems.forEach(item => offsets.set(item, [[0, 0, 0], [0, 0, 0]]))
    const zero: V3[] = [[0, 0, 0]]
    const occupied = (id: number) => id < 1000 ? stations[id].occupied : id < 2000 ? fleet[id - 1000].carrying : id < 3000 ? true : id !== 3001
    const ctx: Ctx = { occupied, offsets: zero }

    const pick = (veh: Vehicle) => {
      const options = stations
        .filter(st => !reserved.has(st.id) && (veh.carrying ? !st.occupied : st.occupied || (st.stocker && Math.random() < 0.3)))
        .map(st => ({ st, d: mod(st.distance - veh.s, LOOP_LENGTH) }))
        .filter(o => o.d > 1.5)
        .sort((a, b) => a.d - b.d)
      if (!options.length) return null
      const choice = options[Math.floor(Math.random() * Math.min(4, options.length))].st
      reserved.add(choice.id)
      return choice
    }

    let clock = 0
    const step = (dt: number) => {
      clock += dt
      const order = [...fleet].sort((a, b) => a.s - b.s)
      for (const veh of fleet) {
        if (veh.mode === 'drive') {
          if (!veh.target) veh.target = pick(veh)
          const ahead = order[(order.indexOf(veh) + 1) % order.length]
          const gap = ahead === veh ? Infinity : mod(ahead.s - veh.s, LOOP_LENGTH) - 1.6
          const toTarget = veh.target ? mod(veh.target.distance - veh.s, LOOP_LENGTH) : Infinity
          const limit = Math.min(3.0, Math.max(0.35, Math.sqrt(2 * 1.4 * toTarget)), Math.sqrt(2 * 2.4 * Math.max(0, gap)))
          veh.v = Math.min(veh.v + 1.6 * dt, limit)
          const move = Math.min(veh.v * dt, toTarget, Math.max(0, gap))
          veh.s = mod(veh.s + move, LOOP_LENGTH)
          if (veh.target && toTarget - move < 0.005) { veh.s = veh.target.distance; veh.v = 0; veh.mode = 'lower'; veh.t = 0 }
        } else {
          veh.t += dt
          if (veh.mode === 'lower' && veh.t >= 2.4) { veh.mode = 'dwell'; veh.t = 0 }
          else if (veh.mode === 'dwell' && veh.t >= 0.9) {
            const st = veh.target!
            if (!st.stocker) st.occupied = veh.carrying
            veh.carrying = !veh.carrying
            veh.mode = 'raise'; veh.t = 0
          } else if (veh.mode === 'raise' && veh.t >= 2.4) {
            reserved.delete(veh.target!.id)
            veh.target = null
            veh.mode = 'drive'
          }
        }
      }
      for (let i = 0; i < shuttleX.length; i++) {
        shuttleX[i] += 3.6 * dt
        if (shuttleX[i] > INTERBAY.x1) shuttleX[i] = INTERBAY.x0
      }
      amrS.forEach((s, i) => { amrS[i] = mod(s + (1.1 + 0.2 * Math.sin(clock * 0.7 + i * 2)) * dt, AMR_LENGTH) })
      const k = 1 - Math.exp(-dt * 2.4)
      for (const c of cranes) {
        if (Math.abs(c.a - c.ta) > 0.02) c.a += (c.ta - c.a) * k
        else if (Math.abs(c.c - c.tc) > 0.02) c.c += (c.tc - c.c) * k
        else if ((c.wait += dt) > 1.1) {
          c.wait = 0
          c.ta = 0.4 + (4 / 3) * (Math.floor(Math.random() * 3) + 0.5)
          c.tc = 1.58 + STOCKER.row * Math.floor(Math.random() * STOCKER.rows)
        }
      }
    }

    const place = () => {
      fleet.forEach((veh, i) => {
        const p = loopPoint(veh.s), item = fleetItems[i], o = offsets.get(item)!
        const t = veh.mode === 'lower' ? ease(Math.min(1, veh.t / 2.4)) : veh.mode === 'dwell' ? 1 : veh.mode === 'raise' ? 1 - ease(Math.min(1, veh.t / 2.4)) : 0
        const drop = t * HOIST_MAX
        o[0] = M(p.x, p.y, RAIL_Z)
        o[1] = [o[0][0], o[0][1] - drop, o[0][2]]
        item.belts.lines = drop > 0.02 ? BELT_POINTS.map(b => [b, [b[0], b[1] - drop, b[2]]]) : []
        item.z0 = item.z1 = p.x
      })
      shuttleItems.forEach((item, i) => {
        const o = offsets.get(item)!
        o[0] = o[1] = M(shuttleX[i], INTERBAY.y, RAIL_Z)
        item.belts.lines = []
        item.z0 = item.z1 = shuttleX[i]
      })
      amrItems.forEach((item, i) => {
        const p = amrPoint(amrS[i]), o = offsets.get(item)!
        o[0] = o[1] = M(p.x, p.y, 0)
        const r = 0.25 + 1.1 * mod(clock / 1.8 + i * 0.5, 1)
        item.pulse.lines = [Array.from({ length: 25 }, (_, k) => [Math.cos((k / 24) * Math.PI * 2) * r, 0.01, Math.sin((k / 24) * Math.PI * 2) * r] as V3)]
        item.z0 = item.z1 = p.x
      })
      cranes.forEach((c, i) => {
        const o = offsets.get(craneItems[i])!
        o[0] = [0, 0, STOCKER.x0 + c.a]
        o[1] = [0, c.c, STOCKER.x0 + c.a]
        craneItems[i].z0 = craneItems[i].z1 = STOCKER.x0 + c.a
      })
    }

    const cam = new Camera()
    let target = START_X, phase = 0, yawT = 0, pitchT = 0
    cam.z = START_X
    const readScroll = () => {
      const rect = track.getBoundingClientRect()
      const p = clamp01(-rect.top / Math.max(1, rect.height - window.innerHeight))
      target = START_X + (END_X - START_X) * p
    }
    const onPointer = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      yawT = ((e.clientX - r.left) / r.width - 0.5) * 0.12
      pitchT = (0.5 - (e.clientY - r.top) / r.height) * 0.06
    }
    const onLeave = () => { yawT = 0; pitchT = 0 }

    let order: ItemView[] = []
    const render = (dt: number) => {
      const still = preference.matches
      const k = still ? 1 : 1 - Math.exp(-dt * 5)
      const before = cam.z
      cam.z += (target - cam.z) * k
      const moved = Math.abs(cam.z - before)
      phase += moved * (Math.PI / 0.72)
      const stride = still ? 0 : Math.min(1, (moved / Math.max(dt, 1e-3)) / 1.2)
      cam.y = EYE + 0.018 * stride * (Math.abs(Math.sin(phase)) - 0.5)
      cam.x = 0.012 * stride * Math.sin(phase / 2)
      cam.yaw += (yawT - cam.yaw) * (still ? 1 : 1 - Math.exp(-dt * 3))
      cam.pitch += (0.06 + pitchT - cam.pitch) * (still ? 1 : 1 - Math.exp(-dt * 3))
      cam.update()

      const visibleFor = (item: Item) => {
        const near = item.actor ? item.z0 - 1.5 : item.z0, far = item.actor ? item.z1 + 1.5 : item.z1
        if (far < cam.z - 1 || near > cam.z + FAR) return -1
        if (item.range && near - cam.z > item.range) return -1
        return Math.max(0, near - cam.z)
      }
      const show = (view: ItemView, d: number) => {
        const reveal = still ? 1 : clamp01((DRAW_FAR - d) / (DRAW_FAR - DRAW_NEAR))
        if (reveal <= 0.001) return view.hide()
        const fog = 0.45 + 0.55 * clamp01(1 - (d - 6) / (FAR - 6))
        ctx.offsets = offsets.get(view.item) ?? zero
        view.render(cam, ctx, fog * (view.item.range ? clamp01((view.item.range - d) / 3) : 1), Math.min(1.8, Math.max(0.55, 7 / (d + 3))), reveal)
      }
      for (const view of floorViews) {
        const d = visibleFor(view.item)
        if (d < 0) view.hide()
        else show(view, d)
      }
      const live: [ItemView, number][] = []
      for (const view of views) {
        const d = visibleFor(view.item)
        if (d < 0) view.hide()
        else live.push([view, (view.item.z0 + view.item.z1) / 2])
      }
      live.sort((a, b) => b[1] - a[1])
      if (live.length !== order.length || live.some(([v], i) => v !== order[i])) {
        order = live.map(([v]) => v)
        for (const v of order) sceneLayer.appendChild(v.g)
      }
      for (const [view] of live) show(view, visibleFor(view.item))
    }

    let raf = 0, last = 0, onScreen = false
    const tick = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016
      last = time
      if (!preference.matches) step(dt)
      place()
      render(dt)
      raf = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      last = 0
      svg.dataset.ambient = onScreen && !document.hidden ? 'playing' : 'paused'
      if (onScreen && !document.hidden) raf = requestAnimationFrame(tick)
    }
    for (let i = 0; i < 600; i++) step(0.05)
    readScroll()
    cam.z = target
    place()
    render(1)
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
    observer.observe(stage)
    window.addEventListener('scroll', readScroll, { passive: true })
    window.addEventListener('resize', readScroll)
    stage.addEventListener('pointermove', onPointer)
    stage.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('scroll', readScroll)
      window.removeEventListener('resize', readScroll)
      stage.removeEventListener('pointermove', onPointer)
      stage.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', sync)
      floorLayer.replaceChildren()
      sceneLayer.replaceChildren()
    }
  }, [])

  return (
    <section id="amhs" className="amhs" aria-labelledby="amhs-title">
      <header className="amhs-intro">
        <p className="amhs-eyebrow"><span>02</span> Material flow</p>
        <h2 id="amhs-title">Every wafer, always moving.<span>Drawn, dispatched, delivered.</span></h2>
        <p>Automated material handling carries wafer pods between stockers and process tools on overhead rails. We engineer the dispatch intelligence that keeps every vehicle, port and pod in motion.</p>
      </header>
      <div className="amhs-track" ref={trackRef}>
        <div className="amhs-stage" ref={stageRef}>
          <svg ref={svgRef} className="fab-art" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Walking down a hand-drawn semiconductor fab aisle: overhead hoist vehicles run on ceiling rails above load ports, stockers and process tools." data-ambient="paused">
            <defs>
              <symbol id="fab-tech" overflow="visible">
                <path d="M-30 0 L-35 -110 L-25 -150 L25 -150 L35 -110 L30 0 Z" className="paper" />
                <ellipse cx="0" cy="-172" rx="23" ry="26" className="paper" />
                <path d="M-20 0 L-25 -70 L-35 -110 L-25 -145 L25 -145 L35 -110 L25 -70 L20 0 M0 -70 L0 0 M-30 -130 L-45 -85 L-15 -70 M30 -130 L40 -90 L20 -75 M-19 -147 C-26 -160 -24 -190 -2 -198 C20 -197 26 -170 18 -147" className="sprite-k" />
                <path d="M-20 -85 L25 -95 L30 -65 L-15 -55 Z M-23 0 V-6 M23 0 V-6" className="sprite-d" />
                <path d="M-16 -178 H16 M-16 -168 H16" className="sprite-acc" />
                <ellipse cx="0" cy="0" rx="45" ry="10" className="sprite-shadow" />
              </symbol>
            </defs>
            <g ref={floorRef} />
            <g ref={sceneRef} />
          </svg>
        </div>
      </div>
    </section>
  )
}
