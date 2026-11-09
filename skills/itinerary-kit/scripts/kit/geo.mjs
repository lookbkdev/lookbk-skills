// Itinerary Kit: the map arithmetic. Measures each day's track (distance,
// climb, profile), projects lon/lat to kilometres on a flat plane centred on
// the route, simplifies lines (Douglas-Peucker) and crops the map data to
// the area the page can show. Everything here is plain arithmetic: no
// library, no map service.
import { readFileSync } from 'node:fs'

const R = 6371.0088
const rad = (d) => (d * Math.PI) / 180
/** great-circle distance in km between [lon, lat] points */
export function haversine(a, b) {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const STEP = 0.1 // km between profile samples
export const SMOOTH = 3 // samples each side in the elevation average (700 m window)

/**
 * Measures one day's track ([lon, lat, ele] points): distance along the
 * points, then elevation resampled every 100 m and averaged over 700 m so
 * GPS noise cannot inflate the climb, then climb, descent, high and low.
 */
export function measure(coords) {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]))
  const km = cum[cum.length - 1]
  const n = Math.max(2, Math.round(km / STEP) + 1)
  const raw = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * km
    while (j < cum.length - 2 && cum[j + 1] < d) j++
    const t = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0
    raw.push([d, coords[j][2] + (coords[j + 1][2] - coords[j][2]) * Math.min(1, Math.max(0, t))])
  }
  const sm = raw.map(([d], i) => {
    let s = 0, c = 0
    for (let k = -SMOOTH; k <= SMOOTH; k++) if (raw[i + k]) { s += raw[i + k][1]; c++ }
    return [d, s / c]
  })
  let up = 0, down = 0
  for (let i = 1; i < sm.length; i++) { const dd = sm[i][1] - sm[i - 1][1]; if (dd > 0) up += dd; else down -= dd }
  const es = sm.map((p) => p[1])
  return { km, up, down, max: Math.max(...es), min: Math.min(...es), samples: sm }
}

/** keeps every k-th sample so a profile has at most `max` points, always the last */
export function thin(samples, max = 160) {
  const k = Math.max(1, Math.ceil(samples.length / max))
  return samples.filter((_, i) => i % k === 0 || i === samples.length - 1)
}

/** equirectangular projection centred on the route: km east, km south */
export function projection(lat0, lon0) {
  const kx = 111.32 * Math.cos(rad(lat0)), ky = 110.574
  const f = (p) => [(p[0] - lon0) * kx, -(p[1] - lat0) * ky]
  f.invert = (q) => [lon0 + q[0] / kx, lat0 - q[1] / ky]
  return f
}

export const plen = (pts) => { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d }

/** Douglas-Peucker on projected points (tol in km) */
export function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const [f, l] = [pts[0], pts[pts.length - 1]]
  if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-9) {
    // a closed ring: split it at its farthest point and simplify both halves
    let m = 1, md = -1
    pts.forEach((p, i) => { const d = Math.hypot(p[0] - f[0], p[1] - f[1]); if (d > md) { md = d; m = i } })
    if (m === 0 || m === pts.length - 1) return pts
    return [...simplify(pts.slice(0, m + 1), tol).slice(0, -1), ...simplify(pts.slice(m), tol)]
  }
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [x1, y1] = pts[a], [x2, y2] = pts[b], L = Math.hypot(x2 - x1, y2 - y1) || 1e-9
    let md = 0, mi = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L
      if (d > md) { md = d; mi = i }
    }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

/** Sutherland-Hodgman: a ring clipped to a box [x0, y0, x1, y1] */
export function clipRing(ring, [x0, y0, x1, y1]) {
  let out = ring
  const edges = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ]
  for (const [inside, cut] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i]
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b) } else if (inside(a)) out.push(cut(a, b))
    }
    if (!out.length) break
  }
  return out
}

/** a line cut into the pieces that fall inside a box */
export function clipLine(line, [x0, y0, x1, y1]) {
  const inside = (p) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1
  const parts = []
  let cur = []
  for (let i = 0; i < line.length; i++) {
    if (inside(line[i])) {
      if (!cur.length && i > 0) cur.push(line[i - 1])
      cur.push(line[i])
    } else if (cur.length) { cur.push(line[i]); parts.push(cur); cur = [] }
  }
  if (cur.length > 1) parts.push(cur)
  return parts
}

/** Decodes the bundled Natural Earth topology: land polygons and the coastline (arcs used by one shape only) */
export function naturalEarth(file) {
  const topo = JSON.parse(readFileSync(file, 'utf8'))
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform
  const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] }) })
  const uses = new Map()
  const ringOf = (ids) => {
    const out = []
    for (const id of ids) {
      uses.set(id < 0 ? ~id : id, (uses.get(id < 0 ? ~id : id) ?? 0) + 1)
      const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id]
      out.push(...(out.length ? a.slice(1) : a))
    }
    return out
  }
  const land = []
  for (const g of topo.objects.countries.geometries) {
    if (g.type === 'Polygon') g.arcs.forEach((r) => land.push(ringOf(r)))
    if (g.type === 'MultiPolygon') g.arcs.forEach((poly) => poly.forEach((r) => land.push(ringOf(r))))
  }
  const coast = [...uses].filter(([, n]) => n === 1).map(([i]) => arcs[i])
  return { land, coast }
}
