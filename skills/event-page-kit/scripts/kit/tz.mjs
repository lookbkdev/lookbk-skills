// Event Page Kit: time zones, with nothing but Intl. The build turns every
// session's venue clock time into an exact instant (UTC milliseconds) with
// toUtc(); the page and the calendar files then work from instants, so a
// visitor anywhere sees the right local time, daylight saving included.
//
// A clock time is "minutes after midnight" of the day it belongs to, and may
// pass 24:00: Low Light's last film starts at 23:00 and ends at 00:50, which
// is 1490 minutes after midnight of the Saturday.

const fmts = new Map()
function parts(zone) {
  if (!fmts.has(zone))
    fmts.set(zone, new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  return fmts.get(zone)
}

/** True when Intl knows the zone ("Europe/London", "America/New_York"). */
export function validZone(zone) {
  if (typeof zone !== 'string' || !zone) return false
  try { parts(zone); return true } catch { return false }
}

/** The zone's offset from UTC at that instant, in minutes (London in summer: 60). */
export function offsetAt(zone, ms) {
  const p = Object.fromEntries(parts(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60000)
}

/** The wall clock in `zone` at an instant: { date: 'YYYY-MM-DD', min: minutes after midnight }. */
export function wall(zone, ms) {
  const p = Object.fromEntries(parts(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
/** Adds whole days to 'YYYY-MM-DD'. */
export function addDays(date, n) {
  const [, y, m, d] = DATE.exec(date)
  return new Date(Date.UTC(+y, +m - 1, +d + n)).toISOString().slice(0, 10)
}

/**
 * The instant at which the clock in `zone` reads `min` minutes after midnight
 * of `date`. Returns null when that clock time does not exist there (the hour
 * skipped when the clocks go forward).
 */
export function toUtc(date, min, zone) {
  const m = DATE.exec(date)
  if (!m) return null
  const extra = Math.floor(min / 1440)
  const day = extra ? addDays(date, extra) : date
  const rest = min - extra * 1440
  const [, y, mo, d] = DATE.exec(day)
  const naive = Date.UTC(+y, +mo - 1, +d) + rest * 60000
  let t = naive - offsetAt(zone, naive) * 60000
  const o2 = offsetAt(zone, t)
  t = naive - o2 * 60000
  const back = wall(zone, t)
  if (back.date !== day || back.min !== rest) return null
  return t
}

/** "HH:MM" to minutes, or null. */
export function minutes(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hm ?? '')
  if (!m || +m[1] > 23 || +m[2] > 59) return null
  return +m[1] * 60 + +m[2]
}
/** Minutes to "HH:MM" on a 24-hour clock (1490 is "00:50"). */
export const hm = (x) => { x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0') }

/** "2027-03-11T18:00" in `zone` to an instant, or null. */
export function localToUtc(stamp, zone) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(stamp ?? '')
  if (!m) return null
  const min = minutes(m[2])
  return min === null ? null : toUtc(m[1], min, zone)
}

/** The city in a zone name: "America/New_York" is "New York". */
export const cityOf = (zone) => zone.split('/').pop().replace(/_/g, ' ')
