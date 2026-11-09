// Integrations kit: every field of integrations.json, its limits, the colour
// rules, the cadence grammar and the packet rule. validate() returns every
// problem at once, so one build lists all of them. derive() works out every
// number the page shows (totals per status and category, records in and out,
// your setup minutes) from the lists, so nothing that can be counted is typed.

export const DISPLAYS = {
  newsreader: {
    family: "'Newsreader', Georgia, serif", weight: 400, track: '-.022em', wdth: 'normal', em: 'italic', caps: 'none',
    text: "'Public Sans', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace",
    google: ['family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400', 'family=Public+Sans:wght@400;500;600', 'family=JetBrains+Mono:wght@400;500'],
  },
  archivo: {
    family: "'Archivo', system-ui, sans-serif", weight: 700, track: '-.005em', wdth: '"wdth" 72', em: 'normal', caps: 'uppercase',
    text: "'Archivo', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace",
    google: ['family=Archivo:wdth,wght@62..125,400..800', 'family=IBM+Plex+Mono:wght@400;500'],
  },
}
export const STATUSES = { native: 'Native', webhook: 'Via webhook', community: 'Community', coming: 'Coming' }
export const SHAPES = ['circle', 'square', 'hex', 'diamond', 'tri', 'pill']
export const CUTS = ['bar', 'bars', 'dot', 'ring', 'slash', 'chev', 'cross', 'half']
export const DIRS = ['in', 'out', 'both']

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
/** The colour between `ink` and `bg`, closest to `bg`, that still holds `need`:1 against every one of `bgs`. */
export function soften(ink, bg, need, bgs = [bg]) {
  for (let t = 0.95; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (bgs.every((b) => contrast(m, b) >= need)) return m }
  return ink
}

/* ---------- cadence and the packet rule ---------- */
// The grammar: "instant" | "every <n> <s|min|h>" | "within <n> <s|min|h>" |
// "daily" | "daily HH:MM" | "weekly". Its interval in seconds sets one thing
// on the page: the gap between packets on that wire. Every packet moves at
// the same speed, so how often a record crosses reads as rhythm, not speed.
export const SPEED = 150 // CSS px per second, on every wire at every width
export const TIERS = [
  { upTo: 60, interval: 0.9, name: 'a minute or less' },
  { upTo: 15 * 60, interval: 1.8, name: 'up to 15 minutes' },
  { upTo: 3600, interval: 3.2, name: 'up to an hour' },
  { upTo: 6 * 3600, interval: 5, name: 'up to 6 hours' },
  { upTo: Infinity, interval: 8, name: 'longer, daily or weekly' },
]
const UNIT = { s: 1, min: 60, h: 3600 }
export function parseCadence(s) {
  if (typeof s !== 'string') return null
  const t = s.trim().toLowerCase()
  if (t === 'instant') return { seconds: 0, text: 'instant' }
  let m = /^(every|within) (\d+) (s|min|h)$/.exec(t)
  if (m) return { seconds: Number(m[2]) * UNIT[m[3]], text: `${m[1]} ${m[2]} ${m[3]}` }
  m = /^daily(?: ([01]\d|2[0-3]):([0-5]\d))?$/.exec(t)
  if (m) return { seconds: 86400, text: m[1] ? `daily at ${m[1]}:${m[2]}` : 'once a day' }
  if (t === 'weekly') return { seconds: 604800, text: 'once a week' }
  return null
}
export const tierOf = (seconds) => TIERS.findIndex((x) => seconds <= x.upTo)
export const packetInterval = (seconds) => TIERS[tierOf(seconds)].interval

/* ---------- validation ---------- */
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/
const NUM_CLAIM = /\b(\d+)\s+(integrations?|apps?|connections?)\b/gi

