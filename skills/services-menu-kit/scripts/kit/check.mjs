// Services Menu Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, with reduced motion at 390 and 1440, and
// with JavaScript off at 390 and 1440. It fails on:
//   - script errors, links without an address, ids used twice
//   - sideways scrolling, at any point down the page, before and after a choice
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is behind it (4.5:1, or 3:1
//     from 24 px), measured with no choice and with one that dims services
//   - text cut off by its box or running off the screen
//   - broken compounds: a line that breaks inside "40-page", "out-of-date",
//     "2 hours" or "$8,000 a month", and a last line of one short word
//   - a text face whose hyphen is drawn as wide as its en dash (it reads as
//     a dash), once the fonts have loaded
//   - arithmetic: a service whose "from" is above its "typical", a set whose
//     printed totals are not the sum of its printed rows less the overlap
//   - the chooser: every budget and deadline pair is chosen in turn and each
//     service's mark, sentence and the live tally must agree with the rules
//     worked out again here; the address must carry the choice and a page
//     opened from that address must show it; Clear must reset both; arrow
//     keys must move a choice; the tally must be a polite live region
//   - reduced motion that still animates
//   - a keyboard focus that can't be seen (Tab through the page)
//   - with JavaScript off: the chooser showing (it cannot work), a service or
//     its "skip it if" missing from the HTML, a verdict showing
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const RUNS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [390, 844, 'reduce'],
  [1440, 900, 'reduce'],
  [390, 844, 'nojs'],
  [1440, 900, 'nojs'],
]

const LIB = `
  window.__sm = {
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    name: (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"',
    num: (s) => Number(String(s).replace(/[^\\d]/g, '')),
  }
`

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.sm-lbl, .sm-tag, .sm-cols, .sm-keys, .sm-code'
  const skip = (el) => el.closest('.sm-sr, [hidden]') || (el.closest('[aria-hidden="true"]') && !el.closest('.sm-pm, .sm-tag, .sm-keys, .sm-cols'))
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.querySelectorAll('.sm *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = __sm.name
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('.sm a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  const ids = new Map()
  for (const el of document.querySelectorAll('[id]')) { if (ids.has(el.id)) say('the id #' + el.id + ' is used twice'); ids.set(el.id, el) }
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
    return null
  }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let bg = [255, 255, 255]
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const opacity = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o }
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    fg[3] *= opacity(el)
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, ratio / need)
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of document.querySelectorAll('.sm *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim()) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
  }
  // the parts of a service or a set never sit on top of each other
  for (const box of document.querySelectorAll('.sm-e, .sm-set, .sm-ch, .sm-mast, .sm-choose')) {
    const kids = [...box.querySelectorAll(':scope > *, :scope > .sm-price > *')].filter((k) => !k.matches('.sm-price') && shown(k) && k.textContent.trim() && !k.closest('.sm-sr'))
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) {
      const r1 = kids[a].getBoundingClientRect(), r2 = kids[b].getBoundingClientRect()
      const x = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), y = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top)
      if (x > 2 && y > 2) say(name(kids[a]) + ' overlaps ' + name(kids[b]))
    }
  }
  for (const el of texts) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

/** Lines that break where they must not, and one-word runts. */
const BREAKS = `(() => {
  const out = []
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  const shown = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden], .sm-sr')
  // a no-break span drawn on two lines
  let joins = 0
  for (const el of document.querySelectorAll('.sm .sm-nb')) {
    if (!shown(el)) continue
    joins++
    const tops = new Set([...el.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))
    if (tops.size > 1) say('"' + el.textContent + '" breaks across two lines')
  }
  // any hyphen or figure+word pair the line breaker split, joined or not
  const blocks = [...document.querySelectorAll('.sm p, .sm dd, .sm li, .sm h2, .sm h3, .sm h4, .sm th, .sm td')].filter(shown)
  let words = 0, runts = 0
  for (const b of blocks) {
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT)
    const chars = []
    for (let n; (n = walker.nextNode()); ) {
      if (!n.parentElement || !shown(n.parentElement)) continue
      for (let i = 0; i < n.length; i++) chars.push([n, i])
    }
    const top = ([n, i]) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getClientRects()[0]; return q ? Math.round(q.top + q.height / 2) : null }
    const ch = ([n, i]) => n.data[i]
    for (let k = 1; k < chars.length - 1; k++) {
      const c = ch(chars[k])
      if (c === '-' && /\\w/.test(ch(chars[k - 1])) && /\\w/.test(ch(chars[k + 1]))) {
        const a = top(chars[k]), z = top(chars[k + 1])
        if (a !== null && z !== null && Math.abs(a - z) > 4) say('a line breaks after the hyphen in "' + b.textContent.slice(Math.max(0, chars.indexOf(chars[k]) - 12), chars.indexOf(chars[k]) + 12).replace(/\\s+/g, ' ').trim() + '"')
      }
    }
    // the last line: one short word on its own
    const text = chars.map(ch).join('')
    const ws = [...text.matchAll(/\\S+/g)]
    words += ws.length
    if (ws.length > 3) {
      const last = ws[ws.length - 1], prev = ws[ws.length - 2]
      const tl = top(chars[last.index]), tp = top(chars[prev.index + prev[0].length - 1])
      if (tl !== null && tp !== null && Math.abs(tl - tp) > 4 && last[0].replace(/[^A-Za-z0-9]/g, '').length <= 3) { runts++; say('a last line of one short word ("' + last[0] + '") in ' + __sm.name(b)) }
    }
  }
  return { problems: out, joins, blocks: blocks.length, words }
})()`

