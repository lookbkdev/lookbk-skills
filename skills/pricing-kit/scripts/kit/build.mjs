// Pricing Kit: checks pricing.json, works out every number the section shows
// (yearly bills, savings, what is new at each plan, the calculator's stops and
// crossovers), and writes two files:
//   out/index.html  a page holding the section, ready to open or upload
//   out/embed.html  the section alone (fonts, style, markup, script) to paste
//                   into an existing page; everything is scoped under .pk
//
//   node scripts/build.mjs pricing.json out
//
// Lists every problem at once and writes nothing until they are fixed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- the fields

const t = (max, o = {}) => ({ type: 'text', max, ...o })
const opt = (s) => ({ ...s, required: false })
const num = (o = {}) => ({ type: 'number', ...o })
const list = (of, min, max) => ({ type: 'list', of, min, max })
const obj = (fields) => ({ type: 'object', fields })
const oneOf = (...values) => ({ type: 'enum', values })
const link = (max) => obj({ label: t(max), href: { type: 'href' } })

export const THEMES = {
  light: { bg: '#f3efe6', card: '#fbf9f4', ink: '#1c1b18', soft: '#3b3833', muted: '#5d584f', rule: '#d3cbba', rule2: '#a79e8b', accent: '#1f4b3d', onAccent: '#f4f1e8', save: '#a8401f' },
  dark: { bg: '#0b0e11', card: '#11161b', ink: '#e7ecef', soft: '#c3ccd3', muted: '#93a1ad', rule: '#26303a', rule2: '#44525f', accent: '#f2aa3c', onAccent: '#15100a', save: '#86cdea' },
}
const PALETTE_KEYS = Object.keys(THEMES.light)

export const FONTS = {
  editorial: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
  technical: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
}

const PLAN = obj({
  name: t(16),
  for: t(60),
  monthly: opt(num({ min: 0, max: 99999 })),
  yearly: opt(num({ min: 0, max: 99999 })),
  custom: opt(t(12)),
  custom_note: opt(t(28)),
  cta: link(24),
  adds_title: t(30),
  adds: list(t(34), 1, 5),
  recommended: opt(obj({ label: t(32), reason: t(40) })),
})
const VALUE = { type: 'value', max: 14 }

export const SPEC = {
  theme: oneOf('light', 'dark'),
  type: oneOf('editorial', 'technical'),
  palette: opt({ type: 'palette' }),
  lang: opt(t(12)),
  id: opt(t(24)),
  title: t(70),
  description: t(170),
  eyebrow: t(40),
  headline: t(70, { min: 8 }),
  promises: opt(list(t(52), 1, 3)),
  currency: t(3),
  unit: t(14),
  billing: opt(obj({ monthly: t(12), yearly: t(12), saving: t(24), start: opt(oneOf('monthly', 'yearly')) })),
  scale: opt(obj({ max: num({ min: 1 }), step: num({ min: 0.01 }) })),
  included: opt(obj({ title: t(24), items: list(t(40), 2, 6), note: opt(t(90)) })),
  plans: list(PLAN, 2, 4),
  compare: opt(obj({ title: t(30), groups: list(obj({ label: t(22), rows: list(obj({ label: t(34), values: list(VALUE, 2, 4) }), 1, 10) }), 1, 6) })),
  calculator: opt(
    obj({
      title: t(30),
      intro: t(90),
      one: t(14),
      many: t(16),
      suffix: opt(t(20)),
      min: num({ min: 0 }),
      max: num({ min: 1 }),
      step: opt(num({ min: 0.01 })),
      scale: opt(oneOf('linear', 'log')),
      value: num({ min: 0 }),
      plans: list(
        obj({
          limit: opt(num({ min: 0 })),
          includes: opt(num({ min: 0 })),
          each: opt(num({ min: 0 })),
          each_yearly: opt(num({ min: 0 })),
          per: opt(num({ min: 1 })),
          quote: opt({ type: 'boolean' }),
        }),
        2,
        4,
      ),
    }),
  ),
  faq: opt(obj({ title: t(30), items: list(obj({ q: t(80), a: t(240) }), 2, 8) })),
}

