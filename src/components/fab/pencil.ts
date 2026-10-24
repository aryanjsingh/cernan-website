import { BOX_EDGES, CORNERS, type Box, type FaceId, type V3 } from './engine'

export function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type BoxOpts = { fill?: string; cls?: string; hatch?: Partial<Record<FaceId, number>>; slope?: number; hc?: string; amp?: number; passes?: number; st?: number; g?: number }

/** Maps face coordinates (u, v) to a point on the face plane. u/v are absolute world coordinates on the face's two free axes. */
export function facePoint(b: Box['b'], f: FaceId, u: number, v: number, lift = 0.004): V3 {
  switch (f) {
    case 0: return [b[0] - lift, v, u]
    case 1: return [b[3] + lift, v, u]
    case 2: return [u, b[1] - lift, v]
    case 3: return [u, b[4] + lift, v]
    case 4: return [u, v, b[2] - lift]
    default: return [u, v, b[5] + lift]
  }
}

/** Ranges of the face's free axes: [u0, u1, v0, v1]. */
export function faceRange(b: Box['b'], f: FaceId): [number, number, number, number] {
  if (f < 2) return [b[2], b[5], b[1], b[4]]
  if (f < 4) return [b[0], b[3], b[2], b[5]]
  return [b[0], b[3], b[1], b[4]]
}

/** Hand-drawn strokes in world space: subdivided, bowed, jittered and drawn in two overshooting passes. */
export class Pencil {
  r: () => number
  constructor(seed: number) { this.r = random(seed) }
  rand(a = 0, b = 1) { return a + (b - a) * this.r() }
  j(amount: number) { return (this.r() * 2 - 1) * amount }

  line(a: V3, b: V3, amp = 0.006, passes = 2): V3[][] {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const n = Math.max(1, Math.ceil(len / 0.7))
    const out: V3[][] = []
    for (let k = 0; k < passes; k++) {
      const t0 = k ? -this.rand(0, 0.03) : 0, t1 = 1 + (k ? this.rand(0, 0.05) : 0)
      const bow: V3 = [this.j(amp * 1.6), this.j(amp * 1.6), this.j(amp * 1.6)]
      const pts: V3[] = []
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n, s = Math.sin(Math.PI * Math.min(1, Math.max(0, t)))
        pts.push([
          a[0] + (b[0] - a[0]) * t + bow[0] * s + this.j(amp * 0.5),
          a[1] + (b[1] - a[1]) * t + bow[1] * s + this.j(amp * 0.5),
          a[2] + (b[2] - a[2]) * t + bow[2] * s + this.j(amp * 0.5),
        ])
      }
      out.push(pts)
    }
    return out
  }

  path(pts: V3[], amp = 0.005, passes = 2, closed = false): V3[][] {
    const src = closed ? [...pts, pts[0]] : pts
    const out: V3[][] = []
    for (let k = 0; k < passes; k++) {
      const p1 = this.rand(0, 6.28), f = this.rand(1.5, 3)
      let acc = 0
      out.push(src.map((p, i) => {
        if (i) acc += Math.hypot(p[0] - src[i - 1][0], p[1] - src[i - 1][1], p[2] - src[i - 1][2])
        const w = Math.sin(acc * f + p1) * amp
        return [p[0] + w + this.j(amp * 0.3), p[1] + w * 0.6 + this.j(amp * 0.3), p[2] + this.j(amp * 0.3)] as V3
      }))
    }
    return out
  }

  lines(segments: [V3, V3][], amp = 0.004, passes = 1) {
    return segments.flatMap(([a, b]) => this.line(a, b, amp, passes))
  }

  hatch(b: Box['b'], f: FaceId, spacing: number, slope = 0.4): V3[][] {
    const [u0, u1, v0, v1] = faceRange(b, f)
    const A = u1 - u0, B = v1 - v0
    const out: V3[][] = []
    for (let c = spacing * this.rand(0.2, 1); c < A + slope * B; c += spacing * this.rand(0.8, 1.2)) {
      const s0 = Math.max(0, slope ? (c - A) / slope : 0), s1 = Math.min(B, slope ? c / slope : B)
      if (s1 - s0 < B * 0.05) continue
      const len = s1 - s0
      const a0 = s0 + len * this.rand(0, 0.12), a1 = s1 - len * this.rand(0, 0.25)
      out.push(...this.line(facePoint(b, f, u0 + c - slope * a0, v0 + a0), facePoint(b, f, u0 + c - slope * a1, v0 + a1), 0.002, 1))
    }
    return out
  }

  /** Rectangle outline drawn on a face, in that face's absolute u/v coordinates. */
  rect(b: Box['b'], f: FaceId, u0: number, v0: number, u1: number, v1: number, amp = 0.003): V3[][] {
    const p = (u: number, v: number) => facePoint(b, f, u, v)
    return [...this.line(p(u0, v0), p(u1, v0), amp, 1), ...this.line(p(u1, v0), p(u1, v1), amp, 1), ...this.line(p(u1, v1), p(u0, v1), amp, 1), ...this.line(p(u0, v1), p(u0, v0), amp, 1)]
  }

  circle(b: Box['b'], f: FaceId, u: number, v: number, r: number, n = 14): V3[][] {
    return this.path(Array.from({ length: n }, (_, i) => facePoint(b, f, u + Math.cos((i / n) * Math.PI * 2) * r, v + Math.sin((i / n) * Math.PI * 2) * r)), r * 0.04, 1, true)
  }

  box(b: Box['b'], o: BoxOpts = {}): Box {
    const c = CORNERS(b)
    const amp = o.amp ?? 0.006
    const edges = BOX_EDGES.map(([i, k]) => this.line(c[i], c[k], amp, o.passes ?? 2))
    const hatch: Partial<Record<FaceId, V3[][]>> = {}
    for (const [f, s] of Object.entries(o.hatch ?? {})) hatch[Number(f) as FaceId] = this.hatch(b, Number(f) as FaceId, s, o.slope ?? 0.4)
    return { t: 'box', b, fill: o.fill ?? 'paper', cls: o.cls ?? 'k', edges, hatch, hc: o.hc, st: o.st, g: o.g, details: [], fills: [] }
  }
}

export function faceRect(b: Box['b'], f: FaceId, u0: number, v0: number, u1: number, v1: number): V3[] {
  return [facePoint(b, f, u0, v0), facePoint(b, f, u1, v0), facePoint(b, f, u1, v1), facePoint(b, f, u0, v1)]
}
