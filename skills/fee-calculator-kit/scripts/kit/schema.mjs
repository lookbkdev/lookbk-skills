// Fee Calculator Kit: every field of calculator.json, its limits, the money
// and time rules, and the colour contrast rules. validate() returns every
// problem at once; the build writes nothing until the list is empty.

export const PAIRINGS = {
  ledger: {
    google: ['family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400', 'family=Public+Sans:wght@400;500;600;700', 'family=IBM+Plex+Mono:wght@400;500'],
    display: "'Newsreader', Georgia, serif", text: "'Public Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace",
    fig: "'Newsreader', Georgia, serif", ledger: "'Newsreader', Georgia, serif",
    hw: 400, htrack: '-.02em', em: 'italic', figw: 400, figtrack: '-.02em',
  },
  terminal: {
    google: ['family=Geist:wght@400;500;600;700', 'family=Geist+Mono:wght@400;500'],
    display: "'Geist', system-ui, sans-serif", text: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, monospace",
    fig: "'Geist', system-ui, sans-serif", ledger: "'Geist Mono', ui-monospace, monospace",
    hw: 600, htrack: '-.04em', em: 'normal', figw: 600, figtrack: '-.045em',
  },
}

/* ---------- colour ---------- */
export const hex = (s) => /^#[0-9a-f]{6}$/i.test(String(s))
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const rgb = (h) => rgbOf(h).join(',')
const toHex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
export function lum(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = rgbOf(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a, b) {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const mix = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)) }
/** ink moved toward the grounds until it only just keeps `target` contrast on every one of them */
export function soften(ink, grounds, target) {
  const bg = grounds[0]
  let best = ink
  for (let t = 0; t <= 0.9; t += 0.01) {
    const m = mix(ink, bg, t)
    if (grounds.every((g) => contrast(m, g) >= target)) best = m
    else break
  }
  return best
}

/* ---------- helpers ---------- */
const DEC = /^\d+(\.\d+)?$/
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const HM = /^([01]\d|2[0-3]):[0-5]\d$/
const zoneOk = (z) => { try { new Intl.DateTimeFormat('en', { timeZone: z }); return typeof z === 'string' && z.includes('/') } catch { return false } }
const localeOk = (l) => { try { return typeof l === 'string' && Intl.NumberFormat.supportedLocalesOf([l]).length === 1 } catch { return false } }
const curOk = (code) => { try { new Intl.NumberFormat('en', { style: 'currency', currency: code }); return /^[A-Z]{3}$/.test(code) } catch { return false } }
const places = (s) => (String(s).split('.')[1] ?? '').length
const big = (s, dp) => { const [i, f = ''] = String(s).split('.'); return BigInt(i + (f + '0'.repeat(dp)).slice(0, dp)) }

/** wall-clock "YYYY-MM-DDTHH:MM" in a zone, as epoch ms */
export function zonedMs(str, zone) {
  const a = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(str)
  if (!a) return NaN
  const want = Date.UTC(+a[1], +a[2] - 1, +a[3], +(a[4] ?? 0), +(a[5] ?? 0))
  let t = want
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  }
  return t
}

