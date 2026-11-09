// Proof Band Kit: every field of proof.json, its limits, the honesty rules
// for numbers and the colour rules. validate() returns every problem at
// once, so one build lists all of them.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/* ---------- the two finished looks; fonts are pinned with an integrity hash ---------- */
const CDN = 'https://cdn.jsdelivr.net/npm/'
export const PRESETS = {
  ledger: {
    page: '#f3f0e8', ink: '#15171a', accent: '#b23a12',
    display: "'Newsreader Variable', Georgia, serif", ui: "'Geist Variable', system-ui, sans-serif", mono: "'Geist Mono Variable', ui-monospace, monospace",
    fonts: [
      [`${CDN}@fontsource-variable/newsreader@5.2.8/index.css`, 'sha384-8NLzpOqclXFx6wm1sfGm5zx5dh3zD77epakW9GinxqlLtlFAjX8iOESHFlVFb1pv'],
      [`${CDN}@fontsource-variable/newsreader@5.2.8/wght-italic.css`, 'sha384-ODTpcWYUnNS56J7u9SmN6ZYk5FMm4fiiiqG30hn0UeE1rCBUg/B+TTYsiSbipOZc'],
      [`${CDN}@fontsource-variable/geist@5.2.8/index.css`, 'sha384-p+EgvS3+MmUG4ztXXPqzFtb7IwR4h5ljta/AfLhM0vj1rtoFd3fsPDFTy2+m+W5U'],
      [`${CDN}@fontsource-variable/geist-mono@5.2.8/index.css`, 'sha384-NST9F93++1eck4FnDE0yqyWiwNNfBoWDI9qHmFymatO15xmb9YIy6A3BP1wUJs2A'],
    ],
    names: ['Newsreader', 'Geist', 'Geist Mono'],
  },
  signal: {
    page: '#0b0d0d', ink: '#e8ebe6', accent: '#7fe0b4',
    display: "'Inter Tight Variable', system-ui, sans-serif", ui: "'Inter Tight Variable', system-ui, sans-serif", mono: "'JetBrains Mono Variable', ui-monospace, monospace",
    fonts: [
      [`${CDN}@fontsource-variable/inter-tight@5.2.6/index.css`, 'sha384-0X4JY1shKP6XGeQTa579l/702swdpM2F0CuQGNCTc3ukEwauEUoTHGXLIOpdRALn'],
      [`${CDN}@fontsource-variable/jetbrains-mono@5.2.8/index.css`, 'sha384-bNykZ+bGB4FclZiYvLmgUfE8clWCvZlLOJ3v63czgIEgamTe0EhkaLXIbptJkvmW'],
    ],
    names: ['Inter Tight', 'JetBrains Mono'],
  },
}
export const LAYOUTS = ['grid', 'row', 'figures']

