// Itinerary Kit: builds trip.json (with its route and map files) into
//   out/index.html   the whole itinerary page, with the bar, to look at, check and record
//   out/embed.html   the itinerary alone (no bar), to paste into a page you have
//
//   node scripts/build.mjs trip.json out
//
// Every figure the page shows is measured from the route file or counted
// from the days: distance, climb, descent, high points, walking times,
// effort, totals, meals included, the lowest price. A distance you state
// that disagrees with the track by more than 5% stops the build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clipLine, clipRing, measure, naturalEarth, plen, projection, simplify, thin } from './geo.mjs'
import { EFFORT, EFFORT_RULE, MARKS, STYLES, TERRAIN, dateOne, dateRange, effortOf, esc, fmtN, money, naismith, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
export const KM_TOLERANCE = 0.05

const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const km1 = (n) => (n >= 100 ? fmtN(n) : (Math.round(n * 10) / 10).toFixed(1))

/** a path from projected points: absolute start, then relative steps at 10 m */
function pathD(pts, close = false) {
  let out = '', px = 0, py = 0
  pts.forEach((p, i) => {
    const x = Math.round(p[0] * 100), y = Math.round(p[1] * 100)
    if (i === 0) out += `M${x / 100} ${y / 100}`
    else if (x !== px || y !== py) out += `l${(x - px) / 100} ${(y - py) / 100}`
    px = x; py = y
  })
  return out.replace(/ -/g, '-') + (close ? 'z' : '')
}

function readJSON(file, what, problems) {
  if (!existsSync(file)) { problems.push(`${what}: ${file} not found`); return null }
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (e) { problems.push(`${what}: not valid JSON (${e.message})`); return null }
}

/** reads, checks and measures everything; returns { model } or { problems } */
export function load(configPath) {
  const problems = []
  const c = readJSON(configPath, 'trip.json', problems)
  if (!c) return { problems }
  problems.push(...validate(c))
  // keep going while the route can still be measured, so every problem is listed at once
  if (!Array.isArray(c.days) || typeof c.map?.route !== 'string' || c.days.some((d) => typeof d?.km !== 'number')) return { problems }
  const base = dirname(resolve(configPath))
  const route = readJSON(join(base, c.map.route), 'map.route', problems)
  if (!route) return { problems }
  const lines = (route.features ?? []).filter((f) => f.geometry?.type === 'LineString')
  if (lines.length !== c.days.length) problems.push(`map.route: ${lines.length} LineString features for ${c.days.length} days; give one per day`)
  lines.sort((a, b) => (a.properties?.day ?? 0) - (b.properties?.day ?? 0))
  lines.forEach((f, i) => {
    const co = f.geometry.coordinates
    if (co.length < 2) problems.push(`map.route day ${i + 1}: fewer than 2 points`)
    const bad = co.findIndex((p) => typeof p[2] !== 'number' || !isFinite(p[2]))
    if (bad >= 0) problems.push(`map.route day ${i + 1}: point ${bad + 1} has no elevation; every point needs [longitude, latitude, metres]`)
  })
  if (lines.length !== c.days.length || lines.some((f) => f.geometry.coordinates.length < 2 || f.geometry.coordinates.some((p) => typeof p[2] !== 'number'))) return { problems }

  // measure every day
  const meas = lines.map((f) => measure(f.geometry.coordinates))
  meas.forEach((m, i) => {
    const said = c.days[i].km
    if (Math.abs(said - m.km) / m.km > KM_TOLERANCE) problems.push(`days[${i}].km: you say ${said} km but the track measures ${m.km.toFixed(1)} km (more than ${KM_TOLERANCE * 100}% apart). Fix the track or the figure`)
  })
  for (let i = 1; i < lines.length; i++) {
    if (c.days[i].from !== c.days[i - 1].to) problems.push(`days[${i}].from is "${c.days[i].from}" but day ${i} ends at "${c.days[i - 1].to}"`)
  }
  if (problems.length) return { problems }

  // projection centred on the route
  const all = lines.flatMap((f) => f.geometry.coordinates)
  const lons = all.map((p) => p[0]), lats = all.map((p) => p[1])
  const P = projection((Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2)
  const proj = lines.map((f) => f.geometry.coordinates.map(P))
  const xs = proj.flat().map((p) => p[0]), ys = proj.flat().map((p) => p[1])
  const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const size = Math.max(bb[2] - bb[0], bb[3] - bb[1])
  const tol = Math.max(0.004, size * 0.00028)
  for (let i = 1; i < proj.length; i++) {
    const a = proj[i - 1][proj[i - 1].length - 1], b = proj[i][0]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5) problems.push(`map.route: day ${i + 1} starts ${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1)} km from where day ${i} ends; the days should join up`)
  }
  const shown = proj.map((pts) => simplify(pts, 0.004))
  shown.forEach((pts, i) => {
    const flat = plen(pts), m = meas[i].km
    if (Math.abs(flat - m) / m > 0.02) problems.push(`map.route day ${i + 1}: the drawn line is ${flat.toFixed(1)} km against ${m.toFixed(1)} km measured; the map projection does not suit this route (is it near a pole?)`)
  })
  if (problems.length) return { problems }

  // the map data, cropped to what any view can show
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, half = size * 1.7
  const box = [cx - half, cy - half, cx + half, cy + half]
  const geo = { land: [], coast: [], river: [], wash: [], lake: [], contour: [] }
  if (c.map.geo === 'natural-earth') {
    const ne = naturalEarth(join(KIT, 'geo', 'natural-earth-50m.json'))
    for (const r of ne.land) { const q = clipRing(simplify(r.map(P), tol), box); if (q.length > 2) geo.land.push(q) }
    for (const a of ne.coast) for (const part of clipLine(a.map(P), box)) geo.coast.push(simplify(part, tol))
  } else {
    const g = readJSON(join(base, c.map.geo), 'map.geo', problems)
    if (!g) return { problems }
    const feats = g.features ?? []
    let outlines = true
    for (const f of feats) {
      const kind = f.properties?.kind, gm = f.geometry
      if (!gm) continue
      if (!geo[kind]) { problems.push(`map.geo: a feature of kind "${kind}"; use land, coast, river, wash, lake or contour`); continue }
      if (kind === 'coast') outlines = false
      const rings = gm.type === 'Polygon' ? gm.coordinates : gm.type === 'MultiPolygon' ? gm.coordinates.flat() : null
      const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : null
      const t = kind === 'contour' ? tol * 2 : tol
      if ((kind === 'land' || kind === 'lake') && rings) for (const r of rings) { const q = clipRing(simplify(r.map(P), t), box); if (q.length > 2) geo[kind].push(kind === 'lake' ? { pts: q, dry: !!f.properties?.dry } : q) }
      else if (ls) for (const l of ls) for (const part of clipLine(l.map(P), box)) { const s = simplify(part, t); if (plen(s) > t * 4) geo[kind].push(kind === 'contour' ? { pts: s, ele: f.properties?.ele } : s) }
      else problems.push(`map.geo: a ${kind} feature must be a ${kind === 'land' || kind === 'lake' ? 'Polygon' : 'LineString'}`)
    }
    if (outlines) for (const f of feats) if (f.properties?.kind === 'land') {
      const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat()
      for (const r of rings) for (const part of clipLine(r.map(P), box)) geo.coast.push(simplify(part, tol))
    }
    if (problems.length) return { problems }
  }

  // profiles share one vertical scale for the whole trip
  const lo0 = Math.min(...meas.map((m) => m.min)), hi0 = Math.max(...meas.map((m) => m.max))
  const lo = lo0 < 250 ? 0 : Math.floor(lo0 / 50) * 50
  const hi = Math.max(lo + 150, Math.ceil(hi0 / 50) * 50)

  const walk = c.trip.mode === 'walk'
  const days = c.days.map((d, i) => {
    const m = meas[i]
    const foot = walk ? { km: m.km, up: m.up, terrain: d.terrain ?? 'path' } : d.onFoot ? { km: d.onFoot.km, up: d.onFoot.up, terrain: d.onFoot.terrain ?? 'path' } : { km: 0, up: 0, terrain: 'path' }
    const eff = effortOf(foot.km, foot.up, foot.terrain)
    return { ...d, km: Math.round(m.km * 10) / 10, up: Math.round(m.up), down: Math.round(m.down), max: Math.round(m.max), min: Math.round(m.min), prof: thin(m.samples).map(([x, e]) => [Math.round(x * 1000) / 1000, Math.round(e * 10) / 10]), line: shown[i], foot, eff, time: walk ? naismith(m.km, m.up) : d.drive }
  })
  const stops = [{ name: c.days[0].from, at: shown[0][0] }, ...c.days.map((d, i) => ({ name: d.to, at: shown[i][shown[i].length - 1] }))]
  return { model: { c, days, stops, geo, bb, lo, hi, walk, total: days.reduce((s, d) => s + d.km, 0) } }
}

function mapSVG(M) {
  const { geo, days, stops, bb } = M
  const pad = 0.16, w = bb[2] - bb[0], h = bb[3] - bb[1]
  const vb = [bb[0] - w * pad, bb[1] - h * pad, w * (1 + 2 * pad), h * (1 + 2 * pad)].map((v) => Math.round(v * 100) / 100)
  const ns = 'vector-effect="non-scaling-stroke"'
  const land = geo.land.map((r) => pathD(r, true)).join('')
  const cont = geo.contour.map((c) => `<path class="${c.ele % 100 === 0 || (M.hi - M.lo > 400 && c.ele % 250 === 0) ? 'it-c2' : 'it-c1'}" d="${pathD(c.pts)}" ${ns}/>`).join('')
  return `<svg class="it-map" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the route from ${esc(stops[0].name)} to ${esc(stops[stops.length - 1].name)}, north at the top" data-vb="${vb.join(' ')}">
<defs><pattern id="it-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3H6" class="it-hatchl"/></pattern>${land ? `<clipPath id="it-landclip"><path d="${land}" clip-rule="evenodd"/></clipPath>` : ''}</defs>
<rect class="it-ground ${land ? 'is-sea' : ''}" x="-1e4" y="-1e4" width="2e4" height="2e4"/>${land ? '<rect class="it-hatchr" x="-1e4" y="-1e4" width="2e4" height="2e4" fill="url(#it-hatch)"/>' : ''}
<g class="it-geo">${land ? `<path class="it-land" d="${land}" fill-rule="evenodd"/>` : ''}<g class="it-conts"${land ? ' clip-path="url(#it-landclip)"' : ''}>${cont}</g>${geo.lake.map((l) => `<path class="it-lake${l.dry ? ' is-dry' : ''}" d="${pathD(l.pts, true)}" ${ns}/>`).join('')}${geo.river.map((r) => `<path class="it-river" d="${pathD(r)}" ${ns}/>`).join('')}${geo.wash.map((r) => `<path class="it-wash" d="${pathD(r)}" ${ns}/>`).join('')}${geo.coast.map((r) => `<path class="it-coast" d="${pathD(r)}" ${ns}/>`).join('')}
${days.map((d, i) => `<g class="it-leg" data-i="${i}"><path class="it-cas" d="${pathD(d.line)}" ${ns}/><path class="it-line" d="${pathD(d.line)}" ${ns}/></g>`).join('')}
${stops.map((s, i) => `<circle class="it-stop" data-i="${i}" cx="${s.at[0].toFixed(2)}" cy="${s.at[1].toFixed(2)}" r="0.01"/>`).join('')}
</g><g class="it-over" aria-hidden="true"></g></svg>`
}

const Y = (M, e, top, hgt) => (top + (1 - (e - M.lo) / (M.hi - M.lo)) * hgt).toFixed(2)
function stripSVG(M) {
  let off = 0, out = ''
  for (const [i, d] of M.days.entries()) {
    const pts = d.prof.map(([x, e]) => [((off + x) / M.total) * 1000, Y(M, e, 4, 92)])
    const line = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1]}`).join('')
    out += `<g class="it-sd" data-i="${i}" data-off="${off}"><path class="it-sa" d="${line}L${pts[pts.length - 1][0].toFixed(2)} 96L${pts[0][0].toFixed(2)} 96Z"/><path class="it-sl" d="${line}" vector-effect="non-scaling-stroke"/></g>`
    if (i) out += `<line class="it-sgap" x1="${((off / M.total) * 1000).toFixed(2)}" x2="${((off / M.total) * 1000).toFixed(2)}" y1="0" y2="96" vector-effect="non-scaling-stroke"/>`
    off += d.km
  }
  return `<span class="it-lab it-scale" aria-hidden="true">${fmtN(M.hi)} m</span><svg class="it-strip-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" data-lo="${M.lo}" data-hi="${M.hi}" data-total="${M.total}"><line class="it-grid" x1="0" x2="1000" y1="4" y2="4" vector-effect="non-scaling-stroke"/>${out}</svg>`
}
function miniSVG(M, d, i) {
  const pts = d.prof.map(([x, e]) => [(x / d.km) * 600, Y(M, e, 4, 72)])
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1]}`).join('')
  const top = d.prof.reduce((a, b) => (b[1] > a[1] ? b : a))
  return `<figure class="it-prof"><span class="it-lab it-scale" aria-hidden="true">${fmtN(M.hi)} m</span><svg class="it-mini" viewBox="0 0 600 80" preserveAspectRatio="none" data-i="${i}" data-lo="${M.lo}" data-hi="${M.hi}" data-km="${d.km}" role="img" aria-label="Height along the day: ${fmtN(d.prof[0][1])} m at ${esc(d.from)}, highest ${fmtN(top[1])} m, ${fmtN(d.prof[d.prof.length - 1][1])} m at ${esc(d.to)}"><line class="it-grid" x1="0" x2="600" y1="4" y2="4" vector-effect="non-scaling-stroke"/><line class="it-base" x1="0" x2="600" y1="76" y2="76" vector-effect="non-scaling-stroke"/><path class="it-ma" d="${line}L600 76L0 76Z"/><path class="it-ml" d="${line}" vector-effect="non-scaling-stroke"/></svg>
<figcaption class="it-lab it-pcap"><span><span class="it-pn">${esc(d.from)} </span>${fmtN(d.prof[0][1])} m</span><span>high ${fmtN(top[1])} m</span><span><span class="it-pn">${esc(d.to)} </span>${fmtN(d.prof[d.prof.length - 1][1])} m</span></figcaption></figure>`
}

