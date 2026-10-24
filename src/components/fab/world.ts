import type { Box, Cyl, FaceId, Item, Lines, Poly, Prim, V3 } from './engine'
import { Pencil, faceRect } from './pencil'
import {
  AMR_LENGTH, AMR_ROUTE, BUFFER_Z, CEILING_Z, INTERBAY, LOOP, LOOP_LENGTH, RAIL_Z, ROW_A, ROW_B, STOCKER, STOCKER_H,
  amrPoint, buildStations, loopPoint, portCenters, type Station, type Tool,
} from '../amhs/layout'

/** Layout space (x along the bay, y across it, z up) to view space (x across, y up, z along the aisle). */
export const AISLE_Y = 12
export const M = (x: number, y: number, z: number): V3 => [y - AISLE_Y, z, x]
const boxLayout = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box['b'] => [Math.min(y0, y1) - AISLE_Y, z0, x0, Math.max(y0, y1) - AISLE_Y, z1, x1]

type Row = 'A' | 'B'
/** Row B mirrors row A across the aisle centre, so every component is authored once in row-A coordinates. */
const mirror = (row: Row) => (y: number) => (row === 'A' ? y : 2 * AISLE_Y - y)
const aisleFace = (row: Row): FaceId => (row === 'A' ? 1 : 0)
const FRONT: FaceId = 4, BACK: FaceId = 5

const lines = (c: string, l: V3[][], extra: Partial<Lines> = {}): Lines => ({ t: 'lines', c, lines: l, ...extra })
const poly = (fill: string, rings: V3[][], extra: Partial<Poly> = {}): Poly => ({ t: 'poly', fill, rings, ...extra })
const cyl = (x: number, y: number, z0: number, z1: number, r: number, o: Partial<Cyl> = {}): Cyl => {
  const [cx, , cz] = M(x, y, 0)
  return { t: 'cyl', c: [cx, cz], y0: z0, y1: z1, r, fill: 'paper', cls: 'd', ...o }
}

type BoxFn = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => Box['b']
function foup(P: Pencil, x: number, y: number, z0: number, o: { st?: number; g?: number } = {}, box6: BoxFn = boxLayout): Prim[] {
  const shell = P.box(box6(x - 0.42, x + 0.42, y - 0.38, y + 0.38, z0, z0 + 0.7), { fill: 'pod', cls: 'foup', hatch: { 4: 0.1, 5: 0.1 }, hc: 'h-acc', amp: 0.004, ...o })
  for (const f of [0, 1] as FaceId[]) shell.details!.push({ f, c: 'f', lines: P.rect(shell.b, f, x - 0.32, z0 + 0.1, x + 0.32, z0 + 0.58, 0.002) })
  for (const f of [4, 5] as FaceId[]) shell.details!.push({ f, c: 'f', lines: P.rect(shell.b, f, shell.b[0] + 0.1, z0 + 0.1, shell.b[3] - 0.1, z0 + 0.58, 0.002) })
  const flange = P.box(box6(x - 0.2, x + 0.2, y - 0.19, y + 0.19, z0 + 0.7, z0 + 0.75), { fill: 'pod', cls: 'foup', amp: 0.003, ...o })
  const handle = P.box(box6(x - 0.31, x + 0.31, y - 0.12, y + 0.12, z0 + 0.75, z0 + 0.82), { fill: 'pod', cls: 'foup', amp: 0.003, ...o })
  return [shell, flange, handle]
}

function loadPort(P: Pencil, x: number, y: number): Prim[] {
  const base = P.box(boxLayout(x - 0.5, x + 0.5, y - 0.55, y + 0.55, 0, 0.95), { cls: 'd', hatch: { 4: 0.12, 5: 0.12 }, amp: 0.004 })
  for (const f of [0, 1] as FaceId[]) {
    base.details!.push({ f, c: 'f', lines: [...P.rect(base.b, f, x - 0.35, 0.18, x + 0.35, 0.62), ...[0.3, 0.4, 0.5].flatMap(v => P.line(M(x - 0.2, f ? y + 0.555 : y - 0.555, v), M(x + 0.2, f ? y + 0.555 : y - 0.555, v), 0.002, 1))] })
  }
  base.details!.push({ f: 3, c: 'f', lines: [[-0.2, -0.2], [0.2, -0.2], [0, 0.22]].flatMap(([dx, dy]) => P.circle(base.b, 3, y + dy - AISLE_Y, x + dx, 0.05, 8)) })
  return [base]
}

