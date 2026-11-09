// How It Works kit: every field of process.json, its limits, the colour
// rules and the arithmetic. validate() returns every problem at once, so one
// build lists all of them. derive() works out what the page shows from the
// config (labels, the buyer's hours, the payment total) so nothing that can
// be computed is ever typed.

export const DISPLAYS = {
  newsreader: {
    family: "'Newsreader', Georgia, serif", weight: 500, track: '-.018em', wdth: 'normal', em: 'italic',
    text: "'Hanken Grotesk', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace",
    google: ['family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500', 'family=Hanken+Grotesk:wght@400;500;600', 'family=JetBrains+Mono:wght@400;500'],
  },
  bricolage: {
    family: "'Bricolage Grotesque', system-ui, sans-serif", weight: 700, track: '-.03em', wdth: '"wdth" 90', em: 'normal',
    text: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, monospace",
    google: ['family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800', 'family=Geist:wght@400;500;600', 'family=Geist+Mono:wght@400;500'],
  },
  archivo: {
    family: "'Archivo', system-ui, sans-serif", weight: 700, track: '-.025em', wdth: '"wdth" 100', em: 'italic',
    text: "'Archivo', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace",
    google: ['family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900', 'family=JetBrains+Mono:wght@400;500'],
  },
}
/** loaded only when a slide asks for a serif mark */
export const SERIF_GOOGLE = 'family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500'
export const KINDS = ['plan', 'sheet', 'log', 'certificate', 'invite', 'slides', 'screen', 'spread', 'image']

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
/** The colour between `ink` and `bg`, closest to `bg`, that still holds `need`:1 against `bg`. */
export function soften(ink, bg, need) {
  for (let t = 0.9; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- time and money, as the page writes them ---------- */
/** 0-based day index to the week it falls in, 1-based */
export const weekOf = (day, week) => Math.floor(day / week) + 1
/** "Day 1", "Days 58–60", "Week 12", "Weeks 3–8" */
export function when(st, week) {
  if (st.length < week) {
    const a = st.start + 1, b = st.start + st.length
    return a === b ? `Day ${a}` : `Days ${a}–${b}`
  }
  const w1 = weekOf(st.start, week), w2 = weekOf(st.start + st.length - 1, week)
  return w1 === w2 ? `Week ${w1}` : `Weeks ${w1}–${w2}`
}
/** "W3–8", "Day 1", "D58–60" for the programme */
export function whenShort(st, week) {
  if (st.length < week) return st.length === 1 ? `Day ${st.start + 1}` : `D${st.start + 1}–${st.start + st.length}`
  const w1 = weekOf(st.start, week), w2 = weekOf(st.start + st.length - 1, week)
  return w1 === w2 ? `W${w1}` : `W${w1}–${w2}`
}
/** "1 day", "9 days", "2 weeks", "12 days" (a part week is said in days) */
export function howLong(st, week) {
  if (st.length === 1) return '1 day'
  if (st.length % week === 0) { const w = st.length / week; return `${w} week${w > 1 ? 's' : ''}` }
  return `${st.length} days`
}
/** 30 -> "30 min", 90 -> "90 min", 120 -> "2 h", 150 -> "2 h 30" */
export function minutes(m) {
  if (m < 120 && m % 60 !== 0) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}
/**
 * The buyer's time, said honestly. The rounding rule: under an hour it is
 * said in minutes; otherwise to the nearest whole hour, halves rounding up,
 * with "about" in front unless the total is a whole number of hours.
 */
export function yourTime(totalMinutes) {
  if (totalMinutes < 60) return { hours: 0, value: String(totalMinutes), unit: 'minutes', about: false, exact: true }
  const hours = Math.floor(totalMinutes / 60 + 0.5)
  const exact = totalMinutes % 60 === 0
  return { hours, value: String(hours), unit: hours === 1 ? 'hour' : 'hours', about: !exact, exact }
}
export const money = (n, cur) => `${n < 0 ? '−' : ''}${cur}${Math.abs(n).toLocaleString('en-GB')}`
export function payValue(p, cur) {
  if (p.free) return 'Free'
  if (p.percent !== undefined) return `${p.percent}%`
  return money(p.amount, cur) + (p.credited ? ', credited' : '')
}

/* ---------- validation ---------- */
export function validate(c) {
  const p = []
  const str = (v, path, max, { req = true } = {}) => {
    if (v === undefined || v === null) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string') { p.push(`${path} must be text`); return false }
    if (!v.trim()) { p.push(`${path} is empty`); return false }
    if (v.length > max) p.push(`${path} is ${v.length} characters; keep it to ${max} (shorten the words rather than the type)`)
    if (/!/.test(v)) p.push(`${path} has an exclamation mark; a schedule states things plainly`)
    if (/—/.test(v)) p.push(`${path} has an em dash; use a full stop, a comma or " · "`)
    return true
  }
  const color = (v, path, req = true) => {
    if (v === undefined) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string' || !HEX.test(v)) { p.push(`${path} must be a colour like #1d5a50`); return false }
    return true
  }
  const int = (v, path, min, max) => {
    if (!Number.isInteger(v)) { p.push(`${path} must be a whole number`); return false }
    if (v < min || v > max) { p.push(`${path} is ${v}; it must be from ${min} to ${max}`); return false }
    return true
  }
  const url = (v, path) => {
    if (!str(v, path, 300)) return
    if (!/^(https:\/\/[a-z0-9-]+\.example(\/|$)|\.{0,2}\/|[a-z0-9_-]+\/)/i.test(v) && !/^https:\/\//.test(v)) p.push(`${path} must be https://… or a path next to the page`)
  }

  if (!c || typeof c !== 'object') return ['process.json is not an object']
  str(c.brand, 'brand', 40)
  str(c.lang, 'lang', 12, { req: false })
  str(c.eyebrow, 'eyebrow', 56)
  if (str(c.headline, 'headline', 80)) {
    const n = (c.headline.match(/_/g) ?? []).length
    if (n !== 0 && n !== 2) p.push('headline: mark one turn with a pair of underscores, like "Twelve weeks to _the first dinner._"')
  }
  str(c.lede, 'lede', 200, { req: false })
  str(c.studio, 'studio', 32)

  // theme
  const t = c.theme ?? {}
  if (!c.theme) p.push('theme is missing')
  const ok = {}
  for (const k of ['page', 'ink', 'accent', 'onAccent', 'you', 'stage']) ok[k] = color(t[k], `theme.${k}`)
  for (const k of ['paper', 'paperInk', 'paperDark']) ok[k] = color(t[k], `theme.${k}`, false)
  if (t.display !== undefined && !DISPLAYS[t.display]) p.push(`theme.display must be one of ${Object.keys(DISPLAYS).join(', ')}`)
  const need = (a, b, min, what) => {
    if (!ok[a] || !ok[b]) return
    const r = contrast(t[a], t[b])
    if (r < min) p.push(`${what}: theme.${a} on theme.${b} is ${r.toFixed(2)}:1, needs ${min}:1`)
  }
  need('ink', 'page', 7, 'text')
  need('accent', 'page', 4.5, 'the accent is also text (the current step\'s weeks, the turn)')
  need('onAccent', 'accent', 4.5, 'the cursor flag')
  need('you', 'page', 4.5, 'the buyer\'s colour labels "You give" and the hours at 12 px')
  if (ok.stage && ok.page && contrast(t.stage, t.page) < 1.06) p.push('theme.stage is too close to theme.page; the desk must read as a surface')
  if (ok.accent && ok.you && Math.hypot(...rgbOf(t.accent).map((v, i) => v - rgbOf(t.you)[i])) < 80) p.push('theme.accent and theme.you look alike; they mean different things (now, and the buyer)')

  // calendar
  const cal = c.calendar ?? {}
  if (!c.calendar) p.push('calendar is missing: { "total": days, "week": working days per week }')
  const calOk = int(cal.total, 'calendar.total', 1, 520) & int(cal.week ?? 5, 'calendar.week', 5, 7)
  const week = cal.week ?? 5
  if (calOk && cal.total % week) p.push(`calendar.total (${cal.total} days) must be whole weeks of ${week} days`)
  str(cal.note, 'calendar.note', 64, { req: false })

  // price
  const pr = c.price
  if (pr !== undefined) {
    if (!['from', 'fixed'].includes(pr.kind)) p.push('price.kind must be "from" or "fixed"')
    str(pr.label, 'price.label', 24)
    str(pr.currency, 'price.currency', 3)
    if (typeof pr.value !== 'number' || pr.value <= 0) p.push('price.value must be a number above 0')
  }
  const cur = pr?.currency ?? '£'

  // steps
  const steps = c.steps
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 7) { p.push('steps: 3 to 7 steps'); return p }
  let minutesSum = 0
  const percents = [], amounts = []
  steps.forEach((s, i) => {
    const at = `steps[${i}]`
    str(s.title, `${at}.title`, 32)
    str(s.who, `${at}.who`, 48)
    str(s.summary, `${at}.summary`, 140)
    str(s.give, `${at}.give`, 90)
    if (!s.get) p.push(`${at}.get is missing: every step ends with something the buyer is handed`)
    else str(s.get, `${at}.get`, 90)
    if (calOk) {
      int(s.start, `${at}.start`, 0, cal.total - 1)
      int(s.length, `${at}.length`, 1, cal.total)
      if (Number.isInteger(s.start) && Number.isInteger(s.length) && s.start + s.length > cal.total)
        p.push(`${at} runs to day ${s.start + s.length}, past the end of the calendar (day ${cal.total})`)
    }
    if (s.parallel !== undefined && typeof s.parallel !== 'boolean') p.push(`${at}.parallel must be true or false`)
    if (s.pay !== undefined) {
      const y = s.pay
      str(y.label, `${at}.pay.label`, 16)
      const kinds = ['percent', 'amount', 'free'].filter((k) => y[k] !== undefined)
      if (kinds.length !== 1) p.push(`${at}.pay needs exactly one of percent, amount or free`)
      else if (kinds[0] === 'percent') { if (typeof y.percent !== 'number' || y.percent <= 0 || y.percent > 100) p.push(`${at}.pay.percent must be above 0 and at most 100`); else percents.push(y.percent) }
      else if (kinds[0] === 'amount') { if (typeof y.amount !== 'number' || y.amount <= 0) p.push(`${at}.pay.amount must be above 0`); else if (!y.credited) amounts.push(y.amount) }
      else if (y.free !== true) p.push(`${at}.pay.free must be true`)
      if (y.credited !== undefined && y.amount === undefined) p.push(`${at}.pay.credited only goes with an amount`)
    }
    if (s.you !== undefined) {
      if (!Array.isArray(s.you) || s.you.length > 4) p.push(`${at}.you: up to 4 touchpoints`)
      else s.you.forEach((y, j) => {
        if (int(y.day, `${at}.you[${j}].day`, 0, (cal.total ?? 1) - 1) && Number.isInteger(s.start) && Number.isInteger(s.length) && (y.day < s.start || y.day >= s.start + s.length))
          p.push(`${at}.you[${j}].day is day ${y.day + 1}, outside its step (days ${s.start + 1} to ${s.start + s.length})`)
        if (int(y.minutes, `${at}.you[${j}].minutes`, 5, 600)) minutesSum += y.minutes
      })
    }
    artifact(s.artifact, `${at}.artifact`, s, str, color, int, url, p)
  })

  // the schedule: the steps not marked parallel tile the calendar exactly
  const placed = steps.map((s, i) => ({ s, i })).filter(({ s }) => Number.isInteger(s.start) && Number.isInteger(s.length))
  if (calOk && placed.length === steps.length) {
    for (let i = 1; i < steps.length; i++)
      if (steps[i].start < steps[i - 1].start) p.push(`steps[${i}] starts before steps[${i - 1}]; list the steps in the order they start`)
    const main = placed.filter(({ s }) => !s.parallel)
    if (!main.length) p.push('every step is parallel; at least one must carry the schedule')
    let end = 0
    for (const { s, i } of main) {
      if (s.start > end) p.push(`a ${s.start - end}-day gap before steps[${i}] (day ${end + 1} to day ${s.start}): close it, or add the waiting as a step; the schedule must add up to calendar.total`)
      if (s.start < end) p.push(`steps[${i}] starts on day ${s.start + 1} but the step before ends on day ${end}: they overlap by ${end - s.start} days. Mark it "parallel": true if it runs alongside`)
      end = Math.max(end, s.start + s.length)
    }
    const sum = main.reduce((a, { s }) => a + s.length, 0)
    if (main.length && sum !== cal.total) p.push(`the steps not marked parallel add up to ${sum} days, but calendar.total is ${cal.total}`)
    for (const { s, i } of placed.filter(({ s }) => s.parallel)) {
      const host = main.find(({ s: m }) => s.start >= m.start && s.start < m.start + m.length)
      if (!host) p.push(`steps[${i}] is parallel but starts outside the main schedule`)
    }
  }

  // the buyer's hours: computed; a stated figure must agree with the rounding rule
  if (c.yourTime !== undefined) {
    const yt = yourTime(minutesSum)
    if (!Number.isInteger(c.yourTime.hours)) p.push('yourTime.hours must be a whole number of hours')
    else if (c.yourTime.hours !== yt.hours) p.push(`yourTime.hours says ${c.yourTime.hours}, but steps[].you add up to ${minutes(minutesSum)}, which is ${yt.hours} by the rule (nearest whole hour, halves up)`)
  }
  if (!minutesSum) p.push('no step has "you" touchpoints; say when the buyer is needed, even if it is one call')

  // money
  if (percents.length && amounts.length) p.push('payments mix percentages and amounts; use one (amounts marked credited do not count)')
  if (percents.length) {
    const sum = percents.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 100) > 1e-9) p.push(`the percentage payments add up to ${sum}%, not 100%`)
  }
  if (amounts.length && pr?.kind === 'fixed') {
    const sum = amounts.reduce((a, b) => a + b, 0)
    if (sum !== pr.value) p.push(`the step payments add up to ${money(sum, cur)}, but price.value (fixed) is ${money(pr.value, cur)}`)
  }
  if (amounts.length && pr && pr.kind !== 'fixed') p.push('step amounts need price.kind "fixed", so they can be checked against the total')

  if (c.preview !== undefined && c.preview.at !== undefined && !Number.isInteger(c.preview.at)) p.push('preview.at must be a step number')
  return p
}

