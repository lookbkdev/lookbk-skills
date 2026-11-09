// Shop Collection Kit: checks page.json, then writes
//   out/index.html  the collection page, ready to open or upload
//   out/embed.html  the same page body alone (fonts, style, markup, script)
//                   to paste into an existing site; everything is under .sck
//   out/photos/     the photographs the page uses (front of every option,
//                   the turned-over view of every product, the editorial one)
//
//   node scripts/build.mjs page.json out
//
// Lists every problem at once and writes nothing until they are fixed.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = dirname(fileURLToPath(import.meta.url))

export const LOOKS = {
  light: { bg: '#efe9df', ink: '#1f1c18', muted: '#625a50', rule: '#d3cabc', plate: '#e3dcd0', plateInk: '#575047', low: '#9b3d1f', soon: '#3f6150', focus: '#9b3d1f', edBg: '#1f1c18', edInk: '#efe9df', scrim: 'rgba(31,28,24,.38)', swatchRing: 'rgba(0,0,0,.2)' },
  dark: { bg: '#14110e', ink: '#ece5d8', muted: '#a69c8d', rule: '#3a332b', plate: '#25211c', plateInk: '#aaa092', low: '#e3a27a', soon: '#d6b47a', focus: '#d6b47a', edBg: '#d6b47a', edInk: '#16120d', scrim: 'rgba(0,0,0,.55)', swatchRing: 'rgba(255,255,255,.22)' },
}
export const TYPES = {
  editorial: {
    fonts: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..600;1,8..60,300..500&family=Instrument+Sans:wght@400;500&family=Spline+Sans+Mono:wght@400;500&display=swap',
    display: "'Source Serif 4', Georgia, serif",
    body: "'Instrument Sans', system-ui, sans-serif",
    mono: "'Spline Sans Mono', ui-monospace, monospace",
    vars: { 'display-var': "'opsz' 60", 'text-var': "'opsz' 24", 'ed-var': "'opsz' 40", 'display-iw': '300', 'brand-track': '-.01em', radius: '2px', 'radius-btn': '2px' },
  },
  didone: {
    fonts: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..500&family=Albert+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap',
    display: "'Bodoni Moda', Didot, serif",
    body: "'Albert Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    vars: { 'display-var': "'opsz' 96", 'text-var': "'opsz' 11", 'ed-var': "'opsz' 24", 'display-iw': '400', 'brand-track': '.32em', radius: '0px', 'radius-btn': '999px' },
  },
}
const WORDS = {
  inStock: 'In stock',
  soldOut: 'Sold out',
  add: 'Add to bag',
  inBag: 'In your bag',
  keep: 'Keep looking',
  checkout: 'Check out',
  total: 'Bag total',
  close: 'Close',
  quick: 'Quick view',
  front: 'Front',
  no: 'No.',
  bag: 'Bag',
  search: 'Search',
  all: 'All',
  stockOnly: 'In stock',
  sort: 'Sort',
  filter: 'Filter',
  clear: 'Clear',
  show: 'Show',
  options: 'options',
  option: 'option',
  piece: 'piece',
  pieces: 'pieces',
  turn: 'Turn over',
  larger: 'Shown {x}× larger',
  endLabel: 'End of list',
  empty: 'Nothing here matches. Clear a filter to see more.',
  availability: 'Availability',
  category: 'Category',
  showing: 'Showing {n} of {of} pieces.',
  showAll: 'Show all {n}',
}
// Words that would turn this into a sale page. The kit shows prices as they are.
const NO_SALE = /^(compare_?at|compareAt|was|was_?price|original_?price|discount|sale|sale_?price|badge|percent_?off|countdown)$/i

// ---------------------------------------------------------------- colour
const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c)
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null
}
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** The reverse's photo for one option: its own, or the product's. */
const turnFile = (photos, id, o) => [`${id}-${o}-turn.webp`, `${id}-turn.webp`].find((f) => existsSync(join(photos, f)))