function signalTower(P: Pencil, x: number, y: number, z: number): Prim[] {
  const out: Prim[] = [lines('d', P.line(M(x, y, z), M(x, y, z + 0.35), 0.003))]
  for (let i = 0; i < 3; i++) out.push(cyl(x, y, z + 0.35 + i * 0.17, z + 0.52 + i * 0.17, 0.11, { cls: 'f', fill: i === 2 ? 'lamp' : i === 1 ? 'tone' : 'paper' }))
  return out
}

function duct(P: Pencil, x: number, y: number, z: number): Prim[] {
  return [
    cyl(x, y, z, z + 1.4, 0.28, { hatch: true, rings: [0.25, 0.4, 0.55, 0.7, 0.85, 1.0].map(v => z + v) }),
    lines('ph', P.line(M(x, y, z + 1.45), M(x, y, CEILING_Z), 0.004, 1)),
  ]
}

function toolTop(P: Pencil, tool: Tool, Y: (y: number) => number): Prim[] {
  const x0 = tool.x0, x1 = tool.x0 + tool.w, h = tool.h
  switch (tool.kind) {
    case 'litho': return [P.box(boxLayout(x0 + 1.1, x1 - 1.3, Y(2.3), Y(5.6), h, h + 0.85), { hatch: { 4: 0.14, 5: 0.14 } }), cyl(x0 + 2.6, Y(3.9), h + 0.85, h + 1.25, 0.55, { hatch: true, rings: [h + 1.05] })]
    case 'etch': return [cyl(x0 + 2.4, Y(4.1), h, h + 0.7, 0.9, { hatch: true, rings: [h + 0.25, h + 0.45] }), cyl(x0 + 2.4, Y(4.1), h + 0.7, h + 0.95, 0.4, { hatch: true })]
    case 'cvd': return [[1.5, 3.1], [3.9, 3.1], [2.7, 5.1]].map(([dx, dy]) => cyl(x0 + dx, Y(dy), h, h + 0.55, 0.55, { hatch: true, rings: [h + 0.3] }))
    case 'cmp': case 'implant': return [P.box(boxLayout(x0 + 0.7, x0 + 2.6, Y(2.2), Y(4.2), h, h + 0.5), { hatch: { 4: 0.12, 5: 0.12 } }), cyl(x0 + 3.8, Y(3.6), h, h + 1.1, 0.42, { hatch: true, rings: [h + 0.4, h + 0.75] })]
    case 'metro': case 'epi': return [P.box(boxLayout(x0 + 1.2, x0 + 4.4, Y(2.6), Y(5.2), h, h + 0.4), { hatch: { 4: 0.14, 5: 0.14 } }), cyl(x0 + 2.8, Y(3.9), h + 0.4, h + 0.75, 0.6, { hatch: true })]
    case 'diff': return [1.3, 3.2, 5.1].map(dx => cyl(x0 + dx, Y(3.6), h, h + 0.9, 0.5, { hatch: true, rings: [h + 0.3, h + 0.6] }))
    case 'wet': return [P.box(boxLayout(x0 + 0.6, x1 - 0.6, Y(2.0), Y(3.4), h, h + 0.35), { hatch: { 4: 0.12, 5: 0.12 } }), cyl(x0 + 1.4, Y(4.6), h, h + 0.8, 0.3, { hatch: true }), cyl(x1 - 1.4, Y(4.6), h, h + 0.8, 0.3, { hatch: true })]
    case 'cluster': return [0, 1, 2, 3].map(i => cyl(x0 + 1.1 + i * 1.05, Y(3.4 + (i % 2) * 1.2), h, h + 0.45, 0.45, { hatch: true }))
  }
}