const TEXTS = []
function text(out, path, v, max, { required = true, min = 1 } = {}) {
  if (v == null || v === '') { if (required) out.push(`${path} is missing`); return }
  if (typeof v !== 'string') { out.push(`${path} must be text`); return }
  if (v.length < min) out.push(`${path} is too short (at least ${min} characters)`)
  if (v.length > max) out.push(`${path} is ${v.length} characters; keep it to ${max}`)
  TEXTS.push([path, v])
}
function money(out, path, v, cur, { required = true } = {}) {
  if (v == null) { if (required) out.push(`${path} is missing`); return }
  if (typeof v !== 'string') { out.push(`${path} must be a string such as "2.10", not a number (money is never a float here)`); return }
  if (!DEC.test(v)) { out.push(`${path} "${v}" is not a plain decimal such as "2.10"`); return }
  if (cur && places(v) > cur.decimals) out.push(`${path} "${v}" has more decimal places than ${cur.code} uses (${cur.decimals})`)
}
function pct(out, path, v, max, { required = true } = {}) {
  if (v == null) { if (required) out.push(`${path} is missing`); return }
  if (typeof v !== 'string') { out.push(`${path} must be a string such as "0.35" (a percentage), not a number`); return }
  if (!DEC.test(v)) { out.push(`${path} "${v}" is not a plain decimal`); return }
  if (places(v) > 4) out.push(`${path} has more than 4 decimal places`)
  if (Number(v) > max) out.push(`${path} is ${v}%; it must be at most ${max}%`)
}
const href = (out, path, h) => {
  if (typeof h !== 'string' || !(/^https:\/\/[^\s]+$/.test(h) || h.startsWith('#'))) out.push(`${path} must be an https:// address or #`)
}

