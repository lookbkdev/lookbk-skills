// FAQ Kit: serves the built page and opens it in headless Chrome at 390,
// 768, 1024 and 1440 px wide, with reduced motion at 390 and 1440, and with
// JavaScript off at 390 and 1440. It fails on:
//   - script errors, links without an address, ids used twice
//   - sideways scrolling, at any point down the page
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px), with
//     every answer open so the answers are measured too
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box or running off the screen
//   - the FAQPage JSON-LD not matching the page: the same questions in the
//     same order, each name equal to the visible question and each answer
//     equal to the visible short answer plus the visible long answer
//   - a computed table cell that its arithmetic doesn't give
//   - open and close: a click opens to the measured height and closes again;
//     Enter on a focused question does the same; with reduced motion it is
//     instant and nothing animates
//   - search: the example's query narrows the list, every row left matches,
//     the count says so; a query with no answer shows the way to the contact
//     with its response time; clearing brings every row back
//   - a #link opens its answer and brings it to the top of the screen
//     (below the phone search bar)
//   - an answer the browser opens by itself (find-in-page, #:~:text= links)
//     stays in step with the runtime, and a #:~:text= link to a phrase inside
//     a closed answer opens it (where the browser supports it)
//   - the contents rail staying beside the list and marking the current
//     topic; the phone search bar appearing once the search has scrolled away
//   - the contact status line missing
//   - a keyboard focus that can't be seen (Tab through the page)
//   - with JavaScript off: an answer that is not in the HTML, a question that
//     won't open, the JSON-LD missing, or the search box showing
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
  window.__fq = {
    squash: (s) => s.replace(/\\s+/g, ' ').trim(),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    name: (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"',
  }
`

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.fq-eyebrow, .fq-addr, .fq-n, .fq-c, .fq-vl, .fq-cols, .fq-count, .fq-foot, .fq-search label, kbd, .fq-roster span, .fq-cur, .fq-body th, .fq-body caption'
  const skip = (el) => el.closest('.fq-sr, [aria-hidden="true"]:not(.fq-cols):not(.fq-vl)')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.querySelectorAll('.fq *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = __fq.name
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('.fq a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
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
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, ratio / need)
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of document.querySelectorAll('.fq *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.fq-ans')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2 && !el.matches('.fq-cur')) say('text is cut off at the side of its box: ' + name(el))
  }
  for (const el of document.querySelectorAll('.fq-ans')) if (el.closest('[open]') && el.scrollHeight > el.clientHeight + 2) say('an open answer is cut off at the bottom: ' + name(el.closest('details').querySelector('.fq-qt')))
  for (const el of texts) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

/** The JSON-LD against the page, and the computed cells against their arithmetic. */
const DATA = `(() => {
  const out = []
  const sq = __fq.squash
  const el = document.getElementById('fq-ld')
  if (!el) return { problems: ['no FAQPage JSON-LD on the page'], n: 0, cells: 0 }
  let ld
  try { ld = JSON.parse(el.textContent) } catch (e) { return { problems: ['the JSON-LD does not parse: ' + e.message], n: 0, cells: 0 } }
  if (ld['@type'] !== 'FAQPage') out.push('the JSON-LD is not a FAQPage')
  const qs = [...document.querySelectorAll('details.fq-q')]
  const items = ld.mainEntity ?? []
  if (items.length !== qs.length) out.push('the JSON-LD has ' + items.length + ' questions; the page shows ' + qs.length)
  qs.forEach((d, i) => {
    const e = items[i]
    if (!e) return
    const q = sq(d.querySelector('.fq-qt').textContent)
    if (e.name !== q) out.push('JSON-LD question ' + (i + 1) + ' is "' + e.name + '"; the page shows "' + q + '"')
    const v = sq(d.querySelector('.fq-v').textContent)
    const want = (/[.!?]$/.test(v) ? v : v + '.') + ' ' + sq(d.querySelector('.fq-body').textContent)
    const got = e.acceptedAnswer?.text ?? ''
    if (got !== want) {
      let k = 0
      while (k < got.length && got[k] === want[k]) k++
      out.push('JSON-LD answer ' + (i + 1) + ' (#' + d.id + ') differs from the page at character ' + k + ': "…' + got.slice(Math.max(0, k - 12), k + 24) + '" vs "…' + want.slice(Math.max(0, k - 12), k + 24) + '"')
    }
  })
  let cells = 0
  for (const td of document.querySelectorAll('td[data-calc]')) {
    const expr = td.dataset.calc
    if (!/^[\\d.+\\-*/() ]+$/.test(expr)) { out.push('a computed cell has arithmetic that is not plain: ' + expr); continue }
    const v = Function('return (' + expr + ')')()
    const dp = Number(td.dataset.dp ?? 2)
    const shown = Number(td.textContent.replace(/,(?=\\d{3}\\b)/g, '').match(/-?\\d+(\\.\\d+)?/)?.[0])
    cells++
    if (Math.abs(shown - Number(v.toFixed(dp))) > 1e-9) out.push('the cell "' + td.textContent + '" should be ' + v.toFixed(dp) + ' (' + expr + ')')
  }
  return { problems: out, n: qs.length, cells }
})()`

const INTERACT = (reduce) => `(async () => {
  const out = []
  const { wait, squash } = __fq
  const K = window.FAQKit
  const D = JSON.parse(document.querySelector('.fq').dataset.fq)
  const qs = [...document.querySelectorAll('details.fq-q')]
  const settled = (d) => { const a = d.querySelector('.fq-ans'); return Math.abs(a.getBoundingClientRect().height - a.scrollHeight) < 1.5 }
  for (const d of qs) K.setOpen(d, false, false)
  // open and close by click
  const d = qs.find((x) => !D.preview.open.includes(x.id)) ?? qs[0]
  scrollTo(0, d.getBoundingClientRect().top + scrollY - 200); await wait(80)
  d.querySelector('summary').click()
  await wait(${reduce ? 40 : 30})
  ${reduce ? `if (!d.open || !settled(d)) out.push('with reduced motion an answer does not open at once'); if (document.getAnimations().length) out.push(document.getAnimations().length + ' animations run with reduced motion')` : `if (!document.querySelector('.fq-ans').parentElement || !d.querySelector('.fq-ans').getAnimations().length) out.push('opening an answer does not animate its height')`}
  await wait(700)
  if (!d.open || !settled(d)) out.push('a click does not open the answer to its full height')
  if (location.hash !== '#' + d.id) out.push('opening an answer does not put its #link in the address')
  d.querySelector('summary').click()
  await wait(${reduce ? 60 : 600})
  if (d.open) out.push('a second click does not close the answer')
  // the open/close state stays in step when the browser opens one itself (find-in-page)
  const e = qs[qs.length - 2]
  e.open = true
  await wait(80)
  if (e.dataset.want !== '1') out.push('an answer the browser opens (find-in-page) is not picked up by the runtime')
  e.querySelector('summary').click()
  await wait(${reduce ? 60 : 600})
  if (e.open) out.push('an answer the browser opened does not close on a click')
  // search
  const input = document.querySelector('.fq-search input')
  const set = async (v) => { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); await wait(60) }
  const q = D.preview.query
  await set(q)
  const vis = qs.filter((x) => !x.classList.contains('fq-hidden'))
  if (!vis.length) out.push('searching "' + q + '" leaves no answers')
  if (vis.length === qs.length) out.push('searching "' + q + '" does not narrow the list')
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  for (const x of vis) if (!norm(x.textContent).includes(norm(q))) out.push('"' + squash(x.querySelector('.fq-qt').textContent) + '" is left in for "' + q + '" but does not contain it')
  for (const x of qs.filter((x) => x.classList.contains('fq-hidden'))) if (norm(x.querySelector('summary').textContent + ' ' + x.querySelector('.fq-body').textContent).includes(norm(q))) out.push('"' + squash(x.querySelector('.fq-qt').textContent) + '" contains "' + q + '" but is hidden')
  if (!document.querySelector('.fq-count').textContent.includes(String(vis.length))) out.push('the search count does not say how many answers match')
  if (!document.querySelector('.fq-hit')) out.push('the match is not highlighted')
  await set('zqxjv')
  const empty = document.querySelector('.fq-empty')
  if (!empty.classList.contains('fq-on') || !empty.textContent.includes(D.contact.promise)) out.push('a search with no answers does not point to the contact and its response time')
  await set('')
  if (qs.some((x) => x.classList.contains('fq-hidden'))) out.push('clearing the search does not bring every answer back')
  // a #link
  const target = document.getElementById(D.preview.deepLink)
  K.setOpen(target, false, false)
  scrollTo(0, 0); await wait(80)
  location.hash = '#' + target.id
  await wait(1400)
  const top = target.getBoundingClientRect().top
  const bar = document.querySelector('.fq-bar')
  const barH = getComputedStyle(bar).display !== 'none' ? bar.firstElementChild.getBoundingClientRect().height : 0
  const roomBelow = document.documentElement.scrollHeight - innerHeight - scrollY < 2
  if (!target.open) out.push('the #link #' + target.id + ' does not open its answer')
  if (top < barH - 2 || (top > innerHeight * 0.45 && !roomBelow)) out.push('the #link #' + target.id + ' leaves its answer at ' + Math.round(top) + 'px (search bar ' + Math.round(barH) + 'px)')
  if (document.activeElement !== target.querySelector('summary')) out.push('the #link does not move focus to its question')
  history.replaceState(null, '', location.pathname + location.search)
  // where you are
  const groups = [...document.querySelectorAll('.fq-group[data-g]')]
  if (groups.length > 1) {
    scrollTo(0, groups[1].getBoundingClientRect().top + scrollY - 40); await wait(250)
    const cur = document.querySelector('.fq-contents a[aria-current="true"]')
    const sideFixed = getComputedStyle(document.querySelector('.fq-side-in')).position === 'sticky'
    if (sideFixed) {
      if (cur?.dataset.g !== groups[1].dataset.g) out.push('the contents do not mark the second topic as current')
      const r = document.querySelector('.fq-search').getBoundingClientRect()
      if (r.top < 0 || r.bottom > innerHeight) out.push('the contents rail does not stay beside the list (search at ' + Math.round(r.top) + 'px)')
    }
  }
  if (getComputedStyle(bar).display !== 'none') {
    scrollTo(0, 0); await wait(200)
    if (bar.classList.contains('fq-on')) out.push('the phone search bar shows while the search is on screen')
    const mid = qs[Math.floor(qs.length / 2)]
    scrollTo(0, mid.getBoundingClientRect().top + scrollY - 200); await wait(250)
    if (!bar.classList.contains('fq-on')) out.push('the phone search bar does not appear once the search has scrolled away')
  }
  if (!squash(document.querySelector('.fq-status').textContent)) out.push('the contact has no status line')
  scrollTo(0, 0)
  for (const x of qs) K.setOpen(x, false, false)
  return out
})()`

const NOJS = `(() => {
  const out = []
  const qs = [...document.querySelectorAll('details.fq-q')]
  if (!qs.length) out.push('no questions in the HTML')
  for (const d of qs) if (!d.querySelector('.fq-body')?.textContent.trim()) out.push('the answer to #' + d.id + ' is not in the HTML')
  if (getComputedStyle(document.querySelector('.fq-search')).display !== 'none') out.push('with JavaScript off the search box still shows (it cannot work)')
  const ld = document.getElementById('fq-ld')
  if (!ld) out.push('with JavaScript off there is no JSON-LD (it must be written at build time)')
  else if (JSON.parse(ld.textContent).mainEntity.length !== qs.length) out.push('the JSON-LD does not list every question')
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('a[href], button, input, summary')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 90); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || el.matches('input')
      return { ring, visible: el.matches(':focus-visible'), name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  return problems
}

/** Enter on a focused question opens it; Enter again closes it. */
async function keyboard(tab, ev, reduce) {
  const problems = []
  await ev(`(() => { const d = document.querySelectorAll('details.fq-q')[0]; window.FAQKit.setOpen(d, false, false); d.querySelector('summary').focus() })()`)
  const enter = async () => {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await new Promise((r) => setTimeout(r, reduce ? 80 : 700))
  }
  await enter()
  if (!(await ev(`document.querySelectorAll('details.fq-q')[0].open`))) problems.push('Enter on a focused question does not open it')
  await enter()
  if (await ev(`document.querySelectorAll('details.fq-q')[0].open`)) problems.push('Enter on an open question does not close it')
  await ev(`history.replaceState(null, '', location.pathname + location.search)`)
  return problems
}

/** A #:~:text= link to a phrase inside a closed answer: the browser opens it. */
async function textFragment(tab, ev, url) {
  const phrase = await ev(`(() => {
    const D = JSON.parse(document.querySelector('.fq').dataset.fq)
    const d = [...document.querySelectorAll('details.fq-q')].reverse().find((x) => !x.hasAttribute('data-open-on-load') && x.id !== D.preview.deepLink && x.querySelector('.fq-body p'))
    return d && { id: d.id, text: d.querySelector('.fq-body p').textContent.trim().split(/\\s+/).slice(0, 5).join(' ') }
  })()`)
  if (!phrase) return { problems: [], info: 'no closed answer to search' }
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url: `${url}?from=search#:~:text=${encodeURIComponent(phrase.text).replace(/-/g, '%2D')}` })
  await loaded
  await ev('document.fonts.ready.then(() => window.FAQKit && window.FAQKit.ready).then(() => new Promise((r) => setTimeout(r, 900)))')
  const r = await ev(`(() => { const d = document.getElementById(${JSON.stringify(phrase.id)}); return { open: d.open, want: d.dataset.want } })()`)
  if (!r.open) return { problems: [], info: `the browser did not open #${phrase.id} for a #:~:text= link (not supported here)` }
  if (r.want === '0') return { problems: [`#${phrase.id} was opened by the browser but the runtime still thinks it is closed`], info: '' }
  return { problems: [], info: `#:~:text= opened #${phrase.id}` }
}

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
      const loaded = tab.once('Page.loadEventFired', 60000)
      await tab.send('Page.navigate', { url })
      await loaded
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      const problems = []
      let info = ''
      if (nojs) {
        await ev('document.fonts.ready')
        await new Promise((r) => setTimeout(r, 400))
        await ev(LIB)
        if (await ev('!!window.FAQKit')) problems.push('the runtime ran with JavaScript off (the run is not what it claims)')
        problems.push(...(await ev(NOJS)))
        // a real click on a question opens it natively
        const pt = await ev(`(() => { const s = document.querySelector('details.fq-q:not([open]) > summary'); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2, id: s.parentElement.id } })()`)
        for (const type of ['mousePressed', 'mouseReleased']) await tab.send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
        await new Promise((r) => setTimeout(r, 150))
        if (!(await ev(`document.getElementById(${JSON.stringify(pt.id)}).open`))) problems.push('with JavaScript off a click does not open a question')
        await ev(`document.querySelectorAll('details.fq-q').forEach((d) => (d.open = true))`)
        for (let y = 0, H = await ev('document.documentElement.scrollHeight'); y <= H; y += Math.round(h * 0.5)) {
          await ev(`scrollTo(0, ${y})`)
          if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) { problems.push('the page scrolls sideways with JavaScript off'); break }
        }
        const audit = await ev(AUDIT)
        problems.push(...audit.problems)
        const data = await ev(DATA)
        problems.push(...data.problems)
        info = `${data.n} questions in the HTML, JSON-LD written at build time and equal to the page, ${audit.pairs} text/background pairs (lowest ${audit.worst}x the minimum), native open and close`
      } else {
        await ev('document.fonts.ready.then(() => window.FAQKit && window.FAQKit.ready).then(() => new Promise((r) => setTimeout(r, 400)))')
        await ev(LIB)
        const height = await ev('document.documentElement.scrollHeight')
        for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
          await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 40))`)
          if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
            if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
          }
        }
        const data = await ev(DATA)
        problems.push(...data.problems)
        problems.push(...(await ev(INTERACT(reduce))))
        problems.push(...(await keyboard(tab, ev, reduce)))
        // every answer open, then measured
        await ev(`document.querySelectorAll('details.fq-q').forEach((d) => window.FAQKit.setOpen(d, true, false)); window.FAQKit.filter('${''}'); new Promise((r) => setTimeout(r, 100))`)
        for (let y = 0, H = await ev('document.documentElement.scrollHeight'); y <= H; y += Math.round(h * 0.5)) {
          await ev(`scrollTo(0, ${y})`)
          if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) { problems.push('the page scrolls sideways with every answer open'); break }
        }
        await ev('scrollTo(0, 0)')
        const audit = await ev(AUDIT)
        problems.push(...audit.problems)
        if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
        let frag = ''
        if (w === 1440 && !reduce) {
          const f = await textFragment(tab, ev, url)
          problems.push(...f.problems)
          frag = `, ${f.info}`
        }
        info = `${audit.pairs} text/background pairs (lowest ${audit.worst}x the minimum), ${data.n} questions in the JSON-LD equal to the page, ${data.cells} computed cells right${reduce ? ', instant open and close' : ''}${frag}`
      }
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : nojs ? ' JavaScript off' : ''}`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
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
