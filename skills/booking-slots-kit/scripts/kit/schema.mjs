// Booking Slots: every field of booking.json, its limits, the colour rules,
// the hours format and the copy rules. validate() returns every problem at
// once, so one build lists all of them.

export const VOICES = {
  serif: {
    family: "'Source Serif 4', Georgia, serif", weight: 300, track: '-.025em', emStyle: 'italic', caps: 'none',
    text: "'Hanken Grotesk', system-ui, sans-serif", mono: "'DM Mono', ui-monospace, monospace",
    google: ['family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;1,8..60,300', 'family=Hanken+Grotesk:wght@400;500;600', 'family=DM+Mono:wght@400;500'],
    fonts: ['Source Serif 4', 'Hanken Grotesk', 'DM Mono'],
  },
  signage: {
    family: "'Big Shoulders Display', 'Arial Narrow', sans-serif", weight: 800, track: '-.005em', emStyle: 'normal', caps: 'uppercase',
    text: "'Archivo', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace",
    google: ['family=Big+Shoulders+Display:wght@700;800', 'family=Archivo:wght@400;500;600', 'family=IBM+Plex+Mono:wght@400;500'],
    fonts: ['Big Shoulders Display', 'Archivo', 'IBM Plex Mono'],
  },
  grotesk: {
    family: "'Hanken Grotesk', system-ui, sans-serif", weight: 500, track: '-.035em', emStyle: 'normal', caps: 'none',
    text: "'Hanken Grotesk', system-ui, sans-serif", mono: "'DM Mono', ui-monospace, monospace",
    google: ['family=Hanken+Grotesk:wght@400;500;600', 'family=DM+Mono:wght@400;500'],
    fonts: ['Hanken Grotesk', 'DM Mono'],
  },
}
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

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
  for (let t = 0.95; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- hours ---------- */
const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-4]):([0-5]\d)$/
/** { "mon-fri": "09:00-17:00", "sat": ["09:00-12:00","13:00-15:00"], "sun": null } → 7 lists of [from, to] minutes, Sunday first. */
export function parseHours(h, where, bad) {
  const week = DAYS.map(() => [])
  if (!h || typeof h !== 'object' || Array.isArray(h)) { bad(`${where}: must be an object such as { "mon-fri": "09:00-17:00" }`); return week }
  for (const [key, val] of Object.entries(h)) {
    const m = /^([a-z]{3})(?:-([a-z]{3}))?$/.exec(key)
    const a = m && DAYS.indexOf(m[1]), b = m && (m[2] ? DAYS.indexOf(m[2]) : a)
    if (!m || a < 0 || b < 0) { bad(`${where}: "${key}" is not a day or a day range (mon, tue, … sun, or mon-fri)`); continue }
    if (val === null) continue
    const spans = Array.isArray(val) ? val : [val]
    const parsed = []
    for (const s of spans) {
      const x = SPAN.exec(String(s))
      if (!x) { bad(`${where}: "${s}" is not HH:MM-HH:MM (24-hour clock)`); continue }
      const from = +x[1] * 60 + +x[2], to = +x[3] * 60 + +x[4]
      if (from % 5 || to % 5) bad(`${where}: "${s}" must be on 5-minute steps`)
      if (to <= from) { bad(`${where}: "${s}" closes before it opens (split a night across two days)`); continue }
      parsed.push([from, to])
    }
    for (let d = a; ; d = (d + 1) % 7) { week[d].push(...parsed); if (d === b) break }
  }
  for (const [i, spans] of week.entries()) {
    spans.sort((x, y) => x[0] - y[0])
    for (let k = 1; k < spans.length; k++) if (spans[k][0] < spans[k - 1][1]) bad(`${where}: the hours on ${DAYS[i]} overlap`)
  }
  return week
}
export const validZone = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return /\//.test(tz) || tz === 'UTC' } catch { return false } }
const DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = (d) => DATE.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d
const ID = /^[a-z][a-z0-9_]{0,23}$/
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/* ---------- copy ---------- */
// Pressure the page cannot honestly keep: the only timer it shows is the hold.
const PRESSURE = [
  [/\bonly\s+\d+\s+(left|slots?|spots?|times?|places?|chairs?)\b/i, '"only N left" pressure'],
  [/\b(hurry|selling fast|going fast|last chance|almost (gone|full)|limited (time|availability)|book (now )?before it'?s gone|don'?t miss)\b/i, 'urgency the page cannot back up'],
  [/\b(\d+ people (are )?(looking|viewing)|in high demand)\b/i, 'invented demand'],
  [/\b(guaranteed|instant(ly)? confirmed)\b/i, 'a promise the page cannot keep'],
  [/!/, 'an exclamation mark'],
]

