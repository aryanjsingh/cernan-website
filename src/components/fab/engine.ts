export type V3 = [number, number, number]

/** Axis-aligned box faces: 0 -x, 1 +x, 2 -y, 3 +y, 4 -z, 5 +z. */
export type FaceId = 0 | 1 | 2 | 3 | 4 | 5

export type Box = {
  t: 'box'
  b: [number, number, number, number, number, number]
  fill: string
  cls: string
  edges: V3[][][]
  hatch?: Partial<Record<FaceId, V3[][]>>
  hc?: string
  details?: { f: FaceId; c: string; lines: V3[][] }[]
  fills?: { f: FaceId; fill: string; pts: V3[] }[]
  st?: number
  g?: number
}
export type Lines = { t: 'lines'; c: string; lines: V3[][]; st?: number; g?: number }
export type Poly = { t: 'poly'; fill: string; rings: V3[][]; st?: number; g?: number }
export type Sprite = { t: 'sprite'; kind: string; at: V3; flip?: boolean; g?: number }
export type Label = { t: 'text'; at: V3; text: string; size: number; c: string; g?: number; vis?: [Box['b'], FaceId] }
export type Cyl = { t: 'cyl'; c: [number, number]; y0: number; y1: number; r: number; fill: string; cls: string; rings?: number[]; hatch?: boolean; st?: number; g?: number }
export type Prim = Box | Lines | Poly | Sprite | Label | Cyl

export type Item = { z0: number; z1: number; prims: Prim[]; range?: number; actor?: boolean }

export const VIEW = { w: 1600, h: 1000 }
const NEAR = 0.12

const CORNERS = (b: Box['b']): V3[] => Array.from({ length: 8 }, (_, i) => [i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]] as V3)
export const FACE_QUADS: number[][] = [[0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6], [0, 1, 3, 2], [4, 6, 7, 5]]
export const BOX_EDGES: [number, number][] = (() => {
  const set = new Map<string, [number, number]>()
  for (const q of FACE_QUADS) for (let i = 0; i < 4; i++) {
    const a = Math.min(q[i], q[(i + 1) % 4]), b = Math.max(q[i], q[(i + 1) % 4])
    set.set(`${a}-${b}`, [a, b])
  }
  return [...set.values()]
})()
export const FACE_EDGES: number[][] = FACE_QUADS.map(q => q.map((c, i) => {
  const a = Math.min(c, q[(i + 1) % 4]), b = Math.max(c, q[(i + 1) % 4])
  return BOX_EDGES.findIndex(([x, y]) => x === a && y === b)
}))
export { CORNERS }

export class Camera {
  x = 0; y = 1.62; z = 0; yaw = 0; pitch = 0
  F = 860; cx = VIEW.w / 2; cy = VIEW.h * 0.47
  private cyaw = 1; private syaw = 0; private cp = 1; private sp = 0
  ox = 0; oy = 0; oz = 0
  update() { this.cyaw = Math.cos(this.yaw); this.syaw = Math.sin(this.yaw); this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch) }
  /** World point (plus current offset) into camera space; z is depth. */
  toCam(p: V3, out: V3) {
    const dx = p[0] + this.ox - this.x, dy = p[1] + this.oy - this.y, dz = p[2] + this.oz - this.z
    const x1 = dx * this.cyaw - dz * this.syaw, z1 = dx * this.syaw + dz * this.cyaw
    out[0] = x1
    out[1] = dy * this.cp - z1 * this.sp
    out[2] = dy * this.sp + z1 * this.cp
    return out
  }
  sx(c: V3) { return this.cx + (this.F * c[0]) / c[2] }
  sy(c: V3) { return this.cy - (this.F * c[1]) / c[2] }
  /** Whether the camera sits on the outside of a box face, so the face is visible. */
  faceVisible(b: Box['b'], f: FaceId) {
    const cx = this.x - this.ox, cy = this.y - this.oy, cz = this.z - this.oz
    switch (f) {
      case 0: return cx < b[0]
      case 1: return cx > b[3]
      case 2: return cy < b[1]
      case 3: return cy > b[4]
      case 4: return cz < b[2]
      default: return cz > b[5]
    }
  }
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const A: V3 = [0, 0, 0], B: V3 = [0, 0, 0]