/** The face's hyphen against its en dash, in the face actually drawing the text. */
const HYPHEN = `(() => {
  const el = document.querySelector('.sm-meta dd') || document.querySelector('.sm p')
  const fam = getComputedStyle(el).fontFamily
  const first = fam.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (!document.fonts.check('16px "' + first + '"', '-–')) return { problems: [], info: first + ' not loaded (offline?); hyphen not measured' }
  const c = document.createElement('canvas').getContext('2d')
  c.font = '100px ' + fam
  const h = c.measureText('-').width, d = c.measureText('\\u2013').width
  const r = h / d
  return { problems: r > 0.75 ? [first + ' draws its hyphen at ' + Math.round(r * 100) + '% of its en dash; it reads as a dash. Pick a text face whose hyphen is shorter'] : [], info: first + ' hyphen ' + Math.round(r * 100) + '% of an en dash' }
})()`

const DATA = `(() => {
  const out = []
  const num = __sm.num
  for (const e of document.querySelectorAll('.sm-e')) {
    const t = num(e.querySelector('.sm-typ b').textContent), f = num(e.querySelector('.sm-from b').textContent)
    if (f > t) out.push(__sm.name(e.querySelector('.sm-name')) + ' shows from ' + f + ' above typical ' + t)
  }
  let sets = 0
  for (const bill of document.querySelectorAll('.sm-bill')) {
    sets++
    const rows = [...bill.querySelectorAll('tbody tr')].filter((r) => !r.classList.contains('sm-ov') && !r.classList.contains('sm-tot'))
    const cells = (r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim())
    const range = (s) => { const m = s.split(/[–-]/).map(Number); return m.length === 1 ? [m[0], m[0]] : m }
    const ov = bill.querySelector('.sm-ov') ? num(cells(bill.querySelector('.sm-ov'))[0]) : 0
    const tot = cells(bill.querySelector('.sm-tot'))
    const sum = (k) => rows.reduce((a, r) => a + num(cells(r)[k]), 0)
    const wmin = rows.reduce((a, r) => a + range(cells(r)[0])[0], 0) - ov
    const wmax = rows.reduce((a, r) => a + range(cells(r)[0])[1], 0) - ov
    const label = __sm.name(bill.closest('.sm-set').querySelector('.sm-name'))
    if (sum(1) !== num(tot[1])) out.push(label + ': the "from" column adds to ' + sum(1) + ', the total says ' + num(tot[1]))
    if (sum(2) !== num(tot[2])) out.push(label + ': the "typically" column adds to ' + sum(2) + ', the total says ' + num(tot[2]))
    const tw = range(tot[0])
    if (tw[0] !== wmin || tw[1] !== wmax) out.push(label + ': the weeks add to ' + wmin + ' to ' + wmax + ' less overlap; the total says ' + tot[0])
    const head = num(bill.closest('.sm-set').querySelector('.sm-settyp').textContent)
    if (head !== sum(2)) out.push(label + ': the price beside the name (' + head + ') is not the typical total (' + sum(2) + ')')
  }
  return { problems: out, sets }
})()`

/** The rules, written again here so the page is checked against something it didn't compute. */
const RULES = `(s, B, W) => {
  const per = !!s.monthly
  const lo = per ? s.from * s.monthly.minMonths : s.from, hi = per ? s.typical * s.monthly.minMonths : s.typical
  const p = B == null ? 0 : hi <= B ? 0 : lo <= B ? 1 : 2
  let t = 0
  if (W != null) t = per ? (s.monthly.startsWithinWeeks <= W ? 0 : 2) : s.weeks[1] <= W ? 0 : s.weeks[0] <= W ? 1 : 2
  return ['fit', 'stretch', 'out'][Math.max(p, t)]
}`