const MEALS = ['breakfast', 'lunch', 'dinner']
function dayHTML(M, d, i) {
  const n = M.days.length, pad = (k) => String(k).padStart(2, '0')
  const tw = TERRAIN[d.foot.terrain].words
  const why = M.walk
    ? `${km1(d.foot.km)} km and ${fmtN(d.foot.up)} m of climb ${tw}`
    : d.onFoot ? `${km1(d.foot.km)} km on foot and ${fmtN(d.foot.up)} m of climb ${tw}` : 'no walking beyond the vehicle'
  const stats = M.walk
    ? [['Distance', `${km1(d.km)} km`], ['Climb', `+${fmtN(d.up)} m`], ['Descent', `\u2212${fmtN(d.down)} m`], ['Time', d.time]]
    : [['Driving', `${km1(d.km)} km`], ['Climb', `+${fmtN(d.up)} m`], ['Highest', `${fmtN(d.max)} m`], ['At the wheel', d.time]]
  return `<li class="it-day" id="day-${i + 1}" data-i="${i}">
<div class="it-dhead"><span class="it-dnum it-lab">Day ${pad(i + 1)} of ${pad(n)}</span><span class="it-eff" title="${esc(d.eff.points)} effort points"><span class="it-cells" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<b${k < d.eff.grade ? ' class="f"' : ''}></b>`).join('')}</span><span class="it-effw">${d.eff.word}</span></span></div>
<h3 class="it-dt">${esc(d.from)} <span class="it-to">to</span> ${esc(d.to)}</h3>
<p class="it-why">${d.eff.word}: ${why}.</p>
<p class="it-dp">${esc(d.text)}</p>
<dl class="it-stats">${stats.map(([k, v]) => `<div><dt class="it-lab">${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
${miniSVG(M, d, i)}
<dl class="it-dl">
<dt class="it-lab">Sleep</dt><dd>${d.sleep.none ? '<strong>No night included</strong>' : `<strong>${esc(d.sleep.name)}</strong>`}, ${esc(d.sleep.detail)}</dd>
<dt class="it-lab">Meals</dt><dd><span class="it-meals">${MEALS.map((k) => `<span class="it-meal ${d.meals[k] ? 'y' : 'n'}"><i aria-hidden="true"></i>${k[0].toUpperCase() + k.slice(1)}<span class="it-sr">${d.meals[k] ? ' included' : ' not included'}</span></span>`).join('')}</span>${d.mealNote ? `<span class="it-mnote">${esc(d.mealNote)}</span>` : ''}</dd>
${d.optional?.length ? `<dt class="it-lab">Optional</dt><dd><ul class="it-opt">${d.optional.map((o) => `<li>${esc(o.label)}<span class="it-op">${esc(/^free$/i.test(o.price) ? 'free' : o.price)}</span></li>`).join('')}</ul></dd>` : ''}
</dl>
${d.note ? `<p class="it-note"><strong>${esc(d.note.label)}.</strong> ${esc(d.note.text)}</p>` : ''}
</li>`
}

export function render(M, { embed = false } = {}) {
  const { c, days, total } = M
  const st = STYLES[c.style ?? 'paper']
  const tok = { ...st.t, ...(c.accent ? { '--accent': c.accent } : {}) }
  const style = Object.entries(tok).map(([k, v]) => `${k}:${v}`).join(';')
  const cur = c.price.currency
  const climb = days.reduce((s, d) => s + d.up, 0)
  const grades = days.map((d) => d.eff.grade)
  const gLo = EFFORT[Math.min(...grades) - 1], gHi = EFFORT[Math.max(...grades) - 1]
  const from = Math.min(...c.departures.list.map((d) => d.price))
  const longest = days.reduce((a, d) => (d.km > a.km ? d : a))
  const facts = [
    [M.walk ? 'Walking' : 'Driving', `${fmtN(total)} km`, `over ${days.length} days, longest ${km1(longest.km)} km`],
    M.walk ? ['Total climb', `+${fmtN(climb)} m`, `high point ${fmtN(Math.max(...days.map((d) => d.max)))} m`] : ['Highest point', `${fmtN(Math.max(...days.map((d) => d.max)))} m`, `lowest ${fmtN(Math.min(...days.map((d) => d.min)))} m`],
    ['Effort', gLo === gHi ? gLo : `${gLo} to ${gHi}`, 'worked out for each day'],
    ['From', money(cur, from), `up to ${c.trip.group} people`],
  ]
  const cnt = MEALS.map((k) => days.filter((d) => d.meals[k]).length)
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : w.endsWith('h') ? 'es' : 's'}`
  const mealLine = [plural(cnt[0], 'breakfast'), plural(cnt[1], 'lunch'), plural(cnt[2], 'dinner')].join(', ')
  const nights = days.filter((d) => !d.sleep.none).length
  const ds = c.dates ?? 'dmy'
  let off = 0
  const bands = days.map((d, i) => { const l = (off / total) * 100, w = (d.km / total) * 100; off += d.km; return `<button type="button" class="it-band" data-i="${i}" style="left:${l.toFixed(3)}%;width:${w.toFixed(3)}%" aria-label="Day ${i + 1}: ${esc(d.from)} to ${esc(d.to)}, ${km1(d.km)} km"><span>${i + 1}</span></button>` }).join('')
  const data = { mode: c.trip.mode, total, lo: M.lo, hi: M.hi, bb: M.bb, stops: M.stops.map((s) => ({ name: s.name, x: +s.at[0].toFixed(2), y: +s.at[1].toFixed(2) })), days: days.map((d) => ({ from: d.from, to: d.to, km: d.km, up: d.up, down: d.down, max: d.max, foot: d.foot, eff: d.eff, prof: d.prof })) }

  const body = `<div class="it it--${c.style ?? 'paper'}${embed ? ' it--embed' : ''}" style="${style}">
<section class="it-itin" aria-label="Itinerary">
<header class="it-hero">
<p class="it-kick it-lab">${c.trip.kicker.map((k) => `<span>${esc(k)}</span>`).join('')}</p>
<h1 class="it-h1">${turn(c.trip.title)}</h1>
<p class="it-lede">${esc(c.trip.lede)}</p>
<dl class="it-facts">${facts.map(([k, v, s]) => `<div class="it-fact"><dt class="it-lab">${k}</dt><dd><b>${esc(v)}</b><small>${esc(s)}</small></dd></div>`).join('')}</dl>
</header>
<div class="it-mapcol"><div class="it-panel" role="region" aria-label="Route map and height profile">
<div class="it-phead"><span class="it-where" aria-live="polite">The whole route, ${fmtN(total)} km</span><span class="it-sum it-lab">${days.length} days</span></div>
<div class="it-mapwrap">${mapSVG(M)}</div>
<div class="it-strip">${stripSVG(M)}<div class="it-bands">${bands}</div></div>
</div></div>
<div class="it-ledger"><ol class="it-days">${days.map((d, i) => dayHTML(M, d, i)).join('\n')}</ol>
<p class="it-rule"><strong>How effort is rated.</strong> ${esc(EFFORT_RULE)}${M.walk ? " Walking times use Naismith's rule: 5 km an hour, plus an hour for every 600 m of climb, without stops." : ''}</p></div>
</section>
<section class="it-sec" id="included" aria-labelledby="it-inc-h"><div class="it-sh"><h2 id="it-inc-h">What the price includes</h2><p>Meals are counted from the days above.</p></div>
<div class="it-inc"><div class="it-yes"><h3 class="it-lab">Included</h3><ul><li>${plural(nights, 'night')} of accommodation, as listed by day</li>${c.included.map((x) => `<li>${esc(x)}</li>`).join('')}<li><strong>${mealLine}</strong></li></ul></div>
<div class="it-no"><h3 class="it-lab">Not included</h3><ul>${c.notIncluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div></section>
<section class="it-sec" id="dates" aria-labelledby="it-dates-h"><div class="it-sh"><h2 id="it-dates-h">Dates and places</h2><p>Each departure takes one group of up to ${c.departures.capacity}.</p></div>
<div><table class="it-deps"><thead><tr><th scope="col">Departure</th><th scope="col">Places</th><th scope="col">Price</th><th scope="col"><span class="it-sr">Book</span></th></tr></thead><tbody>
${c.departures.list.map((d) => `<tr data-left="${d.left}" data-cap="${c.departures.capacity}"><th scope="row" class="it-date">${dateRange(d.start, d.end, ds)}</th><td><span class="it-seats" aria-hidden="true">${Array.from({ length: c.departures.capacity }, (_, k) => `<i${k < c.departures.capacity - d.left ? ' class="b"' : ''}></i>`).join('')}</span><span class="it-left">${d.left ? `${d.left} of ${c.departures.capacity} places left` : 'Full'}</span></td><td class="it-dpr">${money(cur, d.price)}</td><td class="it-go"><a class="it-link" href="${esc(c.brand.cta.href)}">${d.left ? 'Hold a place' : 'Join the waiting list'}</a></td></tr>`).join('\n')}
</tbody></table><p class="it-asof">Places as of ${dateOne(c.departures.asOf, ds)}.</p></div></section>
<section class="it-sec" id="price" aria-labelledby="it-price-h"><div class="it-sh"><h2 id="it-price-h">Price</h2></div>
<div class="it-price"><p class="it-amount">${money(cur, c.price.amount)}<span>${esc(c.price.per)}</span></p>
<div><ul class="it-covers">${c.price.covers.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${c.price.terms?.length ? `<dl class="it-terms">${c.price.terms.map((x) => `<div><dt class="it-lab">${esc(x.label)}</dt><dd>${esc(x.text)}</dd></div>`).join('')}</dl>` : ''}
<p class="it-cta"><a class="it-btn" href="${esc(c.brand.cta.href)}">${esc(c.brand.cta.label)}</a></p></div></div></section>
<script type="application/json" class="it-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`
  return body
}

export function page(M) {
  const { c } = M
  const st = STYLES[c.style ?? 'paper']
  const css = readFileSync(join(KIT, 'itinerary.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const b = c.brand
  const mark = MARKS[b.mark ?? 'none']
  const bar = `<header class="it-bar it--${c.style ?? 'paper'}" style="${Object.entries({ ...st.t, ...(c.accent ? { '--accent': c.accent } : {}) }).map(([k, v]) => `${k}:${v}`).join(';')}"><a class="it-brand" href="/">${mark ? `<svg viewBox="0 0 26 26" aria-hidden="true">${mark}</svg>` : ''}${esc(b.name)}</a>${b.links?.length ? `<nav aria-label="Page">${b.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</nav>` : ''}<a class="it-btn" href="${esc(b.cta.href)}">${esc(b.cta.label)}</a></header>`
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${st.fonts}&display=swap">`
  const title = c.trip.title.replace(/_/g, '')
  const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | ${esc(b.name)}</title><meta name="description" content="${esc(c.trip.lede)}">
${fonts}
<style>${css}</style></head>
<body class="it-page it-page--${c.style ?? 'paper'}">${bar}
<main>${render(M)}</main>
<script>${js}</script></body></html>
`
  const embed = `<!-- Itinerary Kit: paste this where the itinerary goes. It needs the font link below once in <head>. -->
${fonts}
<style>${css}</style>
${render(M, { embed: true })}
<script>${js}</script>
`
  return { index, embed }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) { console.log('usage: node scripts/build.mjs trip.json out'); process.exit(1) }
  const { model, problems } = load(input)
  if (problems?.length) {
    console.error(`${problems.length} problem${problems.length > 1 ? 's' : ''} in ${input}:`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  const { index, embed } = page(model)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), index)
  writeFileSync(join(outDir, 'embed.html'), embed)
  const kb = (s) => Math.round(Buffer.byteLength(s) / 1024)
  console.log(`wrote ${relative(process.cwd(), join(outDir, 'index.html')) || 'index.html'} (${kb(index)} KB) and embed.html (${kb(embed)} KB)`)
  for (const [i, d] of model.days.entries()) console.log(`  day ${i + 1}: ${km1(d.km)} km (you said ${model.c.days[i].km}), +${d.up} m, ${d.eff.word} (${d.eff.points} points), ${d.time}`)
  if (Buffer.byteLength(index) > 400 * 1024) console.warn(`note: the page is ${kb(index)} KB; the check fails over 400 KB. Simplify the map file (fewer contour levels).`)
}
