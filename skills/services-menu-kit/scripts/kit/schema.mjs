// Services Menu Kit: every field of services.json, its limits, the money
// format, the colour rules and the arithmetic. validate() lists every
// problem at once and returns the config with its computed parts (each set's
// from, typical and weeks, worked out from its courses) filled in.

/** The two type systems. Each names a display face, a text face and a figure face. */
export const TYPES = {
  caslon: {
    display: "'Libre Caslon Display', 'Libre Caslon Text', Georgia, serif",
    name: "'Libre Caslon Text', Georgia, serif",
    italic: "'Libre Caslon Text', Georgia, serif",
    text: "'Libre Franklin', system-ui, sans-serif",
    figure: "'Libre Caslon Text', Georgia, serif",
    google: 'family=Libre+Caslon+Display&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;500;600',
  },
  archivo: {
    display: "'Archivo', system-ui, sans-serif",
    name: "'Archivo', system-ui, sans-serif",
    italic: "'IBM Plex Sans', system-ui, sans-serif",
    text: "'IBM Plex Sans', system-ui, sans-serif",
    figure: "'IBM Plex Mono', ui-monospace, monospace",
    google: 'family=Archivo:wdth,wght@100..125,300..700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400',
  },
}
export const LAYOUTS = ['menu', 'ratecard']

/** The words the section prints around the data, each replaceable. */
export const TEXT = {
  typically: 'Typically',
  from: 'from',
  takes: 'Takes',
  bring: 'You bring',
  skip: 'Skip it if',
  youGet: 'You get',
  perMonth: 'a month',
  minimum: '{n} months minimum',
  rolling: 'Rolling, starts within {weeks}',
  budget: 'Budget, up to',
  within: 'Needed within',
  any: 'Any',
  clear: 'Clear',
  change: 'Change',
  idle: 'Pick a budget and a deadline. Each service will say whether it fits, and why.',
  fit: 'Fits',
  stretch: 'Stretch',
  out: 'Not now',
  set: 'The set',
  overlap: 'Planned overlap',
  setFrom: 'From {money} if every course runs at its lowest.',
  weeksCol: 'Weeks',
  service: 'Service',
}

const HEX = /^#[0-9a-f]{6}$/i
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)
const isInt = (x) => Number.isInteger(x)

export function hex2rgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}
export function lum(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const [r, g, b] = hex2rgb(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** One money format for the whole section: the person's currency and locale, whole units. */
export function moneyFormat(m) {
  const nf = new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currency, maximumFractionDigits: 0, minimumFractionDigits: 0 })
  return (n) => nf.format(n)
}
const SYMBOLS = '$€£¥₫₹₩₽₺₪฿'

/**
 * Money written into the copy by hand must look exactly like the money the
 * section prints: same symbol, same grouping, no "8k", no "8,000 USD".
 * Returns a list of the strings that don't.
 */
export function mixedMoney(s, fmt, currency) {
  const bad = []
  const sym = fmt(0).replace(/[\d\s  .,]/g, '')
  const re = new RegExp(`([${SYMBOLS}])\\s?\\d[\\d.,\\u00a0\\u202f]*\\d?(?:\\s?[kKmM]\\b)?|\\b\\d[\\d.,]*\\s?(?:[kK]\\b|USD|EUR|GBP|VND|dollars|euros)`, 'g')
  for (const m of s.matchAll(re)) {
    const tok = m[0].replace(/[.,]$/, '')
    if (/[kKmM]$|USD|EUR|GBP|VND|dollars|euros/.test(tok)) { bad.push(tok); continue }
    if (m[1] && m[1] !== sym) { bad.push(tok); continue }
    const n = Number(tok.replace(/[^\d]/g, ''))
    if (fmt(n) !== tok.replace(/\s/g, (c) => c)) bad.push(tok)
  }
  return bad.filter(() => currency)
}

