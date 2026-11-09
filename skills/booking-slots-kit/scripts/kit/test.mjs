// Booking Slots: a property test of the availability engine (kit/engine.js)
// against a brute-force reference written separately, minute by minute.
//
//   node scripts/test.mjs [--runs 160] [--seed 7]
//
// Each run makes a random shop: a time zone (some with clock changes, some
// with half- and quarter-hour offsets), opening hours, 1 to 3 people with
// shifts and away days, 1 to 3 services with buffers, existing bookings,
// a closed day, a step, a notice period and a horizon, and a "now" a few
// days before a clock change, so many weeks cross one. The visitor is in
// another random zone.
//
// The reference does not use the engine or its time-zone arithmetic. It walks
// every real minute of the period once, writes down the shop's wall clock for
// it (from a differently built Intl formatter, read back from text), and then
// decides each start by looking at every minute of the appointment: inside
// the opening hours and the shift, on the same day, with the wall clock
// running straight, and no minute of it plus its buffer inside a booking plus
// that booking's buffer; then notice and horizon. Every start the engine
// offers must be in the reference's set and every start in the reference's
// set must be offered, for each person and for "anyone"; the same for the
// starts held back for notice. Every offered start's label in the visitor's
// zone must match the reference's reading of that instant.
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
await import(pathToFileURL(join(here, '..', '..', 'kit', 'engine.js')).href)
const E = globalThis.BookingEngine