function toolItem(P: Pencil, tool: Tool, row: Row, stations: Map<string, Station>): Item {
  const Y = mirror(row), af = aisleFace(row)
  const x0 = tool.x0, x1 = tool.x0 + tool.w, h = tool.h
  const prims: Prim[] = []
  const body = P.box(boxLayout(x0, x1, Y(1.6), Y(6.8), 0, h), { hatch: { 4: 0.18, 5: 0.18 } })
  const seams = [
    ...P.line(M(x0 + 0.12, Y(6.8), h - 0.42), M(x1 - 0.12, Y(6.8), h - 0.42), 0.004),
    ...[tool.w / 3, (2 * tool.w) / 3].flatMap(a => P.line(M(x0 + a, Y(6.8), 2.8), M(x0 + a, Y(6.8), h - 0.42), 0.003, 1)),
    ...Array.from({ length: 7 }, (_, i) => P.line(M(x0 + 0.35, Y(6.8), 2.95 + i * 0.1), M(x0 + 1.5, Y(6.8), 2.95 + i * 0.1), 0.002, 1)).flat(),
    ...P.rect(body.b, af, x1 - 2.0, 3.0, x1 - 0.45, Math.min(3.9, h - 0.55)),
    ...P.path(Array.from({ length: 11 }, (_, i) => M(x1 - 1.9 + i * 0.135, Y(6.8), 3.15 + 0.35 * Math.abs(Math.sin(i * 1.7 + x0)) * (i % 3 ? 1 : 0.4))), 0.002, 1),
  ]
  body.details!.push({ f: af, c: 'f', lines: seams })
  for (const f of [FRONT, BACK]) {
    const [u0, u1] = [body.b[0], body.b[3]]
    body.details!.push({ f, c: 'f', lines: [...P.rect(body.b, f, u0 + 0.9, 0.25, u1 - 1.1, h - 0.7), ...P.line([u0 + 1.3, h * 0.45, f === FRONT ? x0 - 0.004 : x1 + 0.004], [u0 + 1.3, h * 0.45 + 0.5, f === FRONT ? x0 - 0.004 : x1 + 0.004], 0.002)] })
  }
  prims.push(body, ...toolTop(P, tool, Y), ...duct(P, x1 - 0.8, Y(2.3), h), ...signalTower(P, x1 - 0.35, Y(6.45), h))

  const efem = P.box(boxLayout(x0 + 0.25, x1 - 0.25, Y(6.8), Y(8.4), 0, 2.7), { hatch: { 4: 0.15, 5: 0.15 } })
  const doors = portCenters(tool).flatMap(px => [...P.rect(efem.b, af, px - 0.46, 1.02, px + 0.46, 2.05), ...P.line(M(px - 0.36, Y(8.4), 1.16), M(px + 0.36, Y(8.4), 1.16), 0.002, 1)])
  efem.details!.push({ f: af, c: 'd', lines: doors })
  for (const f of [FRONT, BACK]) efem.details!.push({ f, c: 'f', lines: P.rect(efem.b, f, efem.b[0] + 0.3, 1.5, efem.b[3] - 0.3, 2.4) })
  efem.fills!.push({ f: af, fill: 'glass', pts: faceRect(efem.b, af, x0 + 0.6, 2.15, x1 - 0.6, 2.55) })
  prims.push(efem)

  portCenters(tool).forEach((px, i) => {
    prims.push(...loadPort(P, px, Y(LOOP.yA)))
    const st = stations.get(`${tool.id}/LP${i + 1}`)
    if (st) prims.push(...foup(P, px, Y(LOOP.yA), 0.95, { st: st.id }))
  })
  return { z0: x0, z1: x1, prims }
}