export function validate(json) {
  const errors = []
  const notes = []
  const E = (p, m) => errors.push(`${p}: ${m}`)
  const c = structuredClone(json ?? {})
  if (!isObj(c)) return { errors: ['the file is not a JSON object'], notes, c }

  const str = (p, v, min, max, { optional = false } = {}) => {
    if (v === undefined || v === null || v === '') { if (!optional) E(p, `is missing (${min} to ${max} characters)`); return }
    if (typeof v !== 'string') return E(p, 'must be text')
    const n = v.replace(/_/g, '').length
    if (n < min) E(p, `is ${n} characters; at least ${min}`)
    if (n > max) E(p, `is ${n} characters; at most ${max} fit here. Shorten the words rather than the type`)
    if (/[—]/.test(v)) E(p, 'uses an em dash; use a comma, a colon or a full stop')
    if (/!/.test(v)) E(p, 'uses an exclamation mark')
  }
  const money = (p, v) => {
    if (!isInt(v) || v <= 0) { E(p, 'must be a whole amount above 0, in the currency\'s main unit (no cents)'); return false }
    if (v > 10_000_000) { E(p, 'is above 10,000,000; check the units'); return false }
    return true
  }

  // layout, money, theme
  c.layout ??= 'menu'
  if (!LAYOUTS.includes(c.layout)) E('layout', `must be one of ${LAYOUTS.join(', ')}`)
  c.dense ??= false
  if (typeof c.dense !== 'boolean') E('dense', 'must be true or false')
  if (c.dense && c.layout !== 'ratecard') E('dense', 'only applies to the "ratecard" layout')
  c.lang ??= 'en'
  if (!isObj(c.money)) { E('money', 'is missing: { "currency": "USD", "locale": "en-US" }'); c.money = { currency: 'USD', locale: 'en-US' } }
  let fmt = (n) => String(n)
  try { fmt = moneyFormat(c.money); if (!/^[A-Z]{3}$/.test(c.money.currency)) throw new Error('code') } catch { E('money', `"${c.money.currency}" in "${c.money.locale}" is not a currency and locale this browser can format (use an ISO code like USD, EUR, GBP and a locale like en-US, en-GB, de-DE)`) }

  const t = c.theme
  if (!isObj(t)) E('theme', 'is missing')
  else {
    if (!TYPES[t.type]) E('theme.type', `must be one of ${Object.keys(TYPES).join(', ')}`)
    for (const k of ['bg', 'ink', 'accent', 'stretch']) if (!HEX.test(t[k] ?? '')) E(`theme.${k}`, 'must be a colour like #1d1a16')
    if (['bg', 'ink', 'accent', 'stretch'].every((k) => HEX.test(t[k] ?? ''))) {
      const need = [['ink', 7], ['accent', 4.5], ['stretch', 4.5]]
      for (const [k, n] of need) { const r = contrast(t[k], t.bg); if (r < n) E(`theme.${k}`, `is ${r.toFixed(2)}:1 on theme.bg; needs ${n}:1`) }
    }
  }

  // text
  c.text = { ...TEXT, ...(isObj(c.text) ? c.text : {}) }
  for (const [k, v] of Object.entries(c.text)) if (typeof v !== 'string' || !v || v.length > 90) E(`text.${k}`, 'must be text of 1 to 90 characters')

  // intro
  const i = c.intro
  if (!isObj(i)) E('intro', 'is missing')
  else {
    str('intro.kicker', i.kicker, 2, 48)
    str('intro.headline', i.headline, 4, 40)
    if (typeof i.headline === 'string' && (i.headline.match(/_/g) ?? []).length !== 2) E('intro.headline', 'needs exactly one _turned_ phrase (between two underscores)')
    str('intro.lede', i.lede, 20, 200)
    if (!Array.isArray(i.facts) || i.facts.length < 1 || i.facts.length > 4) E('intro.facts', 'must list 1 to 4 short facts')
    else i.facts.forEach((f, k) => str(`intro.facts[${k}]`, f, 2, 36))
  }

  // courses and services
  const byId = new Map()
  if (!Array.isArray(c.courses) || c.courses.length < 2 || c.courses.length > 4) E('courses', 'must list 2 to 4 courses (for example: start here, the main work, ongoing)')
  else {
    let total = 0
    c.courses.forEach((co, ci) => {
      const p = `courses[${ci}]`
      if (!isObj(co)) return E(p, 'must be an object')
      str(`${p}.code`, co.code, 1, 16)
      str(`${p}.title`, co.title, 2, 24)
      str(`${p}.note`, co.note, 10, 110)
      if (!Array.isArray(co.services) || co.services.length < 1 || co.services.length > 5) return E(`${p}.services`, 'must list 1 to 5 services')
      total += co.services.length
      co.services.forEach((s, si) => {
        const q = `${p}.services[${si}]`
        if (!isObj(s)) return E(q, 'must be an object')
        if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(s.id ?? '')) E(`${q}.id`, 'must be a short lowercase id like "brand-audit"')
        else if (byId.has(s.id)) E(`${q}.id`, `"${s.id}" is used twice`)
        else byId.set(s.id, s)
        str(`${q}.name`, s.name, 3, 26)
        if (!Array.isArray(s.gets) || s.gets.length < 2 || s.gets.length > 4) E(`${q}.gets`, 'must list 2 to 4 things the client is handed (a noun you could point at: "40-page guidelines", not "strategy")')
        else s.gets.forEach((g, k) => str(`${q}.gets[${k}]`, g, 6, 56))
        const okF = money(`${q}.from`, s.from), okT = money(`${q}.typical`, s.typical)
        if (okF && okT && s.from > s.typical) E(q, `"from" (${fmt(s.from)}) is above "typical" (${fmt(s.typical)}); from is the lowest you have charged, typical the usual`)
        if (okF && okT && s.typical > s.from * 4) notes.push(`${s.name}: typical is more than 4 times from; a range that wide reads as a guess`)
        const hasW = s.weeks !== undefined, hasM = s.monthly !== undefined
        if (hasW === hasM) E(q, 'needs either "weeks": [min, max] (a project) or "monthly": { "minMonths", "startsWithinWeeks" } (ongoing), not both')
        if (hasW) {
          if (!Array.isArray(s.weeks) || s.weeks.length !== 2 || !s.weeks.every((w) => isInt(w) && w >= 1 && w <= 104)) E(`${q}.weeks`, 'must be [min, max] whole weeks between 1 and 104')
          else if (s.weeks[0] > s.weeks[1]) E(`${q}.weeks`, `min (${s.weeks[0]}) is above max (${s.weeks[1]})`)
        }
        if (hasM) {
          const m = s.monthly
          if (!isObj(m) || !isInt(m.minMonths) || m.minMonths < 1 || m.minMonths > 24) E(`${q}.monthly.minMonths`, 'must be 1 to 24')
          if (!isObj(m) || !isInt(m.startsWithinWeeks) || m.startsWithinWeeks < 1 || m.startsWithinWeeks > 12) E(`${q}.monthly.startsWithinWeeks`, 'must be 1 to 12')
        }
        str(`${q}.bring`, s.bring, 10, 110)
        // the honest line is not optional
        if (s.skip === undefined || s.skip === null || String(s.skip).trim() === '') E(`${q}.skip`, 'is missing. Every service needs a "skip it if": the situation in which the client should not buy it')
        else str(`${q}.skip`, s.skip, 20, 150)
      })
    })
    if (total < 3 || total > 14) E('courses', `hold ${total} services; 3 to 14 fit`)
  }

  // sets: computed from their parts, never typed in
  c.sets ??= null
  if (c.sets) {
    const st = c.sets
    if (!isObj(st)) E('sets', 'must be an object with a title and items')
    else {
      str('sets.kicker', st.kicker, 2, 32)
      str('sets.title', st.title, 3, 24)
      str('sets.note', st.note, 10, 110)
      if (!Array.isArray(st.items) || st.items.length < 1 || st.items.length > 3) E('sets.items', 'must list 1 to 3 sets')
      else st.items.forEach((x, k) => {
        const p = `sets.items[${k}]`
        str(`${p}.name`, x.name, 3, 24)
        str(`${p}.note`, x.note, 10, 90, { optional: true })
        for (const f of ['from', 'typical', 'total', 'price', 'weeks']) if (x[f] !== undefined) E(`${p}.${f}`, 'is worked out from the parts; remove it')
        if (!Array.isArray(x.parts) || x.parts.length < 2 || x.parts.length > 4) return E(`${p}.parts`, 'must name 2 to 4 services by id')
        if (new Set(x.parts).size !== x.parts.length) E(`${p}.parts`, 'names a service twice')
        const parts = x.parts.map((id) => byId.get(id))
        x.parts.forEach((id, n) => {
          if (!parts[n]) E(`${p}.parts[${n}]`, `"${id}" is not a service id`)
          else if (!parts[n].weeks) E(`${p}.parts[${n}]`, `"${id}" is ongoing; a set is made of projects`)
        })
        x.overlapWeeks ??= 0
        if (!isInt(x.overlapWeeks) || x.overlapWeeks < 0) E(`${p}.overlapWeeks`, 'must be 0 or more whole weeks')
        if (parts.every((s) => s?.weeks && Array.isArray(s.weeks)) && isInt(x.overlapWeeks)) {
          const sumMin = parts.reduce((a, s) => a + s.weeks[0], 0)
          const longest = Math.max(...parts.map((s) => s.weeks[0]))
          if (sumMin - x.overlapWeeks < longest) E(`${p}.overlapWeeks`, `${x.overlapWeeks} weeks of overlap would make the set (${sumMin - x.overlapWeeks} weeks at least) shorter than its longest part (${longest} weeks)`)
          x.from = parts.reduce((a, s) => a + s.from, 0)
          x.typical = parts.reduce((a, s) => a + s.typical, 0)
          x.weeks = [sumMin - x.overlapWeeks, parts.reduce((a, s) => a + s.weeks[1], 0) - x.overlapWeeks]
          x.services = parts
        }
      })
    }
  }

  // chooser
  const ch = c.chooser
  if (!isObj(ch)) E('chooser', 'is missing')
  else {
    str('chooser.title', ch.title, 4, 24)
    const all = [...byId.values()]
    const first = (s) => (s.weeks ? s.from : s.from * (s.monthly?.minMonths ?? 1))
    const cheapest = all.length ? Math.min(...all.map(first)) : 0
    const quickest = all.length ? Math.min(...all.map((s) => (s.weeks ? s.weeks[0] : s.monthly?.startsWithinWeeks ?? 1))) : 0
    const asc = (a) => a.every((v, n) => n === 0 || v > a[n - 1])
    if (!Array.isArray(ch.budgets) || ch.budgets.length < 2 || ch.budgets.length > 5 || !ch.budgets.every(isInt)) E('chooser.budgets', 'must list 2 to 5 whole amounts ("Any" is added for you)')
    else {
      if (!asc(ch.budgets)) E('chooser.budgets', 'must go up from left to right')
      if (ch.budgets[0] < cheapest) E('chooser.budgets', `the lowest cap (${fmt(ch.budgets[0])}) is below every service's starting price (${fmt(cheapest)}); a button nothing fits is a broken button`)
    }
    if (!Array.isArray(ch.weeks) || ch.weeks.length < 2 || ch.weeks.length > 5 || !ch.weeks.every(isInt)) E('chooser.weeks', 'must list 2 to 5 whole weeks ("Any" is added for you)')
    else {
      if (!asc(ch.weeks)) E('chooser.weeks', 'must go up from left to right')
      if (ch.weeks[0] < quickest) E('chooser.weeks', `the shortest deadline (${ch.weeks[0]} weeks) is under every service's shortest time (${quickest} weeks)`)
    }
  }

  // foot
  if (!isObj(c.foot)) E('foot', 'is missing')
  else {
    str('foot.text', c.foot.text, 10, 120)
    str('foot.cta.label', c.foot.cta?.label, 3, 32)
    if (!/^(https:\/\/|\/|#|mailto:)/.test(c.foot.cta?.href ?? '')) E('foot.cta.href', 'must be an https:// address, a /path, a #anchor or a mailto:')
  }

  // the preview script: two choices that change some verdicts
  const pv = c.preview
  if (!isObj(pv) || !isObj(pv.first) || !isObj(pv.second)) E('preview', 'needs { "first": { "budget", "weeks" }, "second": { "budget", "weeks" } }: two choices the recorder makes')
  else if (isObj(ch)) for (const k of ['first', 'second']) {
    if (pv[k].budget !== null && !ch.budgets?.includes(pv[k].budget)) E(`preview.${k}.budget`, 'must be one of chooser.budgets, or null for Any')
    if (pv[k].weeks !== null && !ch.weeks?.includes(pv[k].weeks)) E(`preview.${k}.weeks`, 'must be one of chooser.weeks, or null for Any')
  }

  // one money format: anything typed by hand must match what the section prints
  if (!errors.some((e) => e.startsWith('money'))) {
    const scan = (p, v) => { if (typeof v === 'string') for (const b of mixedMoney(v, fmt, c.money.currency)) E(p, `writes "${b}"; this section prints money as ${fmt(8000)} (${c.money.currency}, ${c.money.locale}). Write it that way, or leave the figure to the price column`) }
    scan('intro.lede', i?.lede)
    i?.facts?.forEach?.((f, k) => scan(`intro.facts[${k}]`, f))
    c.courses?.forEach?.((co, ci) => {
      scan(`courses[${ci}].note`, co.note)
      co.services?.forEach?.((s, si) => { for (const f of ['name', 'bring', 'skip']) scan(`courses[${ci}].services[${si}].${f}`, s[f]); s.gets?.forEach?.((g, k) => scan(`courses[${ci}].services[${si}].gets[${k}]`, g)) })
    })
    scan('sets.note', c.sets?.note)
    c.sets?.items?.forEach?.((x, k) => scan(`sets.items[${k}].note`, x.note))
    scan('foot.text', c.foot?.text)
  }
  return { errors, notes, c, fmt }
}

/**
 * The verdict for one service or set under a cap and a deadline. The page
 * runs the same function (it is inlined into the runtime by the build).
 * Price: typical within the cap fits; from within it but typical above is a
 * stretch; from above it is not now. Ongoing work compares the first
 * commitment (price x minimum months). Time: max within the deadline fits;
 * min within it but max above is a stretch; min above is not now; ongoing
 * work compares how soon it can start. The worse of the two wins.
 */
export function judge(s, B, W, fmt, T) {
  const per = !!s.monthly
  const lo = per ? s.from * s.monthly.minMonths : s.from
  const hi = per ? s.typical * s.monthly.minMonths : s.typical
  const wk = (w) => (w[0] === w[1] ? `${w[0]} weeks` : `${w[0]} to ${w[1]} weeks`)
  const why = []
  let p = 'fit', t = 'fit'
  if (B != null) {
    if (hi <= B) why.push(per ? `${s.monthly.minMonths} months typically come to ${fmt(hi)}, inside your ${fmt(B)}` : `typically ${fmt(hi)}, inside your ${fmt(B)}`)
    else if (lo <= B) { p = 'stretch'; why.push(per ? `${s.monthly.minMonths} months start at ${fmt(lo)} but usually reach ${fmt(hi)}, ${fmt(hi - B)} over` : `starts at ${fmt(lo)} but usually runs ${fmt(hi)}, ${fmt(hi - B)} over`) }
    else { p = 'out'; why.push(per ? `the ${s.monthly.minMonths}-month minimum starts at ${fmt(lo)}, ${fmt(lo - B)} over your ${fmt(B)}` : `starts at ${fmt(lo)}, ${fmt(lo - B)} over your ${fmt(B)}`) }
  }
  if (W != null) {
    if (per) {
      const n = s.monthly.startsWithinWeeks
      if (n <= W) why.push(`can start within ${n} week${n > 1 ? 's' : ''}`)
      else { t = 'out'; why.push(`needs ${n} weeks to start`) }
    } else if (s.weeks[1] <= W) why.push(`${wk(s.weeks)}, inside ${W}`)
    else if (s.weeks[0] <= W) { t = 'stretch'; why.push(`${wk(s.weeks)} against your ${W}`) }
    else { t = 'out'; why.push(`needs at least ${s.weeks[0]} weeks`) }
  }
  const st = p === 'out' || t === 'out' ? 'out' : p === 'stretch' || t === 'stretch' ? 'stretch' : 'fit'
  const lead = { fit: 'Fits.', stretch: 'A stretch.', out: 'Not this time.' }[st]
  let txt = why.join('; ')
  txt = txt.charAt(0).toUpperCase() + txt.slice(1) + '.'
  return { st, lead, txt }
}
