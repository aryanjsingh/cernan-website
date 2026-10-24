export const RAIL_Z = 6.2
export const CEILING_Z = 8.0
/** Hoist travel that brings a carried pod (2.05 below the rail) onto a 0.95 m load port. */
export const HOIST_MAX = RAIL_Z - 2.05 - 0.95
export const STOCKER_H = 5.4
export const BUFFER_Z = RAIL_Z - 1.85

export const LOOP = { x0: 3.5, x1: 40.5, yA: 9, yB: 15, cy: 12, r: 3 }
const RUN = LOOP.x1 - LOOP.x0
const ARC = Math.PI * LOOP.r
export const LOOP_LENGTH = 2 * RUN + 2 * ARC

/** Arc-length position on the intrabay loop: clockwise along the back rail, around the far end, back along the front rail. */
export function loopPoint(distance: number) {
  const s = ((distance % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH
  if (s < RUN) return { x: LOOP.x0 + s, y: LOOP.yA }
  if (s < RUN + ARC) {
    const t = -Math.PI / 2 + (s - RUN) / LOOP.r
    return { x: LOOP.x1 + Math.cos(t) * LOOP.r, y: LOOP.cy + Math.sin(t) * LOOP.r }
  }
  if (s < 2 * RUN + ARC) return { x: LOOP.x1 - (s - RUN - ARC), y: LOOP.yB }
  const t = Math.PI / 2 + (s - 2 * RUN - ARC) / LOOP.r
  return { x: LOOP.x0 + Math.cos(t) * LOOP.r, y: LOOP.cy + Math.sin(t) * LOOP.r }
}

export const backDistance = (x: number) => x - LOOP.x0
export const frontDistance = (x: number) => RUN + ARC + (LOOP.x1 - x)

export const INTERBAY = { y: -1.4, x0: -10, x1: 54 }

export type ToolKind = 'litho' | 'etch' | 'cvd' | 'cmp' | 'metro' | 'implant' | 'diff' | 'wet' | 'cluster' | 'epi'
export type Tool = { id: string; name: string; kind: ToolKind; x0: number; w: number; h: number; ports: number }

export const ROW_A: Tool[] = [
  { id: 'LITHO-01', name: 'Lithography', kind: 'litho', x0: 7.5, w: 6.4, h: 4.0, ports: 3 },
  { id: 'ETCH-02', name: 'Plasma etch', kind: 'etch', x0: 14.9, w: 5.0, h: 3.4, ports: 2 },
  { id: 'CVD-03', name: 'Deposition', kind: 'cvd', x0: 20.9, w: 5.6, h: 3.7, ports: 2 },
  { id: 'CMP-04', name: 'Planarize', kind: 'cmp', x0: 27.5, w: 5.2, h: 3.2, ports: 2 },
  { id: 'METRO-05', name: 'Metrology', kind: 'metro', x0: 33.7, w: 5.8, h: 3.0, ports: 3 },
]

export const ROW_B: Tool[] = [
  { id: 'IMP-06', name: 'Ion implant', kind: 'implant', x0: 7.5, w: 5.8, h: 4.0, ports: 2 },
  { id: 'DIFF-07', name: 'Furnace', kind: 'diff', x0: 14.3, w: 6.4, h: 4.4, ports: 3 },
  { id: 'WET-08', name: 'Wet bench', kind: 'wet', x0: 21.7, w: 5.6, h: 3.4, ports: 2 },
  { id: 'PVD-09', name: 'Cluster PVD', kind: 'cluster', x0: 28.3, w: 5.4, h: 3.8, ports: 2 },
  { id: 'EPI-10', name: 'Epitaxy', kind: 'epi', x0: 34.7, w: 5.0, h: 3.6, ports: 2 },
]

export const portCenters = (tool: Tool) => {
  const a = tool.x0 + 1.0, b = tool.x0 + tool.w - 1.0
  return Array.from({ length: tool.ports }, (_, i) => (tool.ports === 1 ? (a + b) / 2 : a + ((b - a) * i) / (tool.ports - 1)))
}

export const STOCKER = { x0: 1.5, x1: 6.3, ports: [4.0, 5.4], top: STOCKER_H - 0.5, rows: 4, row: (STOCKER_H - 2.0) / 4 }

export type Station = { id: number; label: string; x: number; y: number; distance: number; stocker: boolean; occupied: boolean }

export function buildStations(): Station[] {
  const stations: Station[] = []
  const add = (label: string, x: number, row: 'A' | 'B', stocker: boolean, occupied: boolean) => stations.push({
    id: stations.length, label, x, y: row === 'A' ? LOOP.yA : LOOP.yB,
    distance: row === 'A' ? backDistance(x) : frontDistance(x), stocker, occupied,
  })
  STOCKER.ports.forEach((x, i) => add(`STK-01/P${i + 1}`, x, 'A', true, false))
  STOCKER.ports.forEach((x, i) => add(`STK-02/P${i + 1}`, x, 'B', true, false))
  let k = 0
  for (const [row, tools] of [['A', ROW_A], ['B', ROW_B]] as const) {
    for (const tool of tools) portCenters(tool).forEach((x, i) => add(`${tool.id}/LP${i + 1}`, x, row, false, (k++ * 7) % 5 < 2))
  }
  return stations
}

/** Floor transfer route for the autonomous mobile robots, as a rounded rectangle in the aisle. */
export const AMR_ROUTE = { x0: 7.5, x1: 38.5, y0: 11.1, y1: 12.9 }
const AMR_R = (AMR_ROUTE.y1 - AMR_ROUTE.y0) / 2
const AMR_RUN = AMR_ROUTE.x1 - AMR_ROUTE.x0
export const AMR_LENGTH = 2 * AMR_RUN + 2 * Math.PI * AMR_R
export function amrPoint(distance: number) {
  const s = ((distance % AMR_LENGTH) + AMR_LENGTH) % AMR_LENGTH
  const cy = (AMR_ROUTE.y0 + AMR_ROUTE.y1) / 2, arc = Math.PI * AMR_R
  if (s < AMR_RUN) return { x: AMR_ROUTE.x0 + s, y: AMR_ROUTE.y0 }
  if (s < AMR_RUN + arc) { const t = -Math.PI / 2 + (s - AMR_RUN) / AMR_R; return { x: AMR_ROUTE.x1 + Math.cos(t) * AMR_R, y: cy + Math.sin(t) * AMR_R } }
  if (s < 2 * AMR_RUN + arc) return { x: AMR_ROUTE.x1 - (s - AMR_RUN - arc), y: AMR_ROUTE.y1 }
  const t = Math.PI / 2 + (s - 2 * AMR_RUN - arc) / AMR_R
  return { x: AMR_ROUTE.x0 + Math.cos(t) * AMR_R, y: cy + Math.sin(t) * AMR_R }
}

export const CLUSTER_CENTER = (() => {
  const tool = ROW_B[3]
  return { x: tool.x0 + tool.w / 2, y: 17.2 + 2.8 }
})()

export const INSET_TARGET = { x: 37.7, y: 8.05, z: BUFFER_Z + 0.1 }