// ---------------------------------------------------------------- checking

const HREF = /^(https?:\/\/[^\s]+|\/[^\s]*|#[\w-]*|mailto:[^\s]+|tel:[+\d][\d\s-]*)$/
const COLOR = /^#[0-9a-f]{6}$/i

function check(value, spec, path, problems) {
  const say = (m) => problems.push(`  ${path}: ${m}`)
  if (value === undefined || value === null || value === '') {
    if (spec.required !== false) say('missing')
    return
  }
  switch (spec.type) {
    case 'text': {
      if (typeof value !== 'string') return say('should be text')
      const n = [...value.replace(/_/g, '')].length
      if (spec.max && n > spec.max) say(`${n} characters, at most ${spec.max} fit the layout ("${value}")`)
      if (spec.min && n < spec.min) say(`${n} characters, at least ${spec.min}`)
      return
    }
    case 'value':
      if (typeof value === 'boolean') return
      if (typeof value !== 'string') return say('use true, false or a short text')
      if ([...value].length > spec.max) say(`${value.length} characters, at most ${spec.max} fit a table cell ("${value}")`)
      return
    case 'href':
      if (typeof value !== 'string' || !HREF.test(value)) say(`not a link: "${value}" (use https://…, /path, #id, mailto: or tel:)`)
      return
    case 'palette':
      if (typeof value !== 'object' || Array.isArray(value)) return say('should be an object of colours')
      for (const [k, v] of Object.entries(value)) {
        if (!PALETTE_KEYS.includes(k)) say(`"${k}" is not a palette colour (${PALETTE_KEYS.join(', ')})`)
        else if (typeof v !== 'string' || !COLOR.test(v)) say(`${k}: "${v}" is not a colour (use #rrggbb)`)
      }
      return
    case 'boolean':
      if (typeof value !== 'boolean') say('should be true or false')
      return
    case 'enum':
      if (!spec.values.includes(value)) say(`"${value}" is not one of ${spec.values.map((v) => `"${v}"`).join(', ')}`)
      return
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return say('should be a number')
      if (spec.min !== undefined && value < spec.min) say(`below ${spec.min}`)
      if (spec.max !== undefined && value > spec.max) say(`above ${spec.max}`)
      return
    case 'list':
      if (!Array.isArray(value)) return say('should be a list')
      if (spec.min && value.length < spec.min) say(`${value.length} items, at least ${spec.min}`)
      if (spec.max && value.length > spec.max) say(`${value.length} items, at most ${spec.max}`)
      value.forEach((v, i) => check(v, spec.of, `${path}[${i}]`, problems))
      return
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return say('should be an object')
      return checkObject(value, spec.fields, path, problems)
  }
}
function checkObject(value, fields, path, problems) {
  for (const [k, spec] of Object.entries(fields)) check(value[k], spec, path ? `${path}.${k}` : k, problems)
  for (const k of Object.keys(value)) if (!(k in fields)) problems.push(`  ${path ? `${path}.` : ''}${k}: not a field here (${Object.keys(fields).join(', ')})`)
}

// WCAG contrast
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const mix = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v * k + rgb(b)[i] * (1 - k)).toString(16).padStart(2, '0')).join('')

const WORDS = { one: 1, two: 2, three: 3, four: 4 }

