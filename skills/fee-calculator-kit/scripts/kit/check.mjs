// Fee Calculator Kit: serves the built page and opens it in headless Chrome
// at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and
// 1440, with "now" pinned to preview.now. At each size it fails on:
//   - script errors, links without an address, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px),
//     the amount field under 16 px
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px), figures included; the comparison
//     column's grey figures are reported on their own line (4.5:1)
//   - text cut off or running off the screen, buttons under 44 px on a phone
//   - the entrance not settling, or reduced motion that is not settled from
//     the start or that rolls a digit
//   - the layout moving when the amount changes (20 amounts, min to max)
//   - the phone's result bar showing while the real result is on screen, or
//     missing while it is off screen
//   - a rate time later than "now", or a time on the page that disagrees
//     with the preview clock
//   - a keyboard focus that can't be seen (it presses Tab through)
// Once, at 1440:
//   - the property test: a few hundred random amounts across min..max (and
//     every toggle), typed in the page's own number format and in the other
//     one, each recomputed by scripts/kit/reference.mjs (exact fractions,
//     separate code) and compared with every figure the page shows, the
//     per-100 bar, the enlarged strip and the difference sentence
//   - input edge cases: empty, below min, above max (a message, never a
//     silent clamp), a non-numeric paste, a negative, too many decimals
//   - the live region: it says the received amount, once typing pauses
//   - the build's refusals: a rate time after preview.now, and a comparison
//     column without a source or a collected date
//
//   node scripts/check.mjs out/index.html [--cases 300]
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { reference } from './reference.mjs'
import { validate } from './schema.mjs'

