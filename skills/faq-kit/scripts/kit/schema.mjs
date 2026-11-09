// FAQ Kit: reads faq.json and lists every problem at once.
// validate(json) -> { errors: [..], notes: [..], c } where c is the config with defaults filled in.

/** The two type sets. `book`: a reading serif with an italic turn. `readout`: a grotesk with mono short answers. */
export const TYPES = {
  book: {
    google: 'family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500',
    display: "'Newsreader', Georgia, serif",
    text: "'Public Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  readout: {
    google: 'family=Schibsted+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500',
    display: "'Schibsted Grotesk', system-ui, sans-serif",
    text: "'Schibsted Grotesk', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
}
export const SHORT_MAX = 28
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const HEX = /^#[0-9a-f]{6}$/i
const LINK = /^(https:\/\/[^\s]+|\/[^\s]*|#[\w-]+|mailto:[^\s]+|tel:[+\d\s()-]+)$/
const ID = /^[a-z0-9][a-z0-9-]{0,40}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

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

/**
 * Arithmetic for computed table cells: numbers, + - * / and brackets, nothing
 * else. Returns a number, or throws with the reason.
 */
export function calc(expr) {
  const s = String(expr).replace(/\s+/g, '')
  if (!/^[\d.+\-*/()]+$/.test(s)) throw new Error('only numbers, + - * / and brackets are allowed')
  let i = 0
  const num = () => {
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i))
    if (!m) throw new Error(`expected a number at "${s.slice(i) || 'the end'}"`)
    i += m[0].length
    return Number(m[0])
  }
  const atom = () => {
    if (s[i] === '(') { i++; const v = sum(); if (s[i] !== ')') throw new Error('a bracket is not closed'); i++; return v }
    if (s[i] === '-') { i++; return -atom() }
    return num()
  }
  const prod = () => { let v = atom(); while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const w = atom(); v = op === '*' ? v * w : v / w } return v }
  const sum = () => { let v = prod(); while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const w = prod(); v = op === '+' ? v + w : v - w } return v }
  const v = sum()
  if (i !== s.length) throw new Error(`unexpected "${s.slice(i)}"`)
  if (!Number.isFinite(v)) throw new Error('the result is not a number (division by 0?)')
  return v
}
/** The number shown in a table cell: "€7.23" -> 7.23, "1,204.50 kr" -> 1204.5. */
export function cellNumber(text) {
  const m = String(text).replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : NaN
}