const CHOOSER = (reduce) => `(async () => {
  const out = []
  const { wait } = __sm
  const root = document.querySelector('.sm')
  const D = JSON.parse(root.dataset.sm)
  const rule = ${RULES}
  const form = document.querySelector('.sm-choose')
  if (form.hidden || getComputedStyle(form).display === 'none') return { problems: ['the chooser does not appear with JavaScript on'], pairs: 0 }
  const live = document.getElementById('sm-tally')
  if (live.getAttribute('aria-live') !== 'polite') out.push('the tally is not a polite live region')
  for (const fs of form.querySelectorAll('fieldset')) if (!fs.querySelector('legend')?.textContent.trim()) out.push('a radio group has no legend')
  for (const r of form.querySelectorAll('input[type=radio]')) if (!r.closest('label')?.textContent.trim()) out.push('a radio has no label')
  const bs = [...form.querySelectorAll('input[name=sm-b]')], ws = [...form.querySelectorAll('input[name=sm-w]')]
  const rows = D.services.map((s) => [s, document.getElementById('svc-' + s.id)])
  const sets = D.sets.map((s, k) => [s, document.querySelector('.sm-set[data-set="' + k + '"]')])
  let pairs = 0
  for (const b of bs) for (const w of ws) {
    b.click(); w.click()
    await wait(${reduce ? 20 : 10})
    pairs++
    const B = b.value ? Number(b.value) : null, W = w.value ? Number(w.value) : null
    const on = B != null || W != null
    const label = (B == null ? 'any budget' : B) + ' / ' + (W == null ? 'any time' : W + ' weeks')
    const tally = { fit: 0, stretch: 0, out: 0 }
    for (const [s, el] of [...rows, ...sets]) {
      const want = on ? rule(s, B, W) : null
      const got = ['fit', 'stretch', 'out'].find((k) => el.classList.contains('is-' + k)) ?? null
      const nm = el.querySelector('.sm-name').textContent.trim()
      if (got !== want) out.push(label + ': ' + nm + ' is marked ' + got + ', the rules say ' + want)
      const why = el.querySelector('.sm-why')
      if (on && (why.hidden || !why.textContent.trim())) out.push(label + ': ' + nm + ' has no sentence saying why')
      if (on && want && !why.textContent.startsWith({ fit: 'Fits.', stretch: 'A stretch.', out: 'Not this time.' }[want])) out.push(label + ': ' + nm + '\\'s sentence does not open with its verdict')
      if (!on && !why.hidden) out.push('with no choice, ' + nm + ' still shows a verdict')
      if (on && el.classList.contains('sm-e')) tally[want]++
    }
    const tx = live.textContent
    if (on && !tx.includes(tally['fit'] + ' of ' + D.services.length)) out.push(label + ': the tally "' + tx + '" does not say ' + tally['fit'] + ' of ' + D.services.length + ' fit')
    if (on && (!tx.includes(tally['stretch'] + ' ') || !tx.includes(tally['out'] + ' do'))) out.push(label + ': the tally "' + tx + '" does not count ' + tally['stretch'] + ' stretch and ' + tally['out'] + ' not now')
    const q = new URLSearchParams(location.search)
    if ((q.get('sm-budget') ?? '') !== b.value || (q.get('sm-within') ?? '') !== w.value) out.push(label + ': the address is ' + location.search + ', not the choice')
    if (out.length > 12) break
  }
  // reduced motion: nothing animates after a change
  ${reduce ? `bs[1].click(); await wait(30); const an = document.getAnimations().length; if (an) out.push(an + ' animations run with reduced motion after a choice')` : ''}
  // Clear
  bs[0].click(); await wait(20)
  const clear = form.querySelector('.sm-clear')
  if (clear.hidden) out.push('Clear does not appear once something is chosen')
  clear.click(); await wait(30)
  if (!bs.at(-1).checked || !ws.at(-1).checked) out.push('Clear does not set both groups back to Any')
  if (location.search.includes('sm-')) out.push('Clear leaves the choice in the address')
  if (document.querySelector('.sm-e.is-fit, .sm-e.is-stretch, .sm-e.is-out')) out.push('Clear leaves verdicts on the services')
  return { problems: out, pairs }
})()`