const RUNS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [390, 844, true],
  [1440, 900, true],
]

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const root = document.querySelector('.fk')
  const phone = root.getBoundingClientRect().width < 760
  const min = phone ? 16 : 14
  const LABEL = '.fk-lbl, .fk-zl, .fk-tx, .fk-pin, sup, .fk-nh b'
  const skip = (el) => el.closest('[aria-hidden="true"]:not(.fk-mbar):not(.fk-zoom), [hidden], .fk-sr, script, style, .fk-tl, .fk-col')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  let texts = [...root.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  // the figures draw their digits in hidden columns; measure the figure itself
  const figs = [...root.querySelectorAll('[data-k]')].filter((el) => shown(el) && !el.closest('.fk-tl'))
  texts = texts.concat(figs.filter((f) => !texts.includes(f)))
  const name = (el) => '"' + (el.getAttribute('data-v') || el.textContent).trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of root.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const input = root.querySelector('#fk-amt')
  if (parseFloat(getComputedStyle(input).fontSize) < 16) say('the amount field is under 16px (phones zoom in)')
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]).slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const ratioOf = (el) => { const fg = parse(getComputedStyle(el).color); if (!fg || fg[3] === 0) return null; const bg = behind(el); const a = lum(over(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
  let pairs = 0, worst = 99, bank = null
  for (const el of texts) {
    const r = ratioOf(el)
    if (r == null) continue
    const s = getComputedStyle(el)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of root.querySelectorAll('.fk-bk [data-k], .fk-bkr [data-k]')) {
    if (!shown(el)) continue
    const r = ratioOf(el)
    bank = bank == null ? r : Math.min(bank, r)
    if (r < 4.5) say('comparison figure contrast ' + r.toFixed(2) + ':1 (needs 4.5:1): ' + name(el))
  }
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.fk-n, .fk-col, svg, input, .fk-tl, .fk-bar')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el)) }
  for (const el of root.querySelectorAll('.fk-tl .fk-pin, .fk-tl .fk-tx, .fk-tl .fk-zl')) { if (!shown(el)) continue; const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) say('a time-strip label runs off the screen: ' + name(el)) }
  // the time strip's pins never overlap each other
  const pins = [...root.querySelectorAll('.fk-tl .fk-pin')].map((p) => p.getBoundingClientRect())
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) { const a = pins[i], b = pins[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) say('two time-strip labels overlap') }
  // a figure fits its cell
  for (const el of figs) { const cell = el.closest('td, dd, li, b, .fk-tline'); if (!cell) continue; const r = el.getBoundingClientRect(), c = cell.getBoundingClientRect(); if (r.right > c.right + 2 || r.left < c.left - 2) say('a figure runs out of its cell: ' + name(el)) }
  if (phone) for (const b of root.querySelectorAll('button')) if (shown(b) && b.getBoundingClientRect().height < 44) say('a button is under 44px tall on a phone: ' + name(b))
  const text = root.innerText
  if (/NaN|undefined|Infinity/.test(text)) say('the section shows NaN, undefined or Infinity')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, bank: bank && Math.round(bank * 100) / 100 }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.fk a[href], .fk button, .fk input')].filter((el) => el.getClientRects().length).length`)
  await ev(`document.activeElement && document.activeElement.blur(); const r = document.querySelector('.fk'); r.setAttribute('tabindex', '-1'); r.focus({ preventScroll: true }); r.removeAttribute('tabindex')`)
  const seen = new Set()
  let reached = 0
  for (let i = 0; i < count + 1; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.fk')) return null
      const s = getComputedStyle(el)
      let ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1
      if (el.id === 'fk-amt') { const f = getComputedStyle(el.closest('.fk-field')); ring = f.borderBottomColor !== getComputedStyle(document.querySelector('.fk')).color || ring }
      return { ring, visible: el.id === 'fk-amt' || el.matches(':focus-visible'), name: (el.textContent || el.getAttribute('aria-label') || el.id || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    reached++
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  if (count && !reached) problems.push('Tab never reaches the section')
  return problems
}

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__fkErr=[];addEventListener("error",function(e){__fkErr.push(e.message)})' })
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  for (let i = 0; i < 100 && !(await ev('!!window.FeeKit')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.FeeKit'))) throw new Error(`the page did not start: ${(await ev('window.__fkErr')).join(' | ') || errors.join(' | ') || 'unknown'}`)
  await ev('window.FeeKit.ready')
  return { tab, ev, errors: { list: errors, page: () => ev('window.__fkErr') } }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------- the property test ---------------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
const big = (s, dp) => { const [i, f = ''] = String(s).split('.'); return BigInt(i + (f + '0'.repeat(dp)).slice(0, dp)) }
function casesFor(c, n) {
  const r = rng(20261109)
  const fd = c.from.decimals
  const lo = big(c.amount.min, fd), hi = big(c.amount.max, fd)
  const span = Number(hi - lo)
  const out = new Set([lo, hi, big(c.amount.start, fd)].map(String))
  // half-way cases: amounts where a percentage fee lands exactly on .5 of a cent
  for (const row of c.fees) for (const k of row.cases) if (k.percent) {
    const p = big(k.percent, 4) // percent x 10^4; fee(minor) = amount x p / 10^6
    for (let a = lo; a < lo + 400000n && out.size < 40; a += 1n) if ((a * p) % 1000000n === 500000n) out.add(String(a))
  }
  while (out.size < n) {
    const u = r()
    const a = u < 0.5 ? lo + BigInt(Math.floor(r() * span)) : BigInt(Math.max(Number(lo), Math.min(Number(hi), Math.round(Math.exp(Math.log(Number(lo)) + r() * (Math.log(Number(hi)) - Math.log(Number(lo))))))))
    out.add(String(a))
  }
  const combos = (c.toggles ?? []).reduce((all, t) => all.flatMap((x) => t.options.map((o) => ({ ...x, [t.id]: o.value }))), [{}])
  return [...out].map((a, i) => ({ amount: a, toggles: combos[i % combos.length], style: ['own', 'other', 'digits'][i % 3] }))
}

const PROPERTY = (cases) => `(async () => {
  const E = window.FeeEngine
  const c = JSON.parse(document.querySelector('.fk script.fk-cfg').textContent)
  const fd = c.from.decimals
  const decimalOf = (loc) => new Intl.NumberFormat(loc).formatToParts(1.5).find((p) => p.type === 'decimal').value
  const own = decimalOf(c.locale)
  const other = own === ',' ? 'en-US' : 'de-DE'
  const asText = (minor, style) => {
    const s = String(minor).padStart(fd + 1, '0')
    const str = fd ? s.slice(0, -fd) + '.' + s.slice(-fd) : s
    if (style === 'digits') return fd ? s.slice(0, -fd) + own + s.slice(-fd) : s
    return new Intl.NumberFormat(style === 'own' ? c.locale : other, { minimumFractionDigits: fd, maximumFractionDigits: fd }).format(str)
  }
  const out = []
  for (const k of ${JSON.stringify(cases)}) {
    for (const [id, v] of Object.entries(k.toggles)) if (FeeKit.state().toggles[id] !== v) FeeKit.toggle(id, v)
    const text = asText(BigInt(k.amount), k.style)
    FeeKit.type(text)
    FeeKit.settle()
    const shown = FeeKit.shown()
    const data = {}
    for (const el of document.querySelectorAll('.fk [data-k]')) data[el.getAttribute('data-k')] = el.getAttribute('data-v')
    const flex = {}
    for (const el of document.querySelectorAll('.fk [data-b]')) flex[el.getAttribute('data-b')] = el.style.flexGrow
    const sayEl = document.querySelector('.fk-keep .fk-say')
    let say = null
    if (sayEl) { const cl = sayEl.cloneNode(true); for (const f of cl.querySelectorAll('[data-k]')) f.replaceWith(document.createTextNode(f.getAttribute('data-v'))); say = cl }
    out.push({ amount: k.amount, toggles: k.toggles, text, state: FeeKit.state().amount, invalid: FeeKit.state().invalid, shown, data, flex, word: (document.querySelector('[data-w="diffw"]') || {}).textContent, say: say ? say.textContent.replace(/\\s+/g, ' ').trim() : null })
  }
  return out
})()`

/** the expected strings for one reading, formatted in the page with Intl (not the engine) */
const EXPECT = (rows) => `(() => {
  const c = JSON.parse(document.querySelector('.fk script.fk-cfg').textContent)
  const M = (minor, cur) => { const neg = BigInt(minor) < 0n; const v = (neg ? -BigInt(minor) : BigInt(minor)).toString().padStart(cur.decimals + 1, '0'); const s = cur.decimals ? v.slice(0, -cur.decimals) + '.' + v.slice(-cur.decimals) : v; return new Intl.NumberFormat(c.locale, { style: 'currency', currency: cur.code, minimumFractionDigits: cur.decimals, maximumFractionDigits: cur.decimals }).format(s) }
  const D = (units, dp) => { const v = String(units).padStart(dp + 1, '0'); return new Intl.NumberFormat(c.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(dp ? v.slice(0, -dp) + '.' + v.slice(-dp) : v) }
  const P = (bp) => { const v = String(bp).padStart(5, '0'); return new Intl.NumberFormat(c.locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v.slice(0, -4) + '.' + v.slice(-4)) }
  return ${JSON.stringify(rows)}.map((x) => {
    const e = {}
    x.us.fees.forEach((f, i) => { e['f' + i] = M(f, c.from) })
    e.m = M(x.us.margin, c.from); e.r = D(x.us.rateUnits, c.rate.decimals); e.rr = e.r
    e.recv = M(x.us.recv, c["to"]); e.mrecv = e.recv
    e.tot = M(x.us.total, c.from) + ' \\u00b7 ' + P(x.totalBp)
    e.pa = M(x.per100.arrive, c.from); e.pf = M(x.per100.fees, c.from); e.pm = M(x.per100.margin, c.from); e.pz = String(x.per100.zoom)
    if (x.bk) {
      x.bk.fees.forEach((f, i) => { e['b' + i] = M(f, c.from) })
      e.bm = M(x.bk.margin, c.from); e["br"] = D(x.bk.rateUnits, c.rate.decimals); e.rb = e["br"]
      e.brecv = M(x.bk.recv, c["to"]); e.btot = M(x.bk.total, c.from) + ' \\u00b7 ' + P(x.bkTotalBp)
      e.diff = M(BigInt(x.diff) < 0n ? -BigInt(x.diff) : x.diff, c["to"])
      if (x.diffSend != null) e.diffs = M(x.diffSend, c.from)
    }
    return e
  })
})()`

const ser = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? v.toString() : v)))

async function property(ev, c, n) {
  const problems = []
  const cases = casesFor(c, n)
  const read = []
  for (let i = 0; i < cases.length; i += 60) read.push(...(await ev(PROPERTY(cases.slice(i, i + 60)))))
  const refs = read.map((x) => reference(c, BigInt(x.amount), x.toggles))
  const expect = await ev(EXPECT(refs.map(ser)))
  let lines = 0
  const fails = []
  read.forEach((x, i) => {
    const ref = refs[i], e = expect[i]
    const bad = (m) => { if (fails.length < 12) fails.push(`${x.text} (${JSON.stringify(x.toggles)}): ${m}`) }
    if (x.state !== x.amount) { bad(`the page read ${x.state}, not ${x.amount}`); return }
    if (x.invalid) { bad(`the page called a valid amount invalid (${x.invalid})`); return }
    for (const [k, want] of Object.entries(e)) {
      lines++
      if (x.data[k] !== want) bad(`${k} is "${x.data[k]}", expected "${want}"`)
      else if (x.shown[k] !== want) bad(`${k} says "${want}" but its digits show "${x.shown[k]}"`)
    }
    const p = ref.per100
    const z = BigInt(p.zoom) * 10n ** BigInt(c.from.decimals)
    const flex = { a: p.arrive, f: p.fees, m: p.margin, za: z - p.fees - p.margin, zf: p.fees, zm: p.margin }
    for (const [k, v] of Object.entries(flex)) { lines++; if (x.flex[k] !== String(v)) bad(`bar ${k} is ${x.flex[k]}, expected ${v}`) }
    if (ref.bk) {
      lines++
      const word = ref.diff < 0n ? (c.words?.less ?? 'less') : (c.words?.more ?? 'more')
      if (x.word !== word) bad(`the difference says "${x.word}", expected "${word}"`)
      const norm = (t) => t.replace(/\s+/g, ' ')
      if (!x.say.includes(norm(e.diff + ' ' + word))) bad(`the difference sentence does not carry ${e.diff} ${word}: ${x.say}`)
      if (e.diffs && !x.say.includes(norm(e.diffs))) bad(`the difference sentence does not carry ${e.diffs}`)
    }
  })
  problems.push(...fails)
  return { problems, info: `${read.length} amounts, ${lines} figures recomputed independently, ${fails.length ? 'mismatches' : 'all equal'}` }
}

/* ---------------- edge cases and the live region ---------------- */
const EDGES = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const input = document.querySelector('#fk-amt'), msg = document.querySelector('#fk-msg'), live = document.querySelector('[data-live]')
  const c = JSON.parse(document.querySelector('.fk script.fk-cfg').textContent)
  const own = new Intl.NumberFormat(c.locale).formatToParts(1.5).find((p) => p.type === 'decimal').value
  const figs = () => [...document.querySelectorAll('.fk [data-k]')].map((e) => e.getAttribute('data-v')).join('|')
  const reset = async () => { FeeKit.type(c.amount.start.replace('.', own)); FeeKit.blur(); await wait(50) }
  const type = (t) => { input.value = t; input.dispatchEvent(new Event('input')) }
  const pasteText = (t) => { const d = new DataTransfer(); d.setData('text', t); input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })) }
  const expect = async (label, act, code, opts = {}) => {
    await reset()
    const before = figs(), value0 = input.value
    act()
    await wait(opts.wait ?? 60)
    const m = msg.textContent.trim()
    if (!m) out.push(label + ': no message')
    if (opts.invalid !== false && input.getAttribute('aria-invalid') !== 'true') out.push(label + ': the field is not marked aria-invalid')
    if (figs() !== before) out.push(label + ': the figures changed (they must keep the last good amount)')
    if (opts.keep && input.value !== value0) out.push(label + ': the field took the pasted text')
    if (opts.typed != null && input.value !== opts.typed) out.push(label + ': the field was changed to "' + input.value + '" (no silent clamping)')
    if (/NaN|undefined/.test(document.querySelector('.fk').innerText)) out.push(label + ': NaN or undefined on the page')
    return m
  }
  await expect('empty', () => type(''), 'empty')
  const lowMinor = BigInt(c.amount.min.replace('.', '')) - 1n
  const lowS = String(lowMinor).padStart(c.from.decimals + 1, '0')
  const minT = c.from.decimals ? lowS.slice(0, -c.from.decimals) + own + lowS.slice(-c.from.decimals) : lowS
  const maxT = String(Math.floor(Number(c.amount.max)) + 1)
  type(minT); await wait(200)
  if (msg.textContent.trim()) out.push('below min: the message shows while typing (it should wait for a pause)')
  await expect('below min', () => type(minT), 'min', { wait: 900, typed: minT })
  await expect('above max', () => type(maxT), 'max', { wait: 900, typed: maxT })
  await expect('non-numeric paste', () => pasteText('call us'), 'nonnumeric', { keep: true, invalid: false })
  await expect('non-numeric typing', () => type('12a'), 'nonnumeric')
  await expect('negative', () => type('-50'), 'negative')
  await expect('negative paste', () => pasteText('(50.00)'), 'negative', { keep: true, invalid: false })
  await expect('too many decimals', () => type('12' + own + '345'), 'decimals')
  // a good paste in the other convention is read and reformatted
  await reset()
  pasteText(own === ',' ? 'EUR 2,500.50' : '2.500,50 EUR')
  await wait(60)
  if (FeeKit.state().amount !== String(250050n * (10n ** BigInt(c.from.decimals)) / 100n)) out.push('a pasted amount in the other number format was not read (' + FeeKit.state().amount + ')')
  if (msg.textContent.trim()) out.push('a good paste left a message: ' + msg.textContent)
  // the live region speaks once typing pauses, and says the received amount
  await reset(); await wait(800)
  live.textContent = ''
  type(own === ',' ? '3000' + own + '00' : '3000.00')
  await wait(250)
  if (live.textContent) out.push('the live region spoke before typing paused')
  await wait(700)
  const recv = document.querySelector('[data-k="recv"]').getAttribute('data-v')
  if (!live.textContent.includes(recv)) out.push('the live region does not say the received amount (' + live.textContent + ')')
  await reset()
  return { problems: out, said: live.textContent }
})()`

export async function check(input, opts = {}) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const html = readFileSync(file, 'utf8')
  const m = /<script type="application\/json" class="fk-cfg">([\s\S]*?)<\/script>/.exec(html)
  if (!m) throw new Error(`${input} is not a Fee Calculator Kit page`)
  const c = JSON.parse(m[1])
  const server = await serve(dirname(file))
  const base = `${server.url}${relative(dirname(file), file)}?fk-now=${encodeURIComponent(c.preview.now)}`
  let failed = 0
  const report = (tag, problems, info) => {
    if (problems.length) { failed++; console.log(`✗ ${tag}: ${info}`); for (const p of problems) console.log(`    - ${p}`) }
    else console.log(`✓ ${tag}: ${info}`)
  }
  try {
    for (const [w, h, reduce] of RUNS) {
      const chrome = await launch({ width: Math.max(w, 800), height: h })
      const problems = []
      let info = ''
      try {
        const { tab, ev, errors } = await open(chrome, base, w, h, reduce)
        // entrance
        if (reduce && !(await ev('document.querySelector(".fk").hasAttribute("data-entered")'))) problems.push('under reduced motion the section is not settled from the start')
        await ev(`scrollTo(0, document.querySelector('.fk-sheet').getBoundingClientRect().top + scrollY - 40)`)
        await wait((reduce ? 0 : await ev('FeeKit.settleMs')) + 600)
        if (!(await ev('document.querySelector(".fk").hasAttribute("data-settled")'))) problems.push('the section did not report settled')
        // a digit roll: moving without reduced motion, instant with it
        const own = await ev(`new Intl.NumberFormat(JSON.parse(document.querySelector('.fk script.fk-cfg').textContent).locale).formatToParts(1.5).find((p) => p.type === 'decimal').value`)
        const t0 = c.amount.start.split('.')
        await ev(`FeeKit.type(${JSON.stringify(String(Number(t0[0]) * 2 + 7) + (t0[1] ? own + t0[1] : ''))})`)
        await wait(90)
        const rolling = await ev(`[...document.querySelectorAll('.fk-dg')].some((d) => { const v = parseFloat(d.style.getPropertyValue('--d')); return Math.abs(v - Math.round(v)) > 0.01 })`)
        if (reduce && rolling) problems.push('under reduced motion a digit still rolls')
        if (!reduce && !rolling) problems.push('changing the amount did not roll any digit')
        await wait(900)
        await ev(`FeeKit.type(${JSON.stringify(c.amount.start.replace('.', own))}); FeeKit.blur(); FeeKit.settle()`)
        // the layout holds still while the amount changes
        const shift = await ev(`(() => {
          const c = JSON.parse(document.querySelector('.fk script.fk-cfg').textContent)
          const own = new Intl.NumberFormat(c.locale).formatToParts(1.5).find((p) => p.type === 'decimal').value
          const sheet = document.querySelector('.fk-sheet'), total = document.querySelector('.fk-total'), cost = document.querySelector('.fk-cost')
          const at = () => [sheet.offsetHeight, Math.round(total.getBoundingClientRect().top - sheet.getBoundingClientRect().top), Math.round(cost.getBoundingClientRect().top - sheet.getBoundingClientRect().top), document.documentElement.scrollWidth].join(',')
          const first = at(), seen = []
          const fd = c.from.decimals, lo = Number(c.amount.min), hi = Number(c.amount.max)
          for (let i = 0; i <= 19; i++) {
            const v = i === 0 ? lo : i === 19 ? hi : Math.round(lo * Math.pow(hi / lo, i / 19) * 100) / 100
            FeeKit.type(v.toFixed(fd).replace('.', own)); FeeKit.settle()
            const now = at(); if (now !== first) seen.push(v + ': ' + now)
          }
          FeeKit.type(c.amount.start.replace('.', own)); FeeKit.blur(); FeeKit.settle()
          return { first, seen }
        })()`)
        if (shift.seen.length) problems.push(`the layout moves as the amount changes (sheet height, total row, cost row, page width ${shift.first}; then ${shift.seen.slice(0, 3).join('; ')})`)
        // the clock: the rate is not from the future and every time on the page agrees with "now"
        const clk = await ev(`(() => { const s = FeeKit.state(); const E = FeeEngine; const c = JSON.parse(document.querySelector('.fk script.fk-cfg').textContent); return { now: s.now, asOf: s.asOf, asText: document.querySelector('[data-asof]').textContent, nowText: document.querySelector('.fk-zl span').textContent, want: E.clock(s.now, c.arrival.cutoffZone), wantAs: E.clock(s.asOf, c.arrival.cutoffZone), tl: +document.querySelector('.fk-tl').getAttribute('data-now') } })()`)
        if (clk.asOf > clk.now) problems.push(`the rate time (${clk.asText}) is later than now (${clk.want})`)
        if (clk.asText !== clk.wantAs) problems.push(`the rate time reads ${clk.asText}, expected ${clk.wantAs}`)
        if (!clk.nowText.startsWith(clk.want) || clk.tl !== clk.now) problems.push(`the time strip's "now" (${clk.nowText}) is not the page's clock (${clk.want})`)
        // the phone's result bar
        const phone = await ev(`document.querySelector('.fk').getBoundingClientRect().width < 760`)
        if (phone) {
          const bar = await ev(`(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms))
            const mb = document.querySelector('.fk-mbar'), res = document.querySelector('.fk-total'), sheet = document.querySelector('.fk-sheet')
            const out = []
            scrollTo(0, Math.max(0, sheet.getBoundingClientRect().top + scrollY - 360)); dispatchEvent(new Event('scroll')); await wait(400)
            const resIn = () => { const r = res.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - mb.offsetHeight }
            if (resIn()) out.push('setup: the result is already on screen at the top of the sheet')
            else if (!mb.hasAttribute('data-shown')) out.push('the result bar is hidden while the result is off screen')
            scrollTo(0, res.getBoundingClientRect().top + scrollY - innerHeight / 3); dispatchEvent(new Event('scroll')); await wait(400)
            if (!resIn()) out.push('setup: could not bring the result on screen')
            else if (mb.hasAttribute('data-shown')) out.push('the result bar shows while the real result is on screen')
            const a = mb.getBoundingClientRect(), b = res.getBoundingClientRect()
            if (mb.hasAttribute('data-shown') && a.top < b.bottom && b.top < a.bottom) out.push('the result bar covers the result')
            return out
          })()`)
          problems.push(...bar)
        }
        const r = await ev(AUDIT)
        problems.push(...r.problems)
        problems.push(...(await focusRings(tab, ev)))
        const errs = [...errors.list, ...(await errors.page())]
        if (errs.length) problems.push(`script errors: ${errs.join(' | ')}`)
        info = `${r.pairs} text pairs, lowest contrast ${r.worst}× its minimum${r.bank ? `, comparison figures ${r.bank}:1` : ''}`
        if (w === 1440 && !reduce) {
          const p = await property(ev, c, Number(opts.cases ?? 300))
          report('property test (1440)', p.problems, p.info)
          const e = await ev(EDGES)
          report('amount edge cases and live region (1440)', e.problems, `empty, below min, above max, non-numeric paste and typing, negative typed and pasted, too many decimals, a paste in the other format; the live region said "${e.said}"`)
        }
      } catch (e) {
        problems.push(e.message)
      } finally {
        await chrome.close()
      }
      report(`${w}x${h}${reduce ? ' reduced motion' : ''}`, problems, info)
    }
    // the build refuses a rate from the future and a comparison without a dated source
    const refusals = []
    const future = structuredClone(c)
    const [d, t] = c.preview.now.split('T')
    const [hh, mm] = t.split(':').map(Number)
    const later = new Date(Date.UTC(2000, 0, 1, hh, mm + 1))
    future.rate.asOf = `${d}T${String(later.getUTCHours()).padStart(2, '0')}:${String(later.getUTCMinutes()).padStart(2, '0')}`
    if (!validate(future).some((p) => p.startsWith('rate.asOf') && p.includes('later than preview.now'))) refusals.push('a rate time one minute after preview.now is not refused')
    if (c.compare) {
      for (const k of ['source', 'collected']) {
        const x = structuredClone(c); delete x.compare[k]
        if (!validate(x).some((p) => p.startsWith(`compare.${k}`))) refusals.push(`a comparison without compare.${k} is not refused`)
      }
      const y = structuredClone(c); y.compare.margin = 3.2
      if (!validate(y).some((p) => p.startsWith('compare.margin'))) refusals.push('a margin given as a number (not a string) is not refused')
    }
    report('build refusals', refusals, 'rate time after preview.now, comparison without source, without collected date, money as a float: all refused')
  } finally {
    server.close()
  }
  return failed
}

export async function main(argv = process.argv.slice(2)) {
  const args = argv.filter((a) => !a.startsWith('--'))
  const ci = argv.indexOf('--cases')
  const [input] = args
  if (!input) { console.log('usage: node scripts/check.mjs out/index.html [--cases 300]'); process.exit(1) }
  try {
    const failed = await check(input, { cases: ci >= 0 ? argv[ci + 1] : 300 })
    if (failed) { console.log(`${failed} check${failed > 1 ? 's' : ''} failed`); process.exit(1) }
    console.log('all checks passed')
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