// ---------------------------------------------------------------- checks
export function check(cfg, base) {
  const P = []
  const say = (m) => P.push(m)
  const str = (v, at, max, { min = 1, need = true } = {}) => {
    if (v == null || v === '') return need ? say(`${at}: missing`) : null
    if (typeof v !== 'string') return say(`${at}: should be text`)
    if (v.length < min) say(`${at}: at least ${min} characters`)
    if (v.length > max) say(`${at}: ${v.length} characters, at most ${max} fit here ("${v.slice(0, 40)}...")`)
  }
  const href = (v, at) => {
    if (typeof v !== 'string' || !v) return say(`${at}: missing link`)
    if (!/^(https:\/\/|\/|#|\.\/|mailto:)/.test(v)) say(`${at}: "${v}" should start with https://, / or #`)
  }
  const num = (v, at, min, max) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return say(`${at}: should be a number`)
    if (v < min || v > max) say(`${at}: ${v} is outside ${min} to ${max}`)
  }
  const walkNoSale = (o, at) => {
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o)) {
      if (NO_SALE.test(k)) say(`${at}.${k}: this kit has no sale prices, badges or countdowns; show the price as it is`)
      if (k !== 'still') walkNoSale(v, `${at}.${k}`)
    }
  }
  const b = cfg.brand ?? {}
  str(b.name, 'brand.name', 24)
  if (b.url) href(b.url, 'brand.url')
  if (!Array.isArray(b.nav) || b.nav.length > 6) say('brand.nav: 0 to 6 links')
  for (const [i, n] of (b.nav ?? []).entries()) {
    str(n.label, `brand.nav[${i}].label`, 16)
    href(n.href, `brand.nav[${i}].href`)
  }
  href(b.bagHref, 'brand.bagHref')
  href(b.checkoutHref, 'brand.checkoutHref')
  const m = cfg.money ?? {}
  if (!/^[A-Z]{3}$/.test(m.currency ?? '')) say('money.currency: the three-letter code, e.g. GBP, EUR, USD')
  str(m.symbol, 'money.symbol', 4)
  if (![0, 2].includes(m.decimals)) say('money.decimals: 0 (€240) or 2 (£34.00)')
  if (!LOOKS[cfg.look]) say(`look: "light" or "dark"`)
  if (!TYPES[cfg.type]) say(`type: ${Object.keys(TYPES).map((t) => `"${t}"`).join(' or ')}`)
  const colors = { ...(LOOKS[cfg.look] ?? LOOKS.light), ...(cfg.colors ?? {}) }
  for (const [k, v] of Object.entries(cfg.colors ?? {})) {
    if (!(k in LOOKS.light)) say(`colors.${k}: not a colour this kit uses (${Object.keys(LOOKS.light).join(', ')})`)
    else if (!['scrim', 'swatchRing'].includes(k) && !hex(v)) say(`colors.${k}: a #rrggbb colour`)
  }
  const pairs = [
    ['ink', 'bg', 4.5, 'text'],
    ['muted', 'bg', 4.5, 'quiet text'],
    ['low', 'bg', 4.5, 'low stock'],
    ['soon', 'bg', 4.5, 'back soon'],
    ['plateInk', 'plate', 4.5, 'plate labels'],
    ['edInk', 'edBg', 4.5, 'editorial band'],
    ['bg', 'ink', 4.5, 'buttons'],
  ]
  for (const [a, bb, need, what] of pairs)
    if (hex(colors[a]) && hex(colors[bb])) {
      const r = contrast(colors[a], colors[bb])
      if (r < need) say(`colors: ${a} on ${bb} (${what}) is ${r.toFixed(2)}:1, needs ${need}:1`)
    }
  const c = cfg.collection ?? {}
  if (!Array.isArray(c.crumb) || c.crumb.length !== 2) say('collection.crumb: two words, like ["Shop", "Tableware"]')
  else c.crumb.forEach((x, i) => str(x, `collection.crumb[${i}]`, 28))
  str(c.label, 'collection.label', 40)
  str(c.title, 'collection.title', 30)
  if (c.title && (c.title.match(/_/g) ?? []).length > 2) say('collection.title: at most one _italic_ phrase')
  str(c.pov, 'collection.pov', 240, { min: 40 })
  str(c.short, 'collection.short', 60)
  if (!Array.isArray(c.facts) || c.facts.length > 5) say('collection.facts: 0 to 5 lines')
  for (const [i, f] of (c.facts ?? []).entries()) {
    str(f.label, `collection.facts[${i}].label`, 12)
    str(f.value, `collection.facts[${i}].value`, 44)
    if (f.href) href(f.href, `collection.facts[${i}].href`)
  }
  const F = cfg.filters ?? {}
  const cats = F.categories ?? []
  if (!Array.isArray(cats) || cats.length < 1 || cats.length > 6) say('filters.categories: 1 to 6')
  const catIds = new Set()
  for (const [i, x] of cats.entries()) {
    if (!/^[a-z0-9-]+$/.test(x.id ?? '')) say(`filters.categories[${i}].id: lowercase letters, digits and dashes`)
    if (catIds.has(x.id)) say(`filters.categories[${i}].id: "${x.id}" is used twice`)
    catIds.add(x.id)
    str(x.label, `filters.categories[${i}].label`, 14)
  }
  str(F.optionLabel, 'filters.optionLabel', 12)
  const opts = F.options ?? {}
  if (!Object.keys(opts).length || Object.keys(opts).length > 8) say('filters.options: 1 to 8 (glazes, metals, colours...)')
  for (const [k, o] of Object.entries(opts)) {
    if (!/^[a-z0-9-]+$/.test(k)) say(`filters.options.${k}: ids are lowercase letters, digits and dashes`)
    str(o.label, `filters.options.${k}.label`, 18)
    if (typeof o.swatch !== 'string' || !(hex(o.swatch) || /^(linear|radial)-gradient\(/.test(o.swatch))) say(`filters.options.${k}.swatch: a #rrggbb colour or a CSS gradient`)
  }
  for (const [i, s] of (F.sort ?? []).entries()) {
    if (!['kiln', 'list', 'price-low', 'price-high'].includes(s.id)) say(`filters.sort[${i}].id: "list" (your order), "price-low" or "price-high"`)
    str(s.label, `filters.sort[${i}].label`, 22)
  }
  const photos = resolve(base, cfg.photos?.dir ?? 'photos')
  if (!existsSync(photos)) say(`photos.dir: ${relative(process.cwd(), photos)} not found (render the example stills with scripts/stills.mjs, or put your photographs there)`)
  if (cfg.photos?.rule) {
    num(cfg.photos.rule.mm, 'photos.rule.mm', 1, 1000)
    str(cfg.photos.rule.label, 'photos.rule.label', 8)
  }
  const prods = cfg.products ?? []
  if (!Array.isArray(prods) || prods.length < 2 || prods.length > 36) say('products: 2 to 36')
  const ids = new Set()
  const need = (f, at) => {
    if (existsSync(photos) && !existsSync(join(photos, f))) say(`${at}: photo ${f} is missing from ${relative(process.cwd(), photos) || '.'}`)
  }
  for (const [i, p] of prods.entries()) {
    const at = `products[${i}]`
    walkNoSale(p, at)
    if (!/^[a-z0-9-]+$/.test(p.id ?? '')) say(`${at}.id: lowercase letters, digits and dashes (it names the photos)`)
    if (ids.has(p.id)) say(`${at}.id: "${p.id}" is used twice`)
    ids.add(p.id)
    str(p.name, `${at}.name`, 34)
    if (!catIds.has(p.category)) say(`${at}.category: "${p.category}" is not one of filters.categories`)
    num(p.price, `${at}.price`, 0, 1e7)
    str(p.size, `${at}.size`, 40)
    for (const o of p.options ?? [])
      if (opts[o] && typeof p.size === 'string' && `${opts[o].label} · ${p.size}`.length > 38) say(`${at}.size: "${opts[o].label} · ${p.size}" is ${`${opts[o].label} · ${p.size}`.length} characters; the plate caption holds 38 on one line`)
    if (!Array.isArray(p.options) || !p.options.length || p.options.length > 6) say(`${at}.options: 1 to 6 ids from filters.options`)
    for (const o of p.options ?? []) {
      if (!opts[o]) say(`${at}.options: "${o}" is not in filters.options`)
      need(`${p.id}-${o}.webp`, `${at}.options "${o}"`)
    }
    for (const k of Object.keys(p.optionPrices ?? {})) {
      if (!(p.options ?? []).includes(k)) say(`${at}.optionPrices.${k}: not one of this product's options`)
      num(p.optionPrices[k], `${at}.optionPrices.${k}`, 0, 1e7)
    }
    const stock = (s, sat) => {
      if (!s || !['in', 'low', 'soon', 'out'].includes(s.state)) return say(`${sat}.state: "in", "low", "soon" or "out"`)
      if (s.state === 'low' && !/\d/.test(s.note ?? '')) say(`${sat}.note: low stock says how many ("2 left", "Sizes 52 and 54 only")`)
      if (s.state === 'soon' && !/\d/.test(s.note ?? '')) say(`${sat}.note: back soon gives a date ("Back 14 March", "Ships 3 December")`)
      if (s.state === 'out') str(s.note, `${sat}.note`, 34)
      if (s.note) str(s.note, `${sat}.note`, 34)
      if (s.action) str(s.action, `${sat}.action`, 14)
    }
    stock(p.stock, `${at}.stock`)
    for (const [k, s] of Object.entries(p.optionStock ?? {})) {
      if (!(p.options ?? []).includes(k)) say(`${at}.optionStock.${k}: not one of this product's options`)
      stock(s, `${at}.optionStock.${k}`)
    }
    // the turn: every product shows its reverse, and the label and caption name it
    if (!p.turn) say(`${at}.turn: every product needs { label, caption } and a photo of its reverse (${p.id}-turn.webp, or ${p.id}-<option>-turn.webp per option)`)
    else {
      str(p.turn.label, `${at}.turn.label`, 14)
      str(p.turn.caption, `${at}.turn.caption`, 40)
      for (const [k, v] of Object.entries(p.turn.captionByOption ?? {})) {
        if (!(p.options ?? []).includes(k)) say(`${at}.turn.captionByOption.${k}: not one of this product's options`)
        str(v, `${at}.turn.captionByOption.${k}`, 40)
      }
    }
    if (existsSync(photos))
      for (const o of p.options ?? [])
        if (!turnFile(photos, p.id, o)) say(`${at}.turn: no photo of the reverse for "${o}": add ${p.id}-${o}-turn.webp or ${p.id}-turn.webp`)
    if (p.description) str(p.description, `${at}.description`, 220)
    if (p.choices) {
      const ch = p.choices
      str(ch.label, `${at}.choices.label`, 14)
      if (ch.note) str(ch.note, `${at}.choices.note`, 24)
      if (ch.noteHref) href(ch.noteHref, `${at}.choices.noteHref`)
      if (!Array.isArray(ch.items) || !ch.items.length || ch.items.length > 12) say(`${at}.choices.items: 1 to 12`)
      for (const [k, x] of (ch.items ?? []).entries()) {
        str(x.label, `${at}.choices.items[${k}].label`, 12)
        if (x.price != null) num(x.price, `${at}.choices.items[${k}].price`, 0, 1e7)
        if (x.note) str(x.note, `${at}.choices.items[${k}].note`, 12)
      }
      const d = ch.default ?? 0
      if (!ch.items?.[d] || ch.items[d].soldOut) say(`${at}.choices.default: index of an item that is not sold out`)
    }
  }
  const e = cfg.editorial
  if (e) {
    num(e.after, 'editorial.after', 1, 36)
    str(e.label, 'editorial.label', 24)
    str(e.quote, 'editorial.quote', 150)
    str(e.by, 'editorial.by', 48)
    if (e.link) {
      str(e.link.label, 'editorial.link.label', 28)
      href(e.link.href, 'editorial.link.href')
      if (e.link.note) str(e.link.note, 'editorial.link.note', 14)
    }
    str(e.photo, 'editorial.photo', 60)
    if (e.photo) need(e.photo, 'editorial.photo')
    str(e.photoAlt, 'editorial.photoAlt', 120)
    if (e.caption) str(e.caption, 'editorial.caption', 30)
  }
  const bag = cfg.bag ?? {}
  num(bag.items ?? 0, 'bag.items', 0, 99)
  num(bag.total ?? 0, 'bag.total', 0, 1e7)
  if (bag.delivery) str(bag.delivery, 'bag.delivery', 40)
  if (cfg.promises && (!Array.isArray(cfg.promises) || cfg.promises.length > 3)) say('promises: up to 3 short lines')
  for (const [i, x] of (cfg.promises ?? []).entries()) str(x, `promises[${i}]`, 32)
  if (cfg.end) {
    str(cfg.end.text, 'end.text', 70)
    if (cfg.end.link) {
      str(cfg.end.link.label, 'end.link.label', 28)
      href(cfg.end.link.href, 'end.link.href')
    }
  }
  if (cfg.turnWord) str(cfg.turnWord, 'turnWord', 14)
  if (cfg.tour?.turn && !prods.some((p) => p.id === cfg.tour.turn)) say(`tour.turn: "${cfg.tour.turn}" is not a product id`)
  return P
}

