// Spec Sheet Kit: every field of spec.json, its limits, and the checks that
// make the drawing honest. validate() returns every problem at once:
//   - the fields and their ranges (see SKILL.md for the full list)
//   - colour contrast for every text pair the page draws
//   - each drawn dimension measures what its line in the table says, for
//     every model, within drawing.tolerance
//   - each part is the same size in every full view that shows it (a part's
//     width in the plan matches its width in the front elevation, and so on)
//   - every view sits inside the drawing frame, for every model
//   - optional pack checks: the cells drawn in the section, times the cells
//     that fit along the body, hold the series x parallel count; the voltage
//     is series x cell voltage; the capacity fits parallel x cell capacity
//   - optional products: energy = voltage x capacity, within a stated share
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const core = new Function(readFileSync(join(here, '..', '..', 'kit', 'core.js'), 'utf8') + '\nreturn SpecSheetCore')()

export const DISPLAYS = {
  newsreader: { family: "'Newsreader', Georgia, serif", google: 'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400', weight: 400, track: '-0.015em', stretch: '100%', turn: 'italic' },
  'ibm-plex-serif': { family: "'IBM Plex Serif', Georgia, serif", google: 'family=IBM+Plex+Serif:ital,wght@0,400;1,400', weight: 400, track: '-0.02em', stretch: '100%', turn: 'italic' },
  archivo: { family: "'Archivo', system-ui, sans-serif", google: 'family=Archivo:wdth,wght@62..125,300..800', weight: 640, track: '-0.025em', stretch: '112%', turn: 'normal' },
}
export const TEXTS = {
  'ibm-plex-sans': { family: "'IBM Plex Sans', system-ui, sans-serif", google: 'family=IBM+Plex+Sans:wght@400;500;600' },
  archivo: { family: "'Archivo', system-ui, sans-serif", google: 'family=Archivo:wdth,wght@62..125,300..800' },
}
export const MONOS = {
  'ibm-plex-mono': { family: "'IBM Plex Mono', ui-monospace, monospace", google: 'family=IBM+Plex+Mono:wght@400;500;600' },
  'jetbrains-mono': { family: "'JetBrains Mono', ui-monospace, monospace", google: 'family=JetBrains+Mono:wght@400;500;600' },
}