export function validate(c) {
  const out = []
  TEXTS.length = 0
  if (!c || typeof c !== 'object') return ['calculator.json is not an object']
  if (!['statement', 'receipt'].includes(c.layout)) out.push('layout must be "statement" or "receipt"')
  if (!PAIRINGS[c.type]) out.push('type must be "ledger" or "terminal"')
  text(out, 'brand', c.brand, 40)
  if (!localeOk(c.locale)) out.push(`locale "${c.locale}" is not a locale this browser engine knows (try "en-US", "de-DE", "en-GB")`)
  text(out, 'eyebrow', c.eyebrow, 32)
  text(out, 'headline', c.headline, 48)
  if (typeof c.headline === 'string' && (c.headline.match(/_/g) ?? []).length > 2) out.push('headline: use at most one _turn_')
  text(out, 'lede', c.lede, 170)
  if (c.layout === 'receipt') text(out, 'receiptTitle', c.receiptTitle, 24, { required: false })
  for (const k of ['from', 'to']) {
    const x = c[k]
    if (!x || typeof x !== 'object') { out.push(`${k} is missing`); continue }
    if (!curOk(x.code)) out.push(`${k}.code "${x.code}" is not an ISO currency code such as "EUR"`)
    if (!Number.isInteger(x.decimals) || x.decimals < 0 || x.decimals > 3) out.push(`${k}.decimals must be 0 to 3`)
    else if (curOk(x.code)) {
      const want = new Intl.NumberFormat('en', { style: 'currency', currency: x.code }).resolvedOptions().maximumFractionDigits
      if (want !== x.decimals) out.push(`${k}.decimals is ${x.decimals} but ${x.code} uses ${want}`)
    }
    text(out, `${k}.symbol`, x.symbol, 3, { required: false })
    text(out, `${k}.unit`, x.unit, 16, { required: false })
  }
  const F = c.from?.decimals != null ? c.from : null
  const A = c.amount ?? {}
  if (!c.amount) out.push('amount is missing')
  else {
    money(out, 'amount.start', A.start, F); money(out, 'amount.min', A.min, F); money(out, 'amount.max', A.max, F)
    text(out, 'amount.hint', A.hint, 70, { required: false })
    if ([A.start, A.min, A.max].every((v) => typeof v === 'string' && DEC.test(v)) && F) {
      const [s, lo, hi] = [A.start, A.min, A.max].map((v) => big(v, F.decimals))
      if (!(lo > 0n)) out.push('amount.min must be above 0')
      if (!(lo < hi)) out.push('amount.min must be below amount.max')
      if (s < lo || s > hi) out.push('amount.start must be between amount.min and amount.max')
    }
  }
  const R = c.rate
  if (!R) out.push('rate is missing')
  else {
    const same = c.from?.code === c.to?.code
    if (!same) {
      if (typeof R.mid !== 'string') out.push('rate.mid must be a string such as "30412.80", not a number')
      else if (!DEC.test(R.mid) || Number(R.mid) <= 0) out.push(`rate.mid "${R.mid}" is not a positive decimal`)
      else if (places(R.mid) > 8) out.push('rate.mid has more than 8 decimal places')
    }
    pct(out, 'rate.margin', R.margin, 10)
    if (!Number.isInteger(R.decimals) || R.decimals < 0 || R.decimals > 6) out.push('rate.decimals must be 0 to 6')
    if (typeof R.asOf !== 'string' || !LOCAL.test(R.asOf)) out.push('rate.asOf must be "YYYY-MM-DDTHH:MM", the time the rate was taken, in arrival.cutoffZone')
    text(out, 'rate.fixedNote', R.fixedNote, 90, { required: false })
  }
  for (const k of ['rounding', 'receiveRounding']) {
    const ok = k === 'rounding' ? ['half-up', 'half-even'] : ['down', 'half-up', 'half-even']
    if (!ok.includes(c[k])) out.push(`${k} must be one of ${ok.map((x) => `"${x}"`).join(', ')}`)
  }
  const toggles = Array.isArray(c.toggles) ? c.toggles : []
  if (c.toggles != null && !Array.isArray(c.toggles)) out.push('toggles must be a list')
  if (toggles.length > 2) out.push('toggles: at most 2')
  toggles.forEach((t, i) => {
    if (!/^[a-z][a-z0-9-]{0,15}$/.test(t.id ?? '')) out.push(`toggles[${i}].id must be a short lowercase name`)
    text(out, `toggles[${i}].label`, t.label, 20)
    if (!Array.isArray(t.options) || t.options.length < 2 || t.options.length > 3) out.push(`toggles[${i}].options: 2 or 3`)
    else t.options.forEach((o, j) => { text(out, `toggles[${i}].options[${j}].label`, o.label, 14); if (!o.value) out.push(`toggles[${i}].options[${j}].value is missing`) })
    if (!t.options?.some((o) => o.value === t.default)) out.push(`toggles[${i}].default must be one of its option values`)
  })
  const rowsCheck = (rows, path, labels) => {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 4) { out.push(`${path} needs 1 to 4 rows`); return }
    rows.forEach((row, i) => {
      if (labels) { text(out, `${path}[${i}].label`, row.label, 24); text(out, `${path}[${i}].none`, row.none, 40, { required: false }) }
      if (!Array.isArray(row.cases) || row.cases.length < 1 || row.cases.length > 4) { out.push(`${path}[${i}].cases needs 1 to 4 entries`); return }
      row.cases.forEach((k, j) => {
        const p = `${path}[${i}].cases[${j}]`
        if (k.fixed == null && k.percent == null) out.push(`${p} needs a fixed amount, a percent or both`)
        money(out, `${p}.fixed`, k.fixed, F, { required: false })
        pct(out, `${p}.percent`, k.percent, 20, { required: false })
        if (labels) text(out, `${p}.detail`, k.detail, 40, { required: false })
        for (const [id, val] of Object.entries(k.when ?? {})) {
          const t = toggles.find((x) => x.id === id)
          if (!t) out.push(`${p}.when names "${id}", which is not a toggle`)
          else if (!t.options.some((o) => o.value === val)) out.push(`${p}.when.${id} "${val}" is not one of that toggle's values`)
        }
      })
    })
  }
  rowsCheck(c.fees, 'fees', true)
  if (c.compare != null) {
    const k = c.compare
    text(out, 'compare.label', k.label, 20)
    text(out, 'compare.inText', k.inText, 30, { required: false })
    // a comparison column cannot exist without a dated source
    text(out, 'compare.source', k.source, 220, { min: 20 })
    if (typeof k.collected !== 'string' || !DAY.test(k.collected)) out.push('compare.collected must be the date the comparison figures were collected, "YYYY-MM-DD"')
    pct(out, 'compare.margin', k.margin, 15)
    rowsCheck(k.fees, 'compare.fees', false)
    if (Array.isArray(k.fees) && Array.isArray(c.fees) && k.fees.length !== c.fees.length) out.push(`compare.fees has ${k.fees.length} rows; it needs one per row of fees (${c.fees.length})`)
    if (k.link) { text(out, 'compare.link.label', k.link.label, 40); href(out, 'compare.link.href', k.link.href) }
  }
  const Ar = c.arrival
  if (!Ar) out.push('arrival is missing')
  else {
    if (!HM.test(Ar.cutoff ?? '')) out.push('arrival.cutoff must be "HH:MM"')
    if (!HM.test(Ar.by ?? '')) out.push('arrival.by must be "HH:MM"')
    if (!zoneOk(Ar.cutoffZone)) out.push(`arrival.cutoffZone "${Ar.cutoffZone}" is not a time zone such as "Europe/Berlin"`)
    if (!zoneOk(Ar.zone)) out.push(`arrival.zone "${Ar.zone}" is not a time zone such as "Asia/Ho_Chi_Minh"`)
    text(out, 'arrival.cutoffCity', Ar.cutoffCity, 20)
    text(out, 'arrival.city', Ar.city, 24)
    text(out, 'arrival.where', Ar.where, 60)
    text(out, 'arrival.note', Ar.note, 160, { required: false })
    if (!Number.isInteger(Ar.businessDays) || Ar.businessDays < 1 || Ar.businessDays > 10) out.push('arrival.businessDays must be 1 to 10')
    if (Ar.holidays != null && (!Array.isArray(Ar.holidays) || Ar.holidays.some((d) => !DAY.test(d)))) out.push('arrival.holidays must be a list of "YYYY-MM-DD"')
  }
  if (c.notes != null && (!Array.isArray(c.notes) || c.notes.length > 2)) out.push('notes: up to 2 (the comparison source and the rounding rules are added for you)')
  ;(c.notes ?? []).forEach((n, i) => { text(out, `notes[${i}].title`, n.title, 24); text(out, `notes[${i}].text`, n.text, 240); if (n.link) { text(out, `notes[${i}].link.label`, n.link.label, 40); href(out, `notes[${i}].link.href`, n.link.href) } })
  if (c.legal != null && (!Array.isArray(c.legal) || c.legal.length > 2)) out.push('legal: up to 2 lines')
  ;(c.legal ?? []).forEach((l, i) => text(out, `legal[${i}]`, l, 110))
  for (const [k, v] of Object.entries(c.words ?? {})) text(out, `words.${k}`, v, 48)
  for (const [k, v] of Object.entries(c.messages ?? {})) text(out, `messages.${k}`, v, 90)
  // the preview clock: stills, checks and recordings run at this time
  const P = c.preview
  if (!P || typeof P.now !== 'string' || !LOCAL.test(P.now)) out.push('preview.now must be "YYYY-MM-DDTHH:MM" in arrival.cutoffZone (the time stills and checks show)')
  else if (Ar && zoneOk(Ar.cutoffZone)) {
    const nowMs = zonedMs(P.now, Ar.cutoffZone)
    if (R && typeof R.asOf === 'string' && LOCAL.test(R.asOf) && zonedMs(R.asOf, Ar.cutoffZone) > nowMs) out.push(`rate.asOf ${R.asOf} is later than preview.now ${P.now}: a rate cannot be quoted from the future`)
    if (c.compare && DAY.test(c.compare.collected ?? '') && c.compare.collected > P.now.slice(0, 10)) out.push(`compare.collected ${c.compare.collected} is later than preview.now`)
  }
  if (P) {
    if (P.type != null && !/^\d{1,9}$/.test(String(P.type))) out.push('preview.type must be digits to type, such as "2400"')
    text(out, 'preview.paste', P.paste, 24, { required: false })
    if (P.toggle && !toggles.some((t) => t.id === P.toggle.id && t.options.some((o) => o.value === P.toggle.value))) out.push('preview.toggle must name a toggle and one of its values')
  }
  // theme
  const t = c.theme
  if (!t) out.push('theme is missing')
  else {
    for (const k of ['page', 'sheet', 'ink', 'cost', 'accent', 'onAccent']) if (!hex(t[k])) out.push(`theme.${k} must be a colour such as "#17201c"`)
    for (const k of ['paper', 'mark', 'result']) if (t[k] != null && !hex(t[k])) out.push(`theme.${k} must be a colour such as "#17201c"`)
    if (['page', 'sheet', 'ink', 'cost', 'accent', 'onAccent'].every((k) => hex(t[k]))) {
      const grounds = [t.sheet, t.page, ...(c.layout === 'receipt' && t.paper ? [t.paper] : [])]
      const need = (a, an, b, bn, n) => { const r = contrast(a, b); if (r < n) out.push(`theme.${an} on theme.${bn} is ${r.toFixed(2)}:1; it needs ${n}:1`) }
      for (const g of grounds) {
        const gn = g === t.sheet ? 'sheet' : g === t.page ? 'page' : 'paper'
        need(t.ink, 'ink', g, gn, 7)
        need(t.accent, 'accent', g, gn, 4.5)
        if (gn !== 'page') need(t.cost, 'cost', g, gn, 4.5)
        if (t.result && gn !== 'page') need(t.result, 'result', g, gn, 4.5)
      }
      need(t.onAccent, 'onAccent', t.accent, 'accent', 4.5)
      const barBg = t.result ?? t.ink
      const barInk = contrast(t.sheet, barBg) >= contrast(t.onAccent, barBg) ? t.sheet : t.onAccent
      if (contrast(barInk, barBg) < 4.5) out.push('the phone result bar has no readable text colour on theme.result (or theme.ink)')
    }
  }
  for (const [p, v] of TEXTS) {
    if (/!/.test(v)) out.push(`${p} has an exclamation mark; state it plainly`)
    if (/—/.test(v)) out.push(`${p} has an em dash; use a comma, a colon or two sentences`)
  }
  return out
}

