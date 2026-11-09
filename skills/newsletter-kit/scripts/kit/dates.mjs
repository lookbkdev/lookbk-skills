// Newsletter Kit: dates and time zones, shared by the build and the checks.
// A send is a local date and time in the sender's time zone ("Thursday 07:30
// in Europe/Madrid"); this turns it into an exact instant, so the page can
// show it in the reader's own zone, summer time included.
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY = 864e5

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s)
export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
export function isZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}
/** 0 = Sunday, as Date#getUTCDay */
export const weekdayOf = (date) => new Date(date + 'T00:00:00Z').getUTCDay()
export const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
export const dayIndex = (key) => (DAYS.indexOf(key) + 1) % 7

/** The wall clock in `tz` at `ms`, as numbers. */
export function wall(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  )
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WD.indexOf(p.weekday) }
}
/** Minutes `tz` is ahead of UTC at `ms`. */
export function offset(ms, tz) {
  const w = wall(ms, tz)
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.min) - Math.floor(ms / 6e4) * 6e4) / 6e4)
}
/** The instant of `date` `time` on the wall clock in `tz`. */
export function zoned(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  let t = guess - offset(guess, tz) * 6e4
  t = guess - offset(t, tz) * 6e4
  return t
}
export const zoneLabel = (tz) => (/^(Etc\/)?(UTC|GMT|Zulu|Universal)$/i.test(tz) ? 'UTC' : `${tz.split('/').pop().replace(/_/g, ' ')} time`)

/** "Thu 5 Nov", "5 Nov", "5 November 2026", "07:30" in `tz`. */
export function fmt(ms, tz, kind) {
  const w = wall(ms, tz)
  const hm = `${String(w.h).padStart(2, '0')}:${String(w.min).padStart(2, '0')}`
  switch (kind) {
    case 'day': return `${WD[w.wd]} ${w.d} ${MONTH[w.m - 1]}`
    case 'short': return `${w.d} ${MONTH[w.m - 1]}`
    case 'long': return `${w.d} ${MONTH_LONG[w.m - 1]} ${w.y}`
    case 'time': return hm
    case 'daytime': return `${WD[w.wd]} ${w.d} ${MONTH[w.m - 1]}, ${hm}`
    case 'wdtime': return `${WD[w.wd]} ${hm}`
    default: throw new Error(`unknown format ${kind}`)
  }
}
/** A plain calendar date (no zone): "1 Nov 2026". */
export function plainDate(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH[m - 1]} ${y}`
}

/**
 * Every scheduled slot from the first issue on, numbered: skipped slots get
 * no number. Returns slots up to issue `upTo` plus `ahead` slots after it.
 */
export function slots(s, upTo, ahead = 0) {
  const skip = new Set(s.skipped ?? [])
  const out = []
  let no = 0
  let after = 0
  for (let date = s.first, i = 0; i < 5000; i++, date = addDays(date, 7 * s.every)) {
    const skipped = skip.has(date)
    if (!skipped) no++
    const at = zoned(date, s.time, s.tz)
    if (no > upTo || (no === upTo && skipped)) after++
    out.push({ date, at, no: skipped ? null : no, skipped })
    if (after > ahead) { out.pop(); break }
  }
  return out
}

/** Weekday-and-cadence words: "Every other Thursday". */
export function cadenceWords(s) {
  const day = WEEKDAY[dayIndex(s.weekday)]
  return s.every === 1 ? `Every ${day}` : s.every === 2 ? `Every other ${day}` : `Every fourth ${day}`
}
