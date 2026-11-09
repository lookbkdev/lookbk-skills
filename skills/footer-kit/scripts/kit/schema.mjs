// Footer Kit: reads footer.json and lists every problem at once.
// validate(json) -> { errors: [..], notes: [..], c } where c is the config with defaults filled in.

export const DISPLAYS = {
  gloock: { family: "'Gloock', Georgia, serif", google: 'family=Gloock', weight: 400, em: 'normal', track: '-0.012em' },
  instrument: { family: "'Instrument Serif', Georgia, serif", google: 'family=Instrument+Serif:ital@0;1', weight: 400, em: 'italic', track: '-0.01em' },
  bricolage: { family: "'Bricolage Grotesque', system-ui, sans-serif", google: 'family=Bricolage+Grotesque:opsz,wght@12..96,500..800', weight: 800, em: 'normal', track: '-0.03em' },
}
export const LAYOUTS = ['wordmark', 'index', 'dispatch', 'place']
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const HEX = /^#[0-9a-f]{6}$/i
const LINK = /^(https?:\/\/[^\s]+|\/[^\s]*|#[\w-]*|mailto:[^\s]+|tel:[+\d\s()-]+)$/

export function lum(hex) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')

export function validate(j) {
  const errors = []
  const notes = []
  const err = (path, msg) => errors.push(`${path}: ${msg}`)
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const str = (v, path, { min = 1, max, need = true } = {}) => {
    if (v === undefined || v === null || v === '') { if (need) err(path, 'is missing'); return }
    if (typeof v !== 'string') return err(path, 'must be text')
    const n = v.replace(/[_*]/g, '').length
    if (n < min) err(path, `is too short (at least ${min} characters)`)
    if (max && n > max) err(path, `is ${n} characters; the limit is ${max}. Shorten it rather than asking for smaller type`)
  }
  const href = (v, path) => {
    if (typeof v !== 'string' || !LINK.test(v)) err(path, `"${v ?? ''}" is not a link (https://…, /path, #id, mailto: or tel:)`)
  }
  const color = (v, path) => { if (typeof v !== 'string' || !HEX.test(v)) err(path, `"${v ?? ''}" must be a colour like #1c1a16`) }
  const list = (v, path, min, max) => {
    if (!Array.isArray(v)) { err(path, 'must be a list'); return [] }
    if (v.length < min || v.length > max) err(path, `has ${v.length} items; use ${min} to ${max}`)
    return v
  }
  const linkObj = (o, path, max = 28) => {
    if (!isObj(o)) return err(path, 'must be { "label", "href" }')
    str(o.label, `${path}.label`, { max })
    href(o.href, `${path}.href`)
  }

  if (!isObj(j)) return { errors: ['footer.json must be an object'], notes, c: null }
  const c = structuredClone(j)
  if (!LAYOUTS.includes(c.layout)) err('layout', `must be one of ${LAYOUTS.join(', ')}`)

  // theme
  const t = c.theme
  if (!isObj(t)) err('theme', 'is missing')
  else {
    for (const k of ['sheet', 'ink', 'board', 'boardInk', 'accent', 'onAccent', 'turn']) color(t[k], `theme.${k}`)
    for (const k of ['mark', 'error']) if (t[k] !== undefined) color(t[k], `theme.${k}`)
    if (!DISPLAYS[t.display]) err('theme.display', `must be one of ${Object.keys(DISPLAYS).join(', ')}`)
    if (t.buttons !== undefined && !['square', 'pill'].includes(t.buttons)) err('theme.buttons', 'must be "square" or "pill"')
    const ok = ['sheet', 'ink', 'board', 'boardInk', 'accent', 'onAccent', 'turn'].every((k) => HEX.test(t[k] ?? ''))
    if (ok) {
      const need = (a, b, min, what) => { const r = contrast(t[a], t[b]); if (r < min) err(`theme.${a}`, `${what} is ${r.toFixed(2)}:1 against theme.${b}; it needs ${min}:1`) }
      need('ink', 'sheet', 7, 'the text colour')
      need('turn', 'sheet', 4.5, 'the emphasis colour (headline turn, small labels)')
      need('onAccent', 'accent', 4.5, 'the button text')
      need('boardInk', 'board', 4.5, 'the name and legal text on the board')
      if (contrast(t.sheet, t.board) < 1.5) err('theme.board', `is too close to theme.sheet (${contrast(t.sheet, t.board).toFixed(2)}:1); the reveal needs a board that reads as a different stock, 1.5:1 or more`)
      if (contrast(t.accent, t.sheet) < 3) err('theme.accent', `the primary button's fill is ${contrast(t.accent, t.sheet).toFixed(2)}:1 against the sheet; it needs 3:1 to read as a button`)
    }
  }

  // brand
  const b = c.brand
  if (!isObj(b)) err('brand', 'is missing')
  else {
    str(b.name, 'brand.name', { max: 12 })
    if (typeof b.name === 'string' && /[|]/.test(b.name)) err('brand.name', 'put the line break in brand.break, not in the name')
    if (b.break !== undefined) {
      if (typeof b.break !== 'string' || b.break.split('|').length !== 2) err('brand.break', 'must be the name with one "|" where it may break onto two lines, e.g. "Fer|row"')
      else if (b.break.replace('|', '') !== b.name) err('brand.break', `"${b.break}" without the "|" must be exactly brand.name ("${b.name}")`)
      else if (b.break.split('|').some((p) => !p.trim())) err('brand.break', 'both lines need letters')
    } else if (typeof b.name === 'string' && b.name.length >= 5) notes.push(`brand.break is not set: on phones "${b.name}" stays on one line. Add "break" (e.g. "${b.name.slice(0, Math.ceil(b.name.length / 2))}|${b.name.slice(Math.ceil(b.name.length / 2))}", at a syllable or between words) to let it stack when one line would be under ${c.reveal?.stackBelow ?? 120} px tall.`)
    if (b.mark !== undefined && (typeof b.mark !== 'string' || ![...b.mark].length || [...b.mark].length > 1)) err('brand.mark', 'must be one character, like "." or "®"')
    str(b.legal, 'brand.legal', { max: 90 })
    if (!Number.isInteger(b.year) || b.year < 1900 || b.year > 2100) err('brand.year', 'must be a year like 2026')
  }

  // the closing call (wordmark, index, place)
  if (['wordmark', 'index', 'place'].includes(c.layout)) {
    const k = c.cta
    if (!isObj(k)) err('cta', 'is missing')
    else {
      str(k.eyebrow, 'cta.eyebrow', { max: 44 })
      str(k.headline, 'cta.headline', { max: 48 })
      if (typeof k.headline === 'string' && (k.headline.match(/_/g) || []).length % 2) err('cta.headline', 'has an unmatched "_"')
      str(k.lede, 'cta.lede', { max: 140, need: false })
      linkObj(k.primary, 'cta.primary', 24)
      if (k.secondary !== undefined) linkObj(k.secondary, 'cta.secondary', 24)
    }
  }

  // columns
  const nCols = list(c.columns, 'columns', 1, 4).length
  ;(c.columns || []).forEach((col, i) => {
    str(col?.title, `columns[${i}].title`, { max: 18 })
    list(col?.links, `columns[${i}].links`, 2, 7).forEach((l, k) => {
      linkObj(l, `columns[${i}].links[${k}]`, 26)
      if (l?.note !== undefined) str(l.note, `columns[${i}].links[${k}].note`, { max: 10 })
    })
  })
  list(c.socials ?? [], 'socials', 0, 5).forEach((s, i) => linkObj(s, `socials[${i}]`, 14))
  list(c.legalLinks, 'legalLinks', 1, 5).forEach((s, i) => linkObj(s, `legalLinks[${i}]`, 18))
  c.backToTop ??= { label: 'Back to top' }
  str(c.backToTop.label, 'backToTop.label', { max: 18 })

  if (c.visit !== undefined) {
    list(c.visit, 'visit', 1, 3).forEach((v, i) => {
      str(v?.city, `visit[${i}].city`, { max: 20 })
      str(v?.address, `visit[${i}].address`, { max: 34 })
      str(v?.hours, `visit[${i}].hours`, { max: 26, need: false })
    })
    if (!['wordmark', 'index'].includes(c.layout)) err('visit', `is for the wordmark and index layouts; ${c.layout} has its own place for this`)
  }
  if (c.layout === 'wordmark' && nCols + (c.visit ? 1 : 0) > 4) err('columns', `${nCols} columns and a visit column don't fit one row; use 3 columns with visit, or 4 without`)

  // dispatch
  if (c.layout === 'dispatch') {
    const d = c.dispatch
    if (!isObj(d)) err('dispatch', 'is missing')
    else {
      str(d.eyebrow, 'dispatch.eyebrow', { max: 44 })
      str(d.headline, 'dispatch.headline', { max: 48 })
      str(d.fine, 'dispatch.fine', { max: 90 })
      str(d.placeholder ?? 'you@example.com', 'dispatch.placeholder', { max: 32 })
      str(d.button ?? 'Subscribe', 'dispatch.button', { max: 14 })
      str(d.sent, 'dispatch.sent', { max: 70 })
      if (typeof d.action !== 'string' || !(d.action === '#' || /^https:\/\//.test(d.action))) err('dispatch.action', 'must be your sign-up form\'s https:// address (where the form posts), or "#" for a demo that sends nothing')
      list(d.issues ?? [], 'dispatch.issues', 0, 4).forEach((x, i) => {
        str(x?.no, `dispatch.issues[${i}].no`, { max: 8 })
        str(x?.title, `dispatch.issues[${i}].title`, { max: 40 })
        str(x?.date, `dispatch.issues[${i}].date`, { max: 8, need: false })
        href(x?.href, `dispatch.issues[${i}].href`)
      })
    }
    if (nCols > 4) err('columns', 'use up to 4 columns')
  }

  // place
  if (c.layout === 'place') {
    const p = c.place
    if (!isObj(p)) err('place', 'is missing')
    else {
      str(p.address, 'place.address', { max: 90 })
      if (p.phone !== undefined) str(p.phone, 'place.phone', { max: 20 })
      try { new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone }) } catch { err('place.timezone', `"${p.timezone}" is not a time zone (e.g. "Europe/London")`) }
      if (!isObj(p.hours)) err('place.hours', 'must give every day: { "mon": "closed", "tue": "17:00-23:00", … }')
      else for (const d of DAYS) {
        const v = p.hours[d]
        if (v !== 'closed' && !(typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d$/.test(v))) err(`place.hours.${d}`, `"${v ?? ''}" must be "closed" or "HH:MM-HH:MM" (24-hour; "24:00" for midnight)`)
        else if (v !== 'closed') { const [a, z] = v.split('-').map((s) => s.split(':').map(Number)).map(([h, m]) => h * 60 + m); if (z <= a) err(`place.hours.${d}`, `"${v}" closes before it opens; for after midnight use "24:00"`) }
      }
      if (p.now !== undefined && isNaN(Date.parse(p.now))) err('place.now', 'must be a date and time like "2026-11-13T19:30" (only for previews)')
      const m = p.map
      const pt = (v, path) => { if (!Array.isArray(v) || v.length !== 2 || v.some((n) => typeof n !== 'number' || n < 0 || n > 100)) err(path, 'must be [x, y], each 0 to 100') }
      if (!isObj(m)) err('place.map', 'is missing (streets, route, pin)')
      else {
        list(m.streets, 'place.map.streets', 2, 14).forEach((s, i) => {
          list(s?.points, `place.map.streets[${i}].points`, 2, 12).forEach((q, k) => pt(q, `place.map.streets[${i}].points[${k}]`))
          if (s?.width !== undefined && !(s.width >= 1 && s.width <= 8)) err(`place.map.streets[${i}].width`, 'must be 1 to 8')
          if (s?.name !== undefined) { str(s.name, `place.map.streets[${i}].name`, { max: 18 }); pt(s.labelAt, `place.map.streets[${i}].labelAt`) }
        })
        for (const k of ['water', 'park']) if (m[k] !== undefined) { list(m[k].shape, `place.map.${k}.shape`, 3, 16).forEach((q, i) => pt(q, `place.map.${k}.shape[${i}]`)); if (m[k].name !== undefined) { str(m[k].name, `place.map.${k}.name`, { max: 18 }); pt(m[k].labelAt, `place.map.${k}.labelAt`) } }
        list(m.route, 'place.map.route', 2, 12).forEach((q, k) => pt(q, `place.map.route[${k}]`))
        pt(m.pin, 'place.map.pin')
        str(m.from, 'place.map.from', { max: 22 })
      }
      str(p.directions?.label, 'place.directions.label', { max: 24 })
      href(p.directions?.href, 'place.directions.href')
      list(p.gettingHere ?? [], 'place.gettingHere', 0, 4).forEach((g, i) => { str(g?.mode, `place.gettingHere[${i}].mode`, { max: 10 }); str(g?.text, `place.gettingHere[${i}].text`, { max: 34 }) })
      p.text = { open: 'Open now', closesAt: 'Closes at {t}', closed: 'Closed · opens {d} {t}', closedAll: 'Closed', closedDay: 'Closed', ...(p.text || {}) }
      p.dayNames ??= ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      if (!Array.isArray(p.dayNames) || p.dayNames.length !== 7) err('place.dayNames', 'must be 7 short day names, Monday first')
    }
    if (nCols > 3) err('columns', 'the place layout takes up to 3 columns')
  }

  // reveal
  c.reveal = { lift: true, rise: 0.22, stackBelow: 120, ...(c.reveal || {}) }
  if (typeof c.reveal.lift !== 'boolean') err('reveal.lift', 'must be true or false')
  if (!(c.reveal.rise >= 0 && c.reveal.rise <= 0.35)) err('reveal.rise', 'must be 0 to 0.35')
  if (!(c.reveal.stackBelow >= 0 && c.reveal.stackBelow <= 200)) err('reveal.stackBelow', 'must be 0 to 200 (px)')

  // the demo page above (only for the built preview page)
  if (c.demo !== undefined) {
    str(c.demo.title, 'demo.title', { max: 70 })
    list(c.demo.above, 'demo.above', 1, 3).forEach((a, i) => { str(a?.label, `demo.above[${i}].label`, { max: 36 }); str(a?.heading, `demo.above[${i}].heading`, { max: 130 }); str(a?.text, `demo.above[${i}].text`, { max: 240, need: false }) })
  }
  return { errors, notes, c }
}