export function validate(j) {
  const errors = []
  const notes = []
  const err = (path, msg) => errors.push(`${path}: ${msg}`)
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const plain = (v) => String(v).replace(/\*\*|`|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  const str = (v, path, { min = 1, max, need = true } = {}) => {
    if (v === undefined || v === null || v === '') { if (need) err(path, 'is missing'); return }
    if (typeof v !== 'string') return err(path, 'must be text')
    const n = plain(v).length
    if (n < min) err(path, `is too short (at least ${min} characters)`)
    if (max && n > max) err(path, `is ${n} characters; the limit is ${max}. Shorten it rather than asking for smaller type`)
  }
  const href = (v, path) => {
    if (typeof v !== 'string' || !LINK.test(v)) err(path, `"${v ?? ''}" is not a link (https://…, /path, #id, mailto: or tel:)`)
  }
  const color = (v, path) => { if (typeof v !== 'string' || !HEX.test(v)) err(path, `"${v ?? ''}" must be a colour like #1c5a4b`) }
  const list = (v, path, min, max) => {
    if (!Array.isArray(v)) { err(path, 'must be a list'); return [] }
    if (v.length < min || v.length > max) err(path, `has ${v.length} items; use ${min} to ${max}`)
    return v
  }
  const inlineLinks = (s, path) => {
    for (const m of String(s).matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) href(m[2], `${path} (link "${m[1]}")`)
  }
  const turns = (s, path) => {
    const n = (String(s).match(/_[^_]+_/g) ?? []).length
    if (n > 1) err(path, `has ${n} _turns_; use one`)
  }

  if (!isObj(j)) return { errors: ['faq.json must be an object'], notes, c: null }
  const c = structuredClone(j)

  // theme
  const t = c.theme
  if (!isObj(t)) err('theme', 'is missing')
  else {
    for (const k of ['bg', 'ink', 'accent']) color(t[k], `theme.${k}`)
    for (const k of ['turn', 'mark', 'markInk', 'live']) if (t[k] !== undefined) color(t[k], `theme.${k}`)
    t.type ??= 'book'
    if (!TYPES[t.type]) err('theme.type', `must be one of ${Object.keys(TYPES).join(', ')}`)
    t.button ??= 'ink'
    if (!['ink', 'accent'].includes(t.button)) err('theme.button', 'must be "ink" or "accent"')
    t.corners ??= 'square'
    if (!['square', 'pill'].includes(t.corners)) err('theme.corners', 'must be "square" or "pill"')
    if (['bg', 'ink', 'accent'].every((k) => HEX.test(t[k] ?? ''))) {
      t.turn ??= t.accent
      t.mark ??= mix(t.bg, t.accent, 0.28)
      t.markInk ??= t.ink
      t.live ??= t.accent
      const need = (a, b, min, what) => {
        if (!HEX.test(t[a] ?? '') || !HEX.test(t[b] ?? '')) return
        const r = contrast(t[a], t[b])
        if (r < min) err(`theme.${a}`, `${what} is ${r.toFixed(2)}:1 against theme.${b}; it needs ${min}:1`)
      }
      need('ink', 'bg', 7, 'the text colour')
      need('accent', 'bg', 4.5, 'the short answers and step numbers (set at 14 to 16 px)')
      need('turn', 'bg', 3, "the headline's turn (large text)")
      need('markInk', 'mark', 4.5, 'the text on a search highlight')
      if (t.button === 'accent') {
        const on = contrast(t.bg, t.accent) >= contrast(t.ink, t.accent) ? t.bg : t.ink
        if (contrast(on, t.accent) < 4.5) err('theme.accent', `no text colour reads on an accent button (best ${contrast(on, t.accent).toFixed(2)}:1, needs 4.5:1); use "button": "ink"`)
      }
    }
  }

  // intro and search
  if (!isObj(c.intro)) err('intro', 'is missing')
  else {
    str(c.intro.eyebrow, 'intro.eyebrow', { max: 40 })
    str(c.intro.headline, 'intro.headline', { max: 60 })
    turns(c.intro.headline ?? '', 'intro.headline')
    str(c.intro.lede, 'intro.lede', { max: 220, need: false })
  }
  c.search = { label: 'Search the answers', placeholder: 'Search', hotkey: true, ...(c.search ?? {}) }
  str(c.search.label, 'search.label', { max: 32 })
  str(c.search.placeholder, 'search.placeholder', { max: 44 })

  // entries
  const ids = new Map()
  const seeId = (id, path) => {
    if (typeof id !== 'string' || !ID.test(id)) return err(`${path}.id`, `"${id ?? ''}" must be a slug (a to z, 0 to 9 and -, up to 41 characters): it is the #link to this answer`)
    if (ids.has(id)) err(`${path}.id`, `"#${id}" is already used by ${ids.get(id)}; every #link must be unique`)
    else ids.set(id, path)
  }
  const block = (b, path) => {
    if (!isObj(b)) return err(path, 'must be one of { "p" }, { "steps" }, { "table" }, { "more" }, { "note" }')
    const kind = ['p', 'steps', 'table', 'more', 'note'].filter((k) => k in b)
    if (kind.length !== 1) return err(path, `must have exactly one of p, steps, table, more, note (has ${kind.join(', ') || 'none'})`)
    const k = kind[0]
    if (k === 'p' || k === 'note') { str(b[k], `${path}.${k}`, { max: 600 }); inlineLinks(b[k], `${path}.${k}`) }
    if (k === 'steps') list(b.steps, `${path}.steps`, 2, 7).forEach((s, i) => { str(s, `${path}.steps[${i}]`, { max: 160 }); inlineLinks(s, `${path}.steps[${i}]`) })
    if (k === 'more') list(b.more, `${path}.more`, 1, 3).forEach((m, i) => {
      if (!isObj(m)) return err(`${path}.more[${i}]`, 'must be { "label", "href" }')
      str(m.label, `${path}.more[${i}].label`, { max: 34 })
      href(m.href, `${path}.more[${i}].href`)
    })
    if (k === 'table') {
      const tb = b.table
      if (!isObj(tb)) return err(`${path}.table`, 'must be { "head", "rows" }')
      const head = list(tb.head, `${path}.table.head`, 2, 4)
      head.forEach((h, i) => str(h, `${path}.table.head[${i}]`, { max: 24 }))
      const rows = list(tb.rows, `${path}.table.rows`, 1, 6)
      rows.forEach((r, i) => {
        if (!Array.isArray(r) || r.length !== head.length) return err(`${path}.table.rows[${i}]`, `has ${Array.isArray(r) ? r.length : 0} cells; the head has ${head.length}`)
        r.forEach((cell, k) => str(cell, `${path}.table.rows[${i}][${k}]`, { max: 28 }))
      })
      str(tb.caption, `${path}.table.caption`, { max: 120, need: false })
      if (tb.computed !== undefined) {
        const cp = tb.computed
        if (!isObj(cp)) return err(`${path}.table.computed`, 'must be { "column", "exprs", "decimals" }')
        if (!Number.isInteger(cp.column) || cp.column < 0 || cp.column >= head.length) err(`${path}.table.computed.column`, `must be a column number from 0 to ${head.length - 1}`)
        cp.decimals ??= 2
        if (!Number.isInteger(cp.decimals) || cp.decimals < 0 || cp.decimals > 4) err(`${path}.table.computed.decimals`, 'must be 0 to 4')
        const ex = list(cp.exprs, `${path}.table.computed.exprs`, rows.length, rows.length)
        ex.forEach((e, i) => {
          let v
          try { v = calc(e) } catch (x) { return err(`${path}.table.computed.exprs[${i}]`, `"${e}": ${x.message}`) }
          const cell = rows[i]?.[cp.column]
          if (cell === undefined) return
          const shown = cellNumber(cell)
          const want = Number(v.toFixed(cp.decimals))
          if (!(Math.abs(shown - want) < 1e-9)) err(`${path}.table.rows[${i}][${cp.column}]`, `shows "${cell}" but ${e} = ${v.toFixed(cp.decimals)}; fix the cell or the arithmetic`)
        })
      }
    }
  }
  const entry = (it, path) => {
    if (!isObj(it)) return err(path, 'must be { "id", "q", "short", "a" }')
    seeId(it.id, path)
    str(it.q, `${path}.q`, { max: 110 })
    if (typeof it.short === 'string' && it.short.length > SHORT_MAX) err(`${path}.short`, `"${it.short}" is ${it.short.length} characters; a short answer is ${SHORT_MAX} at most, so the column reads as answers`)
    else str(it.short, `${path}.short`, { max: SHORT_MAX })
    if (typeof it.short === 'string' && typeof it.q === 'string' && it.short.trim().toLowerCase().replace(/\?$/, '') === it.q.trim().toLowerCase().replace(/\?$/, '')) err(`${path}.short`, 'repeats the question; give the answer')
    list(it.a, `${path}.a`, 1, 5).forEach((b, i) => block(b, `${path}.a[${i}]`))
  }
  const hasGroups = c.groups !== undefined, hasItems = c.items !== undefined
  if (hasGroups === hasItems) err('groups / items', 'give either "groups" (2 to 6 topics) or "items" (one flat list), not both and not neither')
  else if (hasGroups) {
    list(c.groups, 'groups', 2, 6).forEach((g, i) => {
      const p = `groups[${i}]`
      if (!isObj(g)) return err(p, 'must be { "id", "title", "items" }')
      seeId(g.id, p)
      str(g.title, `${p}.title`, { max: 28 })
      str(g.short, `${p}.short`, { max: 12, need: false })
      list(g.items, `${p}.items`, 2, 8).forEach((it, k) => entry(it, `${p}.items[${k}]`))
    })
  } else list(c.items, 'items', 3, 14).forEach((it, k) => entry(it, `items[${k}]`))
  c.layout ??= 'auto'
  if (!['auto', 'index', 'ledger'].includes(c.layout)) err('layout', 'must be "auto", "index" or "ledger"')
  if (c.layout === 'auto') c.layout = hasGroups ? 'index' : 'ledger'
  if (c.layout === 'index' && !hasGroups) err('layout', '"index" needs "groups"; a flat list uses "ledger"')
  const all = hasGroups ? (Array.isArray(c.groups) ? c.groups.flatMap((g) => (Array.isArray(g?.items) ? g.items : [])) : []) : Array.isArray(c.items) ? c.items : []
  const entryIds = all.map((x) => x?.id).filter(Boolean)

  // open on load
  c.open ??= []
  list(c.open, 'open', 0, 2).forEach((id, i) => { if (!entryIds.includes(id)) err(`open[${i}]`, `"${id}" is not the id of an answer`) })

  // contact
  const k = c.contact
  if (!isObj(k)) err('contact', 'is missing: a FAQ ends with where to ask')
  else {
    str(k.headline, 'contact.headline', { max: 60 })
    turns(k.headline ?? '', 'contact.headline')
    str(k.text, 'contact.text', { max: 260 })
    str(k.promise, 'contact.promise', { max: 28 })
    if (typeof k.promise === 'string' && !/\d/.test(k.promise)) err('contact.promise', `"${k.promise}" must name a real response time with a number ("4 working hours", "1 working day"), not "soon"`)
    list(k.people, 'contact.people', 1, 4).forEach((p, i) => {
      if (!isObj(p)) return err(`contact.people[${i}]`, 'must be { "name", "remit" }')
      str(p.name, `contact.people[${i}].name`, { max: 28 })
      str(p.remit, `contact.people[${i}].remit`, { max: 24 })
    })
    str(k.city, 'contact.city', { max: 24 })
    try { new Intl.DateTimeFormat('en', { timeZone: k.timezone }) } catch { err('contact.timezone', `"${k.timezone ?? ''}" is not a time zone like Europe/Lisbon`) }
    if (!k.timezone) err('contact.timezone', 'is missing')
    if (!isObj(k.hours)) err('contact.hours', 'must be { "days", "open", "close" }')
    else {
      list(k.hours.days, 'contact.hours.days', 1, 7).forEach((d, i) => { if (!DAYS.includes(d)) err(`contact.hours.days[${i}]`, `"${d}" must be one of ${DAYS.join(', ')}`) })
      for (const x of ['open', 'close']) if (!TIME.test(k.hours[x] ?? '')) err(`contact.hours.${x}`, `"${k.hours[x] ?? ''}" must be a 24-hour time like 08:00`)
      if (TIME.test(k.hours.open ?? '') && TIME.test(k.hours.close ?? '') && k.hours.close <= k.hours.open) err('contact.hours.close', 'is not after the opening time')
    }
    if (k.now !== undefined && Number.isNaN(Date.parse(k.now))) err('contact.now', `"${k.now}" is not a date and time`)
    list(k.actions, 'contact.actions', 1, 2).forEach((a, i) => {
      if (!isObj(a)) return err(`contact.actions[${i}]`, 'must be { "label", "href" }')
      str(a.label, `contact.actions[${i}].label`, { max: 30 })
      href(a.href, `contact.actions[${i}].href`)
    })
  }

  // words the section uses; defaults in English
  c.text = {
    shortAnswer: 'Short answer', question: 'Question', number: 'No.', answers: 'answers', linkTo: 'Link to', copied: 'Copied',
    count: '{n} of {total} answers mention “{q}”', none: 'Nothing on “{q}” yet.', ask: 'Ask us directly', replies: 'a person replies within {promise}.',
    railNote: 'Not here?', railAsk: 'Ask {name} and the team', railReplies: 'Replies within {promise}.', searchBar: 'Search {total} answers',
    online: 'Online now · {time} in {city}', offline: 'Back {when} at {open} · {time} in {city} now', today: 'today', tomorrow: 'tomorrow',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], topics: 'Topics',
    ...(c.text ?? {}),
  }

  // what the preview video shows (defaults picked from the answers)
  const hasKind = (it, kind) => (it?.a ?? []).some((b) => isObj(b) && kind in b)
  const pick = (pred, not = []) => all.find((x) => pred(x) && !not.includes(x.id))?.id
  const pv = (c.preview ??= {})
  if (all.length >= 3) {
    const firstHalf = hasGroups ? (c.groups[0]?.items ?? []) : all.slice(0, Math.ceil(all.length / 2))
    pv.open ??= [
      firstHalf.find((x) => hasKind(x, 'table'))?.id ?? firstHalf[1]?.id ?? all[0].id,
      (hasGroups ? c.groups[1]?.items ?? [] : all.slice(2)).find((x) => hasKind(x, 'steps'))?.id ?? all[2].id,
    ]
    pv.deepLink ??= pick((x) => true, pv.open.concat(all.slice(0, Math.floor(all.length / 2)).map((x) => x.id))) ?? all.at(-1).id
    pv.query ??= 'free'
    list(pv.open, 'preview.open', 2, 2).forEach((id, i) => { if (!entryIds.includes(id)) err(`preview.open[${i}]`, `"${id}" is not the id of an answer`) })
    if (!entryIds.includes(pv.deepLink)) err('preview.deepLink', `"${pv.deepLink}" is not the id of an answer`)
    str(pv.query, 'preview.query', { max: 16 })
  }
  str(c.demo?.title, 'demo.title', { max: 70, need: false })
  return { errors, notes, c }
}