export function polyline(cam: Camera, pts: V3[], out: string[]) {
  let prevIn = false
  const prev: V3 = [0, 0, 0]
  for (let i = 0; i < pts.length; i++) {
    const c = cam.toCam(pts[i], A)
    const cin = c[2] > NEAR
    if (i > 0) {
      if (prevIn && cin) out.push(`L${f1(cam.sx(c))} ${f1(cam.sy(c))}`)
      else if (prevIn !== cin) {
        const t = (NEAR - prev[2]) / (c[2] - prev[2])
        B[0] = prev[0] + (c[0] - prev[0]) * t; B[1] = prev[1] + (c[1] - prev[1]) * t; B[2] = NEAR
        if (prevIn) out.push(`L${f1(cam.sx(B))} ${f1(cam.sy(B))}`)
        else out.push(`M${f1(cam.sx(B))} ${f1(cam.sy(B))}L${f1(cam.sx(c))} ${f1(cam.sy(c))}`)
      }
    } else if (cin) out.push(`M${f1(cam.sx(c))} ${f1(cam.sy(c))}`)
    prev[0] = c[0]; prev[1] = c[1]; prev[2] = c[2]
    prevIn = cin
  }
}

function ring(cam: Camera, pts: V3[], out: string[]) {
  const cs = pts.map(p => cam.toCam(p, [0, 0, 0]))
  const clipped: V3[] = []
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length]
    const ain = a[2] > NEAR, bin = b[2] > NEAR
    if (ain) clipped.push(a)
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2])
      clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR])
    }
  }
  if (clipped.length < 3) return
  out.push(`M${clipped.map(c => `${f1(cam.sx(c))} ${f1(cam.sy(c))}`).join('L')}Z`)
}

type Call = { kind: 'path'; cls: string; d: string } | { kind: 'use'; cls: string; href: string; tf: string } | { kind: 'text'; cls: string; text: string; x: number; y: number; size: number }

export type Ctx = { occupied: (station: number) => boolean; offsets: V3[] }

export function drawItem(cam: Camera, item: Item, ctx: Ctx, calls: Call[]) {
  calls.length = 0
  const buf: string[] = []
  for (const prim of item.prims) {
    const o = ctx.offsets[prim.g ?? 0] ?? ctx.offsets[0]
    cam.ox = o[0]; cam.oy = o[1]; cam.oz = o[2]
    const hidden = 'st' in prim && prim.st !== undefined && !ctx.occupied(prim.st)
    switch (prim.t) {
      case 'box': {
        const corners = CORNERS(prim.b)
        const vis = ([0, 1, 2, 3, 4, 5] as FaceId[]).filter(f => !hidden && cam.faceVisible(prim.b, f))
        buf.length = 0
        for (const f of vis) ring(cam, FACE_QUADS[f].map(i => corners[i]), buf)
        calls.push({ kind: 'path', cls: prim.fill, d: buf.join('') })
        for (const fl of prim.fills ?? []) {
          buf.length = 0
          if (vis.includes(fl.f)) ring(cam, fl.pts, buf)
          calls.push({ kind: 'path', cls: fl.fill, d: buf.join('') })
        }
        buf.length = 0
        const used = new Set<number>()
        for (const f of vis) for (const e of FACE_EDGES[f]) used.add(e)
        for (const e of used) for (const pass of prim.edges[e]) polyline(cam, pass, buf)
        calls.push({ kind: 'path', cls: prim.cls, d: buf.join('') })
        buf.length = 0
        if (prim.hatch) for (const f of vis) for (const l of prim.hatch[f] ?? []) polyline(cam, l, buf)
        calls.push({ kind: 'path', cls: prim.hc ?? 'h', d: buf.join('') })
        for (const det of prim.details ?? []) {
          buf.length = 0
          if (vis.includes(det.f)) for (const l of det.lines) polyline(cam, l, buf)
          calls.push({ kind: 'path', cls: det.c, d: buf.join('') })
        }
        break
      }
      case 'lines':
        buf.length = 0
        if (!hidden) for (const l of prim.lines) polyline(cam, l, buf)
        calls.push({ kind: 'path', cls: prim.c, d: buf.join('') })
        break
      case 'poly':
        buf.length = 0
        if (!hidden) for (const r of prim.rings) ring(cam, r, buf)
        calls.push({ kind: 'path', cls: prim.fill, d: buf.join('') })
        break
      case 'cyl': {
        const toward = Math.atan2(cam.z - cam.oz - prim.c[1], cam.x - cam.ox - prim.c[0])
        const at = (a: number, y: number): V3 => [prim.c[0] + prim.r * Math.cos(a), y, prim.c[1] + prim.r * Math.sin(a)]
        const arc = (y: number, a0: number, a1: number, n = 10) => Array.from({ length: n + 1 }, (_, i) => at(a0 + ((a1 - a0) * i) / n, y))
        const h = Math.PI / 2
        buf.length = 0
        if (!hidden) ring(cam, [...arc(prim.y0, toward - h, toward + h), ...arc(prim.y1, toward + h, toward + 3 * h)], buf)
        calls.push({ kind: 'path', cls: prim.fill, d: buf.join('') })
        buf.length = 0
        if (!hidden) {
          polyline(cam, arc(prim.y1, 0, Math.PI * 2, 20), buf)
          polyline(cam, arc(prim.y0, toward - h, toward + h), buf)
          polyline(cam, [at(toward - h, prim.y0), at(toward - h, prim.y1)], buf)
          polyline(cam, [at(toward + h, prim.y0), at(toward + h, prim.y1)], buf)
          for (const y of prim.rings ?? []) polyline(cam, arc(y, toward - h, toward + h, 8), buf)
        }
        calls.push({ kind: 'path', cls: prim.cls, d: buf.join('') })
        buf.length = 0
        if (!hidden && prim.hatch) for (let i = 1; i < 6; i++) {
          const a = toward + h * 0.15 + (h * 0.8 * i) / 6
          polyline(cam, [at(a, prim.y0 + (prim.y1 - prim.y0) * 0.05), at(a, prim.y1 - (prim.y1 - prim.y0) * (0.1 + 0.05 * (i % 3)))], buf)
        }
        calls.push({ kind: 'path', cls: 'h', d: buf.join('') })
        break
      }
      case 'sprite': {
        const c = cam.toCam(prim.at, A)
        const k = c[2] > 0.5 ? cam.F / c[2] / 100 : 0
        calls.push({ kind: 'use', cls: 'sprite', href: `#fab-${prim.kind}`, tf: k ? `translate(${f1(cam.sx(c))} ${f1(cam.sy(c))}) scale(${(prim.flip ? -k : k).toFixed(4)} ${k.toFixed(4)})` : '' })
        break
      }
      case 'text': {
        const c = cam.toCam(prim.at, A)
        const ok = c[2] > 0.4 && (!prim.vis || cam.faceVisible(prim.vis[0], prim.vis[1]))
        calls.push({ kind: 'text', cls: prim.c, text: prim.text, x: ok ? cam.sx(c) : 0, y: ok ? cam.sy(c) : 0, size: ok ? (cam.F * prim.size) / c[2] : 0 })
        break
      }
    }
  }
  cam.ox = cam.oy = cam.oz = 0
  return calls
}