/** The rules that span fields: what one plan means for the others. */
function checkRules(d, problems) {
  const say = (m) => problems.push(`  ${m}`)
  const plans = Array.isArray(d.plans) ? d.plans : []
  const recs = plans.filter((p) => p?.recommended)
  if (plans.length && recs.length !== 1) say(`plans: mark exactly one plan "recommended" (now ${recs.length})`)
  const yearly = !!d.billing
  plans.forEach((p, i) => {
    if (!p || typeof p !== 'object') return
    const at = `plans[${i}] (${p.name})`
    if (p.custom) {
      if (p.monthly !== undefined || p.yearly !== undefined) say(`${at}: a custom plan has no monthly or yearly price`)
      return
    }
    if (typeof p.monthly !== 'number') return say(`${at}: needs "monthly" (or "custom" text such as "Let's talk")`)
    if (yearly && typeof p.yearly !== 'number') return say(`${at}: needs "yearly" (the monthly figure when billed yearly), because there is a billing switch`)
    if (!yearly && p.yearly !== undefined) say(`${at}: has a yearly price but there is no "billing" switch`)
    if (yearly && p.yearly > p.monthly) say(`${at}: the yearly figure (${p.yearly}) is above the monthly one (${p.monthly})`)
    for (const k of ['monthly', 'yearly']) if (typeof p[k] === 'number' && Math.round(p[k] * 100) !== p[k] * 100) say(`${at}.${k}: use at most 2 decimals`)
  })
  // the saving the switch claims must be true of every priced plan
  if (yearly && typeof d.billing.saving === 'string') {
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(d.billing.saving)
    const free = /\b(\d+|one|two|three|four)\s+months?\s+free\b/i.exec(d.billing.saving)
    for (const [i, p] of plans.entries()) {
      if (!p || p.custom || !(p.monthly > 0) || typeof p.yearly !== 'number') continue
      if (pct) {
        const real = ((p.monthly - p.yearly) / p.monthly) * 100
        if (Math.abs(real - Number(pct[1])) > 0.5) say(`billing.saving says ${pct[1]}% but ${p.name} saves ${real.toFixed(1)}% (${p.monthly} to ${p.yearly}); fix the price or the claim`)
      }
      if (free) {
        const n = WORDS[free[1].toLowerCase()] ?? Number(free[1])
        if (Math.abs(p.yearly * 12 - p.monthly * (12 - n)) > 0.01) say(`billing.saving says ${n} months free but ${p.name} is ${p.yearly} × 12 = ${round2(p.yearly * 12)} a year, not ${p.monthly} × ${12 - n} = ${round2(p.monthly * (12 - n))}`)
      }
    }
  }
  const top = Math.max(0, ...plans.filter((p) => p && !p.custom).map((p) => p.monthly ?? 0))
  if (d.scale?.max !== undefined && d.scale.max < top) say(`scale.max (${d.scale.max}) is below the highest monthly price (${top})`)
  if (d.scale?.max && d.scale?.step && d.scale.max / d.scale.step > 20) say('scale: max / step gives more than 20 ticks; use a bigger step')
  if (d.compare?.groups)
    d.compare.groups.forEach((g, gi) => g?.rows?.forEach((r, ri) => {
      if (Array.isArray(r?.values) && r.values.length !== plans.length) say(`compare.groups[${gi}].rows[${ri}] (${r.label}): ${r.values.length} values for ${plans.length} plans`)
    }))
  const c = d.calculator
  if (c && typeof c === 'object') {
    if (Array.isArray(c.plans) && c.plans.length !== plans.length) say(`calculator.plans: ${c.plans.length} entries for ${plans.length} plans (one per plan, in order)`)
    if (c.min >= c.max) say('calculator: min has to be below max')
    if (c.value < c.min || c.value > c.max) say(`calculator.value (${c.value}) is outside ${c.min} to ${c.max}`)
    if (c.scale === 'log' && !(c.min > 0)) say('calculator: a log scale needs min above 0')
    if (c.scale !== 'log' && c.step && (c.max - c.min) / c.step > 400) say('calculator: more than 400 stops; use a bigger step or scale "log"')
    c.plans?.forEach((cp, i) => {
      const p = plans[i]
      if (!p || !cp) return
      if (p.custom && !cp.quote) say(`calculator.plans[${i}]: ${p.name} has a custom price, so use { "quote": true }`)
      if (!p.custom && cp.quote) say(`calculator.plans[${i}]: ${p.name} has a price; "quote" is for custom plans`)
      if (cp.each !== undefined && cp.includes === undefined) say(`calculator.plans[${i}]: "each" needs "includes" (what the plan price covers)`)
      if (cp.each_yearly !== undefined && !yearly) say(`calculator.plans[${i}]: "each_yearly" without a billing switch`)
    })
    if (Array.isArray(c.plans) && !c.plans.some((cp, i) => cp && !cp.quote && plans[i])) say('calculator: at least one plan needs a price')
  }
  // colours
  const pal = { ...THEMES[d.theme] ?? THEMES.light, ...(d.palette ?? {}) }
  const need = [
    ['ink', 'bg', 4.5], ['ink', 'card', 4.5], ['soft', 'bg', 4.5], ['soft', 'card', 4.5], ['muted', 'bg', 4.5], ['muted', 'card', 4.5],
    ['save', 'bg', 4.5], ['save', 'card', 4.5], ['onAccent', 'accent', 4.5], ['accent', 'bg', 3], ['accent', 'card', 3],
  ]
  for (const [a, b, n] of need) {
    const r = contrast(pal[a], pal[b])
    if (r < n) say(`palette: ${a} ${pal[a]} on ${b} ${pal[b]} is ${r.toFixed(2)}:1, needs ${n}:1`)
  }
}