// ---------------------------------------------------------------- markup
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const italic = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
const fmt = (m) => (n) => m.symbol + (m.decimals ? n.toFixed(m.decimals) : String(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const TURN_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 9a6 6 0 0 1 10.4-4.1M15 9a6 6 0 0 1-10.4 4.1"/><path d="M13.6 2v3h-3M4.4 16v-3h3"/></svg>'

export function render(cfg, scale, photos) {
  const W = { ...WORDS, ...(cfg.words ?? {}) }
  const money = fmt(cfg.money)
  const colors = { ...LOOKS[cfg.look], ...(cfg.colors ?? {}) }
  const T = TYPES[cfg.type]
  const vars = { ...Object.fromEntries(Object.entries(colors).map(([k, v]) => [kebab(k), v])), display: T.display, body: T.body, mono: T.mono, ...T.vars }
  const style = Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(';')
  const opts = cfg.filters.options
  const dir = 'photos/'
  const rule = cfg.photos?.rule
  const turnWord = cfg.turnWord ?? 'Turned over'
  const c = cfg.collection
  const products = cfg.products.map((p, i) => ({
    ...p,
    i,
    no: String(i + 1).padStart(2, '0'),
    options: p.options.map((o) => ({ id: o, label: opts[o].label, swatch: opts[o].swatch, src: `${dir}${p.id}-${o}.webp`, turnSrc: dir + turnFile(photos, p.id, o), caption: p.turn.captionByOption?.[o] ?? p.turn.caption })),
    turn: { label: p.turn.label, caption: p.turn.caption },
  }))
  const plate = (p) => {
    const o = p.options[0]
    const sc = scale?.files?.[`${p.id}-${o.id}.webp`] ?? (p.photoMmAcross ? { mmAcross: p.photoMmAcross, enlarged: 1 } : null)
    const ruleHtml = rule && sc ? `<span class="sck-rule sck-lab" style="width:${((rule.mm / sc.mmAcross) * 100).toFixed(2)}%" aria-hidden="true"><i></i>${esc(rule.label)}</span>` : ''
    const big = sc && sc.enlarged > 1.001 ? `<span class="sck-big sck-lab">${esc(W.larger.replace('{x}', sc.enlarged.toFixed(1)))}</span>` : ''
    const soldout = p.stock.state === 'out' && p.options.length === 1
    const st = p.stock
    const stock = st.state === 'in' ? `<span class="sck-stock in">${esc(W.inStock)}</span>` : `<span class="sck-stock ${st.state}">${esc(st.note)}${st.action ? ` · <a href="${esc(cfg.brand.notifyHref ?? cfg.brand.url ?? '#')}">${esc(st.action)}</a>` : ''}</span>`
    const sws =
      p.options.length > 1
        ? `<div class="sck-sws" role="group" aria-label="${esc(cfg.filters.optionLabel)}">${p.options.map((o, k) => `<button type="button" class="sck-sw" data-v="${o.id}" aria-pressed="${k === 0}" aria-label="${esc(o.label)}" style="background:${o.swatch}"></button>`).join('')}</div>`
        : `<div class="sck-sws"><span class="sck-sw" role="img" aria-label="${esc(p.options[0].label)}" style="background:${p.options[0].swatch}"></span></div>`
    return `<article class="sck-card${soldout ? ' soldout' : ''}" data-id="${p.id}" data-cat="${p.category}">
<div class="sck-ph">${p.options.map((x, k) => `<img class="front${k ? '' : ' on'}" data-v="${x.id}" src="${x.src}" alt="${k ? '' : `${esc(p.name)}, ${esc(x.label)}`}" width="960" height="1200" loading="lazy" decoding="async">`).join('')}${p.options.map((x, k) => `<img class="back${k ? '' : ' on'}" data-v="${x.id}" src="${x.turnSrc}" alt="${k ? '' : `${esc(p.name)}, ${esc(p.turn.label.toLowerCase())}: ${esc(x.caption)}`}" width="960" height="1200" loading="lazy" decoding="async">`).join('')}
<span class="sck-no sck-lab">${esc(W.no)} ${p.no}</span><span class="sck-turnlab sck-lab" aria-hidden="true">${esc(p.turn.label)}</span>${ruleHtml}${big}
<button type="button" class="sck-q" tabindex="-1" aria-hidden="true"><span>${esc(W.quick)}</span><span class="sck-lab">${p.options.length > 1 ? `${p.options.length} ${esc(cfg.filters.optionLabel.toLowerCase())}s` : esc(W.add)}</span></button>
<button type="button" class="sck-turnbtn" aria-pressed="false" aria-label="${esc(W.turn)}: ${esc(p.name)}">${TURN_ICON}</button></div>
<div class="sck-cap"><h3><button type="button" class="sck-name">${esc(p.name)}</button></h3><span class="sck-price">${money(p.price)}</span>
<p class="sck-mat"><span>${esc(o.label)} · ${esc(p.size)}</span><span>${esc(o.caption)}</span></p>
<div class="sck-row">${sws}${stock}</div></div></article>`
  }
  const cards = products.map(plate).join('\n')
  const e = cfg.editorial
  const ed = e
    ? `<aside class="sck-ed" aria-label="${esc(e.label)}"><div class="sck-ed-pic"><img src="${dir}${esc(e.photo)}" alt="${esc(e.photoAlt)}" loading="lazy" decoding="async">${e.caption ? `<span class="sck-no sck-lab">${esc(e.caption)}</span>` : ''}</div>
<div class="sck-ed-txt"><p class="sck-lab">${esc(e.label)}</p><blockquote class="sck-ed-q">${italic(e.quote)}</blockquote><p class="sck-ed-by">${esc(e.by)}</p>${e.link ? `<p class="sck-ed-link"><a href="${esc(e.link.href)}">${esc(e.link.label)}</a>${e.link.note ? `<span class="sck-lab">${esc(e.link.note)}</span>` : ''}</p>` : ''}</div></aside>`
    : ''
  const endText = cfg.end?.text ?? `That is every piece in ${c.crumb[1]}.`
  const end = `<div class="sck-end gone"><span class="sck-lab">${esc(W.endLabel)}</span><p class="sck-end-t">${esc(endText)}</p><button type="button" class="sck-end-all" hidden>${esc(W.showAll.replace('{n}', cfg.products.length))}</button>${cfg.end?.link ? `<a href="${esc(cfg.end.link.href)}">${esc(cfg.end.link.label)}</a>` : ''}</div>`
  const chips = (cls) => [['all', W.all, products.length], ...cfg.filters.categories.map((k) => [k.id, k.label, products.filter((p) => p.category === k.id).length])].map(([id, l, n]) => `<button type="button" class="sck-chip${cls}" data-f="${id}" aria-pressed="${id === 'all'}">${esc(l)}<span class="n">${n}</span></button>`).join('')
  const optChips = Object.entries(opts).filter(([, o]) => o.filter !== false).map(([id, o]) => `<button type="button" class="sck-chip sw" data-o="${id}" aria-pressed="false"><span class="dot" style="background:${o.swatch}"></span>${esc(o.label)}</button>`).join('')
  const sorts = cfg.filters.sort ?? []
  const n = products.length
  const bag = { items: cfg.bag?.items ?? 0, total: cfg.bag?.total ?? 0, delivery: cfg.bag?.delivery ?? '' }
  const data = {
    money: cfg.money,
    after: e?.after ?? 4,
    crumb: c.crumb[1],
    tourTurn: cfg.tour?.turn ?? null,
    endText,
    optionLabel: cfg.filters.optionLabel,
    notifyHref: cfg.brand.notifyHref ?? cfg.brand.url ?? '#',
    categories: cfg.filters.categories,
    sort: sorts,
    words: W,
    bag,
    products: products.map((p) => ({ id: p.id, i: p.i, no: p.no, name: p.name, category: p.category, price: p.price, size: p.size, optionPrices: p.optionPrices, options: p.options, stock: p.stock, optionStock: p.optionStock, turn: p.turn, desc: p.description, choices: p.choices })),
  }
  const promises = (cfg.promises ?? []).map((x) => `<span>${esc(x)}</span>`).join('')
  const body = `<div class="sck" style="${esc(style)}">
<header class="sck-topw"><div class="sck-wrap sck-top"><a class="sck-brand" href="${esc(cfg.brand.url ?? '#')}">${esc(cfg.brand.name)}</a>
<nav class="sck-nav" aria-label="Shop">${(cfg.brand.nav ?? []).map((x) => `<a href="${esc(x.href)}"${x.current ? ' aria-current="page"' : ''}>${esc(x.label)}</a>`).join('')}</nav>
<div class="sck-tools"><a class="hide-s" href="${esc(cfg.brand.searchHref ?? (cfg.brand.url ?? '') + '/search')}">${esc(W.search)}</a><span class="hide-s sck-lab" title="Prices in ${esc(cfg.money.currency)}">${esc(cfg.money.currency)}</span><a class="sck-bag" href="${esc(cfg.brand.bagHref)}">${esc(W.bag)} <span class="sck-count" aria-label="${bag.items} in bag"><span>${bag.items}</span><span class="sck-count-next" aria-hidden="true">${bag.items + 1}</span></span></a></div></div></header>
<section class="sck-wrap sck-head"><p class="sck-crumb sck-lab"><a href="${esc(cfg.brand.url ?? '#')}">${esc(c.crumb[0])}</a><span class="sl">/</span><span class="sl">${esc(c.crumb[1])}</span><span class="sck-label">${esc(c.label)}</span></p>
<h1 class="sck-title">${italic(c.title)}</h1><p class="sck-pov">${esc(c.pov)}</p>
${c.facts?.length ? `<dl class="sck-facts">${c.facts.map((f) => `<dt>${esc(f.label)}</dt><dd>${f.href ? `<a href="${esc(f.href)}">${esc(f.value)}</a>` : esc(f.value)}</dd>`).join('')}</dl>` : ''}<p class="sck-short">${esc(c.short)}</p></section>
<div class="sck-bar"><div class="sck-wrap sck-bar-in"><div class="sck-scroll"><div class="sck-chips" role="group" aria-label="${esc(W.category)}">${chips('')}</div></div>
<span class="sck-sep" aria-hidden="true"></span><div class="sck-chips sck-opts-bar" role="group" aria-label="${esc(cfg.filters.optionLabel)}"><span class="sck-lab sck-optlab">${esc(cfg.filters.optionLabel)}</span>${optChips}</div>
<div class="sck-right"><button type="button" class="sck-toggle" role="switch" aria-checked="false" data-stock><i aria-hidden="true"></i>${esc(W.stockOnly)}</button>${sorts.length > 1 ? `<label class="sck-sort">${esc(W.sort)}<select data-sortsel>${sorts.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>` : ''}<span class="sck-shown sck-lab" aria-live="polite">${n} of ${n}</span><button type="button" class="sck-filterbtn" aria-haspopup="dialog">${esc(W.filter)}<span class="k"></span></button></div></div></div>
<main class="sck-wrap sck-grid">
${cards}
${ed}
${end}
<p class="sck-empty" hidden>${esc(W.empty)}</p>
</main>
<div class="sck-scrim"></div>
<aside class="sck-sheet sck-qv" role="dialog" aria-modal="true" aria-label="${esc(W.quick)}" aria-hidden="true"><div class="sck-grab" aria-hidden="true"></div>
<div class="sck-sh-top"><span class="sck-lab sck-qv-no"></span><button type="button" class="sck-close">${esc(W.close)}</button></div>
<div class="sck-sh-img"><figure><img class="sck-qv-front" alt=""><figcaption class="sck-lab">${esc(W.front)}</figcaption></figure><figure><img class="sck-qv-back" alt=""><figcaption class="sck-lab sck-qv-backlab">${esc(turnWord)}</figcaption></figure></div>
<div class="sck-sh-body"><div class="sck-sh-name"><h2 class="sck-qv-name"></h2><span class="sck-price sck-qv-price"></span></div><p class="sck-sh-desc sck-qv-desc"></p>
<div class="sck-opt sck-qv-opt"></div><div class="sck-opt sck-qv-ch"></div><div class="sck-opt sck-optstock sck-qv-stock"></div>
<button type="button" class="sck-add"></button>
<div class="sck-slip" role="status"><div class="sck-slip-h" tabindex="-1"><span>${esc(W.inBag)}</span><span class="sck-lab sck-slip-n"></span></div>
<div class="sck-slip-line"><img class="sck-slip-img" alt=""><p><span class="sck-slip-name" style="color:var(--ink)"></span><span class="sck-slip-what"></span></p><span class="sck-slip-price"></span></div>
<div class="sck-slip-tot"><span>${esc(W.total)}</span><span class="sck-slip-total"></span></div>${bag.delivery ? `<p class="sck-slip-del">${esc(bag.delivery)}</p>` : ''}
<div class="sck-slip-act"><button type="button" class="sck-keep">${esc(W.keep)}</button><a href="${esc(cfg.brand.checkoutHref)}">${esc(W.checkout)}</a></div></div>
${promises ? `<p class="sck-promises">${promises}</p>` : ''}</div></aside>
<aside class="sck-sheet sck-fs" role="dialog" aria-modal="true" aria-label="${esc(W.filter)}" aria-hidden="true"><div class="sck-grab" aria-hidden="true"></div>
<div class="sck-sh-top"><span class="sck-lab">${esc(W.filter)} · ${esc(c.crumb[1])}</span><button type="button" class="sck-close">${esc(W.close)}</button></div>
<div class="sck-sh-body"><div class="sck-fs-group"><h3>${esc(W.category)}</h3><div class="sck-fs-list">${chips('')}</div></div>
<div class="sck-fs-group"><h3>${esc(cfg.filters.optionLabel)}</h3><div class="sck-fs-list">${optChips}</div></div>
<div class="sck-fs-group"><h3>${esc(W.availability)}</h3><button type="button" class="sck-toggle" role="switch" aria-checked="false" data-stock><i aria-hidden="true"></i>${esc(W.stockOnly)}</button></div>
${sorts.length > 1 ? `<div class="sck-fs-group"><h3>${esc(W.sort)}</h3><div class="sck-fs-list">${sorts.map((s, k) => `<button type="button" class="sck-chip" data-sort="${s.id}" aria-pressed="${k === 0}">${esc(s.label)}</button>`).join('')}</div></div>` : ''}</div>
<div class="sck-fs-foot"><button type="button" class="clear sck-fs-clear">${esc(W.clear)}</button><button type="button" class="show sck-fs-show">${esc(W.show)} <span class="sck-fs-show-n">${n}</span> ${esc(W.pieces)}</button></div></aside>
<script type="application/json" class="sck-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`
  return { body, fonts: T.fonts, colors }
}

export function build(input, outDir) {
  const file = resolve(input)
  const cfg = JSON.parse(readFileSync(file, 'utf8'))
  const base = dirname(file)
  const problems = check(cfg, base)
  if (problems.length) {
    const e = new Error(`${problems.length} problem${problems.length > 1 ? 's' : ''} in ${relative(process.cwd(), file)}:\n  - ${problems.join('\n  - ')}`)
    e.problems = problems
    throw e
  }
  const photos = resolve(base, cfg.photos?.dir ?? 'photos')
  const scaleFile = join(photos, 'scale.json')
  const scale = existsSync(scaleFile) ? JSON.parse(readFileSync(scaleFile, 'utf8')) : null
  const { body, fonts, colors } = render(cfg, scale, photos)
  const css = readFileSync(join(KIT, 'style.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const title = `${cfg.collection.crumb[1]} · ${cfg.brand.name}`
  const desc = cfg.collection.pov
  const page = `<!doctype html>
<html lang="${esc(cfg.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${colors.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>html,body{margin:0;background:${colors.bg}}
${css}</style>
</head>
<body>
${body}
<script>${js}</script>
</body>
</html>
`
  const embed = `<!-- Shop Collection Kit: paste where the collection goes. Everything is scoped under .sck; the photos/ folder goes next to the page. -->
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
${body}
<script>${js}</script>
`
  mkdirSync(join(outDir, 'photos'), { recursive: true })
  const files = new Set()
  for (const p of cfg.products) {
    for (const o of p.options) {
      files.add(`${p.id}-${o}.webp`)
      files.add(turnFile(photos, p.id, o))
    }
  }
  if (cfg.editorial?.photo) files.add(cfg.editorial.photo)
  for (const f of files) copyFileSync(join(photos, f), join(outDir, 'photos', f))
  writeFileSync(join(outDir, 'index.html'), page)
  writeFileSync(join(outDir, 'embed.html'), embed)
  return { index: join(outDir, 'index.html'), embed: join(outDir, 'embed.html'), products: cfg.products.length, photos: files.size }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((a) => !a.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs page.json [out]')
    process.exit(1)
  }
  try {
    const r = build(input, resolve(out))
    console.log(`shop collection kit: wrote ${relative(process.cwd(), r.index)} and ${relative(process.cwd(), r.embed)} (${r.products} products, ${r.photos} photos)`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
