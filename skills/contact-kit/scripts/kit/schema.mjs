// Contact Desk: every field of contact.json, its limits, the colour rules,
// the hours and plan formats, and the copy rules. validate() returns every
// problem at once, so one build lists all of them.

export const VOICES = {
  spectral: {
    family: "'Spectral', Georgia, serif", weight: 300, track: '-.022em', emStyle: 'italic',
    text: "'Albert Sans', system-ui, sans-serif", mono: "'Fragment Mono', ui-monospace, monospace",
    google: ['family=Spectral:ital,wght@0,300;0,400;1,300', 'family=Albert+Sans:wght@400;500;600', 'family=Fragment+Mono'],
    fonts: ['Spectral', 'Albert Sans', 'Fragment Mono'],
  },
  geist: {
    family: "'Geist', system-ui, sans-serif", weight: 600, track: '-.04em', emStyle: 'normal',
    text: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, monospace",
    google: ['family=Geist:wght@400;500;600;700', 'family=Geist+Mono:wght@400;500'],
    fonts: ['Geist', 'Geist Mono'],
  },
  hanken: {
    family: "'Hanken Grotesk', system-ui, sans-serif", weight: 500, track: '-.03em', emStyle: 'italic',
    text: "'Hanken Grotesk', system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace",
    google: ['family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;1,500', 'family=JetBrains+Mono:wght@400;500'],
    fonts: ['Hanken Grotesk', 'JetBrains Mono'],
  },
}
export const FIELD_TYPES = ['text', 'email', 'tel', 'url', 'select', 'choice', 'swatch', 'textarea', 'date']
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
  for (let t = 0.92; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- hours ---------- */
const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-4]):([0-5]\d)$/
/** "mon-fri": "09:00-17:00", "sat": "10:00-13:00" or ["08:00-12:00","13:00-17:00"] → 7 lists of [from, to] minutes, Sunday first. */
export function parseHours(h, where, bad) {
  const week = DAYS.map(() => [])
  if (!h || typeof h !== 'object' || Array.isArray(h)) { bad(`${where}: hours must be an object such as { "mon-fri": "09:00-17:00" }`); return week }
  for (const [key, val] of Object.entries(h)) {
    const m = /^([a-z]{3})(?:-([a-z]{3}))?$/.exec(key)
    const a = m && DAYS.indexOf(m[1]), b = m && (m[2] ? DAYS.indexOf(m[2]) : a)
    if (!m || a < 0 || b < 0) { bad(`${where}: "${key}" is not a day or a day range (mon, tue, wed, thu, fri, sat, sun, or mon-fri)`); continue }
    if (val === null) continue
    const spans = Array.isArray(val) ? val : [val]
    const parsed = []
    for (const s of spans) {
      const x = SPAN.exec(String(s))
      if (!x) { bad(`${where}: "${s}" is not HH:MM-HH:MM (24-hour clock)`); continue }
      const from = +x[1] * 60 + +x[2], to = +x[3] * 60 + +x[4]
      if (from % 5 || to % 5) bad(`${where}: "${s}" must be on 5-minute steps`)
      if (to <= from) { bad(`${where}: "${s}" closes before it opens (for a night shift, split it at midnight over two days)`); continue }
      parsed.push([from, to])
    }
    for (let d = a; ; d = (d + 1) % 7) { week[d].push(...parsed); if (d === b) break }
  }
  for (const [i, spans] of week.entries()) {
    spans.sort((x, y) => x[0] - y[0])
    for (let k = 1; k < spans.length; k++) if (spans[k][0] < spans[k - 1][1]) bad(`${where}: the hours on ${DAYS[i]} overlap`)
  }
  if (week.every((d) => !d.length)) bad(`${where}: no working hours at all`)
  return week
}
export const validZone = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return /\//.test(tz) || tz === 'UTC' } catch { return false } }
const DATE = /^\d{4}-\d{2}-\d{2}$/

/* ---------- words ---------- */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
/** { within: 2, unit: "working-days" } → "two working days" */
export function replyText(r) {
  const n = r.within, w = WORDS[n] ?? String(n)
  const u = r.unit === 'working-hours' ? 'working hour' : 'working day'
  return `${w} ${u}${n === 1 ? '' : 's'}`
}