function artifact(a, at, s, str, color, int, url, p) {
  if (!a || typeof a !== 'object') return p.push(`${at} is missing: draw what the buyer is handed`)
  if (!KINDS.includes(a.kind)) return p.push(`${at}.kind must be one of ${KINDS.join(', ')}`)
  str(a.alt, `${at}.alt`, 160)
  const list = (v, path, min, max) => { if (!Array.isArray(v) || v.length < min || v.length > max) { p.push(`${path}: ${min} to ${max} items`); return false } return true }
  const pairs = (v, path, min, max, a1, a2) => { if (list(v, path, min, max)) v.forEach((x, j) => { if (!Array.isArray(x) || x.length !== 2) p.push(`${path}[${j}] must be [label, value]`); else { str(x[0], `${path}[${j}][0]`, a1); str(String(x[1]), `${path}[${j}][1]`, a2) } }) }
  switch (a.kind) {
    case 'plan':
      str(a.meta, `${at}.meta`, 48)
      if (!Array.isArray(a.size) || a.size.length !== 2 || !a.size.every((n) => Number.isInteger(n) && n >= 500 && n <= 30000)) p.push(`${at}.size must be [width, depth] in mm, 500 to 30000`)
      else {
        const [W, D] = a.size
        const inside = (x, y, w, h) => x >= 0 && y >= 0 && x + w <= W && y + h <= D
        if (a.window !== undefined && !(Array.isArray(a.window) && a.window[0] >= 0 && a.window[1] <= W && a.window[0] < a.window[1])) p.push(`${at}.window must be [from, to] in mm along the top wall`)
        if (a.door !== undefined && !(a.door.at >= 0 && a.door.width > 0 && a.door.at + a.door.width <= W)) p.push(`${at}.door must be { at, width } in mm along the bottom wall`)
        if (list(a.units ?? [], `${at}.units`, 0, 12)) (a.units ?? []).forEach((u, j) => { if (!Array.isArray(u) || u.length !== 4 || !inside(...u)) p.push(`${at}.units[${j}] must be [x, y, w, h] in mm inside the room`) })
        ;(a.marks ?? []).forEach((m, j) => { if (!(m.x >= 0 && m.x <= W && m.y >= 0 && m.y <= D)) p.push(`${at}.marks[${j}] must sit inside the room`); str(m.label, `${at}.marks[${j}].label`, 10) })
      }
      pairs(a.block, `${at}.block`, 1, 3, 10, 22)
      break
    case 'sheet':
      str(a.meta, `${at}.meta`, 40); str(a.title, `${at}.title`, 44)
      if (a.style !== undefined && !['table', 'pairs'].includes(a.style)) p.push(`${at}.style must be table or pairs`)
      pairs(a.rows, `${at}.rows`, 2, 8, 40, 44)
      if (a.total !== undefined) { if (!Array.isArray(a.total) || a.total.length !== 2) p.push(`${at}.total must be [label, value]`); else { str(a.total[0], `${at}.total[0]`, 24); str(String(a.total[1]), `${at}.total[1]`, 14) } }
      str(a.stamp, `${at}.stamp`, 16, { req: false })
      if (a.sum !== undefined) {
        // a quote whose lines must add up to its total
        const n = (v) => Number(String(v).replace(/[^0-9.−-]/g, '').replace('−', '-'))
        const sum = a.rows.reduce((x, r) => x + n(r[1]), 0)
        if (Math.abs(sum - n(a.total?.[1])) > 0.5) p.push(`${at}: the rows add up to ${sum}, not the total ${a.total?.[1]}`)
      }
      break
    case 'log':
      str(a.meta, `${at}.meta`, 40); str(a.title, `${at}.title`, 32)
      if (list(a.entries, `${at}.entries`, 2, 7)) a.entries.forEach((e, j) => {
        if (int(e.day, `${at}.entries[${j}].day`, 0, 9999) && Number.isInteger(s.start) && (e.day < s.start || e.day >= s.start + s.length)) p.push(`${at}.entries[${j}].day (day ${e.day + 1}) is outside its step`)
        str(e.label, `${at}.entries[${j}].label`, 8); str(e.text, `${at}.entries[${j}].text`, 60)
      })
      break
    case 'certificate':
      str(a.meta, `${at}.meta`, 40); str(a.title, `${at}.title`, 28); str(a.body, `${at}.body`, 140); str(a.foot, `${at}.foot`, 48, { req: false })
      if (!a.seal) p.push(`${at}.seal is missing`); else { str(String(a.seal.big ?? ''), `${at}.seal.big`, 3); str(a.seal.small, `${at}.seal.small`, 8) }
      break
    case 'invite':
      str(a.label, `${at}.label`, 16); str(a.duration, `${at}.duration`, 12); str(a.title, `${at}.title`, 40); str(a.when, `${at}.when`, 32)
      if (list(a.people, `${at}.people`, 1, 4)) a.people.forEach((x, j) => str(x, `${at}.people[${j}]`, 3))
      pairs(a.agenda, `${at}.agenda`, 1, 4, 6, 36)
      str(a.accept, `${at}.accept`, 12)
      break
    case 'slides':
      if (list(a.slides, `${at}.slides`, 1, 2)) a.slides.forEach((x, j) => {
        str(x.meta, `${at}.slides[${j}].meta`, 28); str(x.mark, `${at}.slides[${j}].mark`, 18)
        if (!['serif', 'sans'].includes(x.style)) p.push(`${at}.slides[${j}].style must be serif or sans`)
        if (list(x.swatches, `${at}.slides[${j}].swatches`, 1, 4)) x.swatches.forEach((h, k) => color(h, `${at}.slides[${j}].swatches[${k}]`))
      })
      break
    case 'screen':
      url(a.url, `${at}.url`); str(a.headline, `${at}.headline`, 28); str(a.button, `${at}.button`, 16)
      if (!a.tile) p.push(`${at}.tile is missing`); else { color(a.tile.color, `${at}.tile.color`); str(a.tile.letter, `${at}.tile.letter`, 2) }
      break
    case 'spread':
      str(a.meta, `${at}.meta`, 24); str(a.title, `${at}.title`, 48); str(a.body, `${at}.body`, 90)
      if (list(a.swatches, `${at}.swatches`, 2, 4)) a.swatches.forEach((x, j) => { str(x[0], `${at}.swatches[${j}][0]`, 10); color(x[1], `${at}.swatches[${j}][1]`) })
      if (!Array.isArray(a.pages) || a.pages.length !== 2) p.push(`${at}.pages must be [left, right] page numbers`)
      break
    case 'image':
      url(a.src, `${at}.src`)
      break
  }
}

/** What the page shows that is worked out, not typed. */
export function derive(c) {
  const week = c.calendar.week ?? 5
  const weeks = c.calendar.total / week
  const mins = c.steps.reduce((a, s) => a + (s.you ?? []).reduce((b, y) => b + y.minutes, 0), 0)
  return { week, weeks, minutes: mins, your: yourTime(mins) }
}
