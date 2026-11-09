// Event Page Kit: calendar files (RFC 5545). write() makes one VCALENDAR from
// sessions that already carry their exact instants; times are written in UTC
// (the trailing Z), so every calendar app shows them in its own zone and no
// VTIMEZONE block is needed. parse() reads a file back strictly, so the check
// can prove what the build wrote: CRLF line ends, lines folded at 75 octets,
// balanced BEGIN/END, the required properties, and real instants.

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Folds one content line at 75 octets (continuation lines start with a space). */
function fold(line) {
  const out = []
  let cur = '', size = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch)
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0 }
    cur += ch; size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

/**
 * events: [{ uid, start, end (UTC ms), summary, location, description, url }]
 * Returns the file's text.
 */
export function write(events, { name, prodid, now = Date.now() }) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodid}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`]
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${esc(e.summary)}`)
    if (e.location) L.push(`LOCATION:${esc(e.location)}`)
    if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.url) L.push(`URL:${e.url}`)
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n') + '\r\n'
}

const UTC = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
/** "20270311T101500Z" to ms, or null. */
export function instant(v) {
  const m = UTC.exec(v ?? '')
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null
}

/**
 * Reads a calendar file strictly. Returns { problems: [...], events: [{ uid,
 * start, end, summary, ... }] }. A DTSTART with a TZID is accepted only when
 * the file defines that VTIMEZONE; this kit writes UTC.
 */
export function parse(text) {
  const problems = []
  if (!text.endsWith('\r\n')) problems.push('the file does not end with CRLF')
  const raw = text.split('\r\n')
  if (raw.at(-1) === '') raw.pop()
  raw.forEach((l, i) => {
    if (l.includes('\n') || l.includes('\r')) problems.push(`line ${i + 1} has a bare LF or CR`)
    if (Buffer.byteLength(l) > 75) problems.push(`line ${i + 1} is ${Buffer.byteLength(l)} octets (75 at most)`)
  })
  const lines = []
  for (const l of raw) {
    if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1)
    else lines.push(l)
  }
  const stack = []
  const events = []
  const zones = new Set()
  let cal = null, ev = null
  for (const [i, l] of lines.entries()) {
    const c = l.indexOf(':')
    if (c < 1) { problems.push(`line ${i + 1} is not NAME:VALUE`); continue }
    const head = l.slice(0, c), value = l.slice(c + 1)
    const [name, ...params] = head.split(';')
    if (name === 'BEGIN') {
      stack.push(value)
      if (value === 'VCALENDAR') cal = {}
      if (value === 'VEVENT') ev = { params: {} }
      continue
    }
    if (name === 'END') {
      if (stack.pop() !== value) problems.push(`END:${value} does not close what was opened`)
      if (value === 'VEVENT' && ev) { events.push(ev); ev = null }
      continue
    }
    const target = ev ?? (stack.at(-1) === 'VTIMEZONE' ? null : cal)
    if (stack.at(-1) === 'VTIMEZONE' && name === 'TZID') zones.add(value)
    if (target) { target[name] = value; if (ev) ev.params[name] = params }
  }
  if (stack.length) problems.push(`${stack.join(', ')} never closed`)
  if (!cal) problems.push('no VCALENDAR')
  else {
    if (cal.VERSION !== '2.0') problems.push('VERSION is not 2.0')
    if (!cal.PRODID) problems.push('no PRODID')
  }
  const uids = new Set()
  const out = []
  for (const e of events) {
    const id = e.UID ?? '(no UID)'
    for (const k of ['UID', 'DTSTAMP', 'DTSTART', 'SUMMARY']) if (!e[k]) problems.push(`${id}: no ${k}`)
    if (!e.DTEND && !e.DURATION) problems.push(`${id}: no DTEND or DURATION`)
    if (uids.has(e.UID)) problems.push(`${id}: UID used twice`)
    uids.add(e.UID)
    const when = (k) => {
      const tz = (e.params[k] ?? []).find((p) => p.startsWith('TZID='))
      if (tz) { if (!zones.has(tz.slice(5))) problems.push(`${id}: ${k} names ${tz} with no VTIMEZONE`); return null }
      const t = instant(e[k])
      if (t === null) problems.push(`${id}: ${k} "${e[k]}" is not a UTC date-time`)
      return t
    }
    const start = when('DTSTART'), end = e.DTEND ? when('DTEND') : null
    if (instant(e.DTSTAMP) === null) problems.push(`${id}: DTSTAMP is not a UTC date-time`)
    if (start !== null && end !== null && end <= start) problems.push(`${id}: ends before it starts`)
    out.push({ uid: e.UID, start, end, summary: e.SUMMARY, location: e.LOCATION, url: e.URL })
  }
  return { problems, events: out }
}
