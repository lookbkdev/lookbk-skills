// Testimonial Wall: every field wall.json can hold, with the limits the
// layouts are drawn for, and the honesty rules (the stars add up, the score
// matches the stars, a wall that admits 4-star reviews shows one). build.mjs
// calls validate() and lists every problem at once.
import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'

export const THEMES = ['letters', 'ledger']
export const LAYOUTS = ['beside', 'below']
export const BLOCKS = ['spread', 'cases', 'press']
export const WORDMARKS = ['serif', 'serif-italic', 'serif-bold', 'sans', 'sans-bold', 'caps', 'mono']
const PICTURE = ['.webp', '.jpg', '.jpeg', '.png', '.avif']
const LOGO = ['.svg', '.png', '.webp']

// characters as a reader sees them: the _turn_ and *bold* marks don't count
export const plain = (s) => String(s).replace(/[_*]/g, '')
export const words = (s) => plain(s).trim().split(/\s+/).filter(Boolean).length
/** Seconds a quote stays up: 1.2 s plus about 230 words a minute, 5 to 14 s. */
export const readTime = (s) => Math.min(14, Math.max(5, 1.2 + words(s) / 3.8))

export function validate(cfg, base) {
  const errs = []
  const at = (path, msg) => errs.push(`${path}: ${msg}`)
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const text = (path, v, max, { min = 1, need = true, marks = true } = {}) => {
    if (v === undefined || v === null || v === '') {
      if (need) at(path, 'is missing')
      return
    }
    if (typeof v !== 'string') return at(path, 'must be text')
    const n = (marks ? plain(v) : v).trim().length
    if (n < min) at(path, `is too short (${n} characters, at least ${min})`)
    if (n > max) at(path, `is too long (${n} characters, at most ${max}): shorten it`)
    if (/[<>]/.test(v)) at(path, 'may not contain < or >')
    if (marks && (v.match(/_/g) || []).length % 2) at(path, 'has an unclosed _turn_ mark')
    if (marks && (v.match(/\*/g) || []).length % 2) at(path, 'has an unclosed *bold* mark')
  }
  const href = (path, v) => {
    if (typeof v !== 'string' || !/^(https?:\/\/\S+|\/\S*|#[\w-]+|mailto:\S+|tel:[+\d\s-]+)$/.test(v))
      at(path, 'must be https://…, /path, #id, mailto: or tel:')
  }
  const file = (path, v, exts) => {
    if (typeof v !== 'string') return at(path, 'must be a file name next to wall.json')
    if (!exts.includes(extname(v).toLowerCase())) at(path, `must be ${exts.join(', ')}`)
    else if (!existsSync(resolve(base, v))) at(path, `file not found: ${v}`)
  }
  const color = (path, v) => {
    if (v !== undefined && !/^#[0-9a-f]{6}$/i.test(String(v))) at(path, 'must be a colour like #9c3b22')
  }
  const int = (path, v, lo, hi) => {
    if (!Number.isInteger(v) || v < lo || v > hi) at(path, `must be a whole number from ${lo} to ${hi}`)
  }
  const list = (path, v, lo, hi) => {
    if (!Array.isArray(v)) {
      at(path, `must be a list of ${lo} to ${hi}`)
      return []
    }
    if (v.length < lo || v.length > hi) at(path, `has ${v.length} entries, needs ${lo} to ${hi}`)
    return v
  }
  const known = (path, v, keys) => {
    if (!isObj(v)) return false
    for (const k of Object.keys(v)) if (!keys.includes(k)) at(`${path}.${k}`, `is not a field here (fields: ${keys.join(', ')})`)
    return true
  }

  if (!known('wall.json', cfg, ['theme', 'accent', 'accent2', 'lang', 'pageTitle', 'brand', 'kicker', 'title', 'pauseLabel', 'order', 'rating', 'lead', 'wall', 'cases', 'press'])) {
    at('wall.json', 'must be an object')
    return errs
  }
  if (!THEMES.includes(cfg.theme)) at('theme', `must be one of ${THEMES.join(', ')}`)
  color('accent', cfg.accent)
  color('accent2', cfg.accent2)
  text('lang', cfg.lang, 12, { need: false })
  text('pageTitle', cfg.pageTitle, 70, { need: false })
  text('brand', cfg.brand, 24)
  text('kicker', cfg.kicker, 44)
  text('title', cfg.title, 46, { min: 8 })
  if ((String(cfg.title || '').match(/_/g) || []).length > 2) at('title', 'may turn one phrase only (one pair of _ marks)')
  text('pauseLabel', cfg.pauseLabel, 16, { need: false })
  if (cfg.order !== undefined) {
    const o = list('order', cfg.order, 1, 3)
    o.forEach((b, i) => !BLOCKS.includes(b) && at(`order[${i}]`, `must be one of ${BLOCKS.join(', ')}`))
    if (new Set(o).size !== o.length) at('order', 'names a block twice')
    if (!o.includes('spread')) at('order', 'must include "spread" (the lead letter and the wall)')
  }

  // the rating: the distribution adds up and the score is what the stars say
  const r = cfg.rating
  if (r !== undefined && known('rating', r, ['score', 'count', 'source', 'distribution'])) {
    if (typeof r.score !== 'number' || r.score < 1 || r.score > 5 || Math.round(r.score * 10) !== r.score * 10)
      at('rating.score', 'must be a number from 1 to 5 with at most one decimal, like 4.8')
    int('rating.count', r.count, 1, 9999999)
    text('rating.source', r.source, 40)
    const d = list('rating.distribution', r.distribution, 5, 5)
    if (d.length === 5) {
      d.forEach((v, i) => int(`rating.distribution[${i}]`, v, 0, 100))
      const sum = d.reduce((a, b) => a + b, 0)
      if (sum !== 100) at('rating.distribution', `is the share of 5, 4, 3, 2 and 1 star reviews in percent and must add up to 100 (it adds up to ${sum})`)
      const mean = d.reduce((a, v, i) => a + v * (5 - i), 0) / (sum || 1)
      if (typeof r.score === 'number' && Math.abs(mean - r.score) > 0.06)
        at('rating.score', `is ${r.score} but the distribution averages ${mean.toFixed(2)}: give the real score or the real distribution`)
    }
  }

  // the lead letter
  const lead = cfg.lead
  if (known('lead', lead, ['label', 'items'])) {
    text('lead.label', lead.label, 14, { need: false })
    const items = list('lead.items', lead.items, 2, 6)
    items.forEach((q, i) => {
      const p = `lead.items[${i}]`
      if (!known(p, q, ['quote', 'name', 'role', 'place', 'tab', 'photo', 'result'])) return at(p, 'must be an object')
      text(`${p}.quote`, q.quote, 190, { min: 30 })
      text(`${p}.name`, q.name, 30)
      text(`${p}.role`, q.role, 46)
      text(`${p}.place`, q.place, 22, { need: false })
      text(`${p}.tab`, q.tab, 20)
      if (q.photo !== undefined) file(`${p}.photo`, q.photo, PICTURE)
      if (known(`${p}.result`, q.result, ['value', 'label'])) {
        text(`${p}.result.value`, q.result.value, 7)
        text(`${p}.result.label`, q.result.label, 64)
      } else at(`${p}.result`, 'is missing: the measured result this person got ({ "value": "40", "label": "*washes in,* and no pilling" })')
    })
    const names = items.map((q) => q && q.name)
    if (new Set(names).size !== names.length) at('lead.items', 'names the same person twice')
  } else at('lead', 'is missing')

  // the wall
  const wall = cfg.wall
  if (known('wall', wall, ['label', 'layout', 'columns', 'notes'])) {
    text('wall.label', wall.label, 40, { need: false })
    if (!LAYOUTS.includes(wall.layout)) at('wall.layout', `must be one of ${LAYOUTS.join(', ')}`)
    const max = wall.layout === 'beside' ? 2 : 4
    int('wall.columns', wall.columns, 1, max)
    const notes = list('wall.notes', wall.notes, 6, 24)
    notes.forEach((n, i) => {
      const p = `wall.notes[${i}]`
      if (!known(p, n, ['stars', 'quote', 'name', 'about', 'date', 'photo'])) return at(p, 'must be an object')
      int(`${p}.stars`, n.stars, 1, 5)
      text(`${p}.quote`, n.quote, 130, { min: 20 })
      text(`${p}.name`, n.name, 26)
      text(`${p}.about`, n.about, 30)
      text(`${p}.date`, n.date, 10)
      if (n.photo !== undefined) file(`${p}.photo`, n.photo, PICTURE)
    })
    // no note may show twice at once: three notes a column at least
    if (Number.isInteger(wall.columns) && notes.length && notes.length < wall.columns * 3)
      at('wall.notes', `has ${notes.length} notes for ${wall.columns} columns: give at least ${wall.columns * 3} (three a column) or fewer columns, so no note is on screen twice`)
    const d = r && r.distribution
    if (Array.isArray(d) && d.slice(1).some((v) => v > 0) && notes.length && notes.every((n) => n && n.stars === 5))
      at('wall.notes', 'are all 5 stars but the rating shows lower ones: include at least one real review under 5 stars')
  } else at('wall', 'is missing')

  // the cases
  const cases = cfg.cases
  if (cases !== undefined && known('cases', cases, ['label', 'title', 'items'])) {
    text('cases.label', cases.label, 20, { need: false })
    text('cases.title', cases.title, 34)
    const items = list('cases.items', cases.items, 3, 8)
    items.forEach((c, i) => {
      const p = `cases.items[${i}]`
      if (!known(p, c, ['segment', 'value', 'label', 'quote', 'name', 'place', 'photo', 'link'])) return at(p, 'must be an object')
      text(`${p}.segment`, c.segment, 20)
      text(`${p}.value`, c.value, 7)
      text(`${p}.label`, c.label, 44)
      text(`${p}.quote`, c.quote, 96, { min: 16 })
      text(`${p}.name`, c.name, 26)
      text(`${p}.place`, c.place, 26)
      if (c.photo !== undefined) file(`${p}.photo`, c.photo, PICTURE)
      if (known(`${p}.link`, c.link, ['label', 'href'])) {
        text(`${p}.link.label`, c.link.label, 18)
        href(`${p}.link.href`, c.link.href)
      } else at(`${p}.link`, 'is missing ({ "label": "Read the case", "href": "/cases/…" })')
    })
  }

  // the press strip
  const press = cfg.press
  if (press !== undefined && known('press', press, ['label', 'items'])) {
    text('press.label', press.label, 24, { need: false })
    const items = list('press.items', press.items, 3, 6)
    items.forEach((m, i) => {
      const p = `press.items[${i}]`
      if (!known(p, m, ['name', 'logo', 'style', 'line', 'href'])) return at(p, 'must be an object')
      text(`${p}.name`, m.name, 24, { marks: false })
      if (m.logo !== undefined) file(`${p}.logo`, m.logo, LOGO)
      if (m.style !== undefined && !WORDMARKS.includes(m.style)) at(`${p}.style`, `must be one of ${WORDMARKS.join(', ')}`)
      text(`${p}.line`, m.line, 60)
      if (m.href !== undefined) href(`${p}.href`, m.href)
    })
  }
  const order = cfg.order || ['spread', 'cases', 'press']
  if (order.includes('cases') && !cases) at('order', 'names "cases" but there is no cases block')
  if (order.includes('press') && !press) at('order', 'names "press" but there is no press block')
  return errs
}