/* ---------- copy that contradicts the page ---------- */
/**
 * Each rule: a pattern, when it applies (given the config), and why it is wrong.
 * The build refuses copy that promises something the page does not do.
 */
export const COPY_RULES = [
  [/\bno forms?\b|\bwithout (?:a |any )?forms?\b|\bform-?free\b|\bno need to fill\b/i, () => true, 'says there is no form, but this section is a form (try "No chat window, no bots. A person reads every note.")'],
  [/\b24\/7\b|\baround the clock\b|\bday and night\b|\balways (?:open|on|here|available)\b/i, (c) => !c._allDay, 'promises round-the-clock cover, but nobody on the desk works 24 hours on every day'],
  [/\binstant(?:ly)?\b|\bright away\b|\bimmediately\b|\bwithin minutes\b|\bin minutes\b/i, (c) => true, 'promises an instant reply; the page states real reply times instead'],
  [/\b(?:live )?chat (?:with us|now|to us)\b|\bchat bubble\b|\bstart a chat\b/i, () => true, 'offers a chat, but this section has no chat window'],
  [/\b(?:call|phone|ring) us\b/i, (c) => !c.aside?.phone, 'asks people to call, but no phone number is given (aside.phone)'],
  [/\b(?:visit|come and see|drop by|find) us\b|\bour (?:office|studio|workshop)\b/i, (c) => !(c.offices ?? []).length, 'invites a visit, but no office is listed'],
  [/\bbot\b|\bbots\b|\bAI assistant\b/i, () => false, ''],
]
export function copyProblems(c, strings) {
  const out = []
  for (const [where, s] of strings) {
    if (typeof s !== 'string') continue
    for (const [re, applies, why] of COPY_RULES) {
      if (!why || !applies(c)) continue
      const m = re.exec(s)
      if (m) out.push(`${where}: "${m[0]}" ${why}. Reword it.`)
    }
  }
  return out
}