const SVGNS = 'http://www.w3.org/2000/svg'

/** Keeps one <g> per item and reuses its children, so each frame only rewrites attributes. */
export class ItemView {
  g: SVGGElement
  private kids: SVGElement[] = []
  private calls: Call[] = []
  private visible = false
  item: Item
  constructor(item: Item, parent: SVGGElement) {
    this.item = item
    this.g = document.createElementNS(SVGNS, 'g')
    this.g.style.display = 'none'
    parent.appendChild(this.g)
  }
  hide() { if (this.visible) { this.g.style.display = 'none'; this.visible = false } }
  /** reveal: 0..1 pen progress; strokes draw on and fills fade in as it rises. */
  render(cam: Camera, ctx: Ctx, opacity: number, weight: number, reveal = 1) {
    if (!this.visible) { this.g.style.display = ''; this.visible = true }
    this.g.style.opacity = opacity.toFixed(3)
    this.g.style.setProperty('--w', weight.toFixed(2))
    this.g.style.setProperty('--r', reveal.toFixed(3))
    const calls = drawItem(cam, this.item, ctx, this.calls)
    calls.forEach((call, i) => {
      let el = this.kids[i]
      const tag = call.kind === 'path' ? 'path' : call.kind === 'use' ? 'use' : 'text'
      if (!el || el.tagName !== tag) {
        const next = document.createElementNS(SVGNS, tag)
        if (el) this.g.replaceChild(next, el)
        else this.g.appendChild(next)
        this.kids[i] = el = next
        el.setAttribute('class', call.cls)
        // Normalised length so the CSS draw-on works even though d changes every frame.
        if (call.kind === 'path') el.setAttribute('pathLength', '1')
        if (call.kind === 'use') el.setAttribute('href', call.href)
        if (call.kind === 'text') el.textContent = call.text
      }
      if (call.kind === 'path') el.setAttribute('d', call.d)
      else if (call.kind === 'use') {
        if (call.tf) { el.setAttribute('transform', call.tf); el.style.display = '' } else el.style.display = 'none'
        if (el.getAttribute('href') !== call.href) el.setAttribute('href', call.href)
      } else {
        if (call.size > 0.8) {
          el.style.display = ''
          el.setAttribute('x', f1(call.x)); el.setAttribute('y', f1(call.y))
          el.setAttribute('font-size', call.size.toFixed(2))
        } else el.style.display = 'none'
        if (el.textContent !== call.text) el.textContent = call.text
      }
    })
  }
}