function stockerItem(P: Pencil, row: Row): Item {
  const Y = mirror(row), af = aisleFace(row)
  const { x0, x1, top, rows, row: rh } = STOCKER
  const h = STOCKER_H
  const body = P.box(boxLayout(x0, x1, Y(1.0), Y(8.4), 0, h), { hatch: { 4: 0.18, 5: 0.18 } })
  body.fills!.push({ f: af, fill: 'glass', pts: faceRect(body.b, af, x0 + 0.4, 1.5, x0 + 4.4, top) })
  for (let i = 0; i < 3; i++) for (let j = 0; j < rows; j++) {
    if ((i * 5 + j * 3) % 7 === 3) continue
    const a = x0 + 0.4 + (4 * i) / 3, b = 1.5 + rh * j
    body.fills!.push({ f: af, fill: 'pod', pts: faceRect(body.b, af, a + 0.28, b + 0.08, a + 1.05, b + 0.56) })
  }
  const grid = [
    ...P.rect(body.b, af, x0 + 0.4, 1.5, x0 + 4.4, top, 0.004),
    ...[1, 2].flatMap(i => P.line(M(x0 + 0.4 + (4 * i) / 3, Y(8.4), 1.5), M(x0 + 0.4 + (4 * i) / 3, Y(8.4), top), 0.003)),
    ...Array.from({ length: rows - 1 }, (_, j) => P.line(M(x0 + 0.4, Y(8.4), 1.5 + rh * (j + 1)), M(x0 + 4.4, Y(8.4), 1.5 + rh * (j + 1)), 0.003, 1)).flat(),
    ...STOCKER.ports.flatMap(px => P.rect(body.b, af, px - 0.45, 0.98, px + 0.45, 1.38)),
  ]
  body.details!.push({ f: af, c: 'd', lines: grid })
  body.details!.push({ f: af, c: 'f', lines: [...P.line(M(x0 + 0.8, Y(8.4), 4.6), M(x0 + 1.5, Y(8.4), 3.8), 0.002, 1), ...P.line(M(x0 + 1.1, Y(8.4), 4.75), M(x0 + 1.6, Y(8.4), 4.15), 0.002, 1), ...P.line(M(x0 + 3.2, Y(8.4), 2.5), M(x0 + 3.7, Y(8.4), 1.9), 0.002, 1)] })
  for (const f of [FRONT, BACK]) {
    const u0 = body.b[0], u1 = body.b[3], vz = f === FRONT ? x0 - 0.004 : x1 + 0.004
    body.details!.push({ f, c: 'f', lines: [...Array.from({ length: 8 }, (_, i) => P.line([u0 + 1.0, 3.7 + i * 0.1, vz], [u0 + 3.0, 3.7 + i * 0.1, vz], 0.002, 1)).flat(), ...P.rect(body.b, f, u1 - 3.4, 0.3, u1 - 0.8, 3.2)] })
  }
  const prims: Prim[] = [body, ...signalTower(P, x1 - 0.4, Y(8.0), h)]
  for (const px of STOCKER.ports) prims.push(...loadPort(P, px, Y(LOOP.yA)))
  return { z0: x0, z1: x1, prims }
}

function railPrims(P: Pencil, centre: { x: number; y: number }[], o: { hangers?: number; route?: boolean } = {}): Prim[] {
  const n = centre.length
  const frames = centre.map((p, i) => {
    const a = centre[Math.max(0, i - 1)], b = centre[Math.min(n - 1, i + 1)]
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1
    return { p, nx: -ty / l, ny: tx / l, tx: tx / l, ty: ty / l }
  })
  const w = 0.2, z = RAIL_Z
  const edge = (off: number, dz: number) => frames.map(({ p, nx, ny }) => M(p.x + nx * off, p.y + ny * off, z + dz))
  const prims: Prim[] = []
  const bl = edge(w, -0.24), br = edge(-w, -0.24)
  prims.push(poly('paper', [[...bl, ...[...br].reverse()]]))
  prims.push(lines('rail', [...P.path(edge(w, 0), 0.006, 2), ...P.path(edge(-w, 0), 0.006, 2), ...P.path(bl, 0.005, 1), ...P.path(br, 0.005, 1)]))
  const ties: V3[][] = []
  frames.forEach(({ p, nx, ny }, i) => {
    if (i % 2) return
    ties.push(...P.line(M(p.x + nx * w, p.y + ny * w, z - 0.24), M(p.x - nx * w, p.y - ny * w, z - 0.24), 0.002, 1))
    ties.push(...P.line(M(p.x + nx * w, p.y + ny * w, z), M(p.x + nx * w, p.y + ny * w, z - 0.24), 0.002, 1))
  })
  prims.push(lines('h', ties))
  if (o.hangers) {
    const rods: V3[][] = []
    frames.forEach(({ p, tx, ty }, i) => {
      if (i % o.hangers!) return
      rods.push(...P.line(M(p.x, p.y, z + 0.02), M(p.x, p.y, CEILING_Z), 0.005))
      rods.push(...P.line(M(p.x - tx * 0.5, p.y - ty * 0.5, CEILING_Z), M(p.x + tx * 0.5, p.y + ty * 0.5, CEILING_Z), 0.004))
      rods.push(...P.line(M(p.x + tx * 0.45, p.y + ty * 0.45, CEILING_Z), M(p.x, p.y, CEILING_Z - 0.7), 0.003, 1))
    })
    prims.push(lines('d', rods))
    const beam: V3[][] = []
    for (let i = 0; i + 1 < n; i += 2) beam.push([M(centre[i].x, centre[i].y, CEILING_Z + 0.04), M(centre[i + 1].x, centre[i + 1].y, CEILING_Z + 0.04)])
    prims.push(lines('ph', beam))
  }
  if (o.route) prims.push(lines('route', [frames.map(({ p }) => M(p.x, p.y, z - 0.25))]))
  return prims
}