/** Once the form has scrolled away the choice stays in a bar at the top, and Change goes back to it. */
const STICK = (reduce) => `(async () => {
  const out = []
  const { wait } = __sm
  const b = document.querySelectorAll('input[name=sm-b]')[1]
  b.click(); await wait(30)
  const second = document.querySelectorAll('.sm-course')[1]
  scrollTo(0, second.getBoundingClientRect().top + scrollY - 40)
  await wait(${reduce ? 120 : 600})
  const stick = document.querySelector('.sm-stick')
  const inner = stick.querySelector('.sm-stick-in')
  if (!stick.classList.contains('sm-on') || getComputedStyle(inner).visibility !== 'visible') out.push('the choice is not kept in sight once the form has scrolled away')
  else {
    const r = inner.getBoundingClientRect()
    if (r.top < -1 || r.top > 2) out.push('the choice bar is not at the top of the screen (' + Math.round(r.top) + 'px)')
    const fit = document.querySelectorAll('.sm-e.is-fit').length
    if (!inner.textContent.includes(fit + ' of ')) out.push('the choice bar does not count what fits (' + inner.textContent + ')')
    // it covers no verdict mark it is meant to explain: the bar is opaque and short
    if (r.height > 90) out.push('the choice bar is ' + Math.round(r.height) + 'px tall')
    stick.querySelector('.sm-change').click()
    await wait(${reduce ? 150 : 1200})
    const f = document.querySelector('.sm-choose').getBoundingClientRect()
    if (f.top < -2 || f.top > innerHeight * 0.4) out.push('Change does not bring the form back into view (' + Math.round(f.top) + 'px)')
    if (!document.querySelector('.sm-choose').contains(document.activeElement)) out.push('Change does not move focus into the form')
  }
  document.querySelector('.sm-clear').click()
  scrollTo(0, 0); await wait(${reduce ? 60 : 400})
  if (stick.classList.contains('sm-on')) out.push('the choice bar stays after Clear')
  return out
})()`