/* ---------- plans ---------- */
const PT = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v))
const distSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}
const distLine = (p, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(p, pts[i - 1], pts[i])); return d }
const distRing = (p, pts) => distLine(p, [...pts, pts[0]])
export function validatePlan(plan, steps, where, bad) {
  if (!plan || typeof plan !== 'object') { bad(`${where}: plan is missing`); return }
  const [W, H] = plan.size ?? [600, 340]
  if (!(W >= 300 && W <= 1200 && H >= 200 && H <= 900)) bad(`${where}.size: [width, height] between [300, 200] and [1200, 900]`)
  const inside = (p, w) => { if (!PT(p)) { bad(`${w}: [x, y] numbers`); return false } if (p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) { bad(`${w}: [${p}] is outside the plan (0..${W}, 0..${H})`); return false } return true }
  const poly = (list, name, min = 0, max = 40) => {
    if (list === undefined) return
    if (!Array.isArray(list) || list.length < min || list.length > max) { bad(`${where}.${name}: ${min} to ${max} shapes`); return }
    list.forEach((s, i) => { if (!Array.isArray(s) || s.length < 3) bad(`${where}.${name}[${i}]: a shape needs 3 or more [x, y] points`); else s.forEach((p, k) => inside(p, `${where}.${name}[${i}][${k}]`)) })
  }
  poly(plan.blocks, 'blocks', 1)
  poly(plan.water, 'water')
  poly(plan.green, 'green')
  poly(plan.courts, 'courts')
  if (!Array.isArray(plan.us) || plan.us.length < 3) bad(`${where}.us: your building, 3 or more [x, y] points`)
  else plan.us.forEach((p, k) => inside(p, `${where}.us[${k}]`))
  const seg = (s, name) => {
    if (s === undefined) return
    if (!Array.isArray(s) || s.length !== 2 || !s.every(PT)) { bad(`${where}.${name}: two [x, y] points`); return }
    s.forEach((p, k) => inside(p, `${where}.${name}[${k}]`))
  }
  if (!plan.door) bad(`${where}.door: the entrance, two [x, y] points on your building's outline`)
  seg(plan.door, 'door')
  if (plan.door && Array.isArray(plan.us) && plan.us.length >= 3 && plan.door.every(PT)) for (const p of plan.door) if (distRing(p, plan.us) > 3) bad(`${where}.door: [${p}] is not on your building's outline (it must sit on one of its edges)`)
  seg(plan.gate, 'gate')
  if (plan.bay !== undefined) { seg(plan.bay?.at, 'bay.at'); if (typeof plan.bay?.label !== 'string' || plan.bay.label.length > 10) bad(`${where}.bay.label: up to 10 characters`) }
  if (plan.stairs !== undefined) {
    const s = plan.stairs
    seg(s?.at, 'stairs.at')
    if (!(s?.width >= 8 && s.width <= 80)) bad(`${where}.stairs.width: 8 to 80`)
    if (!(Number.isInteger(s?.treads) && s.treads >= 3 && s.treads <= 30)) bad(`${where}.stairs.treads: 3 to 30`)
  }
  const route = plan.route
  if (!Array.isArray(route) || route.length < 2 || route.length > 12) bad(`${where}.route: 2 to 12 [x, y] points, from where people arrive to your door`)
  else route.forEach((p, k) => inside(p, `${where}.route[${k}]`))
  const marks = plan.marks
  if (!Array.isArray(marks) || !marks.length) bad(`${where}.marks: one [x, y] per arrival step`)
  else {
    if (marks.length !== steps?.length) bad(`${where}: ${marks.length} marks but ${steps?.length ?? 0} steps; every step needs its mark and every mark its step`)
    marks.forEach((p, k) => {
      if (!inside(p, `${where}.marks[${k}]`)) return
      if (Array.isArray(route) && route.length >= 2 && route.every(PT) && distLine(p, route) > 40) bad(`${where}.marks[${k}]: mark ${k + 1} is ${Math.round(distLine(p, route))} units from the route (keep it within 40)`)
    })
  }
  if (plan.labels !== undefined) {
    if (!Array.isArray(plan.labels) || plan.labels.length > 8) bad(`${where}.labels: up to 8`)
    else plan.labels.forEach((l, k) => {
      if (typeof l?.text !== 'string' || !l.text.trim() || l.text.length > 24) bad(`${where}.labels[${k}].text: 1 to 24 characters`)
      inside(l?.at, `${where}.labels[${k}].at`)
      if (l?.angle !== undefined && !(Math.abs(l.angle) <= 90)) bad(`${where}.labels[${k}].angle: -90 to 90`)
    })
  }
  if (plan.north !== undefined && !(Math.abs(plan.north) <= 180)) bad(`${where}.north: -180 to 180 (degrees from straight up)`)
  if (plan.scale !== undefined && !(plan.scale?.metres > 0 && plan.scale?.units >= 30 && plan.scale.units <= 200)) bad(`${where}.scale: { "metres": 20, "units": 80 } (units 30 to 200)`)
  // the phone crop: a window onto the plan that still holds the whole route and every mark
  const c = plan.crop
  if (c !== undefined) {
    if (!Array.isArray(c) || c.length !== 4 || !c.every((v) => typeof v === 'number')) bad(`${where}.crop: [x, y, width, height]`)
    else {
      const [x, y, w, h] = c
      if (x < 0 || y < 0 || x + w > W + 0.01 || y + h > H + 0.01) bad(`${where}.crop: [${c}] runs outside the plan`)
      if (w < 200 || h < 160) bad(`${where}.crop: at least 200 by 160 units`)
      if (w / h > 1.6 || w / h < 0.8) bad(`${where}.crop: keep it between 4:5 and 8:5 (it is ${(w / h).toFixed(2)}:1); a phone needs a squarer view`)
      const inC = (p, pad = 24) => p[0] >= x + pad && p[0] <= x + w - pad && p[1] >= y + pad && p[1] <= y + h - pad
      if (Array.isArray(marks)) marks.forEach((p, k) => { if (PT(p) && !inC(p)) bad(`${where}.crop: mark ${k + 1} at [${p}] falls outside the phone crop (or within 24 units of its edge, where its enlarged marker would be cut)`) })
      if (Array.isArray(route)) route.forEach((p, k) => { if (PT(p) && !inC(p, 0)) bad(`${where}.crop: route point ${k + 1} at [${p}] falls outside the phone crop`) })
      if (Array.isArray(plan.door)) plan.door.forEach((p) => { if (PT(p) && !inC(p, 0)) bad(`${where}.crop: the door falls outside the phone crop`) })
    }
  }
}

/* ---------- the whole config ---------- */
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KEY = /^[a-z][a-z0-9_]{0,23}$/