function chunkedRail(P: Pencil, pts: { x: number; y: number }[], per: number, o: { hangers?: number; route?: boolean }): Item[] {
  const out: Item[] = []
  for (let i = 0; i < pts.length - 1; i += per) {
    const part = pts.slice(i, Math.min(pts.length, i + per + 1))
    const xs = part.map(p => p.x)
    out.push({ z0: Math.min(...xs) - 0.3, z1: Math.max(...xs) + 0.3, prims: railPrims(P, part, o) })
  }
  return out
}

function bezier(a: [number, number], b: [number, number], c: [number, number], d: [number, number], n = 40) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return { x: u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], y: u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1] }
  })
}

function bufferItem(P: Pencil, x0: number, x1: number, y0: number, y1: number, pods: number[]): Item {
  const z = BUFFER_Z
  const shelf = P.box(boxLayout(x0, x1, y0, y1, z, z + 0.1), { hatch: { 4: 0.05, 5: 0.05 }, amp: 0.004 })
  const rods = [[x0 + 0.1, y0 + 0.1], [x1 - 0.1, y0 + 0.1], [x0 + 0.1, y1 - 0.1], [x1 - 0.1, y1 - 0.1]].flatMap(([x, y]) => P.line(M(x, y, z + 0.1), M(x, y, CEILING_Z), 0.004, 1))
  return { z0: x0, z1: x1, prims: [lines('d', rods), shelf, ...pods.flatMap(x => foup(P, x, (y0 + y1) / 2, z + 0.1))] }
}

function floorItems(P: Pencil): Item[] {
  const items: Item[] = []
  for (let x = -1; x < 46; x += 4) {
    const x1 = x + 4
    const grid: V3[][] = []
    for (let y = 0; y <= 24; y += 1) {
      const aisle = y >= 8 && y <= 16
      if (!aisle && y % 2) continue
      grid.push(...P.line(M(x, y, 0), M(x1, y, 0), 0.003, 1))
    }
    for (let k = x; k < x1; k += 1) grid.push(...P.line(M(k, 7.5, 0), M(k, 16.5, 0), 0.003, 1))
    const dots: V3[][] = []
    for (let k = x; k < x1; k += 1) for (let y = 9; y < 15; y += 1) {
      if ((k + y) % 2) continue
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const p = M(k + 0.2 + i * 0.2, y + 0.2 + j * 0.2, 0.002)
        dots.push([p, [p[0] + 0.012, p[1], p[2]]])
      }
    }
    const safe: V3[][] = []
    for (let k = Math.max(3, x); k < Math.min(42.5, x1); k += 0.9) for (const y of [9.75, 14.25]) safe.push([M(k, y, 0.003), M(k + 0.55, y, 0.003)])
    const route: V3[][] = []
    for (let s = 0; s < AMR_LENGTH; s += 0.6) {
      const a = amrPoint(s), b = amrPoint(s + 0.3)
      if (a.x < x || a.x >= x1) continue
      route.push([M(a.x, a.y, 0.004), M(b.x, b.y, 0.004)])
    }
    const chevrons: V3[][] = []
    for (let cx = AMR_ROUTE.x0 + 2; cx < AMR_ROUTE.x1 - 1; cx += 4) {
      if (cx < x || cx >= x1) continue
      for (const [y, dir] of [[AMR_ROUTE.y0, 1], [AMR_ROUTE.y1, -1]] as const) chevrons.push(...P.path([M(cx - 0.3 * dir, y - 0.3, 0.004), M(cx + 0.2 * dir, y, 0.004), M(cx - 0.3 * dir, y + 0.3, 0.004)], 0.003, 1))
    }
    items.push({ z0: x, z1: x1, prims: [lines('grid', grid), lines('acc-dash', safe), lines('route-floor', route), lines('f', chevrons)] })
    items.push({ z0: x, z1: x1, range: 10, prims: [lines('dot', dots)] })
  }
  return items
}