async function keys(tab, ev) {
  const problems = []
  await ev(`(() => { const r = document.querySelector('input[name=sm-b]'); r.focus(); })()`)
  const before = await ev(`document.getElementById('sm-tally').textContent`)
  await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  await new Promise((r) => setTimeout(r, 120))
  const r = await ev(`({ checked: document.querySelector('input[name=sm-b]:checked')?.value, idx: [...document.querySelectorAll('input[name=sm-b]')].indexOf(document.activeElement), tally: document.getElementById('sm-tally').textContent })`)
  if (r.idx !== 1) problems.push('the arrow key does not move focus along the budget group')
  if (r.tally === before) problems.push('choosing with the arrow key does not update the tally')
  return problems
}

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.sm a[href], .sm button, .sm input')].filter((el) => el.getClientRects().length).length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 40); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const ring = (x) => { const s = getComputedStyle(x); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 }
      const vis = el.matches('input') ? ring(el.closest('label').querySelector('span')) : ring(el)
      return { ring: vis, visible: el.matches(':focus-visible'), name: (el.closest('label')?.textContent || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  return problems
}

const NOJS = `(() => {
  const out = []
  const form = document.querySelector('.sm-choose')
  if (form && getComputedStyle(form).display !== 'none') out.push('with JavaScript off the chooser shows (it cannot work)')
  const es = [...document.querySelectorAll('.sm-e')]
  if (!es.length) out.push('no services in the HTML')
  for (const e of es) {
    if (!e.querySelector('.sm-skip dd')?.textContent.trim()) out.push(__sm.name(e.querySelector('.sm-name')) + ' has no "skip it if" in the HTML')
    if (!e.querySelector('.sm-typ b')?.textContent.trim()) out.push(__sm.name(e.querySelector('.sm-name')) + ' has no price in the HTML')
  }
  for (const w of document.querySelectorAll('.sm-why')) if (getComputedStyle(w).display !== 'none') out.push('a verdict shows with JavaScript off')
  for (const t of document.querySelectorAll('.sm-tag')) if (Number(getComputedStyle(t).opacity) > 0.01) out.push('a verdict mark shows with JavaScript off')
  return out
})()`

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  const url = `${server.url}${relative(dirname(file), file)}`
  const chrome = await launch({ width: 1440, height: 900 })
  let failed = 0
  try {
    for (const [w, h, mode] of RUNS) {
      const reduce = mode === 'reduce', nojs = mode === 'nojs'
      const tab = await chrome.page()
      const errors = []
      chrome.on('Runtime.exceptionThrown', (p, s) => s === tab.sessionId && errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
      await tab.send('Page.enable')
      await tab.send('Runtime.enable')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
      if (reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      if (nojs) await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
      const go = async (u) => { const loaded = tab.once('Page.loadEventFired', 60000); await tab.send('Page.navigate', { url: u }); await loaded }
      await go(url)
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      const sideways = async (what) => {
        for (let y = 0, H = await ev('document.documentElement.scrollHeight'); y <= H; y += Math.round(h * 0.5)) {
          await ev(`scrollTo(0, ${y})`)
          if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) return [`the page scrolls sideways ${what} (at ${y}px down)`]
        }
        await ev('scrollTo(0, 0)')
        // let the choice bar finish leaving before anything is measured
        await new Promise((r) => setTimeout(r, reduce ? 60 : 500))
        return []
      }
      const problems = []
      let info = ''
      if (nojs) {
        await ev('document.fonts.ready')
        await new Promise((r) => setTimeout(r, 300))
        await ev(LIB)
        if (await ev('!!window.ServicesMenu')) problems.push('the runtime ran with JavaScript off (the run is not what it claims)')
        problems.push(...(await ev(NOJS)))
        problems.push(...(await sideways('with JavaScript off')))
        const audit = await ev(AUDIT)
        problems.push(...audit.problems)
        const data = await ev(DATA)
        problems.push(...data.problems)
        const br = await ev(BREAKS)
        problems.push(...br.problems)
        info = `menu reads in full, chooser hidden, ${audit.pairs} text/background pairs (lowest ${audit.worst}x the minimum), ${data.sets} set bills add up, ${br.joins} no-break joins hold`
      } else {
        await ev('document.fonts.ready.then(() => window.ServicesMenu && window.ServicesMenu.ready).then(() => new Promise((r) => setTimeout(r, 300)))')
        await ev(LIB)
        problems.push(...(await sideways('with no choice')))
        const data = await ev(DATA)
        problems.push(...data.problems)
        const hy = await ev(HYPHEN)
        problems.push(...hy.problems)
        const br0 = await ev(BREAKS)
        problems.push(...br0.problems)
        const a0 = await ev(AUDIT)
        problems.push(...a0.problems)
        const ch = await ev(CHOOSER(reduce))
        problems.push(...ch.problems)
        problems.push(...(await keys(tab, ev)))
        problems.push(...(await ev(STICK(reduce))))
        // a shared address opens on its choice, with the preview's second choice (the one that dims the most)
        const pv = await ev(`JSON.parse(document.querySelector('.sm').dataset.sm).preview.second`)
        const q = new URLSearchParams()
        if (pv.budget != null) q.set('sm-budget', pv.budget)
        if (pv.weeks != null) q.set('sm-within', pv.weeks)
        await go(`${url}?${q}`)
        await ev('document.fonts.ready.then(() => window.ServicesMenu.ready).then(() => new Promise((r) => setTimeout(r, 600)))')
        await ev(LIB)
        const opened = await ev(`({ b: document.querySelector('input[name=sm-b]:checked').value, w: document.querySelector('input[name=sm-w]:checked').value, marked: document.querySelectorAll('.sm-e.is-fit, .sm-e.is-stretch, .sm-e.is-out').length, n: document.querySelectorAll('.sm-e').length })`)
        if (opened.b !== String(pv.budget ?? '') || opened.w !== String(pv.weeks ?? '')) problems.push(`opening ?${q} does not select that choice`)
        if (opened.marked !== opened.n) problems.push(`opening ?${q} marks ${opened.marked} of ${opened.n} services`)
        problems.push(...(await sideways('with a choice made')))
        const br1 = await ev(BREAKS)
        problems.push(...br1.problems)
        const a1 = await ev(AUDIT)
        problems.push(...a1.problems)
        if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
        info = `${ch.pairs} budget and deadline pairs agree with the rules, the address round-trips, ${a0.pairs + a1.pairs} text/background pairs (lowest ${Math.min(a0.worst, a1.worst)}x the minimum), ${data.sets} set bills add up, ${br1.joins} no-break joins hold, ${hy.info}${reduce ? ', nothing animates' : ''}`
      }
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : nojs ? ' JavaScript off' : ''}`
      const uniq = [...new Set(problems)]
      if (uniq.length) {
        failed += uniq.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of uniq) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}`)
      const targets = (await chrome.send('Target.getTargets')).targetInfos.filter((t) => t.type === 'page' && t.url.startsWith(server.url))
      for (const t of targets) await chrome.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {})
    }
  } finally {
    await chrome.close()
    server.close()
  }
  return failed
}

export async function main(argv = process.argv.slice(2)) {
  const [input] = argv
  if (!input) {
    console.log('usage: node scripts/check.mjs out/index.html')
    process.exit(1)
  }
  try {
    const n = await check(input)
    if (n) {
      console.log(`${n} problem${n > 1 ? 's' : ''} in ${input}`)
      process.exit(1)
    }
    console.log(`all checks passed for ${input}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
