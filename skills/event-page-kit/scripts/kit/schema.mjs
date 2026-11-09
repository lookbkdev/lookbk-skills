// Event Page Kit: every field of event.json, its limits, the colour rules and
// the schedule rules. validate() returns every problem at once, so one build
// lists all of them, and the model the build draws from (every session with
// its exact start and end instants, its column, its lane in its track).
//
// The schedule rules are the point of the kit. The build stops on:
//   - a room double-booked (two sessions in one room overlapping by a minute)
//   - a session outside its day's opening hours, or across a break that
//     covers its room
//   - a person in two places at once (any two of their sessions overlapping)
//   - a person with no session, or whose quote points at a session they are
//     not in
//   - a clock time that does not exist in the venue's zone that day (the
//     hour skipped when the clocks go forward)
//   - a ticket whose sales end after the event, or that is shown on sale at
//     the preview clock but whose sales have already ended (or the reverse)
//   - a preview clock that is not before, during and after the event as named
import { localToUtc, minutes, toUtc, validZone } from './tz.mjs'

export const TYPES = {
  grotesk: {
    display: "'Archivo', system-ui, sans-serif",
    text: "'Archivo', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    google: 'family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500',
  },
  serif: {
    display: "'Instrument Serif', Georgia, serif",
    text: "'Instrument Sans', system-ui, sans-serif",
    mono: "'DM Mono', ui-monospace, monospace",
    google: 'family=Instrument+Sans:wdth,wght@75..100,400..700&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500',
  },
}
export const MARKS = ['solid', 'ticks', 'dashes', 'hatch', 'dots', 'hairline']
export const STATUS = ['full', 'cancelled']
export const TITLES = { programme: 'Programme', speakers: 'Who says what', tickets: 'Tickets', venue: 'Venue and access' }

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
/** The colour between `ink` and `bg` closest to `bg` that still holds `need`:1 against every one of `grounds`. */
export function soften(ink, bg, need, grounds = [bg]) {
  for (let t = 0.9; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (grounds.every((g) => contrast(m, g) >= need)) return m }
  return ink
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const realDate = (d) => DATE.test(d ?? '') && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max

export function validate(c) {
  const P = [], W = []
  const need = (ok, msg) => { if (!ok) P.push(msg) }
  if (!c || typeof c !== 'object') return { problems: ['the file is not a JSON object'], warnings: [] }

  need(str(c.brand, 40), 'brand: 1 to 40 characters')
  need(Array.isArray(c.title?.lines) && c.title.lines.length >= 1 && c.title.lines.length <= 3 && c.title.lines.every((l) => str(l, 12)), 'title.lines: 1 to 3 lines of up to 12 characters')
  if (c.title?.accent !== undefined) need(Number.isInteger(c.title.accent) && c.title.accent >= 0 && c.title.accent < (c.title.lines?.length ?? 0), 'title.accent: the number of one of the title lines, from 0')
  need(str(c.kicker, 200), 'kicker: 1 to 200 characters')

  // theme
  const t = c.theme ?? {}
  for (const k of ['bg', 'surface', 'past', 'ink', 'accent', 'onAccent']) need(HEX.test(t[k] ?? ''), `theme.${k}: a colour as #rrggbb`)
  need(TYPES[t.type ?? 'grotesk'], `theme.type: one of ${Object.keys(TYPES).join(', ')}`)
  if (['bg', 'surface', 'past', 'ink', 'accent', 'onAccent'].every((k) => HEX.test(t[k] ?? ''))) {
    for (const g of ['bg', 'surface', 'past']) {
      const r = contrast(t.ink, t[g])
      need(r >= 7, `theme.ink on theme.${g} is ${r.toFixed(2)}:1; it needs 7:1 (body text and the session titles sit on it)`)
    }
    const a = contrast(t.accent, t.bg)
    need(a >= 4.5, `theme.accent on theme.bg is ${a.toFixed(2)}:1; it needs 4.5:1 (sales-end times and the clock are set in it)`)
    const o = contrast(t.onAccent, t.accent)
    need(o >= 4.5, `theme.onAccent on theme.accent is ${o.toFixed(2)}:1; it needs 4.5:1 (the Now tags)`)
  }

  // venue
  const v = c.venue ?? {}
  need(str(v.name, 50), 'venue.name: 1 to 50 characters')
  need(str(v.short, 40), 'venue.short: 1 to 40 characters (the Where fact, as "Albion Mill, Leeds")')
  need(str(v.note, 80), 'venue.note: 1 to 80 characters (under the Where fact)')
  need(validZone(v.zone), `venue.zone: a time zone name such as "Europe/London" (got ${JSON.stringify(v.zone)})`)
  need(str(v.city, 30), 'venue.city: 1 to 30 characters (names the venue clock, as "Leeds")')
  need(Array.isArray(v.rows) && v.rows.length >= 2 && v.rows.length <= 8 && v.rows.every((r) => Array.isArray(r) && str(r[0], 20) && str(r[1], 140)), 'venue.rows: 2 to 8 [label (up to 20), text (up to 140)] pairs')

  // rooms, tracks
  const rooms = Array.isArray(c.rooms) ? c.rooms : []
  need(rooms.length >= 1 && rooms.length <= 5, 'rooms: 1 to 5 rooms')
  const roomIx = new Map()
  rooms.forEach((r, i) => {
    need(/^[A-Za-z0-9]{1,3}$/.test(r.id ?? ''), `rooms[${i}].id: 1 to 3 letters or digits`)
    need(!roomIx.has(r.id), `rooms[${i}].id "${r.id}" is used twice`)
    need(str(r.name, 18), `rooms[${i}].name: 1 to 18 characters`)
    if (r.note !== undefined) need(str(r.note, 32), `rooms[${i}].note: up to 32 characters`)
    if (r.sparse !== undefined) need(typeof r.sparse === 'boolean', `rooms[${i}].sparse: true or false`)
    roomIx.set(r.id, i)
  })
  const tracks = Array.isArray(c.tracks) ? c.tracks : []
  need(tracks.length >= 1 && tracks.length <= 5, 'tracks: 1 to 5 tracks')
  const trackIx = new Map()
  tracks.forEach((tr, i) => {
    need(/^[a-z0-9-]{1,16}$/.test(tr.id ?? ''), `tracks[${i}].id: lowercase letters, digits or -`)
    need(!trackIx.has(tr.id), `tracks[${i}].id "${tr.id}" is used twice`)
    need(str(tr.name, 18), `tracks[${i}].name: 1 to 18 characters`)
    need(MARKS.includes(tr.mark), `tracks[${i}].mark: one of ${MARKS.join(', ')}`)
    if (tr.accent !== undefined) need(typeof tr.accent === 'boolean', `tracks[${i}].accent: true or false`)
    trackIx.set(tr.id, i)
  })
  const marks = tracks.map((x) => `${x.mark}${x.accent ? '+' : ''}`)
  need(new Set(marks).size === marks.length, 'tracks: two tracks have the same mark; each track needs its own, so the key reads without colour')

  // days
  const days = Array.isArray(c.days) ? c.days : []
  need(days.length >= 1 && days.length <= 3, 'days: 1 to 3 days')
  const dayIx = new Map()
  days.forEach((d, i) => {
    need(/^[a-z0-9-]{1,12}$/.test(d.id ?? ''), `days[${i}].id: lowercase letters, digits or -`)
    need(!dayIx.has(d.id), `days[${i}].id "${d.id}" is used twice`)
    need(realDate(d.date), `days[${i}].date: a real date as YYYY-MM-DD`)
    if (i > 0 && realDate(d.date) && realDate(days[i - 1].date)) need(d.date > days[i - 1].date, `days[${i}].date: days must be in date order`)
    const o = minutes(d.opens), cl = minutes(d.closes)
    need(o !== null, `days[${i}].opens: a time as HH:MM`)
    need(cl !== null, `days[${i}].closes: a time as HH:MM (after midnight is fine: "01:30")`)
    d._open = o
    d._close = o !== null && cl !== null ? (cl <= o ? cl + 1440 : cl) : null
    dayIx.set(d.id, i)
  })

  const zone = validZone(v.zone) ? v.zone : null
  /** A clock time on a day, to minutes after that day's midnight (after midnight when the day runs past it). */
  const onDay = (d, hm) => {
    const m = minutes(hm)
    if (m === null || d._open === null) return null
    return m < d._open && d._close > 1440 && m + 1440 <= d._close ? m + 1440 : m
  }

  // breaks
  const breaks = Array.isArray(c.breaks) ? c.breaks : []
  breaks.forEach((b, i) => {
    const d = days[dayIx.get(b.day)]
    need(d, `breaks[${i}].day: "${b.day}" is not a day`)
    need(str(b.title, 20), `breaks[${i}].title: 1 to 20 characters`)
    need(str(b.where, 40), `breaks[${i}].where: 1 to 40 characters`)
    if (!d) return
    b._s = onDay(d, b.start); b._e = onDay(d, b.end)
    need(b._s !== null && b._e !== null && b._e > b._s, `breaks[${i}]: start and end as HH:MM, end after start`)
    const ids = b.rooms ?? rooms.map((r) => r.id)
    const ix = ids.map((id) => roomIx.get(id))
    need(ix.every((x) => x !== undefined), `breaks[${i}].rooms: ${ids.filter((id) => !roomIx.has(id)).join(', ')} not a room`)
    const sorted = [...ix].sort((a, z) => a - z)
    need(sorted.every((x, k) => k === 0 || x === sorted[k - 1] + 1), `breaks[${i}].rooms: the rooms must sit next to each other in the rooms list, so the band can span them`)
    b._c0 = sorted[0] ?? 0; b._cs = sorted.length; b._rooms = new Set(ids)
    b._dayIx = dayIx.get(b.day)
    if (b._s !== null && b._e !== null) need(b._s >= d._open && b._e <= d._close, `breaks[${i}] (${b.title}) is outside ${d.id}'s opening hours`)
  })

  // people
  const people = Array.isArray(c.people) ? c.people : []
  const personIx = new Map()
  people.forEach((p, i) => {
    need(/^[a-z0-9-]{1,24}$/.test(p.id ?? ''), `people[${i}].id: lowercase letters, digits or -`)
    need(!personIx.has(p.id), `people[${i}].id "${p.id}" is used twice`)
    need(str(p.name, 40), `people[${i}].name: 1 to 40 characters`)
    need(str(p.role, 60), `people[${i}].role: 1 to 60 characters`)
    if (p.says !== undefined) need(str(p.says, 180), `people[${i}].says: up to 180 characters`)
    if (p.featured) need(str(p.says, 180), `people[${i}] (${p.name}) is featured but has no "says": the speakers list shows what each person will actually say`)
    personIx.set(p.id, i)
  })

  // sessions
  const sessions = Array.isArray(c.sessions) ? c.sessions : []
  need(sessions.length >= 1 && sessions.length <= 120, 'sessions: 1 to 120')
  const codes = new Map()
  sessions.forEach((s, i) => {
    const at = `sessions[${i}]${s.code ? ` (${s.code})` : ''}`
    need(/^[A-Za-z0-9.]{1,6}$/.test(s.code ?? ''), `${at}.code: 1 to 6 letters, digits or dots`)
    need(!codes.has(s.code), `${at}.code is used twice`)
    codes.set(s.code, i)
    const d = days[dayIx.get(s.day)]
    need(d, `${at}.day: "${s.day}" is not a day`)
    need(roomIx.has(s.room), `${at}.room: "${s.room}" is not a room`)
    need(trackIx.has(s.track), `${at}.track: "${s.track}" is not a track`)
    need(str(s.title, 80), `${at}.title: 1 to 80 characters`)
    if (s.meta !== undefined) need(str(s.meta, 70), `${at}.meta: up to 70 characters`)
    if (s.line !== undefined) need(str(s.line, 110), `${at}.line: up to 110 characters`)
    if (s.access !== undefined) need(Array.isArray(s.access) && s.access.length <= 3 && s.access.every((a) => str(a, 6)), `${at}.access: up to 3 marks of up to 6 characters ("BSL", "CC")`)
    if (s.status !== undefined) need(STATUS.includes(s.status), `${at}.status: one of ${STATUS.join(', ')}`)
    const ppl = s.people ?? []
    need(Array.isArray(ppl) && ppl.length <= 4, `${at}.people: up to 4 people`)
    for (const id of ppl) need(personIx.has(id), `${at}.people: "${id}" is not in people`)
    if (!ppl.length) need(str(s.meta, 70), `${at}: needs people or a meta line (a film's director, year and length)`)
    if (s.room && s.code && !s.code.startsWith(s.room)) W.push(`${at}: the code does not start with its room id "${s.room}"; codes that do are easier to find in the grid`)
    s._room = roomIx.get(s.room); s._track = trackIx.get(s.track); s._dayIx = dayIx.get(s.day)
    if (!d) return
    s._s = onDay(d, s.start); s._e = onDay(d, s.end)
    if (s._s !== null && s._e !== null && s._e <= s._s && s._e + 1440 <= d._close) s._e += 1440
    need(s._s !== null && s._e !== null, `${at}: start and end as HH:MM`)
    if (s._s === null || s._e === null) return
    need(s._e > s._s, `${at}: ends before it starts`)
    const len = s._e - s._s
    need(len >= 15 && len <= 360, `${at}: ${len} minutes long; a session runs 15 minutes to 6 hours`)
    if (len < 30) W.push(`${at}: ${len} minutes; it is drawn compact (code and title on one line)`)
    need(s._s >= d._open && s._e <= d._close, `${at} (${s.start}–${s.end}) is outside ${d.id}'s opening hours (${d.opens}–${d.closes})`)
    if (zone) {
      s._u0 = toUtc(d.date, s._s, zone); s._u1 = toUtc(d.date, s._e, zone)
      need(s._u0 !== null, `${at}: ${s.start} on ${d.date} does not exist in ${zone} (the clocks go forward then)`)
      need(s._u1 !== null, `${at}: ${s.end} on ${d.date} does not exist in ${zone} (the clocks go forward then)`)
    }
    for (const b of breaks) if (b._dayIx === s._dayIx && b._rooms?.has(s.room) && b._s !== null && s._s < b._e && b._s < s._e)
      P.push(`${at} (${s.start}–${s.end}) runs into the ${b.title.toLowerCase()} break (${b.start}–${b.end}) in ${s.room}`)
  })
  const ok = sessions.filter((s) => s._s != null && s._e != null && s._dayIx !== undefined)
  // a room double-booked
  for (let i = 0; i < ok.length; i++) for (let k = i + 1; k < ok.length; k++) {
    const a = ok[i], b = ok[k]
    if (a._dayIx === b._dayIx && a.room === b.room && a._s < b._e && b._s < a._e)
      P.push(`room ${a.room} is double-booked on ${a.day}: ${a.code} (${a.start}–${a.end}) and ${b.code} (${b.start}–${b.end})`)
  }
  // a person in two places at once
  for (const p of people) {
    const mine = ok.filter((s) => (s.people ?? []).includes(p.id)).sort((a, b) => a._dayIx - b._dayIx || a._s - b._s)
    p._sessions = mine.map((s) => s.code)
    if (!sessions.some((s) => (s.people ?? []).includes(p.id))) P.push(`people: ${p.name ?? p.id} has no session; take them out or add them to one`)
    for (let i = 0; i < mine.length; i++) for (let k = i + 1; k < mine.length; k++) {
      const a = mine[i], b = mine[k]
      if (a._dayIx === b._dayIx && a._s < b._e && b._s < a._e)
        P.push(`${p.name} is in two places at once on ${a.day}: ${a.code} in ${a.room} (${a.start}–${a.end}) and ${b.code} in ${b.room} (${b.start}–${b.end})`)
    }
    if (p.talk !== undefined) {
      const s = sessions[codes.get(p.talk)]
      if (!s) P.push(`people (${p.name}).talk: "${p.talk}" is not a session code`)
      else if (!(s.people ?? []).includes(p.id)) P.push(`people (${p.name}).talk: ${p.talk} does not list ${p.id} in its people`)
    } else if (p.featured) P.push(`people (${p.name}).talk: a featured person needs the code of the session their quote is about`)
  }
  // gaps
  for (const [di, d] of days.entries()) for (const r of rooms.filter((x) => !x.sparse)) {
    const list = ok.filter((s) => s._dayIx === di && s.room === r.id).sort((a, b) => a._s - b._s)
    for (let i = 1; i < list.length; i++) {
      const gap = list[i]._s - list[i - 1]._e
      const covered = breaks.some((b) => b._dayIx === di && b._rooms?.has(r.id) && b._s <= list[i - 1]._e + 15 && b._e >= list[i]._s - 15)
      if (gap >= 90 && !covered) W.push(`${d.id}, ${r.name}: ${gap} minutes free between ${list[i - 1].code} and ${list[i].code} with no break; is a session missing?`)
    }
  }
  // lanes: sessions of one track that overlap (in different rooms) sit side by side when the phone shows one track
  for (const [di] of days.entries()) for (const tr of tracks) {
    const list = ok.filter((s) => s._dayIx === di && s.track === tr.id).sort((a, b) => a._s - b._s || a._room - b._room)
    let cluster = [], end = -1
    const close = () => { const n = Math.max(1, ...cluster.map((s) => s._lane + 1)); for (const s of cluster) s._lanes = n; cluster = [] }
    for (const s of list) {
      if (s._s >= end && cluster.length) close()
      const used = new Set(cluster.filter((x) => x._e > s._s).map((x) => x._lane))
      let lane = 0
      while (used.has(lane)) lane++
      s._lane = lane
      cluster.push(s); end = Math.max(end, s._e)
    }
    if (cluster.length) close()
    for (const s of list) if (s._lanes > 3) P.push(`${s.code}: ${s._lanes} ${tr.name} sessions run at once; the phone's track view fits 3 side by side`)
  }

  // the event's span
  const firstUtc = Math.min(...ok.map((s) => s._u0 ?? Infinity))
  const lastUtc = Math.max(...ok.map((s) => s._u1 ?? -Infinity))

  // preview clock
  const pv = c.preview ?? {}
  const pu = {}
  for (const k of ['clock', 'before', 'after']) {
    pu[k] = zone ? localToUtc(pv[k], zone) : null
    need(pu[k] !== null, `preview.${k}: a venue time as YYYY-MM-DDTHH:MM`)
  }
  if (Number.isFinite(firstUtc) && pu.clock !== null) need(pu.clock >= firstUtc && pu.clock < lastUtc, 'preview.clock: must fall during the event (the stills and video show the programme "now")')
  if (Number.isFinite(firstUtc) && pu.before !== null) need(pu.before < firstUtc, 'preview.before: must be before the first session')
  if (Number.isFinite(lastUtc) && pu.after !== null) need(pu.after >= lastUtc, 'preview.after: must be after the last session')
  if (pv.visitorZone !== undefined) need(validZone(pv.visitorZone), `preview.visitorZone: a time zone name (got ${JSON.stringify(pv.visitorZone)})`)

  // tickets
  const tickets = Array.isArray(c.tickets) ? c.tickets : []
  need(tickets.length >= 1 && tickets.length <= 6, 'tickets: 1 to 6')
  tickets.forEach((tk, i) => {
    const at = `tickets[${i}]${tk.name ? ` (${tk.name})` : ''}`
    need(str(tk.name, 30), `${at}.name: 1 to 30 characters`)
    need(str(tk.includes, 90), `${at}.includes: 1 to 90 characters`)
    need(str(tk.price, 10), `${at}.price: 1 to 10 characters, with its currency ("£190")`)
    need(/^https:\/\//.test(tk.url ?? ''), `${at}.url: the booking page, https://`)
    if (tk.stock !== undefined) need(Number.isInteger(tk.stock) && tk.stock >= 0 && tk.stock <= 9999, `${at}.stock: a whole number of places left`)
    if (tk.endsNote !== undefined) need(str(tk.endsNote, 40), `${at}.endsNote: up to 40 characters`)
    tk._u1 = zone ? localToUtc(tk.salesEnd, zone) : null
    need(tk._u1 !== null, `${at}.salesEnd: a venue time as YYYY-MM-DDTHH:MM`)
    if (tk._u1 === null) return
    if (Number.isFinite(lastUtc)) need(tk._u1 <= lastUtc, `${at}.salesEnd: sales end after the last session`)
    if (pu.clock !== null) {
      if (tk.ended) need(tk._u1 <= pu.clock, `${at}: marked "ended" but its sales end after the preview clock (${pv.clock})`)
      else need(tk._u1 > pu.clock, `${at}.salesEnd (${tk.salesEnd}) is not after the preview clock (${pv.clock}); the preview would show it on sale when it is not. Move the date, or mark it "ended": true`)
    }
  })
  if (pu.clock !== null) need(tickets.some((tk) => tk._u1 > pu.clock), 'tickets: nothing is on sale at the preview clock')

  // online
  if (c.online !== undefined) {
    need(Array.isArray(c.online.rooms) && c.online.rooms.length && c.online.rooms.every((id) => roomIx.has(id)), 'online.rooms: the rooms that are streamed')
    need(str(c.online.what, 30), 'online.what: 1 to 30 characters (the Online fact, as "Hall sessions, live")')
    if (c.online.after !== undefined) need(str(c.online.after, 40), 'online.after: up to 40 characters')
  }
  if (c.facts?.extra !== undefined) {
    const x = c.facts.extra
    need(str(x.label, 16) && str(x.value, 40) && (x.note === undefined || str(x.note, 60)), 'facts.extra: { label (up to 16), value (up to 40), note? (up to 60) }')
  }
  need(c.ppm === undefined || (typeof c.ppm === 'number' && c.ppm >= 1.6 && c.ppm <= 4), 'ppm: pixels per minute, 1.6 to 4')
  need(c.phoneSwitch === undefined || ['room', 'track'].includes(c.phoneSwitch), 'phoneSwitch: room or track')
  if (c.titles !== undefined) for (const [k, x] of Object.entries(c.titles)) need(TITLES[k] !== undefined && str(x, 28), `titles.${k}: up to 28 characters`)
  need(c.after === undefined || str(c.after, 120), 'after: up to 120 characters (shown when the programme has ended)')

  // plan
  const plan = v.plan
  if (plan !== undefined) {
    need(Array.isArray(plan.floors) && plan.floors.length >= 1 && plan.floors.length <= 3, 'venue.plan.floors: 1 to 3 floors')
    for (const [fi, f] of (plan.floors ?? []).entries()) {
      need(str(f.name, 30), `venue.plan.floors[${fi}].name: 1 to 30 characters`)
      need(f.w > 0 && f.h > 0 && f.w / f.h <= 5 && f.h / f.w <= 2, `venue.plan.floors[${fi}]: w and h, no wider than 5:1 or taller than 1:2`)
      for (const [ri, r] of (f.rooms ?? []).entries()) {
        need(str(r.label, 22), `venue.plan.floors[${fi}].rooms[${ri}].label: 1 to 22 characters`)
        need(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= f.w && r.y + r.h <= f.h, `venue.plan.floors[${fi}].rooms[${ri}] (${r.label}) is not inside its floor`)
        if (r.room !== undefined) need(roomIx.has(r.room), `venue.plan.floors[${fi}].rooms[${ri}].room: "${r.room}" is not a room`)
      }
      if (f.entrance !== undefined) need(str(f.entrance, 40), `venue.plan.floors[${fi}].entrance: up to 40 characters`)
    }
  }

  return { problems: P, warnings: W, span: { firstUtc, lastUtc }, preview: pu }
}
