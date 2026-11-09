/* Booking Slots: the availability engine. No dependencies; runs in the page
 * and in Node (scripts/kit/test.mjs loads this same file).
 *
 * Every rule is worked out in the shop's own time zone and kept as real
 * instants (milliseconds), so the visitor's zone only changes the labels.
 *
 * A start is offered for a person when
 *   1. it falls on the step grid counted from the shop's local midnight, and
 *      it is the first time that wall-clock time happens that day (a time
 *      skipped by a clock change is not offered; a repeated one once);
 *   2. every minute of the appointment is inside the opening hours and that
 *      person's shift on that day, the day is not closed or one of their
 *      away days, and the clock runs straight through it (an appointment
 *      that would span a clock change is not offered);
 *   3. no minute of the appointment plus its buffer touches a booking plus
 *      that booking's buffer;
 *   4. it starts at least `notice` minutes after now;
 *   5. its day is between today and today + `horizon` days, shop calendar.
 * A start that passes 1, 2, 3 and 5 but not 4 is "soon"; one that passes 2
 * but not 3 is "taken"; one before now is "past"; one outside the person's
 * working time is "off".
 */
;(function (root) {
  'use strict'
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  var MIN = 60000
  var fmtCache = {}

  function formatter(tz) {
    if (!fmtCache[tz])
      fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
      })
    return fmtCache[tz]
  }
  /** The wall clock in `tz` at instant `ms`: { date: 'YYYY-MM-DD', min, dow }. */
  function wallOf(tz, ms) {
    var p = {}
    var parts = formatter(tz).formatToParts(new Date(ms))
    for (var i = 0; i < parts.length; i++) p[parts[i].type] = parts[i].value
    var h = +p.hour === 24 ? 0 : +p.hour
    return { date: p.year + '-' + p.month + '-' + p.day, min: h * 60 + +p.minute, dow: DAYS.indexOf(p.weekday.toLowerCase().slice(0, 3)) }
  }
  /** Minutes `tz` is ahead of UTC at instant `ms`. */
  function offsetAt(tz, ms) {
    var w = wallOf(tz, ms)
    var asUtc = Date.UTC(+w.date.slice(0, 4), +w.date.slice(5, 7) - 1, +w.date.slice(8, 10), 0, w.min)
    return Math.round((asUtc - Math.floor(ms / MIN) * MIN) / MIN)
  }
  /** The first instant whose wall clock in `tz` reads `date` `min`, or null if the clock skips it. */
  function wallToInstant(tz, date, min) {
    var naive = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 0, min)
    var seen = {}, best = null
    var probes = [naive - 26 * 60 * MIN, naive, naive + 26 * 60 * MIN]
    for (var i = 0; i < probes.length; i++) {
      var o = offsetAt(tz, probes[i])
      if (seen[o]) continue
      seen[o] = 1
      var t = naive - o * MIN
      var w = wallOf(tz, t)
      if (w.date === date && w.min === min && (best === null || t < best)) best = t
    }
    return best
  }
  function addDays(date, n) {
    var t = new Date(date + 'T12:00:00Z')
    t.setUTCDate(t.getUTCDate() + n)
    return t.toISOString().slice(0, 10)
  }
  function dowOf(date) { return new Date(date + 'T12:00:00Z').getUTCDay() }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5) }
  function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }

  /** Intersects two sorted lists of [from, to) minute spans. */
  function intersect(a, b) {
    var out = []
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) {
      var x = Math.max(a[i][0], b[j][0]), y = Math.min(a[i][1], b[j][1])
      if (y > x) out.push([x, y])
    }
    return out.sort(function (p, q) { return p[0] - q[0] })
  }
  function inRanges(date, ranges) {
    for (var i = 0; i < (ranges || []).length; i++) if (date >= ranges[i][0] && date <= ranges[i][1]) return true
    return false
  }

  /**
   * Prepares a model from the page data (hours already parsed to minute
   * spans per weekday, Sunday first):
   * { tz, hours: [[[from,to],...] x7], closed: [{from, to, label}], step, notice, horizon,
   *   people: [{ id, shifts: [x7], away: [[from,to]] }], services: [{ id, minutes, buffer, who }],
   *   bookings: [{ person, start: 'YYYY-MM-DDTHH:MM' (shop wall clock) | ISO with offset, minutes, buffer }] }
   */
  function model(d) {
    var m = { tz: d.tz, hours: d.hours, closed: d.closed || [], step: d.step, notice: d.notice, horizon: d.horizon, people: d.people, services: d.services, busy: {} }
    for (var i = 0; i < d.people.length; i++) m.busy[d.people[i].id] = []
    var bs = d.bookings || []
    for (var k = 0; k < bs.length; k++) {
      var b = bs[k], s = bookingStart(d.tz, b.start)
      if (s === null || !m.busy[b.person]) continue
      m.busy[b.person].push([s, s + (b.minutes + (b.buffer || 0)) * MIN])
    }
    for (var id in m.busy) m.busy[id].sort(function (p, q) { return p[0] - q[0] })
    return m
  }
  function bookingStart(tz, s) {
    var x = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(s))
    if (x) return wallToInstant(tz, x[1], +x[2] * 60 + +x[3])
    var t = Date.parse(s)
    return isNaN(t) ? null : t
  }
  function closedLabel(m, date) {
    for (var i = 0; i < m.closed.length; i++) if (date >= m.closed[i].from && date <= m.closed[i].to) return m.closed[i].label
    return null
  }
  function service(m, id) { for (var i = 0; i < m.services.length; i++) if (m.services[i].id === id) return m.services[i]; return null }
  function person(m, id) { for (var i = 0; i < m.people.length; i++) if (m.people[i].id === id) return m.people[i]; return null }
  /** The minute spans a person works on `date`: shift ∩ opening hours, or [] when closed or away. */
  function workSpans(m, p, date) {
    if (closedLabel(m, date) || inRanges(date, p.away)) return []
    var dw = dowOf(date)
    return intersect(m.hours[dw] || [], p.shifts[dw] || [])
  }

  /** One start for one person: 'free' | 'soon' | 'taken' | 'past' | 'off'. */
  function status(m, p, svc, date, min, s, now, today) {
    if (s === null) return 'off'
    var spans = workSpans(m, p, date)
    var endW = wallOf(m.tz, s + (svc.minutes - 1) * MIN)
    var fits = false
    if (endW.date === date && endW.min - min === svc.minutes - 1)
      for (var i = 0; i < spans.length; i++) if (spans[i][0] <= min && endW.min < spans[i][1]) { fits = true; break }
    if (!fits) return 'off'
    if (s < now) return 'past'
    var e = s + (svc.minutes + (svc.buffer || 0)) * MIN, busy = m.busy[p.id] || []
    for (var k = 0; k < busy.length; k++) if (s < busy[k][1] && e > busy[k][0]) return 'taken'
    var dd = daysBetween(today, date)
    if (dd < 0 || dd > m.horizon) return 'off'
    if (s < now + m.notice * MIN) return 'soon'
    return 'free'
  }

  var RANK = { free: 4, soon: 3, taken: 2, past: 1, off: 0 }
  /**
   * The starts of one day for a service and a person ('any' for everyone who
   * does it): { date, closed (label) | null, notIn, beyond, open: [from,to] | null,
   *   slots: [{ min, ms, status, free: [person ids] }] } with only the starts
   * inside opening hours.
   */
  function day(m, svcId, who, date, now) {
    var svc = service(m, svcId)
    var today = wallOf(m.tz, now).date
    var dw = dowOf(date)
    var hours = m.hours[dw] || []
    var out = { date: date, closed: closedLabel(m, date), notIn: false, beyond: daysBetween(today, date) > m.horizon, past: date < today, open: hours.length ? [hours[0][0], hours[hours.length - 1][1]] : null, slots: [] }
    if (!hours.length && !out.closed) out.closed = 'Closed'
    if (out.closed) return out
    var ppl = []
    for (var i = 0; i < m.people.length; i++) {
      var p = m.people[i]
      if (svc.who.indexOf(p.id) >= 0 && (who === 'any' || who === p.id)) ppl.push(p)
    }
    var working = false
    for (var j = 0; j < ppl.length; j++) if (workSpans(m, ppl[j], date).length) working = true
    out.notIn = !working
    for (var mm = 0; mm < 1440; mm += m.step) {
      var inside = false
      for (var h = 0; h < hours.length; h++) if (hours[h][0] <= mm && mm < hours[h][1]) inside = true
      if (!inside) continue
      var s = wallToInstant(m.tz, date, mm)
      if (s === null) continue
      var best = 'off', free = []
      for (var q = 0; q < ppl.length; q++) {
        var st = status(m, ppl[q], svc, date, mm, s, now, today)
        if (st === 'free') free.push(ppl[q].id)
        if (RANK[st] > RANK[best]) best = st
      }
      out.slots.push({ min: mm, ms: s, status: best, free: free })
    }
    return out
  }
  /** The first offered start from `from` on, within `days` days: { date, min, ms, person } or null. */
  function firstFree(m, svcId, who, from, now, days) {
    for (var i = 0; i <= (days == null ? m.horizon : days); i++) {
      var d = addDays(from, i)
      var r = day(m, svcId, who, d, now)
      if (r.beyond) return null
      for (var k = 0; k < r.slots.length; k++) if (r.slots[k].status === 'free') return { date: d, min: r.slots[k].min, ms: r.slots[k].ms, person: r.slots[k].free[0] }
    }
    return null
  }
  /** "14:30" in zone `tz` for instant `ms`. */
  function clock(tz, ms) { return hm(wallOf(tz, ms).min) }

  var api = { DAYS: DAYS, wallOf: wallOf, offsetAt: offsetAt, wallToInstant: wallToInstant, addDays: addDays, dowOf: dowOf, daysBetween: daysBetween, hm: hm, model: model, day: day, firstFree: firstFree, status: status, workSpans: workSpans, service: service, person: person, clock: clock }
  root.BookingEngine = api
})(typeof globalThis !== 'undefined' ? globalThis : this)