export function validate(c) {
  const p = []
  const str = (v, path, max, { req = true } = {}) => {
    if (v === undefined || v === null) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string') { p.push(`${path} must be text`); return false }
    if (!v.trim()) { p.push(`${path} is empty`); return false }
    if (v.length > max) p.push(`${path} is ${v.length} characters; keep it to ${max}, the diagram is laid out for that`)
    if (/!/.test(v)) p.push(`${path} has an exclamation mark; say it plainly`)
    if (/—/.test(v)) p.push(`${path} has an em dash; use a full stop, a comma or " · "`)
    return true
  }
  const color = (v, path, req = true) => {
    if (v === undefined) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string' || !HEX.test(v)) { p.push(`${path} must be a colour like #1d47c8`); return false }
    return true
  }
  const int = (v, path, min, max) => {
    if (!Number.isInteger(v)) { p.push(`${path} must be a whole number`); return false }
    if (v < min || v > max) { p.push(`${path} is ${v}; it must be from ${min} to ${max}`); return false }
    return true
  }
  const url = (v, path) => {
    if (!str(v, path, 300)) return
    if (!/^https:\/\//.test(v) && !/^(\.{0,2}\/|#)/.test(v)) p.push(`${path} must start with https:// or be a path on your site`)
  }
  const list = (v, path, min, max) => {
    if (!Array.isArray(v)) { p.push(`${path} must be a list`); return false }
    if (v.length < min || v.length > max) { p.push(`${path} has ${v.length}; give ${min} to ${max}`); return false }
    return true
  }
  const markOk = (m, path) => {
    if (!m || typeof m !== 'object') { p.push(`${path} is missing ({ shape, cut, color, ink })`); return }
    if (!SHAPES.includes(m.shape)) p.push(`${path}.shape must be one of ${SHAPES.join(', ')}`)
    if (!CUTS.includes(m.cut)) p.push(`${path}.cut must be one of ${CUTS.join(', ')}`)
    const a = color(m.color, `${path}.color`), b = color(m.ink, `${path}.ink`)
    if (a && b && contrast(m.color, m.ink) < 3) p.push(`${path}: the cut (ink ${m.ink}) on ${m.color} is ${contrast(m.color, m.ink).toFixed(2)}:1; it needs 3:1 to read`)
    if (a && HEX.test(c.theme?.page ?? '') && contrast(m.color, c.theme.page) < 3) p.push(`${path}.color ${m.color} is ${contrast(m.color, c.theme.page).toFixed(2)}:1 on theme.page; a mark needs 3:1`)
  }

  if (!c || typeof c !== 'object') return ['integrations.json is not an object']
  str(c.brand, 'brand', 18)
  str(c.lang, 'lang', 12, { req: false })
  markOk(c.mark, 'mark')
  str(c.eyebrow, 'eyebrow', 52)
  if (str(c.headline, 'headline', 90)) {
    const n = (c.headline.match(/_/g) ?? []).length
    if (n !== 0 && n !== 2) p.push('headline: mark one turn with a pair of underscores, like "See what crosses over _before you connect it._"')
  }
  str(c.lede, 'lede', 280, { req: false })

  // theme
  const t = c.theme ?? {}
  if (!c.theme) p.push('theme is missing')
  const ok = {}
  for (const k of ['page', 'surface', 'ink', 'accent', 'onAccent', 'packet']) ok[k] = color(t[k], `theme.${k}`)
  if (t.display !== undefined && !DISPLAYS[t.display]) p.push(`theme.display must be one of ${Object.keys(DISPLAYS).join(', ')}`)
  const need = (a, b, min, what) => {
    if (!ok[a] || !ok[b]) return
    const r = contrast(t[a], t[b])
    if (r < min) p.push(`${what}: theme.${a} on theme.${b} is ${r.toFixed(2)}:1, needs ${min}:1`)
  }
  need('ink', 'page', 7, 'text'); need('ink', 'surface', 7, 'text')
  need('accent', 'page', 4.5, 'the headline turn, links and your minutes')
  need('accent', 'surface', 4.5, 'your minutes in the setup list')
  need('onAccent', 'accent', 4.5, 'the button label')
  need('packet', 'page', 3, 'packets (a meaningful mark)'); need('packet', 'surface', 3, 'packets (a meaningful mark)')
  if (ok.page && ok.surface && contrast(t.page, t.surface) > 1.4) p.push('theme.surface should sit close to theme.page (the nodes are paper on paper, not cards)')
  const st = t.status ?? {}
  if (!t.status) p.push('theme.status is missing ({ native, webhook, community, coming })')
  for (const k of Object.keys(STATUSES)) {
    if (!color(st[k], `theme.status.${k}`)) continue
    for (const b of ['page', 'surface']) if (ok[b] && contrast(st[k], t[b]) < 4.5) p.push(`theme.status.${k} ${st[k]} is ${contrast(st[k], t[b]).toFixed(2)}:1 on theme.${b}; status text needs 4.5:1`)
  }

  // apps
  const ids = new Set()
  const cats = Array.isArray(c.categories) ? c.categories : []
  if (list(c.categories, 'categories', 2, 9)) c.categories.forEach((x, i) => str(x, `categories[${i}]`, 22))
  if (new Set(cats).size !== cats.length) p.push('categories has the same name twice')
  if (list(c.apps, 'apps', 4, 60)) {
    c.apps.forEach((a, i) => {
      const at = `apps[${i}]${a?.id ? ` (${a.id})` : ''}`
      if (!a || typeof a !== 'object') return p.push(`${at} is not an object`)
      if (typeof a.id !== 'string' || !ID.test(a.id)) p.push(`${at}.id must be lowercase letters, digits and hyphens, like "tillwright"`)
      else if (ids.has(a.id)) p.push(`${at}.id "${a.id}" is used twice`)
      else ids.add(a.id)
      str(a.name, `${at}.name`, 18)
      if (!cats.includes(a.category)) p.push(`${at}.category "${a.category}" is not in categories`)
      if (!STATUSES[a.status]) p.push(`${at}.status must be one of ${Object.keys(STATUSES).join(', ')}`)
      markOk(a.mark, `${at}.mark`)
      str(a.summary, `${at}.summary`, 90)
      if (a.status === 'coming') str(a.eta, `${at}.eta`, 24)
      else if (a.eta !== undefined) p.push(`${at}.eta is only for apps that are coming`)
      str(a.by, `${at}.by`, 44)
      str(a.plans, `${at}.plans`, 32)
      str(a.conflict, `${at}.conflict`, 44)
      str(a.log, `${at}.log`, 44)
      if (list(a.flows, `${at}.flows`, 1, 6)) a.flows.forEach((f, j) => {
        const ft = `${at}.flows[${j}]`
        str(f.record, `${ft}.record`, 24)
        if (!DIRS.includes(f.dir)) p.push(`${ft}.dir must be in (into ${c.brand ?? 'the product'}), out or both`)
        str(f.trigger, `${ft}.trigger`, 36, { req: false })
        if (!parseCadence(f.cadence)) p.push(`${ft}.cadence "${f.cadence}" is not one of: instant, every 15 min, within 1 h, within 4 s, daily, daily 02:00, weekly`)
        str(f.theirs, `${ft}.theirs`, 22)
        str(f.ours, `${ft}.ours`, 22)
      })
      if (Array.isArray(a.stays) ? a.stays.length > 4 : a.stays !== undefined) p.push(`${at}.stays has more than 4; name the ones people ask about`)
      ;(a.stays ?? []).forEach((s, j) => { str(s.record, `${at}.stays[${j}].record`, 24); str(s.why, `${at}.stays[${j}].why`, 34) })
      if (a.status === 'coming') {
        if (a.setup !== undefined) p.push(`${at} is coming, so it has no setup yet; remove setup`)
      } else if (list(a.setup, `${at}.setup`, 1, 6)) {
        a.setup.forEach((s, j) => {
          str(s.step, `${at}.setup[${j}].step`, 60)
          int(s.minutes, `${at}.setup[${j}].minutes`, 1, 240)
          if (s.who !== 'you' && s.who !== 'us') p.push(`${at}.setup[${j}].who must be "you" or "us"`)
        })
        if (!a.setup.some((s) => s.who === 'you')) p.push(`${at}.setup has no step for you; say what the person does, even if it is one click`)
      }
      if (a.minutes !== undefined) {
        const m = (a.setup ?? []).filter((s) => s.who === 'you').reduce((n, s) => n + s.minutes, 0)
        if (a.minutes !== m) p.push(`${at}.minutes says ${a.minutes}, its setup steps for you add up to ${m}; remove the typed number or fix the steps`)
      }
    })
  }
  const known = (id, path) => { if (!ids.has(id)) p.push(`${path} "${id}" is not an app id`) }
  if (list(c.featured, 'featured', 3, 8)) {
    c.featured.forEach((id, i) => known(id, `featured[${i}]`))
    if (new Set(c.featured).size !== c.featured.length) p.push('featured lists the same app twice')
  }
  if (c.selected !== undefined) {
    known(c.selected, 'selected')
    if (Array.isArray(c.featured) && !c.featured.includes(c.selected)) p.push('selected must be one of featured')
  }
  if (list(c.unsupported, 'unsupported', 2, 8)) c.unsupported.forEach((u, i) => {
    str(u.what, `unsupported[${i}].what`, 44); str(u.why, `unsupported[${i}].why`, 90); str(u.instead, `unsupported[${i}].instead`, 90)
    if (u.keywords !== undefined && (!Array.isArray(u.keywords) || u.keywords.some((k) => typeof k !== 'string'))) p.push(`unsupported[${i}].keywords must be a list of words`)
  })
  if (!c.cta) p.push('cta is missing ({ label: "Connect {app}", href })')
  else { str(c.cta.label, 'cta.label', 32); url(c.cta.href, 'cta.href') }
  if (!c.request) p.push('request is missing ({ label, href }: where to ask for an integration)')
  else { str(c.request.label, 'request.label', 36); url(c.request.href, 'request.href') }

  // typed numbers must agree with the lists
  if (!p.length || ids.size) {
    const D = derive(c, { safe: true })
    if (D) {
      for (const [k, v] of Object.entries(c.stated ?? {})) {
        const want = D.stated[k]
        if (want === undefined) p.push(`stated.${k} is not a number the page shows; use integrations, native, webhook, community, coming or unsupported`)
        else if (v !== want) p.push(`stated.${k} is ${v}, but the lists give ${want}; remove it or fix the lists`)
      }
      for (const [field, text] of [['eyebrow', c.eyebrow], ['headline', c.headline], ['lede', c.lede]]) {
        if (typeof text !== 'string') continue
        for (const m of text.matchAll(NUM_CLAIM)) if (Number(m[1]) !== D.stated.integrations) p.push(`${field} says "${m[0]}", but apps has ${D.stated.integrations}; write {count} and the build fills it in`)
      }
    }
  }
  return p
}

/** Everything the page counts, from the lists. */
export function derive(c, { safe = false } = {}) {
  try {
    const apps = c.apps.map((a) => {
      const flows = a.flows.map((f) => {
        const cad = parseCadence(f.cadence)
        return { ...f, seconds: cad.seconds, when: f.trigger ? `${f.trigger} · ${cad.text}` : cad.text[0].toUpperCase() + cad.text.slice(1), interval: packetInterval(cad.seconds) }
      })
      const you = (a.setup ?? []).filter((s) => s.who === 'you').reduce((n, s) => n + s.minutes, 0)
      const us = (a.setup ?? []).filter((s) => s.who === 'us').reduce((n, s) => n + s.minutes, 0)
      return {
        ...a, flows, stays: a.stays ?? [], setup: a.setup ?? [],
        nIn: flows.filter((f) => f.dir !== 'out').length, nOut: flows.filter((f) => f.dir !== 'in').length,
        you, us,
      }
    })
    const count = (s) => apps.filter((a) => a.status === s).length
    const stated = {
      integrations: apps.length, native: count('native'), webhook: count('webhook'), community: count('community'), coming: count('coming'),
      unsupported: (c.unsupported ?? []).length,
    }
    return { apps, stated, byCat: Object.fromEntries((c.categories ?? []).map((k) => [k, apps.filter((a) => a.category === k).length])) }
  } catch (e) {
    if (safe) return null
    throw e
  }
}
/** "{count}" and friends in copy */
export const fill = (s, D) => String(s ?? '').replace(/\{(count|native|webhook|community|coming|unsupported)\}/g, (_, k) => String(D.stated[k === 'count' ? 'integrations' : k]))