// ---------------------------------------------------------------- numbers

const round2 = (v) => Math.round(v * 100) / 100
const money = (cur, v) => cur + (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
/** 1000 → 1k, 4200000 → 4.2M */
export function compact(v) {
  const f = (x, s) => `${Number.isInteger(x) ? x : Number(x.toFixed(x < 10 ? 1 : 0))}${s}`
  if (v >= 1e9) return f(v / 1e9, 'B')
  if (v >= 1e6) return f(v / 1e6, 'M')
  if (v >= 1e3) return f(v / 1e3, 'k')
  return String(Math.round(v))
}
const sig2 = (v) => {
  const p = 10 ** (Math.floor(Math.log10(v)) - 1)
  return Math.round(v / p) * p
}

/** Every stop the slider can sit on, and the tick labels under it. */
function stops(c) {
  const log = c.scale === 'log'
  let v = []
  if (log) {
    const a = Math.log10(c.min), b = Math.log10(c.max)
    for (let i = 0; i <= 160; i++) v.push(sig2(10 ** (a + ((b - a) * i) / 160)))
    v.push(c.min, c.max, c.value)
  } else {
    const step = c.step ?? 1
    for (let x = c.min; x <= c.max + 1e-9; x += step) v.push(round2(x))
    v.push(c.value)
  }
  v = [...new Set(v.map((x) => round2(x)))].filter((x) => x >= c.min && x <= c.max).sort((p, q) => p - q)
  const pos = (x) => (log ? (Math.log10(x) - Math.log10(c.min)) / (Math.log10(c.max) - Math.log10(c.min)) : (x - c.min) / (c.max - c.min))
  let ticks
  if (log) {
    ticks = []
    for (let e = Math.ceil(Math.log10(c.min)); e <= Math.floor(Math.log10(c.max)); e++) ticks.push(10 ** e)
    if (!ticks.includes(c.min)) ticks.unshift(c.min)
    if (!ticks.includes(c.max)) ticks.push(c.max)
  } else {
    const step = c.step ?? 1
    const raw = [0, 0.25, 0.5, 0.75, 1].map((k) => c.min + Math.round(((c.max - c.min) * k) / step) * step)
    ticks = [...new Set(raw)]
  }
  // drop a tick that would sit on top of its neighbour
  ticks = ticks.filter((x, i) => i === 0 || i === ticks.length - 1 || (pos(x) - pos(ticks[i - 1]) > 0.08 && pos(ticks.at(-1)) - pos(x) > 0.08))
  // the slider moves stop by stop, so a tick sits at its nearest stop's place
  const near = (x) => v.reduce((b, y, i) => (Math.abs(pos(y) - pos(x)) < Math.abs(pos(v[b]) - pos(x)) ? i : b), 0)
  return { values: v, ticks: ticks.map((x) => ({ at: v.length > 1 ? near(x) / (v.length - 1) : 0, label: log || x >= 10000 ? compact(x) : String(x) })), log }
}

// ---------------------------------------------------------------- markup

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (s) => String(s).replace(/_/g, '')
const marks = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')

function card(p, i, d, ids) {
  const rec = !!p.recommended
  const yearly = !!d.billing
  const cur = d.currency
  const priced = !p.custom
  const startY = yearly && d.billing.start === 'yearly'
  const sum = (bill) => {
    if (p.custom) return [p.custom_note ?? '', '', '']
    if (p.monthly === 0) return ['Free, no card needed', '', '']
    if (bill === 'y') return [`${money(cur, p.yearly)} × 12`, `= ${money(cur, round2(p.yearly * 12))} billed yearly`, p.monthly > p.yearly ? `You keep ${money(cur, round2((p.monthly - p.yearly) * 12))} a year` : '']
    return [`${money(cur, p.monthly)} billed monthly`, yearly ? `${money(cur, round2(p.monthly * 12))} a year` : '', '']
  }
  const sr = (bill) => {
    if (p.custom) return `${p.custom}. ${p.custom_note ?? ''}`
    if (p.monthly === 0) return 'Free'
    if (bill === 'y') return `${money(cur, p.yearly)} a month, billed ${money(cur, round2(p.yearly * 12))} once a year`
    return `${money(cur, p.monthly)} a month, billed monthly`
  }
  const b = startY ? 'y' : 'm'
  const s = sum(b)
  const line = (k, v) => (k === 1 && b === 'm' && v ? `<span class="l2"><s>${esc(v)}</s></span>` : k === 2 && rec ? `<span class="l3">${v ? `<em>${esc(v)}</em>` : ''}</span>` : `<span class="l${k + 1}">${esc(v)}</span>`)
  const price = priced
    ? `<div class="pk-price"><span class="pk-cur" aria-hidden="true">${esc(cur)}</span><span class="pk-digits" aria-hidden="true" data-m="${p.monthly}" data-y="${p.yearly ?? p.monthly}"></span><span class="pk-unit" aria-hidden="true">${esc(d.unit)}</span><span class="pk-sr pk-price-sr" data-m="${esc(sr('m'))}" data-y="${esc(sr('y'))}">${esc(sr(b))}</span></div>`
    : `<p class="pk-custom">${esc(p.custom)}</p>`
  return `<article class="pk-card${rec ? ' pk-rec' : ''}" data-plan="${i}" aria-labelledby="${ids}-n${i}">
      <span class="pk-notch" aria-hidden="true"></span>
      <div class="pk-cardhead">
        ${rec ? `<p class="pk-why"><b class="pk-lab">${esc(p.recommended.label)}</b><span>${esc(p.recommended.reason)}</span></p>` : ''}
        <h3 class="pk-name" id="${ids}-n${i}"><span class="pk-name-t">${esc(p.name)}</span>${rec ? '' : `<button class="pk-fold" type="button" aria-expanded="true" aria-controls="${ids}-b${i}"><span class="pk-sr">Show the ${esc(p.name)} plan</span></button>`}</h3>
        <p class="pk-for">${esc(p.for)}</p>
        ${price}
      </div>
      <div class="pk-body" id="${ids}-b${i}">
        <p class="pk-sum" aria-hidden="true" data-m='${esc(JSON.stringify(sum('m')))}' data-y='${esc(JSON.stringify(sum(yearly ? 'y' : 'm')))}'>${s.map((v, k) => line(k, v)).join('')}</p>
        <a class="pk-cta" href="${esc(p.cta.href)}">${esc(p.cta.label)}<span class="pk-sr">: ${esc(p.name)} plan</span></a>
        <div class="pk-adds"><p class="pk-lab">${esc(p.adds_title)}</p><ul>${p.adds.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        ${d.compare ? `<button class="pk-open" type="button" data-plan="${i}" aria-controls="${ids}-cmp">Compare all features <span class="pk-sr">with ${esc(p.name)} highlighted</span><i aria-hidden="true">↓</i></button>` : ''}
      </div>
    </article>`
}

function compareBlock(d, ids) {
  const plans = d.plans
  const rec = plans.findIndex((p) => p.recommended)
  const show = (v) => (v === true ? '<span class="yes" aria-hidden="true"></span><span class="pk-sr">Included</span>' : v === false ? '<span class="no" aria-hidden="true"></span><span class="pk-sr">Not included</span>' : esc(v))
  const rows = d.compare.groups
    .map((g) => {
      const head = `<div class="pk-grp" role="row"><span class="pk-lab" role="rowheader" aria-level="1">${esc(g.label)}</span></div>`
      const body = g.rows
        .map((r) => {
          const same = r.values.every((v) => v === r.values[0])
          const cells = r.values
            .map((v, i) => {
              const fresh = i > 0 && v !== false && v !== r.values[i - 1]
              return `<span class="pk-v${fresh ? ' new' : ''}${i === rec ? ' sel' : ''}" role="cell" data-c="${i}">${show(v)}${fresh ? '<span class="pk-sr">, new at this plan</span>' : ''}</span>`
            })
            .join('')
          return `<div class="pk-r pk-row" role="row"${same ? ' data-same' : ''}><span class="pk-rl" role="rowheader">${esc(r.label)}</span>${cells}</div>`
        })
        .join('')
      return head + body
    })
    .join('')
  return `<div class="pk-cmpwrap" id="${ids}-cmp" hidden>
    <div class="pk-cmp" role="table" aria-label="${esc(d.compare.title)} by plan">
      <span class="pk-band" aria-hidden="true"></span><span class="pk-colring" aria-hidden="true"></span>
      <div class="pk-cmp-head pk-row" role="row">
        <div role="columnheader">
          <h3 tabindex="-1" id="${ids}-cmph">${esc(d.compare.title)}</h3>
          <div class="pk-cmp-ctl">
            <button class="pk-only" type="button" role="switch" aria-checked="false"><span class="tog" aria-hidden="true"></span>Only what changes</button>
            <span class="pk-legend">New at this plan</span>
            <button class="pk-close" type="button" aria-controls="${ids}-cmp">Close <span aria-hidden="true">×</span></button>
          </div>
          <div class="pk-tabs" role="radiogroup" aria-label="Plan to show">${plans.map((p, i) => `<button class="pk-tab" type="button" role="radio" aria-checked="${i === rec}" data-c="${i}">${esc(p.name)}</button>`).join('')}</div>
        </div>
        ${plans.map((p, i) => `<span class="pk-colh" role="columnheader" data-c="${i}">${esc(p.name)}</span>`).join('')}
      </div>
      ${rows}
    </div>
  </div>`
}

function calcBlock(d, ids, calc) {
  const c = d.calculator
  return `<section class="pk-calc pk-row" aria-labelledby="${ids}-ch">
    <div><h3 id="${ids}-ch">${esc(c.title)}</h3><p class="pk-calc-intro">${esc(c.intro)}</p></div>
    <div class="pk-calc-main">
      <p class="pk-read" aria-hidden="true"><span><b class="pk-readv"></b><span class="pk-readu"></span></span><span class="pk-lab pk-billed"></span></p>
      <div class="pk-slider">
        <div class="pk-segs" aria-hidden="true"></div>
        <input class="pk-range" type="range" min="0" max="${calc.values.length - 1}" step="1" value="${calc.values.indexOf(c.value)}" aria-label="${esc(c.many)} ${esc(c.suffix ?? '')}">
        <div class="pk-ticks" aria-hidden="true">${calc.ticks.map((tk) => `<span style="left:${(tk.at * 100).toFixed(3)}%">${esc(tk.label)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="pk-res pk-row" style="grid-column:1 / -1">
      <span class="pk-hl" aria-hidden="true"></span>
      <p class="pk-say" aria-live="polite"></p>
      ${d.plans.map((p, i) => `<div class="pk-cell" data-c="${i}"><span class="pk-lab">${esc(p.name)}</span><span class="p"></span><span class="n"></span></div>`).join('')}
    </div>
  </section>`
}

export function render(d) {
  const ids = esc(d.id || 'pk')
  const n = d.plans.length
  const rec = d.plans.findIndex((p) => p.recommended)
  const cols = d.plans.map((_, i) => (i === rec ? '1.18fr' : '1fr')).join(' ')
  const pal = { ...THEMES[d.theme], ...(d.palette ?? {}) }
  const calc = d.calculator ? stops(d.calculator) : null
  const startY = !!d.billing && d.billing.start === 'yearly'
  // tokens; the on-accent tints are mixed here so the check can measure them
  const onAccent2 = mix(pal.onAccent, pal.accent, 0.8)
  const vars = {
    '--bg': pal.bg, '--card': pal.card, '--ink': pal.ink, '--soft': pal.soft, '--muted': pal.muted, '--rule': pal.rule, '--rule2': pal.rule2,
    '--accent': pal.accent, '--on-accent': pal.onAccent, '--on-accent-2': onAccent2, '--on-accent-rule': mix(pal.onAccent, pal.accent, 0.3),
    '--on-accent-wash': `color-mix(in srgb, ${pal.onAccent} 14%, transparent)`, '--save': pal.save,
    '--acc-text': contrast(pal.accent, pal.bg) >= 4.5 && contrast(pal.accent, pal.card) >= 4.5 ? pal.accent : pal.ink,
    '--n': n, '--cols': cols,
  }
  const style = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')
  const data = {
    currency: d.currency,
    billing: d.billing ? { start: startY ? 'y' : 'm' } : null,
    scale: { max: d.scale?.max ?? niceMax(d), step: d.scale?.step ?? niceStep(d.scale?.max ?? niceMax(d)) },
    rec,
    plans: d.plans.map((p) => ({ name: p.name, m: p.custom ? null : p.monthly, y: p.custom ? null : p.yearly ?? p.monthly, custom: !!p.custom })),
    calc: calc && {
      ...calc,
      one: d.calculator.one, many: d.calculator.many, suffix: d.calculator.suffix ?? '',
      plans: d.calculator.plans,
    },
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<div class="pk-shell">
<section class="pk pk--${d.theme} pk--${d.type}" id="${ids}" aria-labelledby="${ids}-h" style="${style}" data-bill="${startY ? 'y' : 'm'}">
  <script type="application/json" class="pk-data">${json}</script>
  <header class="pk-head">
    <p class="pk-lab">${esc(d.eyebrow)}</p>
    <h2 class="pk-h" id="${ids}-h">${marks(d.headline)}</h2>
    ${d.promises ? `<ul class="pk-promise">${d.promises.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span></span>'}
  </header>
  <div class="pk-bar pk-row">
    <div class="pk-switchbox">
      ${
        d.billing
          ? `<div class="pk-switch" role="radiogroup" aria-label="Billing period"><span class="pk-thumb" aria-hidden="true"></span><button type="button" role="radio" data-bill="m" aria-checked="${!startY}" tabindex="${startY ? -1 : 0}">${esc(d.billing.monthly)}</button><button type="button" role="radio" data-bill="y" aria-checked="${startY}" tabindex="${startY ? 0 : -1}">${esc(d.billing.yearly)}</button></div>
      <p class="pk-save"><b>${esc(d.billing.saving)}</b> <span class="pk-save-tail">on every plan</span></p>
      <p class="pk-sr pk-live" aria-live="polite"></p>`
          : ''
      }
    </div>
    <div class="pk-scale" aria-hidden="true"><svg class="pk-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
  </div>
  <div class="pk-cards pk-row">
    ${d.included ? `<aside class="pk-incl" aria-label="${esc(d.included.title)}"><h3>${esc(d.included.title)}</h3><ul>${d.included.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${d.included.note ? `<p>${esc(d.included.note)}</p>` : ''}${d.promises ? `<ul class="pk-promise pk-promise-n">${d.promises.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</aside>` : '<span></span>'}
    ${d.plans.map((p, i) => card(p, i, d, ids)).join('\n    ')}
  </div>
  ${d.compare ? compareBlock(d, ids) : ''}
  ${calc ? calcBlock(d, ids, calc) : ''}
  ${
    d.faq
      ? `<section class="pk-faq pk-row" aria-labelledby="${ids}-fh"><div><h3 id="${ids}-fh">${esc(d.faq.title)}</h3></div><div class="pk-qs">${d.faq.items
          .map((f, i) => `<div class="pk-q"><h4><button type="button" aria-expanded="false" aria-controls="${ids}-a${i}">${esc(f.q)}<i aria-hidden="true">+</i></button></h4><div class="pk-a" id="${ids}-a${i}" hidden><p>${esc(f.a)}</p></div></div>`)
          .join('')}</div></section>`
      : ''
  }
</section>
</div>`
}

function niceMax(d) {
  const top = Math.max(1, ...d.plans.filter((p) => !p.custom).map((p) => p.monthly))
  const p = 10 ** Math.floor(Math.log10(top))
  return Math.ceil(top / (p / 2)) * (p / 2)
}
function niceStep(max) {
  for (const k of [1, 2, 2.5, 5]) for (let e = -2; e < 8; e++) if (max / (k * 10 ** e) <= 8) return k * 10 ** e
  return max / 4
}

export function build(input, outDir) {
  let d
  try {
    d = JSON.parse(readFileSync(input, 'utf8'))
  } catch (e) {
    throw new Error(`${input}: ${e.message}`)
  }
  const problems = []
  checkObject(d, SPEC, '', problems)
  if (!problems.length) checkRules(d, problems)
  if (problems.length) throw new Error(`${relative(process.cwd(), input) || input} has ${problems.length} problem${problems.length > 1 ? 's' : ''}:\n${problems.join('\n')}`)

  const section = render(d)
  const css = readFileSync(join(KIT, 'style.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS[d.type]}">`
  const pal = { ...THEMES[d.theme], ...(d.palette ?? {}) }
  const embed = `<!-- Pricing Kit section: paste where the pricing goes. Everything is scoped under .pk. -->
${fonts}
<style>
${css}</style>
${section}
<script>
${js}</script>
`
  const page = `<!doctype html>
<html lang="${esc(d.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(plain(d.title))}</title>
<meta name="description" content="${esc(plain(d.description))}">
<meta name="theme-color" content="${pal.bg}">
${fonts}
<style>
html, body { margin: 0; background: ${pal.bg}; }
${css}</style>
</head>
<body>
<main>
${section}
</main>
<script>
${js}</script>
</body>
</html>
`
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), page)
  writeFileSync(join(outDir, 'embed.html'), embed)
  return { index: join(outDir, 'index.html'), embed: join(outDir, 'embed.html'), plans: d.plans.map((p) => p.name), parts: ['plans', d.compare && 'comparison', d.calculator && 'calculator', d.faq && 'faq'].filter(Boolean) }
}

export function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs pricing.json [out]')
    process.exit(1)
  }
  if (!existsSync(input)) {
    console.error(`${input} not found`)
    process.exit(1)
  }
  try {
    const r = build(resolve(input), resolve(out))
    console.log(`pricing kit: wrote ${relative(process.cwd(), r.index)} and ${relative(process.cwd(), r.embed)} (${r.plans.join(', ')}; ${r.parts.join(', ')})`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