function roomItems(P: Pencil): Item[] {
  const items: Item[] = []
  const top = CEILING_Z + 0.6
  for (let x = -1; x < 46; x += 4) {
    const x1 = x + 4
    const ceiling: V3[][] = []
    for (let y = 0; y <= 24; y += 2) ceiling.push(...P.line(M(x, y, top), M(x1, y, top), 0.004, 1))
    for (let k = x; k < x1; k += 2) ceiling.push(...P.line(M(k, 0, top), M(k, 24, top), 0.004, 1))
    const walls: Prim[] = []
    for (const y of [0, 24]) {
      walls.push(poly('paper', [[M(x, y, 0), M(x1, y, 0), M(x1, y, top), M(x, y, top)]]))
      walls.push(lines('f', [...P.line(M(x, y, 0.3), M(x1, y, 0.3), 0.004, 1), ...P.line(M(x, y, 3.2), M(x1, y, 3.2), 0.004, 1), ...[0, 2].flatMap(k => P.line(M(x + k, y, 0), M(x + k, y, top), 0.004, 1))]))
    }
    items.push({ z0: x, z1: x1, prims: [...walls, lines('ph', ceiling)] })
  }
  const end = 46
  const wall: V3[][] = []
  for (let y = 0; y <= 24; y += 2) wall.push(...P.line(M(end, y, 0), M(end, y, top), 0.004, 1))
  wall.push(...P.line(M(end, 0, 3.2), M(end, 24, 3.2), 0.004, 1))
  items.push({ z0: end, z1: end + 0.1, prims: [poly('paper', [[M(end, 0, 0), M(end, 24, 0), M(end, 24, top), M(end, 0, top)]]), lines('f', wall)] })
  return items
}

export function buildWorld() {
  const P = new Pencil(11)
  const stations = buildStations()
  const byLabel = new Map(stations.map(s => [s.label, s]))
  const items: Item[] = []

  items.push(...roomItems(P))
  items.push(stockerItem(P, 'A'), stockerItem(P, 'B'))
  ROW_A.forEach(t => items.push(toolItem(P, t, 'A', byLabel)))
  ROW_B.forEach(t => items.push(toolItem(P, t, 'B', byLabel)))

  const loop = Array.from({ length: Math.round(LOOP_LENGTH / 0.3) + 1 }, (_, i) => loopPoint(i * 0.3))
  items.push(...chunkedRail(P, loop, 10, { hangers: 9, route: true }))
  const interbay = Array.from({ length: 129 }, (_, i) => ({ x: INTERBAY.x0 + (i * (INTERBAY.x1 - INTERBAY.x0)) / 128, y: INTERBAY.y }))
  items.push(...chunkedRail(P, interbay, 8, { hangers: 6 }))
  items.push(...chunkedRail(P, bezier([12, INTERBAY.y], [17, INTERBAY.y], [16, LOOP.yA], [21, LOOP.yA]), 10, {}))
  items.push(...chunkedRail(P, bezier([29, LOOP.yA], [34, LOOP.yA], [33, INTERBAY.y], [38, INTERBAY.y]), 10, {}))
  items.push(bufferItem(P, 36.0, 39.4, 7.7, 8.4, [37.0, 38.3]))
  items.push(bufferItem(P, 17.0, 20.4, 15.6, 16.3, [17.6, 19.8]))
  items.push(bufferItem(P, 29.6, 33.0, 15.6, 16.3, [30.3, 31.6, 32.4]))
  items.push({ z0: 24.3, z1: 24.9, prims: [{ t: 'sprite', kind: 'tech', at: M(24.6, 13.75, 0) }] })

  return { items: items.filter(i => i.prims.length), floor: floorItems(P), stations }
}

const V = (x: number, y: number, z: number): V3 => [y, z, x]
const vb = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box['b'] => [y0, z0, x0, y1, z1, x1]

