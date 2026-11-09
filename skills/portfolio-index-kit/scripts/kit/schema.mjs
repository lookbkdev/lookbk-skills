// Work Index: every field of work.json, its limits and the colour rules.
// validate() returns every problem at once (and a list of warnings), so one
// build lists all of them.
import { existsSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

export const DISPLAYS = {
  bricolage: {
    google: 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=DM+Mono:wght@400;500',
    display: "'Bricolage Grotesque', 'Arial Narrow', system-ui, sans-serif",
    text: "'Bricolage Grotesque', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    h1: { weight: 650, size: 84, lh: 0.94, track: '-.035em', vary: "'wdth' 80, 'opsz' 96", phone: 46 },
    em: { style: 'normal', weight: 260, track: '-.02em' },
    ti: { weight: 560, track: '-.025em', vary: "'wdth' 86, 'opsz' 48" },
    mark: { font: 'text', weight: 600, size: 17 },
    caseSize: 132, casePhone: 60, lead: 40, leadPhone: 30, pn: 52, pnPhone: 32,
  },
  instrument: {
    google: 'family=Instrument+Serif:ital@0;1&family=Geist:wght@300..700&family=Geist+Mono:wght@400;500',
    display: "'Instrument Serif', Georgia, serif",
    text: "'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, monospace",
    h1: { weight: 400, size: 92, lh: 0.98, track: '-.015em', vary: 'normal', phone: 52 },
    em: { style: 'italic', weight: 400, track: '0' },
    ti: { weight: 400, track: '-.01em', vary: 'normal' },
    mark: { font: 'display', weight: 400, size: 24 },
    caseSize: 140, casePhone: 68, lead: 44, leadPhone: 34, pn: 56, pnPhone: 36,
  },
}
export const STYLES = {
  ledger: { ti: 34, tiPhone: 30, gridTi: 22, cols: [4, 3, 2], ar: '4 / 5', plate: { land: 340, port: 280 } },
  caption: { ti: 60, tiPhone: 38, gridTi: 28, cols: [3, 2, 1], ar: '3 / 2', plate: { land: 460, port: 300 } },
}

/* ---------- colour ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
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
/** the colour between ink and bg closest to bg that still holds `need`:1 */
export function soften(ink, bg, need) {
  for (let t = 0.7; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

const IMG = ['.webp', '.jpg', '.jpeg', '.png', '.avif']
const VID = ['.mp4', '.webm']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function validate(c, base) {
  const errors = [], warnings = []
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m)
  const str = (v, path, min, max, opt = false) => {
    if (v == null || v === '') { if (!opt) err(`${path} is missing`); return false }
    if (typeof v !== 'string') { err(`${path} must be text`); return false }
    if (v.length < min) err(`${path} is ${v.length} characters; at least ${min}`)
    if (v.length > max) err(`${path} is ${v.length} characters; at most ${max} ("${v.slice(0, max)}…")`)
    return true
  }
  const file = (p, path, kinds) => {
    if (!str(p, path, 1, 300)) return
    if (/^https?:/.test(p)) { err(`${path}: use a file on disk, not a URL (${p})`); return }
    const f = resolve(base, p)
    if (!kinds.includes(extname(f).toLowerCase())) err(`${path}: ${p} should be ${kinds.join(', ')}`)
    else if (!existsSync(f)) err(`${path}: ${p} not found (paths are relative to work.json)`)
    return f
  }
  if (!c || typeof c !== 'object') return { errors: ['work.json is not an object'], warnings }
  if (!STYLES[c.style]) err(`style must be "ledger" or "caption" (got ${JSON.stringify(c.style)})`)
  const s = c.site ?? {}
  str(s.name, 'site.name', 1, 32)
  if (s.nav != null) {
    if (!Array.isArray(s.nav) || s.nav.length > 4) err('site.nav is a list of at most 4 links')
    else s.nav.forEach((l, i) => { str(l?.label, `site.nav[${i}].label`, 1, 16); str(l?.href, `site.nav[${i}].href`, 1, 200) })
  }
  str(s.availability, 'site.availability', 4, 44, true)
  if (str(s.statement, 'site.statement', 6, 70)) {
    const turns = (s.statement.match(/_/g) ?? []).length
    if (turns !== 0 && turns !== 2) err('site.statement: mark one turn with _two underscores_ (or none)')
  }
  str(s.lede, 'site.lede', 20, 220)
  if (s.email != null && !EMAIL.test(s.email)) err(`site.email is not an address: ${s.email}`)
  if (s.email == null) err('site.email is missing (the footer and every case page link to it)')
  str(s.place, 'site.place', 2, 40, true)
  str(s.note, 'site.note', 4, 44, true)
  const t = c.theme ?? {}
  for (const k of ['ground', 'ink', 'accent']) if (!HEX.test(t[k] ?? '')) err(`theme.${k} must be #rrggbb`)
  if (t.plate != null && !HEX.test(t.plate)) err('theme.plate must be #rrggbb')
  if (!['light', 'dark'].includes(t.mode)) err('theme.mode must be "light" or "dark"')
  if (!DISPLAYS[t.display]) err('theme.display must be "bricolage" or "instrument"')
  if (HEX.test(t.ground ?? '') && HEX.test(t.ink ?? '') && contrast(t.ink, t.ground) < 7) err(`theme.ink on theme.ground is ${contrast(t.ink, t.ground).toFixed(2)}:1; it needs 7:1 (the muted text is derived from it)`)
  if (HEX.test(t.ground ?? '') && HEX.test(t.accent ?? '') && contrast(t.accent, t.ground) < 4.5) err(`theme.accent on theme.ground is ${contrast(t.accent, t.ground).toFixed(2)}:1; it needs 4.5:1 (it colours the hovered row's number)`)
  if (HEX.test(t.ground ?? '') && t.mode) {
    const dark = lum(t.ground) < 0.2
    if (dark !== (t.mode === 'dark')) warn(`theme.mode is "${t.mode}" but theme.ground looks ${dark ? 'dark' : 'light'}`)
  }
  const discs = c.disciplines
  if (discs != null && (!Array.isArray(discs) || !discs.length || discs.length > 8)) err('disciplines is a list of 1 to 8 names')
  const P = c.projects
  if (!Array.isArray(P) || P.length < 3 || P.length > 40) { err('projects is a list of 3 to 40 projects'); return { errors, warnings } }
  const slugs = new Set()
  P.forEach((p, i) => {
    const at = `projects[${i}]${p?.title ? ` (${p.title})` : ''}`
    if (!SLUG.test(p?.slug ?? '')) err(`${at}.slug must be lowercase words joined by hyphens`)
    else if (slugs.has(p.slug)) err(`${at}.slug "${p.slug}" is used twice`)
    else slugs.add(p.slug)
    str(p.title, `${at}.title`, 1, 34)
    str(p.client, `${at}.client`, 1, 32)
    str(p.place, `${at}.place`, 2, 24, true)
    if (str(p.discipline, `${at}.discipline`, 2, 18) && Array.isArray(discs) && !discs.includes(p.discipline)) err(`${at}.discipline "${p.discipline}" is not in disciplines (${discs.join(', ')})`)
    if (!/^\d{4}$/.test(String(p.year ?? ''))) err(`${at}.year must be four digits`)
    if (str(p.outcome, `${at}.outcome`, 12, 64) && p.outcome.trim().split(/\s+/).length < 4) warn(`${at}.outcome "${p.outcome}" reads like a label; say what changed, with a number if there is one`)
    if (!!p.image === !!p.loop) err(`${at}: give it an image or a loop (one of them)`)
    if (p.image) { file(p.image.src, `${at}.image.src`, IMG); str(p.image.alt, `${at}.image.alt`, 4, 160) }
    if (p.loop) {
      const f = file(p.loop.src, `${at}.loop.src`, VID)
      if (f && existsSync(f) && statSync(f).size > 4 * 1024 * 1024) err(`${at}.loop.src is ${(statSync(f).size / 1048576).toFixed(1)} MB; keep a loop under 4 MB`)
      file(p.loop.poster, `${at}.loop.poster`, IMG)
      str(p.loop.alt, `${at}.loop.alt`, 4, 160)
      if (!(p.loop.seconds >= 2 && p.loop.seconds <= 30)) err(`${at}.loop.seconds must be 2 to 30`)
    }
    const k = p.case ?? {}
    str(k.intro, `${at}.case.intro`, 12, 140, true)
    if (k.body != null && (!Array.isArray(k.body) || k.body.length > 6 || k.body.some((x) => typeof x !== 'string' || x.length > 900))) err(`${at}.case.body is up to 6 paragraphs of up to 900 characters`)
    if (!Array.isArray(k.credits) || k.credits.length < 2 || k.credits.length > 12) err(`${at}.case.credits is a list of 2 to 12 {role, name}`)
    else k.credits.forEach((x, j) => { str(x?.role, `${at}.case.credits[${j}].role`, 2, 24); str(x?.name, `${at}.case.credits[${j}].name`, 2, 60) })
    if (k.gallery != null) {
      if (!Array.isArray(k.gallery) || k.gallery.length > 8) err(`${at}.case.gallery is up to 8 images`)
      else k.gallery.forEach((g, j) => { file(g?.src, `${at}.case.gallery[${j}].src`, IMG); str(g?.alt, `${at}.case.gallery[${j}].alt`, 4, 160); str(g?.caption, `${at}.case.gallery[${j}].caption`, 2, 80, true) })
    }
    if (k.links != null) {
      if (!Array.isArray(k.links) || k.links.length > 4) err(`${at}.case.links is up to 4 links`)
      else k.links.forEach((l, j) => { str(l?.label, `${at}.case.links[${j}].label`, 1, 32); str(l?.href, `${at}.case.links[${j}].href`, 1, 300) })
    }
  })
  if (c.order !== 'manual') {
    for (let i = 1; i < P.length; i++) if (+P[i].year > +P[i - 1].year) { err(`projects are newest first: ${P[i].title} (${P[i].year}) comes after ${P[i - 1].title} (${P[i - 1].year}); reorder them or set "order": "manual"`); break }
  }
  const pv = c.preview
  if (pv != null) {
    if (pv.hover != null && (!Array.isArray(pv.hover) || pv.hover.length !== 2 || pv.hover.some((n) => !(n >= 0 && n < P.length)))) err('preview.hover is two project numbers (counting from 0)')
    if (pv.open != null && !(pv.open >= 0 && pv.open < P.length)) err('preview.open is a project number (counting from 0)')
    if (pv.filter != null && !P.some((p) => p.discipline === pv.filter)) err(`preview.filter "${pv.filter}" is not a discipline any project has`)
  }
  return { errors, warnings }
}