export function validate(c) {
  const out = []
  const bad = (m) => out.push(m)
  const str = (v, where, min, max, opt = false) => {
    if (v === undefined || v === null) { if (!opt) bad(`${where}: missing (${min} to ${max} characters)`); return }
    if (typeof v !== 'string') return bad(`${where}: must be text`)
    if (v.length < min || v.length > max) bad(`${where}: ${v.length} characters, needs ${min} to ${max}`)
    for (const [re, why] of PRESSURE) if (re.test(v)) bad(`${where}: "${v}" reads as ${why}; say what is true instead (the page shows real free times and the hold)`)
  }
  const num = (v, where, min, max, opt = false, int = true) => {
    if (v === undefined || v === null) { if (!opt) bad(`${where}: missing (${min} to ${max})`); return }
    if (typeof v !== 'number' || !Number.isFinite(v) || (int && !Number.isInteger(v)) || v < min || v > max) bad(`${where}: ${JSON.stringify(v)} must be ${int ? 'a whole number ' : ''}from ${min} to ${max}`)
  }
  if (!c || typeof c !== 'object') return ['booking.json must be an object']
  str(c.brand, 'brand', 1, 60)
  str(c.title, 'title', 1, 70)
  str(c.description, 'description', 20, 170)
  str(c.eyebrow, 'eyebrow', 1, 40)
  str(c.headline, 'headline', 8, 70)
  if (typeof c.headline === 'string' && (c.headline.match(/_/g) ?? []).length > 2) bad('headline: one _turn_ at most')

  // theme
  const t = c.theme ?? {}
  if (!c.theme) bad('theme: missing')
  for (const k of ['page', 'surface', 'ink', 'accent', 'onAccent', 'hold']) if (!HEX.test(t[k] ?? '')) bad(`theme.${k}: "${t[k]}" is not #rrggbb`)
  if (t.voice !== undefined && !VOICES[t.voice]) bad(`theme.voice: "${t.voice}" is not one of ${Object.keys(VOICES).join(', ')}`)
  if (t.corners !== undefined && !['soft', 'square'].includes(t.corners)) bad('theme.corners: soft or square')
  if (['page', 'surface', 'ink', 'accent', 'onAccent', 'hold'].every((k) => HEX.test(t[k] ?? ''))) {
    const need = (a, b, n, what) => { const r = contrast(t[a], t[b]); if (r < n) bad(`theme: ${what} is ${r.toFixed(2)}:1, needs ${n}:1 (${a} ${t[a]} on ${b} ${t[b]})`) }
    need('ink', 'page', 7, 'ink on page')
    need('ink', 'surface', 7, 'ink on surface')
    need('accent', 'page', 3, 'the accent (free times, the chosen slot) on page')
    need('accent', 'surface', 3, 'the accent on surface')
    need('onAccent', 'accent', 4.5, 'text on the accent (the chosen slot, the book button)')
    need('hold', 'surface', 3, 'the hold colour on surface')
  }

  // shop
  const s = c.shop ?? {}
  if (!c.shop) bad('shop: missing')
  str(s.name, 'shop.name', 1, 60, true)
  str(s.address, 'shop.address', 4, 80)
  str(s.where, 'shop.where', 4, 60)
  str(s.city, 'shop.city', 2, 28)
  if (!validZone(s.tz ?? '')) bad(`shop.tz: "${s.tz}" is not an IANA time zone (such as Europe/London)`)
  if (s.phone !== undefined && !/^\+?[\d ()-]{6,22}$/.test(s.phone)) bad(`shop.phone: "${s.phone}" is not a phone number`)

  const hours = parseHours(c.hours, 'hours', bad)
  if (hours.every((d) => !d.length)) bad('hours: the shop is never open')
  for (const [i, x] of (c.closed ?? []).entries()) {
    if (!validDate(x.from ?? '')) bad(`closed[${i}].from: "${x.from}" is not YYYY-MM-DD`)
    if (x.to !== undefined && (!validDate(x.to) || x.to < x.from)) bad(`closed[${i}].to: must be a date on or after from`)
    str(x.label, `closed[${i}].label`, 2, 28)
  }
  if ((c.closed ?? []).length > 30) bad('closed: up to 30 entries')

  // people
  const people = c.people ?? []
  if (!Array.isArray(people) || people.length > 8) bad('people: a list of 0 to 8')
  const ids = new Set()
  const shiftsOf = {}
  for (const [i, p] of people.entries()) {
    const w = `people[${i}]${p?.id ? ` (${p.id})` : ''}`
    if (!ID.test(p.id ?? '')) bad(`${w}.id: lowercase letters, digits and _ , starting with a letter`)
    if (ids.has(p.id)) bad(`${w}.id: used twice`)
    ids.add(p.id)
    str(p.name, `${w}.name`, 2, 40)
    str(p.role, `${w}.role`, 2, 32)
    if (p.initials !== undefined && !/^[A-Z]{1,3}$/.test(p.initials)) bad(`${w}.initials: 1 to 3 capital letters`)
    const sh = parseHours(p.shifts, `${w}.shifts`, bad)
    shiftsOf[p.id] = sh
    if (sh.every((d) => !d.length)) bad(`${w}.shifts: no working hours at all`)
    for (const [d, spans] of sh.entries()) for (const [a, b] of spans) {
      const inside = hours[d].some(([x, y]) => x <= a && b <= y)
      if (!inside) bad(`${w}.shifts: ${DAYS[d]} ${hm(a)}-${hm(b)} is outside the opening hours (${hours[d].map(([x, y]) => `${hm(x)}-${hm(y)}`).join(', ') || 'closed'})`)
    }
    for (const [k, r] of (p.away ?? []).entries()) if (!Array.isArray(r) || !validDate(r[0] ?? '') || !validDate(r[1] ?? '') || r[1] < r[0]) bad(`${w}.away[${k}]: ["YYYY-MM-DD", "YYYY-MM-DD"], first and last day off`)
  }
  if (people.length) str(c.peopleLabel, 'peopleLabel', 2, 20)

  // services
  const svcs = c.services ?? []
  if (!Array.isArray(svcs) || svcs.length < 1 || svcs.length > 8) bad('services: 1 to 8')
  const sids = new Set()
  for (const [i, v] of svcs.entries()) {
    const w = `services[${i}]${v?.id ? ` (${v.id})` : ''}`
    if (!ID.test(v.id ?? '')) bad(`${w}.id: lowercase letters, digits and _`)
    if (sids.has(v.id)) bad(`${w}.id: used twice`)
    sids.add(v.id)
    str(v.name, `${w}.name`, 2, 36)
    str(v.desc, `${w}.desc`, 4, 70)
    num(v.minutes, `${w}.minutes`, 10, 480)
    num(v.buffer, `${w}.buffer`, 0, 60, true)
    if (v.price !== null && v.price !== undefined) num(v.price, `${w}.price`, 0, 1e9, false, false)
    str(v.priceText, `${w}.priceText`, 2, 20, true)
    if (v.price === undefined && v.priceText === undefined) bad(`${w}: give a price (a number) or priceText ("from £40", "free")`)
    if (people.length) {
      if (!Array.isArray(v.who) || !v.who.length) bad(`${w}.who: the ids of the people who do it`)
      else for (const id of v.who) if (!ids.has(id)) bad(`${w}.who: no person "${id}"`)
      // it must fit in at least one shift
      if (Number.isInteger(v.minutes) && Array.isArray(v.who)) {
        const fits = v.who.some((id) => (shiftsOf[id] ?? []).some((spans, d) => spans.some(([a, b]) => hours[d].some(([x, y]) => Math.min(b, y) - Math.max(a, x) >= v.minutes))))
        if (!fits) bad(`${w}: ${v.minutes} minutes does not fit in any shift of the people who do it`)
      }
    } else if (v.who !== undefined) bad(`${w}.who: there are no people; leave who out`)
  }

  // rules
  const r = c.rules ?? {}
  if (r.step !== undefined && ![5, 10, 15, 20, 30, 60].includes(r.step)) bad('rules.step: 5, 10, 15, 20, 30 or 60')
  num(r.notice, 'rules.notice', 0, 10080, true)
  num(r.horizon, 'rules.horizon', 1, 180, true)
  num(r.hold, 'rules.hold', 2, 20, true)
  if (r.weekStart !== undefined && !['mon', 'sun'].includes(r.weekStart)) bad('rules.weekStart: mon or sun')

  // bookings
  if (c.bookings !== undefined && !Array.isArray(c.bookings)) bad('bookings: a list')
  for (const [i, b] of (c.bookings ?? []).entries()) {
    const w = `bookings[${i}]`
    if (!ids.has(b.person) && !(people.length === 0 && b.person === undefined)) bad(`${w}.person: no person "${b.person}"`)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.start ?? '') && Number.isNaN(Date.parse(b.start ?? ''))) bad(`${w}.start: "YYYY-MM-DDTHH:MM" in the shop's time, or an ISO time with its offset`)
    num(b.minutes, `${w}.minutes`, 5, 1440)
    num(b.buffer, `${w}.buffer`, 0, 120, true)
  }
  if (c.bookingsUrl !== undefined && c.bookingsUrl !== null && !/^https:\/\//.test(c.bookingsUrl)) bad('bookingsUrl: an https address, or null')

  // money
  const money = c.money ?? {}
  try { new Intl.NumberFormat(money.locale ?? 'en', { style: 'currency', currency: money.currency ?? 'USD' }) } catch { bad(`money: "${money.currency}" / "${money.locale}" is not a currency and locale Intl knows`) }

  // endpoint
  const e = c.endpoint
  if (e !== undefined && e !== null) {
    if (!/^https:\/\//.test(e.url ?? '')) bad('endpoint.url: an https address')
    if (e.adapter !== undefined && !['json', 'form'].includes(e.adapter)) bad('endpoint.adapter: json or form')
    if (e.hold !== undefined && e.hold !== null && !/^https:\/\//.test(e.hold)) bad('endpoint.hold: an https address that holds a time, or null')
  }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c.email ?? '')) bad(`email: "${c.email}" is not an email address (requests go here when there is no endpoint, or it fails)`)

  // card
  const k = c.card ?? {}
  if (!c.card) bad('card: missing')
  str(k.title, 'card.title', 2, 28)
  str(k.cta, 'card.cta', 2, 24)
  str(k.policy, 'card.policy', 8, 120)
  if (!/^[A-Z]{2,4}$/.test(k.ref ?? '')) bad('card.ref: 2 to 4 capital letters, the start of the reference')
  if (c.cancelList !== undefined && typeof c.cancelList !== 'boolean') bad('cancelList: true or false')

  // preview
  const pv = c.preview
  if (pv) {
    if (Number.isNaN(Date.parse(pv.now ?? ''))) bad('preview.now: an ISO time')
    if (pv.tz !== undefined && !validZone(pv.tz)) bad(`preview.tz: "${pv.tz}" is not an IANA time zone`)
    const sc = pv.script ?? {}
    if (pv.script) {
      if (!sids.has(sc.service)) bad(`preview.script.service: no service "${sc.service}"`)
      if (sc.person && sc.person !== 'any' && !ids.has(sc.person)) bad(`preview.script.person: no person "${sc.person}"`)
      if (!validDate(sc.day ?? '')) bad('preview.script.day: YYYY-MM-DD')
      if (!Array.isArray(sc.times) || sc.times.length !== 2 || sc.times.some((x) => !/^\d{2}:\d{2}$/.test(x))) bad('preview.script.times: two "HH:MM" starts to pick in turn')
      if (!sc.draft || typeof sc.draft.name !== 'string' || typeof sc.draft.contact !== 'string') bad('preview.script.draft: { name, contact }')
    }
  }
  return out
}
