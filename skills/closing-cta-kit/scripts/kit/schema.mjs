// Closing CTA Kit: every field of cta.json, its limits and the colour
// contrast rules. validate() returns every problem at once, so one build
// lists all of them.

export const DISPLAYS = {
  shoulders: {
    family: "'Big Shoulders Display', 'Arial Narrow', sans-serif",
    google: 'family=Big+Shoulders+Display:wght@500;800;900',
    weight: 800, heavy: 900, track: '-.005em', case: 'uppercase', emStyle: 'normal', emWeight: 800,
    text: "'Schibsted Grotesk', system-ui, sans-serif", textGoogle: 'family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;1,400',
    mono: "'IBM Plex Mono', ui-monospace, monospace", monoGoogle: 'family=IBM+Plex+Mono:wght@400;500',
    figWdth: 100, headWdth: 100,
  },
  archivo: {
    family: "'Archivo', system-ui, sans-serif",
    google: 'family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900',
    weight: 700, heavy: 800, track: '-.025em', case: 'none', emStyle: 'italic', emWeight: 500,
    text: "'Archivo', system-ui, sans-serif", textGoogle: '',
    mono: "'JetBrains Mono', ui-monospace, monospace", monoGoogle: 'family=JetBrains+Mono:wght@400;500',
    figWdth: 125, headWdth: 100,
  },
  newsreader: {
    family: "'Newsreader', Georgia, serif",
    google: 'family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800',
    weight: 500, heavy: 600, track: '-.02em', case: 'none', emStyle: 'italic', emWeight: 400,
    text: "'Schibsted Grotesk', system-ui, sans-serif", textGoogle: 'family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;1,400',
    mono: "'IBM Plex Mono', ui-monospace, monospace", monoGoogle: 'family=IBM+Plex+Mono:wght@400;500',
    figWdth: 100, headWdth: 100,
  },
}
export const LAYOUTS = ['stub', 'poster', 'sentence']
export const FACTS = ['count', 'date', 'price', 'proof']

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
/** a + (b - a) * t, as #rrggbb */
export function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** The colour between `ink` and `bg` closest to `bg` that still holds `need`:1 against `bg`. */
export function soften(ink, bg, need) {
  for (let t = 0.7; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

/* ---------- time ---------- */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
function offsetAt(t, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t
}
/** "2026-12-01T18:00" in `tz` to a UTC instant (ms) */
export function zoned(local, tz) {
  const guess = Date.parse((DATE.test(local) ? local + 'T00:00' : local) + ':00Z')
  let t = guess - offsetAt(guess, tz)
  t = guess - offsetAt(t, tz)
  return t
}
export function validTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
}

/* ---------- validation ---------- */
export function validate(c) {
  const p = []
  const str = (v, path, max, { req = true, min = 1 } = {}) => {
    if (v === undefined || v === null) { if (req) p.push(`${path} is missing`); return false }
    if (typeof v !== 'string') { p.push(`${path} must be text`); return false }
    if (v.trim().length < min) { p.push(`${path} is empty`); return false }
    if (v.length > max) p.push(`${path} is ${v.length} characters; keep it to ${max} (shorten the words rather than the type)`)
    if (/!/.test(v)) p.push(`${path} has an exclamation mark; the band states its reason plainly`)
    if (/—/.test(v)) p.push(`${path} has an em dash; use a full stop, a comma or " · "`)
    return true
  }
  const href = (v, path) => { if (str(v, path, 400)) if (!/^(https?:\/\/|mailto:|tel:|\/|#)/.test(v)) p.push(`${path} must start with https://, /, #, mailto: or tel:`) }
  const color = (v, path, req = true) => { if (v === undefined) { if (req) p.push(`${path} is missing`); return false } if (!HEX.test(v)) { p.push(`${path} must be a colour like #1f45a0`); return false } return true }
  const link = (l, path, max, req = true) => {
    if (!l) { if (req) p.push(`${path} is missing`); return }
    str(l.label, `${path}.label`, max)
    href(l.href, `${path}.href`)
  }

  if (!c || typeof c !== 'object') return ['cta.json is not an object']
  if (!LAYOUTS.includes(c.layout)) p.push(`layout must be one of ${LAYOUTS.join(', ')}`)
  str(c.brand, 'brand', 40)
  str(c.lang, 'lang', 12, { req: false })

  // theme and contrast
  const t = c.theme ?? {}
  if (!c.theme) p.push('theme is missing')
  const ok = {}
  for (const k of ['band', 'ink', 'accent', 'onAccent']) ok[k] = color(t[k], `theme.${k}`)
  ok.card = color(t.card, 'theme.card', c.layout === 'stub')
  ok.turn = color(t.turn, 'theme.turn', false)
  ok.error = color(t.error, 'theme.error', false)
  if (t.display !== undefined && !DISPLAYS[t.display]) p.push(`theme.display must be one of ${Object.keys(DISPLAYS).join(', ')}`)
  if (t.buttons !== undefined && !['square', 'pill'].includes(t.buttons)) p.push('theme.buttons must be square or pill')
  const need = (a, b, min, what) => { if (ok[a] && (b in ok ? ok[b] : true)) { const r = contrast(t[a], t[b]); if (r < min) p.push(`${what}: theme.${a} on theme.${b} is ${r.toFixed(2)}:1, needs ${min}:1`) } }
  const ground = c.layout === 'stub' ? 'card' : 'band'
  need('ink', 'band', 7, 'text')
  if (c.layout === 'stub') need('ink', 'card', 7, 'text on the ticket')
  need('onAccent', 'accent', 4.5, 'button and stub text')
  need('accent', ground, 3, 'the accent must stand off its ground (button, figure)')
  if (t.turn) need('turn', ground, 3, "the headline's turn")
  if (t.error) need('error', 'band', 4.5, 'form errors')
  if (c.layout === 'stub' && ok.card && ok.band && contrast(t.card, t.band) < 1.08) p.push('the theme card and band colours are too close; the ticket must read as a separate stock')

  // copy
  str(c.eyebrow, 'eyebrow', 48)
  str(c.serial, 'serial', 40, { req: false })
  if (str(c.headline, 'headline', 52)) {
    const turns = (c.headline.match(/_/g) ?? []).length
    if (turns !== 0 && turns !== 2) p.push('headline: mark one turn with a pair of underscores, like "Throw your first _set of bowls._"')
  }
  str(c.lede, 'lede', 180, { req: false })
  link(c.primary, 'primary', 22, c.layout !== 'sentence')
  if (c.primary) str(c.primary.price, 'primary.price', 8, { req: false })
  link(c.secondary, 'secondary', 30, false)

  // the deadline
  const cl = c.closes
  if (cl) {
    if (!LOCAL.test(cl.at ?? '')) p.push('closes.at must be a local time like 2026-12-01T18:00')
    if (!validTz(cl.tz)) p.push('closes.tz must be a time zone like Europe/London')
    str(cl.label, 'closes.label', 28)
    str(cl.title, 'closes.title', 24, { req: false })
    str(cl.countdown, 'closes.countdown', 40, { req: false })
    if (cl.countdown && !cl.countdown.includes('{days}')) p.push('closes.countdown must contain {days}')
  }
  if (c.opened !== undefined && !DATE.test(c.opened) && !LOCAL.test(c.opened)) p.push('opened must be a date like 2026-11-01')
  str(c.openedLabel, 'openedLabel', 48, { req: false })

  // the fact
  const f = c.fact
  if (!f) p.push('fact is missing: the band needs one real reason to act now (a count, a date, a price held, or proof)')
  else if (!FACTS.includes(f.kind)) p.push(`fact.kind must be one of ${FACTS.join(', ')}`)
  else {
    str(f.label, 'fact.label', 24)
    if (f.kind === 'count') {
      if (!Number.isInteger(f.value) || f.value < 0) p.push('fact.value must be a whole number, 0 or more')
      if (!Number.isInteger(f.of) || f.of < 1 || f.of > 60) p.push('fact.of must be a whole number from 1 to 60')
      else if (f.value > f.of) p.push(`fact.value (${f.value}) is more than fact.of (${f.of})`)
      str(f.left, 'fact.left', 12, { req: false })
      str(f.taken, 'fact.taken', 12, { req: false })
    }
    if (f.kind === 'price') {
      if (typeof f.value !== 'number' || f.value <= 0) p.push('fact.value must be a price above 0')
      if (f.was !== undefined && !(typeof f.was === 'number' && f.was > f.value)) p.push('fact.was must be a higher price than fact.value')
      str(f.currency, 'fact.currency', 3)
      if (!cl) p.push('a price fact needs closes (when the price ends)')
      if (c.opened === undefined && c.layout === 'poster') p.push('a price fact on the poster needs opened (when the price started), for the price window')
      str(f.window, 'fact.window', 48, { req: false })
      if (f.window && !f.window.includes('{days}')) p.push('fact.window must contain {days}')
    }
    if (f.kind === 'date') { if (!cl) p.push('a date fact needs closes'); str(f.unit, 'fact.unit', 5, { req: false }) }
    if (f.kind === 'proof') { str(String(f.value ?? ''), 'fact.value', 5); str(f.unit, 'fact.unit', 16, { req: false }) }
  }
  if (cl && c.opened && LOCAL.test(cl.at) && validTz(cl.tz)) {
    const o = zoned(c.opened, cl.tz), e = zoned(cl.at, cl.tz)
    if (!(o < e)) p.push('opened must be before closes.at')
  }

  // per layout
  if (c.fields !== undefined) {
    if (!Array.isArray(c.fields) || c.fields.length > 4) p.push('fields: up to 4')
    else c.fields.forEach((x, i) => { str(x.label, `fields[${i}].label`, 12); str(x.value, `fields[${i}].value`, 24) })
  }
  if (c.stamp !== undefined) {
    str(c.stamp.top, 'stamp.top', 18); str(c.stamp.bottom, 'stamp.bottom', 22); str(String(c.stamp.big ?? ''), 'stamp.big', 3); str(c.stamp.small, 'stamp.small', 4)
  }
  if (c.proof !== undefined) {
    str(c.proof.score, 'proof.score', 5); str(c.proof.label, 'proof.label', 28)
    str(c.proof.quote, 'proof.quote', 120); str(c.proof.cite, 'proof.cite', 48)
  }
  if (c.layout === 'sentence') {
    const s = c.sentence
    if (!s) p.push('sentence is missing (the sentence layout needs its form)')
    else {
      href(s.action, 'sentence.action')
      if (!Array.isArray(s.parts) || s.parts.length < 3 || s.parts.length > 9) p.push('sentence.parts: 3 to 9 pieces (words and blanks, in reading order)')
      else {
        const blanks = { count: 0, option: 0, email: 0 }
        s.parts.forEach((x, i) => {
          if (typeof x === 'string') { if (x.length > 24) p.push(`sentence.parts[${i}] is ${x.length} characters; keep words between blanks to 24`); return }
          const k = Object.keys(x ?? {})[0]
          if (!(k in blanks)) return p.push(`sentence.parts[${i}] must be words or one of {count}, {option}, {email}`)
          blanks[k]++
          const b = x[k]
          str(b.caption, `sentence.parts[${i}].${k}.caption`, 16)
          if (k === 'count') {
            if (!(Number.isInteger(b.min) && Number.isInteger(b.max) && b.min >= 1 && b.max >= b.min && b.max <= 12)) p.push(`sentence.parts[${i}].count: min and max are whole numbers, 1 to 12`)
            if (b.default !== undefined && !(b.default >= b.min && b.default <= b.max)) p.push(`sentence.parts[${i}].count.default must be between min and max`)
            if (c.fact?.kind === 'count' && b.max > c.fact.value) p.push(`sentence.parts[${i}].count.max (${b.max}) is more than the places left (${c.fact.value})`)
          }
          if (k === 'option') {
            if (!Array.isArray(b.values) || b.values.length < 2 || b.values.length > 8) p.push(`sentence.parts[${i}].option.values: 2 to 8 choices`)
            else b.values.forEach((v, j) => str(v, `sentence.parts[${i}].option.values[${j}]`, 16))
          }
          if (k === 'email') str(b.placeholder, `sentence.parts[${i}].email.placeholder`, 20)
        })
        if (blanks.email !== 1) p.push('sentence.parts needs exactly one {email} blank')
        if (blanks.count > 1 || blanks.option > 1) p.push('sentence.parts: at most one {count} and one {option}')
      }
      str(s.button, 'sentence.button', 24)
      if (s.price !== undefined && !(typeof s.price === 'number' && s.price > 0)) p.push('sentence.price must be a number above 0 (the price of one)')
      str(s.currency, 'sentence.currency', 3, { req: s.price !== undefined })
      str(s.fine, 'sentence.fine', 140)
      str(s.sent, 'sentence.sent', 120)
      str(s.holdLabel, 'sentence.holdLabel', 20, { req: false })
      str(s.holdNote, 'sentence.holdNote', 60, { req: false })
      str(s.holdLine, 'sentence.holdLine', 60, { req: !!s.holdLabel })
      str(s.errEmpty, 'sentence.errEmpty', 80)
      str(s.errBad, 'sentence.errBad', 80)
      str(s.errSend, 'sentence.errSend', 80)
    }
  }
  if (c.afterClose !== undefined) {
    const a = c.afterClose
    if (!cl) p.push('afterClose needs closes (it shows once closes.at has passed)')
    str(a.eyebrow, 'afterClose.eyebrow', 48, { req: false })
    str(a.headline, 'afterClose.headline', 52)
    str(a.lede, 'afterClose.lede', 180, { req: false })
    link(a.primary, 'afterClose.primary', 22)
    if (a.fact) { str(a.fact.label, 'afterClose.fact.label', 24); str(String(a.fact.value ?? ''), 'afterClose.fact.value', 5); str(a.fact.unit, 'afterClose.fact.unit', 16, { req: false }); str(a.fact.note, 'afterClose.fact.note', 48, { req: false }) }
    str(a.window, 'afterClose.window', 48, { req: false })
    if (a.secondary) link(a.secondary, 'afterClose.secondary', 30)
    if (a.fields !== undefined) { if (!Array.isArray(a.fields) || a.fields.length > 4) p.push('afterClose.fields: up to 4'); else a.fields.forEach((x, i) => { str(x.label, `afterClose.fields[${i}].label`, 12); str(x.value, `afterClose.fields[${i}].value`, 24) }) }
    if (a.foot) { str(a.foot.title, 'afterClose.foot.title', 20); str(a.foot.label, 'afterClose.foot.label', 28) }
    if (a.stamp) { str(a.stamp.top, 'afterClose.stamp.top', 18); str(a.stamp.bottom, 'afterClose.stamp.bottom', 22); str(String(a.stamp.big ?? ''), 'afterClose.stamp.big', 3); str(a.stamp.small, 'afterClose.stamp.small', 4) }
  } else if (cl) p.push('afterClose is missing: say what the band shows once the deadline has passed (the next date, the regular price, a waitlist)')

  if (c.preview !== undefined && c.preview.now !== undefined && !DATE.test(c.preview.now) && !/^\d{4}-\d{2}-\d{2}T/.test(c.preview.now)) p.push('preview.now must be a date like 2026-11-09')
  if (c.demo !== undefined) {
    if (c.demo.above !== undefined) {
      if (!Array.isArray(c.demo.above) || c.demo.above.length > 6) p.push('demo.above: up to 6 rows')
      else c.demo.above.forEach((r, i) => { if (!Array.isArray(r) || r.length !== 2) p.push(`demo.above[${i}] must be [question, answer]`); else { str(r[0], `demo.above[${i}][0]`, 60); str(r[1], `demo.above[${i}][1]`, 24) } })
    }
    str(c.demo.footer, 'demo.footer', 80, { req: false })
  }
  return p
}