export function validate(c) {
  const out = []
  const bad = (m) => out.push(m)
  if (!c || typeof c !== 'object') return ['the file is not a JSON object']
  const need = (path, v, min, max) => { if (!str(v, min, max)) bad(`${path}: ${min ? `${min} to ` : 'up to '}${max} characters${v === undefined ? ' (missing)' : typeof v === 'string' ? ` (it is ${v.length})` : ''}`) }
  need('brand', c.brand, 1, 60)
  need('title', c.title, 1, 70)
  need('description', c.description, 20, 170)
  need('eyebrow', c.eyebrow, 1, 40)
  need('headline', c.headline, 8, 90)
  if (typeof c.headline === 'string' && (c.headline.match(/_/g) ?? []).length % 2) bad('headline: the _turn_ has an opening _ without a closing one')
  // theme
  const t = c.theme ?? {}
  for (const k of ['page', 'surface', 'ink', 'accent', 'onAccent', 'open']) if (!HEX.test(t[k] ?? '')) bad(`theme.${k}: a colour as #rrggbb`)
  if (t.error !== undefined && !HEX.test(t.error)) bad('theme.error: a colour as #rrggbb')
  if (!VOICES[t.voice ?? 'spectral']) bad(`theme.voice: one of ${Object.keys(VOICES).join(', ')}`)
  if (t.corners !== undefined && !['square', 'round'].includes(t.corners)) bad('theme.corners: square or round')
  if (['page', 'surface', 'ink', 'accent', 'onAccent', 'open'].every((k) => HEX.test(t[k] ?? ''))) {
    const ck = (a, b, n, what) => { const r = contrast(t[a], t[b]); if (r < n) bad(`theme: ${what} is ${r.toFixed(2)}:1, needs ${n}:1 (${a} on ${b})`) }
    ck('ink', 'page', 7, 'body text on the page')
    ck('ink', 'surface', 7, 'body text on the surface')
    ck('accent', 'page', 3, 'the accent (now line, route, selected reason) on the page')
    ck('accent', 'surface', 4.5, 'the accent as text (errors, the turn) on the surface')
    ck('onAccent', 'accent', 4.5, 'text on accent buttons and marks')
    ck('open', 'page', 3, 'the "open" colour on the page (status dots and live hours)')
    ck('open', 'surface', 3, 'the "open" colour on the surface')
    if (t.error) ck('error', 'surface', 4.5, 'error text on the surface')
  }
  // people
  const people = c.people ?? {}
  const ids = Object.keys(people)
  if (!ids.length || ids.length > 8) bad('people: 1 to 8 people, keyed by a short id')
  let allDay = ids.length > 0
  for (const id of ids) {
    const p = people[id] ?? {}, w = `people.${id}`
    if (!KEY.test(id)) bad(`${w}: the id must be lowercase letters, digits or _ (it is used in routes' "to")`)
    need(`${w}.name`, p.name, 2, 40)
    need(`${w}.role`, p.role, 2, 40)
    need(`${w}.city`, p.city, 2, 24)
    if (!validZone(p.tz)) bad(`${w}.tz: an IANA time zone such as Europe/Lisbon (it is "${p.tz}")`)
    const week = parseHours(p.hours, `${w}.hours`, bad)
    if (!week.every((d) => d.some(([a, b]) => a === 0 && b === 1440))) allDay = false
    if (p.away !== undefined) {
      if (!Array.isArray(p.away) || p.away.length > 12) bad(`${w}.away: up to 12 [from, to] date pairs`)
      else p.away.forEach((r, k) => { if (!Array.isArray(r) || r.length !== 2 || !r.every((d) => DATE.test(d)) || r[1] < r[0]) bad(`${w}.away[${k}]: ["YYYY-MM-DD", "YYYY-MM-DD"], first day to last day`) })
    }
  }
  c._allDay = allDay
  // routes
  const routes = c.routes
  const fieldDefs = {}
  if (!Array.isArray(routes) || routes.length < 3 || routes.length > 5) bad('routes: 3 to 5 reasons to get in touch')
  const rids = new Set(), refs = new Set()
  for (const [i, r] of (Array.isArray(routes) ? routes : []).entries()) {
    const w = `routes[${i}]`
    if (!KEY.test(r?.id ?? '')) bad(`${w}.id: lowercase letters, digits or _`)
    else if (rids.has(r.id)) bad(`${w}.id: "${r.id}" is used twice`)
    else rids.add(r.id)
    need(`${w}.title`, r?.title, 3, 44)
    if (!Array.isArray(r?.to) || !r.to.length || r.to.length > 4) bad(`${w}.to: 1 to 4 people ids`)
    else for (const id of r.to) if (!people[id]) bad(`${w}.to: "${id}" is not in people`)
    if (r?.to?.length > 1) need(`${w}.desk`, r.desk, 2, 24)
    if (!(Number.isInteger(r?.reply?.within) && r.reply.within >= 1 && r.reply.within <= 10) || !['working-hours', 'working-days'].includes(r?.reply?.unit)) bad(`${w}.reply: { "within": 1 to 10, "unit": "working-hours" or "working-days" }`)
    if (r?.reply?.say !== undefined) need(`${w}.reply.say`, r.reply.say, 3, 30)
    if (!EMAIL.test(r?.email ?? '')) bad(`${w}.email: the address this reason's notes go to (the mailto fallback), such as new@studio.example`)
    if (!/^[A-Z]{2,4}$/.test(r?.ref ?? '')) bad(`${w}.ref: 2 to 4 capital letters, the start of the reference number`)
    else if (refs.has(r.ref)) bad(`${w}.ref: "${r.ref}" is used by another reason`)
    else refs.add(r.ref)
    if (r?.note !== undefined) need(`${w}.note`, r.note, 4, 90)
    if (r?.button !== undefined) need(`${w}.button`, r.button, 3, 28)
    const s = r?.sent ?? {}
    need(`${w}.sent.headline`, s.headline, 4, 60)
    need(`${w}.sent.read`, s.read, 4, 60)
    need(`${w}.sent.reply`, s.reply, 4, 60)
    if (!Array.isArray(r?.fields) || r.fields.length < 2 || r.fields.length > 7) { bad(`${w}.fields: 2 to 7 fields`); continue }
    const keys = new Set()
    let hasEmail = false
    for (const [k, f] of r.fields.entries()) {
      const fw = `${w}.fields[${k}]`
      if (!KEY.test(f?.k ?? '')) { bad(`${fw}.k: a key in lowercase letters, digits or _`); continue }
      if (keys.has(f.k)) bad(`${fw}.k: "${f.k}" appears twice in this reason`)
      keys.add(f.k)
      if (f.k === c.form?.honeypot || f.k === 'company_website') bad(`${fw}.k: "${f.k}" is the spam trap's name; pick another`)
      if (!FIELD_TYPES.includes(f.type ?? 'text')) bad(`${fw}.type: one of ${FIELD_TYPES.join(', ')}`)
      need(`${fw}.label`, f.label, 2, 40)
      if (f.hint !== undefined) need(`${fw}.hint`, f.hint, 2, 60)
      if (f.placeholder !== undefined) need(`${fw}.placeholder`, f.placeholder, 1, 60)
      const type = f.type ?? 'text'
      if (type === 'email') hasEmail = f.required !== false
      if (['select', 'choice'].includes(type)) {
        if (!Array.isArray(f.options) || f.options.length < 2 || f.options.length > 8 || !f.options.every((o) => str(o, 1, 28))) bad(`${fw}.options: 2 to 8 options of up to 28 characters`)
      }
      if (type === 'swatch') {
        if (!Array.isArray(f.options) || f.options.length < 2 || f.options.length > 6 || !f.options.every((o) => str(o?.label, 1, 22) && (o.color === 'none' || HEX.test(o.color ?? '')))) bad(`${fw}.options: 2 to 6 { "label", "color": "#rrggbb" or "none" }`)
      }
      if (f.pattern !== undefined) {
        try { new RegExp(`^(?:${f.pattern})$`) } catch { bad(`${fw}.pattern: not a valid pattern`) }
        need(`${fw}.patternMessage`, f.patternMessage, 6, 90)
      }
      // a key shared by several reasons is one field on the page: same kind, same options
      const prev = fieldDefs[f.k]
      if (prev) {
        if ((prev.type ?? 'text') !== type) bad(`${fw}: "${f.k}" is a ${prev.type ?? 'text'} in "${prev._route}" but a ${type} here; one key is one field, so give this one another key`)
        else if (JSON.stringify(prev.options ?? null) !== JSON.stringify(f.options ?? null)) bad(`${fw}: "${f.k}" has different options in "${prev._route}"; give this one another key`)
      } else fieldDefs[f.k] = { ...f, _route: r.id }
    }
    if (!hasEmail) bad(`${w}.fields: needs a required email field (type "email"), or nobody can be answered`)
  }
  // aside
  if (c.aside !== undefined) {
    need('aside.lead', c.aside.lead, 2, 40)
    need('aside.body', c.aside.body, 10, 200)
    if (c.aside.phone !== undefined && !/^\+[\d ]{7,20}$/.test(c.aside.phone)) bad('aside.phone: an international number such as +351 21 000 4810')
    if (c.aside.phone !== undefined) { need('aside.phoneLabel', c.aside.phoneLabel, 2, 24); need('aside.phoneHours', c.aside.phoneHours, 4, 60) }
  }
  // offices
  const offices = c.offices ?? []
  if (!Array.isArray(offices) || offices.length > 3) bad('offices: 0 to 3')
  for (const [i, o] of (Array.isArray(offices) ? offices : []).entries()) {
    const w = `offices[${i}]`
    need(`${w}.city`, o?.city, 2, 28)
    if (!Array.isArray(o?.address) || !o.address.length || o.address.length > 4 || !o.address.every((l) => str(l, 2, 48))) bad(`${w}.address: 1 to 4 lines of up to 48 characters`)
    if (!validZone(o?.tz)) bad(`${w}.tz: an IANA time zone`)
    parseHours(o?.hours, `${w}.hours`, bad)
    if (o?.note !== undefined) need(`${w}.note`, o.note, 4, 80)
    if (!Array.isArray(o?.steps) || o.steps.length < 2 || o.steps.length > 4 || !o.steps.every((s) => str(s, 8, 140))) bad(`${w}.steps: 2 to 4 arrival steps of up to 140 characters (*bold* allowed)`)
    if (o?.directions !== undefined && !/^https:\/\/[a-z0-9.-]+\.[a-z]+\//i.test(o.directions)) bad(`${w}.directions: an https:// link to directions`)
    validatePlan(o?.plan, o?.steps, `${w}.plan`, bad)
  }
  // form
  const f = c.form ?? {}
  if (f.endpoint !== undefined && f.endpoint !== null && !/^https:\/\//.test(f.endpoint)) bad('form.endpoint: an https:// address that accepts a POST, or null to send by email')
  if (f.honeypot !== undefined && !KEY.test(f.honeypot)) bad('form.honeypot: a field name in lowercase letters, digits or _')
  if (f.alt !== undefined) need('form.alt', f.alt, 6, 80)
  if (f.privacy !== undefined) need('form.privacy', f.privacy, 6, 140)
  // preview
  const pv = c.preview
  if (pv !== undefined) {
    if (pv.now !== undefined && Number.isNaN(Date.parse(pv.now))) bad('preview.now: an ISO time such as 2026-11-10T15:40:00Z')
    if (pv.tz !== undefined && !validZone(pv.tz)) bad('preview.tz: an IANA time zone')
    if (pv.switchTo !== undefined && !(Array.isArray(routes) && routes.some((r) => r.id === pv.switchTo))) bad('preview.switchTo: a route id')
    if (pv.draft !== undefined && (typeof pv.draft !== 'object' || Array.isArray(pv.draft))) bad('preview.draft: { "key": "value" } per field key')
    else for (const k of Object.keys(pv.draft ?? {})) if (!fieldDefs[k]) bad(`preview.draft.${k}: no field has this key`)
  }
  // copy that contradicts the layout
  const strings = [['headline', c.headline], ['eyebrow', c.eyebrow], ['form.alt', f.alt], ['form.privacy', f.privacy], ['aside.body', c.aside?.body], ['aside.lead', c.aside?.lead]]
  for (const [i, r] of (Array.isArray(routes) ? routes : []).entries()) strings.push([`routes[${i}].note`, r?.note], [`routes[${i}].sent.headline`, r?.sent?.headline], [`routes[${i}].sent.read`, r?.sent?.read], [`routes[${i}].sent.reply`, r?.sent?.reply])
  for (const [i, o] of (Array.isArray(offices) ? offices : []).entries()) (o?.steps ?? []).forEach((s, k) => strings.push([`offices[${i}].steps[${k}]`, s]))
  out.push(...copyProblems(c, strings))
  return out
}
