// About Story Kit: every field of about.json, its limits, the colour contrast
// rules and the evidence rules. validate() returns every problem at once, so
// one build lists all of them.
//
// The evidence rules are the point of the kit: a number without a source, a
// milestone without evidence, an "as of" date in the future, or a headcount
// that the people section does not add up to, stops the build.

export const TYPES = {
  serif: {
    display: "'Source Serif 4', Georgia, serif",
    text: "'Source Serif 4', Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    google: 'family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=IBM+Plex+Mono:wght@400;500',
    weight: 400, strong: 600, track: '-.018em', em: 'italic', emWeight: 400, monoStretch: '100%', mono13: '13px',
  },
  grotesk: {
    display: "'Familjen Grotesk', system-ui, sans-serif",
    text: "'Familjen Grotesk', system-ui, sans-serif",
    mono: "'Martian Mono', ui-monospace, monospace",
    google: 'family=Familjen+Grotesk:ital,wght@0,400..700;1,400..700&family=Martian+Mono:wdth,wght@87.5..112.5,300..600',
    weight: 600, strong: 600, track: '-.03em', em: 'normal', emWeight: 600, monoStretch: '87.5%', mono13: '13px',
  },
}
export const FALLBACKS = ['rings', 'hatch', 'plain']
export const TIMELINES = ['spine', 'rail']
export const PEOPLE = ['sheet', 'index']

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
/** a + (b - a) * t, as #rrggbb */
export function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** The colour between `ink` and `bg` closest to `bg` that still holds `need`:1 against `bg`. */
export function soften(ink, bg, need) {
  for (let t = 0.9; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- dates ---------- */
const MONTH = /^(\d{4})-(\d{2})$/
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
/** "2017-06" or "2017-06-14" to a sortable number of months, or null */
export function months(s) {
  const m = MONTH.exec(s ?? '') ?? DAY.exec(s ?? '')
  if (!m) return null
  const mo = +m[2]
  if (mo < 1 || mo > 12) return null
  if (m[3] && (+m[3] < 1 || +m[3] > 31)) return null
  return +m[1] * 12 + (mo - 1) + (m[3] ? (+m[3] - 1) / 31 : 0)
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthName = (s) => MON[+s.slice(5, 7) - 1]
export const yearOf = (s) => +s.slice(0, 4)
/** "30 Sep 2026" or "Sep 2026" */
export const longDate = (s) => (DAY.test(s) ? `${+s.slice(8, 10)} ${monthName(s)} ${s.slice(0, 4)}` : `${monthName(s)} ${s.slice(0, 4)}`)
const today = () => new Date().toISOString().slice(0, 10)

/* ---------- the rules ---------- */
const BANNED = ['passionate', 'innovative', 'world-class', 'world class', 'best-in-class', 'cutting-edge', 'cutting edge', 'synergy', 'synergies', 'game-changing', 'next-level', 'customer-centric', 'excellence', 'disruptive']

export function validate(c, { now = today() } = {}) {
  const p = []
  const warn = []
  const str = (v, path, max, { req = true, min = 1 } = {}) => {
    if (v == null || v === '') { if (req) p.push(`${path} is required`); return false }
    if (typeof v !== 'string') { p.push(`${path} must be text`); return false }
    if (v.length < min) p.push(`${path} is too short`)
    if (max && v.replace(/_/g, '').length > max) p.push(`${path} is ${v.replace(/_/g, '').length} characters; keep it to ${max}`)
    return true
  }
  const arr = (v, path, min, max) => {
    if (!Array.isArray(v)) { p.push(`${path} must be a list`); return [] }
    if (v.length < min) p.push(`${path} needs at least ${min} (has ${v.length})`)
    if (v.length > max) p.push(`${path} takes at most ${max} (has ${v.length})`)
    return v
  }
  const href = (v, path) => {
    if (!str(v, path, 300)) return
    if (!/^(https?:\/\/|mailto:|tel:|#|\/|\.{0,2}\/?[\w-])/.test(v)) p.push(`${path} is not a link`)
  }
  const nowM = months(now)
  const notFuture = (s, path) => { const m = months(s); if (m != null && m > nowM + 1e-9) p.push(`${path} (${s}) is in the future; an "as of" date must be a day that has happened`) }

  if (!c || typeof c !== 'object') return { problems: ['about.json is not an object'], warnings: [] }
  str(c.brand, 'brand', 40)
  if (c.lang != null && !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(c.lang)) p.push('lang must be a language tag such as en or en-GB')
  arr(c.nav ?? [], 'nav', 0, 6).forEach((n, i) => { str(n.label, `nav[${i}].label`, 20); href(n.href, `nav[${i}].href`) })

  // theme
  const t = c.theme ?? {}
  if (!c.theme) p.push('theme is required')
  for (const k of ['bg', 'surface', 'ink', 'accent', 'onAccent']) if (!HEX.test(t[k] ?? '')) p.push(`theme.${k} must be a colour like #1e1a16`)
  if (t.type && !TYPES[t.type]) p.push(`theme.type must be one of ${Object.keys(TYPES).join(', ')}`)
  if (t.fallback && !FALLBACKS.includes(t.fallback)) p.push(`theme.fallback must be one of ${FALLBACKS.join(', ')}`)
  if (['bg', 'surface', 'ink', 'accent', 'onAccent'].every((k) => HEX.test(t[k] ?? ''))) {
    const need = (a, b, n, what) => { const r = contrast(t[a], t[b]); if (r < n) p.push(`theme.${a} on theme.${b} is ${r.toFixed(2)}:1; ${what} needs ${n}:1`) }
    need('ink', 'bg', 7, 'body text')
    need('ink', 'surface', 7, 'text on panels')
    need('accent', 'bg', 4.5, 'the accent is used for small markers and labels, so it')
    need('accent', 'surface', 4.5, 'the accent on panels')
    need('onAccent', 'accent', 4.5, 'text on the accent')
  }
  if (t.tones != null) arr(t.tones, 'theme.tones', 1, 6).forEach((x, i) => {
    for (const k of ['tile', 'line', 'ink']) if (!HEX.test(x?.[k] ?? '')) p.push(`theme.tones[${i}].${k} must be a colour`)
    if (HEX.test(x?.tile ?? '') && HEX.test(x?.ink ?? '') && contrast(x.tile, x.ink) < 3) p.push(`theme.tones[${i}]: initials on that tile are ${contrast(x.tile, x.ink).toFixed(2)}:1; large initials need 3:1`)
  })

  // founding
  const f = c.founding ?? {}
  if (!c.founding) p.push('founding is required')
  str(f.eyebrow, 'founding.eyebrow', 40)
  if (str(f.sentence, 'founding.sentence', 160)) {
    const turns = (f.sentence.match(/_/g) ?? []).length
    if (turns !== 2) p.push('founding.sentence needs exactly one _turn_ (a phrase between underscores)')
  }
  str(f.signedBy, 'founding.signedBy', 90)
  str(f.place, 'founding.place', 40)
  const founded = months(f.founded)
  if (founded == null || !DAY.test(f.founded ?? '')) p.push('founding.founded must be a date like 2014-03-03')
  else notFuture(f.founded, 'founding.founded')
  const hc = f.headcount ?? {}
  if (!Number.isInteger(hc.count) || hc.count < 1 || hc.count > 2000) p.push('founding.headcount.count must be a whole number of people (1 to 2000)')
  if (!DAY.test(hc.asOf ?? '')) p.push('founding.headcount.asOf must be a date like 2026-09-30')
  else notFuture(hc.asOf, 'founding.headcount.asOf')
  const w = f.written ?? {}
  if (months(w.date) == null) p.push('founding.written.date must be a month or a day, like 2026-10')
  else notFuture(w.date, 'founding.written.date')
  str(w.by, 'founding.written.by', 30)

  // titles
  const titles = c.titles ?? {}
  for (const k of Object.keys(titles)) if (!['record', 'people', 'practices', 'numbers', 'contact'].includes(k)) p.push(`titles.${k} is not a section (record, people, practices, numbers, contact)`)
  for (const [k, v] of Object.entries(titles)) str(v, `titles.${k}`, 24)

  // timeline
  const tl = c.timeline ?? {}
  if (!c.timeline) p.push('timeline is required')
  if (!TIMELINES.includes(tl.layout)) p.push(`timeline.layout must be ${TIMELINES.join(' or ')}`)
  const entries = arr(tl.entries ?? [], 'timeline.entries', 3, tl.layout === 'rail' ? 8 : 12)
  if (tl.layout === 'rail' && entries.length > 8) p.push('timeline.layout rail holds up to 8 entries; use spine for more')
  let last = -Infinity
  entries.forEach((e, i) => {
    const at = `timeline.entries[${i}]`
    const m = months(e.date)
    if (m == null || !MONTH.test(e.date ?? '')) p.push(`${at}.date must be a month like 2017-06`)
    else {
      if (m < last) p.push(`${at}.date (${e.date}) comes before the entry above it; list the record in order`)
      last = m
      if (founded != null && m < Math.floor(founded) - 24) p.push(`${at}.date (${e.date}) is more than two years before founding.founded`)
      notFuture(e.date, `${at}.date`)
    }
    str(e.title, `${at}.title`, 60)
    str(e.body, `${at}.body`, 220)
    if (!e.evidence || !String(e.evidence).trim()) p.push(`${at}.evidence is required: every milestone needs its receipt (a document, a count, a date, a source)`)
    else str(e.evidence, `${at}.evidence`, 140)
    if ((e.before == null) !== (e.after == null)) p.push(`${at}: give both before and after, or neither`)
    if (e.before != null) { str(e.before, `${at}.before`, 48); str(e.after, `${at}.after`, 48) }
  })

  // people
  const pp = c.people ?? {}
  if (!c.people) p.push('people is required')
  if (!PEOPLE.includes(pp.layout)) p.push(`people.layout must be ${PEOPLE.join(' or ')}`)
  const featured = arr(pp.featured ?? [], 'people.featured', 1, pp.layout === 'sheet' ? 24 : 12)
  const names = new Set()
  featured.forEach((x, i) => {
    const at = `people.featured[${i}]`
    if (str(x.name, `${at}.name`, 32)) { if (names.has(x.name)) p.push(`${at}.name (${x.name}) is listed twice`); names.add(x.name) }
    str(x.role, `${at}.role`, 22)
    str(x.does, `${at}.does`, 110)
    if (!Number.isInteger(x.since)) p.push(`${at}.since must be the year they joined, like 2016`)
    else {
      if (founded != null && x.since < Math.floor(founded / 12)) p.push(`${at}.since (${x.since}) is before the company was founded (${f.founded.slice(0, 4)})`)
      if (nowM != null && x.since > Math.floor(nowM / 12)) p.push(`${at}.since (${x.since}) is in the future`)
    }
    const d = x.decided
    if (!d) p.push(`${at}.decided is required: one thing they decided, with its year`)
    else {
      if (!Number.isInteger(d.year)) p.push(`${at}.decided.year must be a year`)
      else {
        if (Number.isInteger(x.since) && d.year < x.since) p.push(`${at}.decided.year (${d.year}) is before they joined (${x.since})`)
        if (nowM != null && d.year > Math.floor(nowM / 12)) p.push(`${at}.decided.year (${d.year}) is in the future`)
      }
      str(d.line, `${at}.decided.line`, 70)
      if ((d.before == null) !== (d.after == null)) p.push(`${at}.decided: give both before and after, or neither`)
      if (d.before != null) { str(d.before, `${at}.decided.before`, 40); str(d.after, `${at}.decided.after`, 40) }
    }
    if (x.photo != null) {
      str(x.photo, `${at}.photo`, 200)
      if (typeof x.photo === 'string' && !/\.(jpe?g|png|webp|avif|svg)$/i.test(x.photo)) p.push(`${at}.photo must be a .jpg, .png, .webp, .avif or .svg file`)
    }
    if (x.focus != null && !/^\d{1,3}% \d{1,3}%$/.test(x.focus)) p.push(`${at}.focus must look like "50% 30%"`)
    if (x.tone != null && !(Number.isInteger(x.tone) && x.tone >= 0 && x.tone < (t.tones?.length ?? 1))) p.push(`${at}.tone must be the number of one of theme.tones (0 to ${(t.tones?.length ?? 1) - 1})`)
  })
  const others = arr(pp.others ?? [], 'people.others', 0, 400)
  others.forEach((x, i) => {
    if (str(x.name, `people.others[${i}].name`, 32)) { if (names.has(x.name)) p.push(`people.others[${i}].name (${x.name}) is already listed`); names.add(x.name) }
    str(x.role, `people.others[${i}].role`, 18)
  })
  if (pp.layout === 'sheet' && others.length) p.push('people.others goes with the index layout; with sheet, show everyone as featured')
  if (Number.isInteger(hc.count) && featured.length && featured.length + others.length !== hc.count)
    p.push(`the people section lists ${featured.length}${others.length ? ` + ${others.length} = ${featured.length + others.length}` : ''} people, but founding.headcount.count says ${hc.count}; the page must agree with itself`)
  if (pp.hover != null && !(Number.isInteger(pp.hover) && pp.hover >= 0 && pp.hover < featured.length)) p.push('people.hover must be the number of a featured person (from 0)')

  // practices
  arr(c.practices ?? [], 'practices', 2, 6).forEach((x, i) => {
    const at = `practices[${i}]`
    str(x.rule, `${at}.rule`, 48)
    str(x.detail, `${at}.detail`, 160)
    if (!Number.isInteger(x.since)) p.push(`${at}.since must be a year`)
    else if (nowM != null && x.since > Math.floor(nowM / 12)) p.push(`${at}.since (${x.since}) is in the future`)
    if (!x.check || !String(x.check).trim()) p.push(`${at}.check is required: how a visitor could check this practice is real`)
    else str(x.check, `${at}.check`, 48)
    const words = `${x.rule ?? ''} ${x.detail ?? ''}`.toLowerCase()
    for (const b of BANNED) if (new RegExp(`\\b${b}\\b`).test(words)) warn.push(`${at} says "${b}": write what you do, not what you are`)
  })

  // numbers
  const nb = c.numbers ?? {}
  if (!c.numbers) p.push('numbers is required')
  if (!DAY.test(nb.asOf ?? '')) p.push('numbers.asOf must be the day the numbers were counted, like 2026-09-30')
  else notFuture(nb.asOf, 'numbers.asOf')
  arr(nb.items ?? [], 'numbers.items', 2, 4).forEach((x, i) => {
    const at = `numbers.items[${i}]`
    if (x.value == null || x.value === '') p.push(`${at}.value is required`)
    else if (!/\d/.test(String(x.value))) p.push(`${at}.value (${x.value}) has no digits; a number is a number`)
    else str(String(x.value), `${at}.value`, 8)
    if (x.unit != null) str(x.unit, `${at}.unit`, 5)
    str(x.label, `${at}.label`, 60)
    if (!x.source || !String(x.source).trim()) p.push(`${at}.source is required: say how this number was counted (a register, a ledger, a log, and the period)`)
    else str(x.source, `${at}.source`, 140)
  })

  // contact
  const ct = c.contact ?? {}
  if (!c.contact) p.push('contact is required')
  str(ct.title, 'contact.title', 60)
  str(ct.lede, 'contact.lede', 120, { req: false })
  arr(ct.people ?? [], 'contact.people', 1, 4).forEach((x, i) => {
    const at = `contact.people[${i}]`
    str(x.for, `${at}.for`, 40)
    if (!x.name || !String(x.name).trim()) p.push(`${at}.name is required: every address on the page reaches a named person`)
    else str(x.name, `${at}.name`, 32)
    str(x.role, `${at}.role`, 30)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email ?? '')) p.push(`${at}.email must be an email address`)
    str(x.reply, `${at}.reply`, 40)
  })
  arr(ct.visit ?? [], 'contact.visit', 0, 2).forEach((x, i) => str(x, `contact.visit[${i}]`, 90))
  return { problems: p, warnings: warn }
}