/* ---------- colour ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const rgb = (h) => rgbOf(h).join(',')
export function lum(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = rgbOf(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** The colour between `ink` and `bg` closest to `bg` that still holds `need`:1 against `bg`. */
export function soften(ink, bg, need) {
  for (let t = 0.8; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- the honesty rules ---------- */
const DATE = /^\d{4}-\d{2}-\d{2}$/
const NUMBER = /^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/
const HEDGE = /\bup\s*to\b|\d\s*\+|\+\s*\d|\bover\s+\d|\bmore than\s+\d|\bnearly\s+\d|\balmost\s+\d|~\s*\d/i
/** a [n] marker that ties copy to note n */
export const MARKER = /\[(\d{1,2})\]/g
const RATING = /\/\s*5\b|\bstars?\b|\brating\b|\breviews?\b/i

export function today() {
  return new Date().toISOString().slice(0, 10)
}

function monthsBetween(a, b) {
  const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/* ---------- validation ---------- */
export function validate(c, { dir = '.', now = today() } = {}) {
  const p = []
  const warn = []
  const str = (v, path, max, { req = true } = {}) => {
    if (v === undefined || v === null) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string') { p.push(`${path} must be text`); return false }
    if (!v.trim()) { p.push(`${path} is empty`); return false }
    if (v.length > max) p.push(`${path} is ${v.length} characters; keep it to ${max}`)
    return true
  }
  const url = (v, path) => {
    if (!str(v, path, 300)) return
    if (!/^(https?:\/\/|\/|#|mailto:)/.test(v)) p.push(`${path} must start with https://, / or #`)
  }
  if (!c || typeof c !== 'object') return { problems: ['proof.json must be an object'], warnings: [] }

  if (!LAYOUTS.includes(c.layout)) p.push(`layout must be one of ${LAYOUTS.join(', ')} (got ${JSON.stringify(c.layout)})`)
  const t = c.theme ?? {}
  if (!PRESETS[t.preset]) p.push(`theme.preset must be ${Object.keys(PRESETS).join(' or ')}`)
  for (const k of ['page', 'ink', 'accent']) if (t[k] !== undefined && !HEX.test(t[k])) p.push(`theme.${k} must be a #rrggbb colour`)
  if (PRESETS[t.preset]) {
    const pr = PRESETS[t.preset]
    const page = t.page ?? pr.page, ink = t.ink ?? pr.ink, accent = t.accent ?? pr.accent
    if (HEX.test(page) && HEX.test(ink) && contrast(ink, page) < 7) p.push(`theme.ink on theme.page is ${contrast(ink, page).toFixed(2)}:1; the band needs 7:1 so its muted tones can still pass 4.5:1`)
    if (HEX.test(page) && HEX.test(accent) && contrast(accent, page) < 4.5) p.push(`theme.accent on theme.page is ${contrast(accent, page).toFixed(2)}:1; it marks notes and links, so it needs 4.5:1`)
  }

  str(c.brand, 'brand', 40)
  if (!Array.isArray(c.eyebrow) || c.eyebrow.length < 1 || c.eyebrow.length > 2) p.push('eyebrow must be a list of one or two short lines')
  else { str(c.eyebrow[0], 'eyebrow[0]', 32); if (c.eyebrow[1] !== undefined) str(c.eyebrow[1], 'eyebrow[1]', 56) }
  str(c.statement, 'statement', 110)
  if (typeof c.statement === 'string' && (c.statement.match(/_/g) || []).length % 2) p.push('statement has an unclosed _turn_')

  // marks
  const marks = Array.isArray(c.marks) ? c.marks : []
  if (!Array.isArray(c.marks)) p.push('marks must be a list')
  else if (marks.length < 4 || marks.length > 12) p.push(`marks has ${marks.length}; use 4 to 12`)
  const svgs = []
  marks.forEach((m, i) => {
    const at = `marks[${i}]`
    str(m.name, `${at}.name`, 48)
    str(m.use, `${at}.use`, 90)
    if (c.layout === 'grid') str(m.sector, `${at}.sector`, 24, { req: false })
    if (m.href !== undefined) url(m.href, `${at}.href`)
    if (m.align !== undefined && !['baseline', 'center'].includes(m.align)) p.push(`${at}.align must be baseline or center`)
    if (m.baseline !== undefined && !(typeof m.baseline === 'number' && m.baseline > 0 && m.baseline <= 1)) p.push(`${at}.baseline must be a number from 0 to 1 (a share of the logo's height from the top)`)
    if (!str(m.svg, `${at}.svg`, 200)) return
    const f = join(dir, m.svg)
    if (!/\.svg$/i.test(m.svg)) { p.push(`${at}.svg must be an .svg file (a PNG can't be balanced or recoloured)`); return }
    if (!existsSync(f)) { p.push(`${at}.svg: ${m.svg} not found next to the config`); return }
    const s = readFileSync(f, 'utf8')
    if (!/<svg\b/.test(s)) p.push(`${at}.svg: ${m.svg} is not an SVG`)
    else if (!/viewBox\s*=\s*"[^"]+"/.test(s)) p.push(`${at}.svg: ${m.svg} has no viewBox; export it again with one`)
    if (/<script\b|\son\w+\s*=/i.test(s)) p.push(`${at}.svg: ${m.svg} contains script; export a clean SVG`)
    if (/<image\b/i.test(s)) p.push(`${at}.svg: ${m.svg} embeds a bitmap; use a vector logo`)
    if (/<text\b/i.test(s)) p.push(`${at}.svg: ${m.svg} has live <text>; convert the type to outlines so it measures and looks the same everywhere`)
    if (/<foreignObject\b/i.test(s)) p.push(`${at}.svg: ${m.svg} uses foreignObject; export a plain SVG`)
    svgs[i] = s
  })

  // notes
  const notes = Array.isArray(c.notes) ? c.notes : []
  if (!Array.isArray(c.notes)) p.push('notes must be a list (one per sourced figure)')
  notes.forEach((n, i) => {
    const at = `notes[${i}]`
    str(n.basis, `${at}.basis`, 180)
    if (!str(n.source, `${at}.source`, 70)) p.push(`${at} has no source: say where the number comes from (a ledger, a report, a meter), or remove the figure`)
    if (typeof n.asOf !== 'string' || !DATE.test(n.asOf) || isNaN(Date.parse(n.asOf))) p.push(`${at}.asOf must be a date, YYYY-MM-DD`)
    else if (n.asOf > now) p.push(`${at}.asOf is ${n.asOf}, which is in the future; a figure can only be as of a day that has happened`)
    else if (monthsBetween(n.asOf, now) > 18) warn.push(`${at} is ${monthsBetween(n.asOf, now)} months old (as of ${n.asOf}); update it or say so`)
  })
  const noteOk = (k) => Number.isInteger(k) && k >= 1 && k <= notes.length

  // stats
  const stats = Array.isArray(c.stats) ? c.stats : []
  if (!Array.isArray(c.stats)) p.push('stats must be a list')
  else if (stats.length < 2 || stats.length > 4) p.push(`stats has ${stats.length}; use 2 to 4`)
  const used = new Set()
  stats.forEach((s, i) => {
    const at = `stats[${i}]`
    const shown = `${s.prefix ?? ''}${s.value ?? ''}${s.unit ?? ''}`
    if (typeof s.value !== 'string' || !NUMBER.test(s.value)) p.push(`${at}.value must be a plain number written as text, like "4.1" or "38,200" (got ${JSON.stringify(s.value)}); no "+", ranges or words`)
    str(s.prefix, `${at}.prefix`, 2, { req: false })
    str(s.unit, `${at}.unit`, 5, { req: false })
    str(s.label, `${at}.label`, 80)
    for (const k of ['prefix', 'value', 'unit', 'label'])
      if (typeof s[k] === 'string' && HEDGE.test(s[k])) p.push(`${at}.${k} hedges the number ("${s[k]}"): "+", "up to", "over", "more than" and "nearly" are refused; give the measured figure`)
    if (s.note === undefined) p.push(`${at} (${shown}) has no source. Point it at a note ("note": 1) that gives the basis, the source and the as-of date, or remove the figure`)
    else if (!noteOk(s.note)) p.push(`${at}.note is ${JSON.stringify(s.note)}; there is no notes[${Number(s.note) - 1}]`)
    else used.add(s.note)
    if (typeof s.label === 'string' && RATING.test(s.label + ' ' + (s.unit ?? ''))) warn.push(`${at} reads like a rating or review count; ratings belong in a reviews section (testimonial-wall), not a proof band`)
  })

  // digits anywhere else in the copy must carry a [n] marker
  const copy = [['statement', c.statement], ['eyebrow[0]', c.eyebrow?.[0]], ['eyebrow[1]', c.eyebrow?.[1]], ['runLabel', c.runLabel], ['notesHead', c.notesHead]]
  marks.forEach((m, i) => { copy.push([`marks[${i}].use`, m.use], [`marks[${i}].sector`, m.sector], [`marks[${i}].name`, null]) })
  for (const [path, v] of copy) {
    if (typeof v !== 'string') continue
    const refs = [...v.matchAll(MARKER)].map((m) => Number(m[1]))
    for (const k of refs) { if (!noteOk(k)) p.push(`${path} points at [${k}], but there is no notes[${k - 1}]`); else used.add(k) }
    const bare = v.replace(MARKER, '')
    if (/\d/.test(bare) && !refs.length) p.push(`${path} has a number ("${v}") with no source. Add a [n] marker pointing at a note, or say it without the number`)
    if (HEDGE.test(bare)) p.push(`${path} hedges a number ("${v}"); "+", "up to", "over" and "more than" are refused`)
  }
  notes.forEach((_, i) => { if (!used.has(i + 1)) warn.push(`notes[${i}] is not used by any figure or [${i + 1}] marker`) })
  str(c.notesHead, 'notesHead', 24, { req: false })
  str(c.runLabel, 'runLabel', 24, { req: false })

  if (c.columns !== undefined && ![3, 4, 5, 6].includes(c.columns)) p.push('columns must be 3, 4, 5 or 6')
  const b = c.balance ?? {}
  if (b.area !== undefined && !(b.area >= 1200 && b.area <= 9000)) p.push('balance.area must be 1200 to 9000 (square px of a mark at the median ink density)')
  if (b.densityWeight !== undefined && !(b.densityWeight >= 0 && b.densityWeight <= 1)) p.push('balance.densityWeight must be 0 to 1')
  if (b.maxHeight !== undefined && !(b.maxHeight >= 24 && b.maxHeight <= 96)) p.push('balance.maxHeight must be 24 to 96')
  if (c.marquee !== undefined) {
    if (c.layout !== 'row') p.push('marquee only works with layout "row"')
    if (!(c.marquee.speed >= 12 && c.marquee.speed <= 32)) p.push('marquee.speed must be 12 to 32 px a second (slow enough to read)')
  }
  const pv = c.preview ?? {}
  if (pv.open !== undefined && (!Array.isArray(pv.open) || pv.open.length !== 2 || !pv.open.every((i) => Number.isInteger(i) && i >= 0 && i < marks.length))) p.push('preview.open must be two mark indexes, like [1, 4]')
  const d = c.demo ?? {}
  if (c.demo !== undefined) {
    str(d.headline, 'demo.headline', 90)
    str(d.lede, 'demo.lede', 200, { req: false })
    if (d.cta) { str(d.cta.label, 'demo.cta.label', 24); url(d.cta.href, 'demo.cta.href') }
    for (const [i, l] of (d.nav ?? []).entries()) { str(l.label, `demo.nav[${i}].label`, 20); url(l.href, `demo.nav[${i}].href`) }
  }
  return { problems: p, warnings: warn, svgs }
}