const HEX = /^#[0-9a-f]{6}$/i
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => hex(rgbOf(a).map((v, i) => v + (rgbOf(b)[i] - v) * t))
export function lum(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = rgbOf(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
/** The quietest mix of ink into the background that still holds `need`:1. */
export function mute(ink, bg, need = 5) {
  for (let t = 0.6; t >= 0; t -= 0.02) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

const SHEET = [10, 10, 410, 287]

export function validate(c) {
  const errors = []
  const notes = []
  const E = (m) => errors.push(m)
  const str = (v, path, max, min = 1) => {
    if (typeof v !== 'string' || v.trim().length < min) { E(`${path}: write some text`); return false }
    if (v.length > max) E(`${path}: ${v.length} characters, at most ${max}`)
    return true
  }
  const num = (v, path, lo, hi) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { E(`${path}: must be a number`); return false }
    if (v < lo || v > hi) { E(`${path}: ${v} is outside ${lo} to ${hi}`); return false }
    return true
  }
  const pt = (v, path) => Array.isArray(v) && v.length >= 2 && v.every((x) => typeof x === 'number') ? true : (E(`${path}: must be [x, y]`), false)
  if (!c || typeof c !== 'object') return { errors: ['spec.json must be an object'], notes }

  // theme
  const t = c.theme ?? {}
  if (!['light', 'dark'].includes(t.mode)) E('theme.mode: "light" or "dark"')
  for (const k of ['paper', 'sheet', 'ink', 'accent', 'onAccent', 'turn']) if (!HEX.test(t[k] ?? '')) E(`theme.${k}: a colour like "#1b1f22"`)
  if (!DISPLAYS[t.display]) E(`theme.display: one of ${Object.keys(DISPLAYS).join(', ')}`)
  if (!TEXTS[t.text]) E(`theme.text: one of ${Object.keys(TEXTS).join(', ')}`)
  if (!MONOS[t.mono]) E(`theme.mono: one of ${Object.keys(MONOS).join(', ')}`)
  if (t.radius !== undefined) num(t.radius, 'theme.radius', 0, 12)
  if (['paper', 'sheet', 'ink', 'accent', 'onAccent', 'turn'].every((k) => HEX.test(t[k] ?? ''))) {
    const pairs = [
      ['ink', 'paper', 7], ['ink', 'sheet', 7], ['accent', 'paper', 4.5], ['accent', 'sheet', 4.5], ['onAccent', 'accent', 4.5], ['turn', 'paper', 3],
    ]
    for (const [a, b, need] of pairs) {
      const r = contrast(t[a], t[b])
      if (r < need) E(`theme.${a} on theme.${b}: ${r.toFixed(2)}:1, needs ${need}:1`)
    }
    if (t.mode === 'dark' && lum(t.paper) > 0.2) E('theme.paper: a dark theme needs a dark paper')
    if (t.mode === 'light' && lum(t.paper) < 0.4) E('theme.paper: a light theme needs a light paper')
  }

  str(c.brand, 'brand', 40)
  const h = c.head ?? {}
  if (!Array.isArray(h.eyebrow) || h.eyebrow.length < 1 || h.eyebrow.length > 3) E('head.eyebrow: 1 to 3 short items, e.g. ["04", "Specifications", "Sheet 1 of 1"]')
  else h.eyebrow.forEach((x, i) => str(x, `head.eyebrow[${i}]`, 28))
  if (str(h.headline, 'head.headline', 64)) {
    if ((h.headline.match(/_/g) ?? []).length > 2) E('head.headline: one _turn_ at most')
    if (h.headline.split('\n').length > 2) E('head.headline: two lines at most (one "\\n")')
  }
  if (h.lede !== undefined) str(h.lede, 'head.lede', 180)

  // models
  const models = Array.isArray(c.models) ? c.models : []
  if (models.length < 1 || models.length > 3) E('models: 1 to 3 models')
  const ids = models.map((m) => m.id)
  if (new Set(ids).size !== ids.length) E('models: every id must be different')
  models.forEach((m, i) => { str(m.id, `models[${i}].id`, 16); str(m.name, `models[${i}].name`, 16); if (m.sub !== undefined) str(m.sub, `models[${i}].sub`, 24) })
  if (!ids.includes(c.drawn)) E(`drawn: the model drawn solid in compare mode, one of ${ids.join(', ')}`)
  const st = c.start ?? {}
  if (!ids.includes(st.model)) E(`start.model: one of ${ids.join(', ')}`)
  if (st.compare && models.length < 2) E('start.compare: compare needs 2 or 3 models')

  // units
  const U = c.units ?? {}
  const steps = { "units.length.step['mm']": U.length?.step?.mm, "units.length.step['in']": U.length?.step?.in, "units.mass.step['kg']": U.mass?.step?.kg, "units.mass.step['lb']": U.mass?.step?.lb }
  const okSteps = [1, 0.5, 0.25, 0.2, 0.1, 0.05, 0.01, 0.005, 0.001]
  for (const [p, v] of Object.entries(steps)) if (!okSteps.includes(v)) E(`${p}: one of ${okSteps.join(', ')}`)
  if (!['mm', 'in'].includes(U.length?.primary)) E('units.length.primary: "mm" or "in"')
  if (!['kg', 'lb'].includes(U.mass?.primary)) E('units.mass.primary: "kg" or "lb"')

  // groups and rows
  const groups = Array.isArray(c.groups) ? c.groups : []
  if (groups.length < 1 || groups.length > 8) E('groups: 1 to 8 groups')
  const rows = []
  groups.forEach((g, gi) => {
    str(g.title, `groups[${gi}].title`, 28)
    const kinds = ['rows', 'list', 'marks'].filter((k) => g[k] !== undefined)
    if (kinds.length !== 1) { E(`groups[${gi}]: give exactly one of rows, list or marks`); return }
    if (g.list) { if (!Array.isArray(g.list) || g.list.length < 1 || g.list.length > 12) E(`groups[${gi}].list: 1 to 12 items`); else g.list.forEach((x, i) => str(x, `groups[${gi}].list[${i}]`, 48)) }
    if (g.marks) { if (!Array.isArray(g.marks) || g.marks.length < 1 || g.marks.length > 12) E(`groups[${gi}].marks: 1 to 12 marks`); else g.marks.forEach((x, i) => str(x, `groups[${gi}].marks[${i}]`, 32)) }
    if (g.rows) {
      if (!Array.isArray(g.rows) || g.rows.length < 1 || g.rows.length > 14) { E(`groups[${gi}].rows: 1 to 14 lines`); return }
      g.rows.forEach((r, ri) => {
        const p = `groups[${gi}].rows[${ri}]`
        rows.push({ r, p })
        if (!/^[a-z0-9-]{1,24}$/i.test(r.key ?? '')) E(`${p}.key: letters, digits and "-", up to 24`)
        str(r.label, `${p}.label`, 32)
        if (r.note !== undefined) str(r.note, `${p}.note`, 40)
        const vk = ['length', 'mass', 'number', 'text'].filter((k) => r[k] !== undefined)
        if (vk.length !== 1) { E(`${p}: give exactly one of length (mm), mass (kg), number (with unit) or text`); return }
        const v = r[vk[0]]
        const each = (fn) => {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            for (const id of ids) if (v[id] === undefined) E(`${p}.${vk[0]}: no value for model ${id}`)
            for (const id of Object.keys(v)) if (!ids.includes(id)) E(`${p}.${vk[0]}: ${id} is not a model`)
            Object.values(v).forEach(fn)
          } else fn(v)
        }
        if (vk[0] === 'text') each((x) => str(x, `${p}.text`, 32))
        else each((x) => num(x, `${p}.${vk[0]}`, 0, 1e6))
        if (vk[0] === 'number') { if (r.unit !== undefined) str(r.unit, `${p}.unit`, 6) }
        if (r.extra !== undefined) str(core.per(r.extra, ids[0]), `${p}.extra`, 12)
      })
    }
  })
  const keyCount = {}
  rows.forEach(({ r }) => { keyCount[r.key] = (keyCount[r.key] ?? 0) + 1 })
  for (const [k, n] of Object.entries(keyCount)) if (n > 1) E(`rows: the key "${k}" is used ${n} times`)
  const rowOf = Object.fromEntries(rows.map(({ r }) => [r.key, r]))

  // drawing
  const D = c.drawing ?? {}
  str(D.number, 'drawing.number', 16); str(D.rev, 'drawing.rev', 3); str(D.scale, 'drawing.scale', 6)
  if (!['third', 'first'].includes(D.projection)) E('drawing.projection: "third" or "first" angle')
  num(D.tolerance, 'drawing.tolerance', 0.05, 5)
  str(D.toleranceNote, 'drawing.toleranceNote', 26)
  pt(D.notes_at, 'drawing.notes_at')
  if (!Array.isArray(D.title_block) || D.title_block.length !== 5 || !Array.isArray(D.title_block[4])) E('drawing.title_block: [x, y, width, height, [col1, col2, col3]]')
  if (D.tab !== undefined) pt(D.tab, 'drawing.tab')
  const parts = Array.isArray(D.parts) ? D.parts : []
  if (parts.length < 1 || parts.length > 20) E('drawing.parts: 1 to 20 parts')
  const partIds = parts.map((p) => p.id)
  if (new Set(partIds).size !== partIds.length) E('drawing.parts: every id must be different')
  if (new Set(parts.map((p) => p.no)).size !== parts.length) E('drawing.parts: every number must be different')
  parts.forEach((p, i) => { str(p.id, `drawing.parts[${i}].id`, 24); num(p.no, `drawing.parts[${i}].no`, 1, 99); str(p.name, `drawing.parts[${i}].name`, 32) })

  const views = Array.isArray(D.views) ? D.views : []
  if (views.length < 1 || views.length > 6) E('drawing.views: 1 to 6 views')
  const viewIds = views.map((v) => v.id)
  if (new Set(viewIds).size !== viewIds.length) E('drawing.views: every id must be different')
  const shapeOk = (s, p) => {
    if (!partIds.includes(s.part)) E(`${p}.part: "${s.part}" is not in drawing.parts`)
    const g = ['d', 'circle', 'rect', 'poly'].filter((k) => s[k] !== undefined)
    if (g.length !== 1) { E(`${p}: give exactly one of d, circle, rect or poly`); return false }
    if (s.d !== undefined) { const r = core.pathPoints(s.d); if (r.error) { E(`${p}.d: ${r.error}`); return false } }
    if (s.circle && !(s.circle.length === 3 && s.circle.every(Number.isFinite) && s.circle[2] > 0)) { E(`${p}.circle: [cx, cy, r]`); return false }
    if (s.rect && !(s.rect.length === 4 && s.rect.every(Number.isFinite) && s.rect[2] > 0 && s.rect[3] > 0)) { E(`${p}.rect: [x, y, width, height]`); return false }
    return true
  }
  const drawnParts = new Set()
  views.forEach((v0, vi) => {
    const p = `drawing.views[${vi}]`
    str(v0.id, `${p}.id`, 16); str(v0.label, `${p}.label`, 24); str(v0.short, `${p}.short`, 12)
    if (v0.models) for (const id of Object.keys(v0.models)) if (!ids.includes(id)) E(`${p}.models: ${id} is not a model`)
    if (!Array.isArray(v0.axes) || v0.axes.length !== 2 || !v0.axes.every((a) => ['x', 'y', 'z'].includes(a))) E(`${p}.axes: the two product axes the view shows, e.g. ["x", "y"]`)
    if (!Array.isArray(v0.crop) || v0.crop.length !== 4) E(`${p}.crop: [x0, y0, x1, y1] on the sheet, what a phone shows`)
    for (const m of ids) {
      const v = core.view(c, v0, m)
      if (!pt(v.origin, `${p}.origin`) || !num(v.scale, `${p}.scale`, 0.01, 10)) return
      if (!Array.isArray(v.shapes) || !v.shapes.length) { E(`${p}.shapes: at least one shape (model ${m})`); return }
      let ext = null
      const okAll = v.shapes.map((s, si) => shapeOk(s, `${p}.shapes[${si}]` + (v0.models?.[m] ? ` (${m})` : ''))).every(Boolean)
      if (!okAll) return
      v.shapes.forEach((s) => { drawnParts.add(s.part); ext = core.union(ext, core.shapeExt(s)) })
      if (v.outline && !shapeOk({ part: v.shapes[0].part, ...v.outline }, `${p}.outline`)) return
      // inside the frame
      const box = v.ring ? [v.origin[0] - v.ring, v.origin[1] - v.ring, v.origin[0] + v.ring, v.origin[1] + v.ring]
        : [v.origin[0] + ext[0] * v.scale, v.origin[1] - ext[3] * v.scale, v.origin[0] + ext[2] * v.scale, v.origin[1] - ext[1] * v.scale]
      if (box[0] < SHEET[0] || box[1] < SHEET[1] || box[2] > SHEET[2] || box[3] > SHEET[3])
        E(`${p} (${v0.id}, ${m}): runs outside the drawing frame (${box.map((x) => x.toFixed(0)).join(', ')}); move its origin or change its scale`)
      ;(v.balloons ?? []).forEach((b, bi) => {
        if (!partIds.includes(b.part)) E(`${p}.balloons[${bi}].part: "${b.part}" is not a part`)
        else if (!v.shapes.some((s) => s.part === b.part)) E(`${p}.balloons[${bi}]: the ${b.part} is not drawn in this view`)
        pt(b.at, `${p}.balloons[${bi}].at`); pt(b.offset, `${p}.balloons[${bi}].offset`)
      })
    }
  })

  // dimensions: each measures what the table says
  const dims = Array.isArray(D.dims) ? D.dims : []
  dims.forEach((d0, di) => {
    const p = `drawing.dims[${di}]`
    if (!viewIds.includes(d0.view)) { E(`${p}.view: "${d0.view}" is not a view`); return }
    const r = rowOf[d0.row]
    if (!r) { E(`${p}.row: "${d0.row}" is not a line in the schedule`); return }
    if (r.length === undefined) { E(`${p}.row: "${d0.row}" must be a length line to be dimensioned`); return }
    if (!['h', 'v'].includes(d0.kind)) E(`${p}.kind: "h" (horizontal) or "v" (vertical)`)
    if (!(typeof d0.offset === 'number' && d0.offset !== 0)) E(`${p}.offset: how far from the object the dimension line sits, not 0`)
    if (d0.symbol !== undefined && !/^[A-Z]$/.test(d0.symbol)) E(`${p}.symbol: one capital letter`)
    const vw = views.find((v) => v.id === d0.view)
    for (const m of ids) {
      const d = core.dim(d0, m)
      if (!pt(d.a, `${p}.a`) || !pt(d.b, `${p}.b`)) return
      const drawn = core.measure(d), table = core.per(r.length, m)
      if (Math.abs(drawn - table) > D.tolerance + 1e-9)
        E(`${p}: ${r.label} is drawn ${drawn.toFixed(1)} mm in the ${vw.label.toLowerCase()} of ${m}, but the table says ${table} mm (tolerance ${D.tolerance} mm)`)
    }
  })

  // the same part is the same size in every full view
  for (const m of ids) {
    const sizes = {} // part -> axis -> [{ view, size }]
    views.forEach((v0) => {
      if (v0.partial || !Array.isArray(v0.axes)) return
      const v = core.view(c, v0, m)
      if (!Array.isArray(v.shapes)) return
      const byPart = {}
      v.shapes.forEach((s) => { const e = core.shapeExt(s); if (e) byPart[s.part] = core.union(byPart[s.part], e) })
      for (const [part, e] of Object.entries(byPart)) {
        v0.axes.forEach((ax, i) => {
          const size = i === 0 ? e[2] - e[0] : e[3] - e[1]
          ;((sizes[part] ??= {})[ax] ??= []).push({ view: v0.label, size })
        })
      }
    })
    for (const [part, axes] of Object.entries(sizes))
      for (const [ax, list] of Object.entries(axes)) {
        if (list.length < 2) continue
        const lo = Math.min(...list.map((x) => x.size)), hi = Math.max(...list.map((x) => x.size))
        if (hi - lo > D.tolerance + 1e-9) E(`views disagree on the ${part} (${m}): along ${ax} it is ${list.map((x) => `${x.size.toFixed(1)} mm in the ${x.view.toLowerCase()}`).join(', ')}`)
      }
  }

  // rows point at real parts
  rows.forEach(({ r, p }) => (r.parts ?? []).forEach((id) => {
    if (!partIds.includes(id)) E(`${p}.parts: "${id}" is not in drawing.parts`)
    else if (!drawnParts.has(id)) E(`${p}.parts: the ${id} is not drawn in any view`)
  }))
  parts.forEach((pp) => { if (!drawnParts.has(pp.id)) notes.push(`the part "${pp.id}" is listed but not drawn`) })

  // pack checks: cells, voltage, capacity
  const pk = D.cells
  if (pk) {
    const v0 = views.find((v) => v.id === pk.view), bv = views.find((v) => v.id === pk.bodyView), cr = rowOf[pk.row]
    if (!v0 || !bv) E('drawing.cells.view / bodyView: must name views')
    else if (!cr || cr.text === undefined) E('drawing.cells.row: the text line that gives the configuration, like "10S5P"')
    else for (const m of ids) {
      const v = core.view(c, v0, m), circles = v.shapes.filter((s) => s.part === pk.part && s.circle)
      const sp = /^(\d+)S(\d+)P$/.exec(core.per(cr.text, m))
      if (!sp) { E(`${cr.label} for ${m}: write it as series and parallel, like 10S5P`); continue }
      const S = +sp[1], Pp = +sp[2]
      for (const s of circles) if (Math.abs(s.circle[2] * 2 - pk.diameter) > 0.05) E(`drawing.cells: a cell in ${v0.label} is ${s.circle[2] * 2} mm across; the format is ${pk.diameter} mm`)
      for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i].circle, b = circles[j].circle
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < a[2] + b[2] - 0.01) E(`drawing.cells: two cells overlap in ${v0.label} (${m})`)
      }
      const shell = v.shapes.filter((s) => pk.shellPart ? s.part === pk.shellPart : s.section).map(core.shapeExt).reduce(core.union, null)
      if (shell) for (const s of circles) { const e = core.shapeExt(s); if (e[0] < shell[0] || e[2] > shell[2] || e[1] < shell[1] || e[3] > shell[3]) E(`drawing.cells: a cell in ${v0.label} (${m}) sits outside the housing`) }
      const body = core.view(c, bv, m).shapes.filter((s) => pk.bodyParts.includes(s.part)).map(core.shapeExt).reduce(core.union, null)
      const bodyLen = body[2] - body[0], along = Math.floor((bodyLen - 2 * pk.wall) / pk.length), fit = circles.length * along
      if (fit < S * Pp) E(`${m}: ${S}S${Pp}P needs ${S * Pp} cells, but ${circles.length} across x ${along} along a ${bodyLen.toFixed(0)} mm body (${pk.wall} mm walls, ${pk.length} mm cells) holds ${fit}`)
      const vr = rowOf[pk.voltRow], ar = rowOf[pk.ahRow]
      if (vr) { const V = core.per(vr.number, m); if (Math.abs(V - S * pk.cellV) / (S * pk.cellV) > 0.02) E(`${m}: ${S} cells in series at ${pk.cellV} V make ${(S * pk.cellV).toFixed(1)} V, the table says ${V} V`) }
      if (ar) { const A = core.per(ar.number, m); if (A > Pp * pk.cellAh + 1e-9) E(`${m}: ${Pp} cells in parallel at ${pk.cellAh} Ah hold ${(Pp * pk.cellAh).toFixed(1)} Ah, the table says ${A} Ah`) }
      notes.push(`${m}: ${S}S${Pp}P = ${S * Pp} cells; the housing holds ${circles.length} x ${along} = ${fit}`)
    }
  }
  for (const [i, pr] of (c.checks?.product ?? []).entries()) {
    const rs = [...pr.of, pr.is].map((k) => rowOf[k])
    if (rs.some((r) => !r || r.number === undefined)) { E(`checks.product[${i}]: every key must be a number line`); continue }
    for (const m of ids) {
      const prod = pr.of.reduce((a, k) => a * core.per(rowOf[k].number, m), 1), is = core.per(rowOf[pr.is].number, m)
      if (Math.abs(prod - is) / is > pr.within) E(`${m}: ${pr.of.map((k) => rowOf[k].label.toLowerCase()).join(' x ')} = ${prod.toFixed(1)}, but ${rowOf[pr.is].label.toLowerCase()} is ${is} (more than ${(pr.within * 100).toFixed(0)}% apart)`)
    }
  }

  // tour (the preview's script)
  ;(c.tour ?? []).forEach((s, i) => {
    const p = `tour[${i}]`
    if (s.row !== undefined) { const r = rowOf[s.row]; if (!r || !(r.parts?.length || dims.some((d) => d.row === s.row))) E(`${p}.row: "${s.row}" is not a line linked to the drawing`) }
    else if (s.part !== undefined) { if (!partIds.includes(s.part)) E(`${p}.part: "${s.part}" is not a part`) }
    else if (s.set !== undefined) {
      for (const [k, v] of Object.entries(s.set)) {
        if (k === 'len' && !['mm', 'in'].includes(v)) E(`${p}.set.len: "mm" or "in"`)
        else if (k === 'mass' && !['kg', 'lb'].includes(v)) E(`${p}.set.mass: "kg" or "lb"`)
        else if (k === 'model' && !ids.includes(v)) E(`${p}.set.model: one of ${ids.join(', ')}`)
        else if (k === 'compare' && typeof v !== 'boolean') E(`${p}.set.compare: true or false`)
        else if (!['len', 'mass', 'model', 'compare'].includes(k)) E(`${p}.set.${k}: only len, mass, model and compare`)
      }
    } else E(`${p}: a step is { row }, { part } or { set }`)
  })
  if ((c.tour ?? []).length > 8) E('tour: at most 8 steps')
  if (!['A4', 'Letter'].includes(c.print?.paper ?? 'A4')) E('print.paper: "A4" or "Letter"')
  return { errors, notes, c }
}