const ZONES = ['Europe/London', 'America/New_York', 'Australia/Sydney', 'Asia/Ho_Chi_Minh', 'Asia/Singapore', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/St_Johns', 'Pacific/Chatham', 'Europe/Lisbon', 'America/Sao_Paulo', 'Pacific/Auckland']
// days with a clock change in 2026 (EU, US, AU/NZ south, and none)
const PIVOTS = ['2026-03-29', '2026-10-25', '2026-03-08', '2026-11-01', '2026-04-05', '2026-10-04', '2026-09-27', '2026-07-14']

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

function randomShop(r) {
  const pick = (a) => a[Math.floor(r() * a.length)]
  const int = (a, b) => a + Math.floor(r() * (b - a + 1))
  const five = (a, b) => 5 * int(Math.ceil(a / 5), Math.floor(b / 5))
  // a third of the shops keep long days, so the edges (notice, horizon, clock changes) are hit often
  const long = r() < 0.35
  const spans = (night) => {
    if (long) return [[night ? 0 : five(0, 480), five(1020, 1440)]]
    const n = r() < 0.15 ? 0 : r() < 0.7 ? 1 : 2
    const out = []
    let t = night && r() < 0.5 ? 0 : five(0, 600)
    for (let i = 0; i < n && t < 1400; i++) {
      const len = five(30, 600)
      const b = Math.min(1440, t + len)
      out.push([t, b])
      t = b + five(5, 180)
    }
    return out
  }
  const night = r() < 0.4
  const hours = Array.from({ length: 7 }, () => spans(night))
  const tz = pick(ZONES)
  // mostly a week that crosses this zone's own clock change, if it has one
  const own = PIVOTS.filter((d) => { const t = Date.parse(d + 'T12:00:00Z'); return E.offsetAt(tz, t - 864e5 * 2) !== E.offsetAt(tz, t + 864e5 * 2) })
  const pivot = own.length && r() < 0.75 ? pick(own) : pick(PIVOTS)
  const today = E.addDays(pivot, -int(0, 6))
  const nowWall = int(0, 1439)
  const people = Array.from({ length: int(1, 3) }, (_, i) => ({
    id: 'p' + i,
    shifts: Array.from({ length: 7 }, () => (r() < 0.3 ? hours[0] : spans(night))),
    away: r() < 0.3 ? [[E.addDays(today, int(0, 5)), E.addDays(today, int(5, 8))]] : [],
  }))
  const services = Array.from({ length: int(1, 3) }, (_, i) => ({
    id: 's' + i, minutes: five(10, 180), buffer: r() < 0.4 ? 0 : five(5, 30),
    who: people.filter(() => r() < 0.7).map((p) => p.id),
  }))
  for (const s of services) if (!s.who.length) s.who.push(people[0].id)
  const horizon = int(1, 9)
  const bookings = []
  for (const p of people) for (let k = 0; k < int(0, 14); k++) {
    const d = E.addDays(today, int(-1, horizon + 1))
    const m = five(0, 1435)
    bookings.push({ person: p.id, start: `${d}T${E.hm(m)}`, minutes: five(10, 150), buffer: r() < 0.5 ? 0 : five(5, 20) })
  }
  const closed = r() < 0.4 ? [{ from: E.addDays(today, int(0, horizon)), to: null, label: 'Closed day' }] : []
  for (const c of closed) c.to = r() < 0.5 ? c.from : E.addDays(c.from, 1)
  return {
    tz, visitor: pick(ZONES), today, nowWall, horizon,
    step: pick([5, 10, 15, 20, 30, 60]), notice: pick([0, 15, 60, 120, 240, 600, 1440]),
    hours, people, services, bookings, closed,
  }
}

/** The reference: every real minute of the period, read as the shop's wall clock. */
function reference(c) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: c.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const read = (ms) => { const s = fmt.format(new Date(ms)); const m = /(\d{4})-(\d{2})-(\d{2})\D+(\d{2}):(\d{2})/.exec(s); return { date: `${m[1]}-${m[2]}-${m[3]}`, min: (+m[4] % 24) * 60 + +m[5] } }
  const from = Date.parse(E.addDays(c.today, -3) + 'T00:00:00Z'), to = Date.parse(E.addDays(c.today, c.horizon + 4) + 'T00:00:00Z')
  const N = (to - from) / 60000
  const wall = new Array(N), first = new Map()
  for (let i = 0; i < N; i++) {
    const w = read(from + i * 60000)
    wall[i] = w
    const key = `${w.date} ${w.min}`
    if (!first.has(key)) first.set(key, i)
  }
  const idx = (ms) => (ms - from) / 60000
  const dow = (d) => new Date(d + 'T12:00:00Z').getUTCDay()
  const inside = (spans, m) => spans.some(([a, b]) => a <= m && m < b)
  const closedOn = (d) => c.closed.some((x) => d >= x.from && d <= x.to)
  // minute masks per person
  const work = {}, busy = {}
  for (const p of c.people) {
    work[p.id] = new Uint8Array(N); busy[p.id] = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
      const w = wall[i], d = dow(w.date)
      const away = p.away.some(([a, b]) => w.date >= a && w.date <= b)
      work[p.id][i] = !closedOn(w.date) && !away && inside(c.hours[d], w.min) && inside(p.shifts[d], w.min) ? 1 : 0
    }
  }
  for (const b of c.bookings) {
    const [d, t] = b.start.split('T'), [hh, mm] = t.split(':').map(Number)
    const i0 = first.get(`${d} ${hh * 60 + mm}`)
    if (i0 === undefined) continue
    for (let k = 0; k < b.minutes + (b.buffer || 0); k++) if (i0 + k < N) busy[b.person][i0 + k] = 1
  }
  // "now" is the first instant that shows today's nowWall (or the next minute that exists)
  let nowI
  for (let m = c.nowWall; nowI === undefined && m < 1440 + 120; m++) nowI = first.get(`${c.today} ${m}`)
  const now = from + nowI * 60000
  const out = { now, free: new Map(), soon: new Map(), label: (ms) => { const f = new Intl.DateTimeFormat('sv-SE', { timeZone: c.visitor, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); const m = /(\d{2}):(\d{2})/.exec(f); return `${String(+m[1] % 24).padStart(2, '0')}:${m[2]}` } }
  for (const svc of c.services) for (const who of [...svc.who, 'any']) {
    const free = new Set(), soon = new Set()
    for (let dd = -1; dd <= c.horizon + 1; dd++) {
      const D = E.addDays(c.today, dd)
      for (let m = 0; m < 1440; m += c.step) {
        if (!inside(c.hours[dow(D)], m)) continue
        const i0 = first.get(`${D} ${m}`)
        if (i0 === undefined) continue
        const ok = (pid) => {
          for (let k = 0; k < svc.minutes; k++) { const i = i0 + k; if (i >= N || !work[pid][i] || wall[i].date !== D || wall[i].min !== m + k) return false }
          for (let k = 0; k < svc.minutes + svc.buffer; k++) { const i = i0 + k; if (i < N && busy[pid][i]) return false }
          return true
        }
        const s = from + i0 * 60000
        const inHorizon = dd >= 0 && dd <= c.horizon
        const people = (who === 'any' ? svc.who : [who]).filter(ok)
        if (!people.length || !inHorizon || s < now) continue
        if (s >= now + c.notice * 60000) free.add(s)
        else soon.add(s)
      }
    }
    out.free.set(`${svc.id}/${who}`, free)
    out.soon.set(`${svc.id}/${who}`, soon)
  }
  return out
}