/** The custom properties for the section. */
export function tokens(c) {
  const t = c.theme, P = PAIRINGS[c.type]
  const grounds = [t.sheet, ...(c.layout === 'receipt' && t.paper ? [t.paper] : []), t.page]
  const result = t.result ?? t.ink
  const barInk = contrast(t.sheet, result) >= contrast(t.onAccent, result) ? t.sheet : t.onAccent
  const v = {
    '--fk-page': t.page, '--fk-sheet': t.sheet, '--fk-paper': t.paper ?? t.sheet,
    '--fk-ink': t.ink, '--fk-mute': soften(t.ink, grounds, 5.2), '--fk-bank': soften(t.ink, grounds, 4.8),
    '--fk-rule': mix(t.sheet, t.ink, 0.17), '--fk-rule2': mix(t.sheet, t.ink, 0.09), '--fk-night': mix(t.sheet, t.ink, 0.055),
    '--fk-cost': t.cost, '--fk-accent': t.accent, '--fk-on-accent': t.onAccent,
    '--fk-mark': t.mark ?? 'transparent', '--fk-result': result, '--fk-diff': result, '--fk-bar': result,
    '--fk-total-rule': result, '--fk-go': t.accent, '--fk-go-bar': result, '--fk-bar-bg': result, '--fk-bar-ink': barInk,
    '--fk-display': P.display, '--fk-text': P.text, '--fk-mono': P.mono, '--fk-fig': P.fig, '--fk-ledger': P.ledger,
    '--fk-h-w': P.hw, '--fk-h-track': P.htrack, '--fk-em-style': P.em, '--fk-fig-w': P.figw, '--fk-fig-track': P.figtrack,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
export const fontsHref = (c) => `https://fonts.googleapis.com/css2?${PAIRINGS[c.type].google.join('&')}&display=swap`