/** Overhead hoist vehicle around its rail attachment point; group 1 is the hoist plate and carried pod. */
export function vehicleItem(seed: number, podId: number): Item & { belts: Lines } {
  const P = new Pencil(seed)
  const neck = P.box(vb(-0.16, 0.16, -0.16, 0.16, -0.3, -0.02), { amp: 0.003 })
  const body = P.box(vb(-0.55, 0.55, -0.48, 0.48, -1.15, -0.3), { hatch: { 4: 0.08, 5: 0.08, 2: 0.1 }, amp: 0.005 })
  for (const f of [0, 1] as FaceId[]) {
    body.details!.push({ f, c: 'f', lines: [...P.rect(body.b, f, -0.43, -1.03, 0.43, -0.42, 0.002), ...P.line(f ? [0.481, -0.73, -0.43] : [-0.481, -0.73, -0.43], f ? [0.481, -0.73, 0.43] : [-0.481, -0.73, 0.43], 0.002, 1)] })
    body.fills!.push({ f, fill: 'screen', pts: faceRect(body.b, f, -0.3, -0.62, 0.05, -0.48) })
    body.fills!.push({ f, fill: 'lamp-dot', pts: faceRect(body.b, f, 0.22, -0.62, 0.3, -0.54) })
  }
  for (const f of [4, 5] as FaceId[]) {
    body.details!.push({ f, c: 'f', lines: P.rect(body.b, f, -0.36, -1.0, 0.36, -0.45, 0.002) })
    body.fills!.push({ f, fill: 'screen', pts: faceRect(body.b, f, -0.22, -0.7, 0.12, -0.56) })
    body.fills!.push({ f, fill: 'lamp-dot', pts: faceRect(body.b, f, 0.2, -0.7, 0.28, -0.62) })
  }
  const plate = P.box(vb(-0.38, 0.38, -0.34, 0.34, -1.23, -1.15), { amp: 0.003, hatch: { 2: 0.06 }, g: 1 })
  const belts: Lines = { t: 'lines', c: 'belt', lines: [] }
  const pod = foup(P, 0, 0, -2.05, { st: podId, g: 1 }, vb)
  return { z0: 0, z1: 0, actor: true, prims: [belts, plate, ...pod, body, neck], belts }
}

export const BELT_POINTS: V3[] = [[-0.3, -0.26], [0.3, -0.26], [-0.3, 0.26], [0.3, 0.26]].map(([x, y]) => V(x, y, -1.15))

export function amrItem(seed: number, loaded: boolean, podId: number): Item & { pulse: Lines } {
  const P = new Pencil(seed)
  const body = P.box(vb(-0.55, 0.55, -0.48, 0.48, 0.05, 0.45), { hatch: { 4: 0.07, 5: 0.07 }, amp: 0.004 })
  for (const f of [0, 1] as FaceId[]) body.details!.push({ f, c: 'acc', lines: P.line(f ? [0.481, 0.27, -0.45] : [-0.481, 0.27, -0.45], f ? [0.481, 0.27, 0.45] : [-0.481, 0.27, 0.45], 0.002) })
  for (const f of [0, 1] as FaceId[]) body.details!.push({ f, c: 'd', lines: [...P.circle(body.b, f, -0.3, 0.1, 0.08, 10), ...P.circle(body.b, f, 0.3, 0.1, 0.08, 10)] })
  const lidar: Cyl = { t: 'cyl', c: [0.25, 0.3], y0: 0.45, y1: 0.6, r: 0.12, fill: 'paper', cls: 'f', hatch: true }
  const pulse: Lines = { t: 'lines', c: 'lidar', lines: [] }
  const pod = loaded ? foup(P, 0, 0, 0.45, { st: podId }, vb) : []
  return { z0: 0, z1: 0, actor: true, prims: [pulse, body, lidar, ...pod], pulse }
}

/** Stocker crane on the aisle face; group 1 is the carriage, offset by its height. */
export function craneItem(seed: number, row: Row): Item {
  const P = new Pencil(seed)
  const y = mirror(row)(8.4) - AISLE_Y + (row === 'A' ? 0.02 : -0.02)
  const mast = [...P.line([y, 1.5, -0.06], [y, STOCKER.top, -0.06], 0.004), ...P.line([y, 1.5, 0.06], [y, STOCKER.top, 0.06], 0.004)]
  const rungs: V3[][] = []
  for (let c = 1.7; c < STOCKER.top - 0.1; c += 0.32) rungs.push(...P.line([y, c, -0.06], [y, c + 0.16, 0.06], 0.001, 1))
  const carriage = P.box([y - 0.03, 0, -0.42, y + 0.03, 0.42, 0.42], { cls: 'k', amp: 0.003, g: 1, fill: 'paper' })
  carriage.fills!.push({ f: row === 'A' ? 1 : 0, fill: 'pod', pts: faceRect(carriage.b, row === 'A' ? 1 : 0, -0.28, 0.12, 0.28, 0.36) })
  return { z0: 0, z1: 0, actor: true, prims: [lines('d', mast), lines('f', rungs), carriage] }
}