export async function test(argv = process.argv.slice(2)) {
  const a = {}
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]
  const runs = Number(a.runs ?? 160), seed = Number(a.seed ?? 7)
  const r = rng(seed)
  let starts = 0, offered = 0, soonN = 0, crossing = 0, labels = 0
  const fails = []
  for (let run = 0; run < runs && fails.length < 12; run++) {
    const c = randomShop(r)
    const ref = reference(c)
    const m = E.model({ tz: c.tz, hours: c.hours, closed: c.closed, step: c.step, notice: c.notice, horizon: c.horizon, people: c.people, services: c.services, bookings: c.bookings })
    const o0 = E.offsetAt(c.tz, ref.now), o1 = E.offsetAt(c.tz, ref.now + (c.horizon + 1) * 864e5)
    if (o0 !== o1) crossing++
    for (const svc of c.services) for (const who of [...svc.who, 'any']) {
      const got = new Set(), gotSoon = new Set()
      for (let dd = -1; dd <= c.horizon + 1; dd++) {
        const day = E.day(m, svc.id, who, E.addDays(c.today, dd), ref.now)
        for (const s of day.slots) {
          starts++
          if (s.status === 'free') {
            got.add(s.ms)
            if (who === 'any' && !s.free.length) fails.push(`run ${run}: an "any" start has nobody free`)
            const want = ref.label(s.ms), have = E.clock(c.visitor, s.ms)
            labels++
            if (want !== have) fails.push(`run ${run} (${c.tz} → ${c.visitor}): ${new Date(s.ms).toISOString()} labelled ${have}, reference ${want}`)
          }
          if (s.status === 'soon') gotSoon.add(s.ms)
        }
      }
      const key = `${svc.id}/${who}`, want = ref.free.get(key), wantSoon = ref.soon.get(key)
      offered += got.size; soonN += gotSoon.size
      const iso = (t) => new Date(t).toISOString().slice(0, 16)
      for (const t of got) if (!want.has(t)) fails.push(`run ${run} (${c.tz}, ${key}): engine offers ${iso(t)}Z, reference says no`)
      for (const t of want) if (!got.has(t)) fails.push(`run ${run} (${c.tz}, ${key}): reference offers ${iso(t)}Z, engine misses it`)
      for (const t of gotSoon) if (!wantSoon.has(t)) fails.push(`run ${run} (${c.tz}, ${key}): engine holds back ${iso(t)}Z for notice, reference does not`)
      for (const t of wantSoon) if (!gotSoon.has(t)) fails.push(`run ${run} (${c.tz}, ${key}): reference holds back ${iso(t)}Z for notice, engine does not`)
    }
  }
  return { runs, seed, starts, offered, soon: soonN, crossing, labels, fails }
}

export async function main() {
  const t0 = Date.now()
  const r = await test()
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  if (r.fails.length) {
    console.log(`✗ availability: ${r.fails.length} disagreements with the reference (seed ${r.seed}):`)
    for (const f of r.fails.slice(0, 12)) console.log(`    - ${f}`)
    process.exit(1)
  }
  console.log(`✓ availability: ${r.runs} random shops (${r.crossing} with a clock change inside the horizon), ${r.starts} starts judged, ${r.offered} offered and ${r.soon} held back for notice, all equal to the minute-by-minute reference; ${r.labels} visitor-zone labels match (${secs}s, seed ${r.seed})`)
}
