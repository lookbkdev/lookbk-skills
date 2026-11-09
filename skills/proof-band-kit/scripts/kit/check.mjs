// Proof Band Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it fails on:
//   - script errors, links without an address
//   - sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px); the
//     inside of a logo is artwork and is not read as text
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px), every pair measured
//   - text cut off by its box or running off the screen; buttons under
//     44 px tall on a phone
//   - a logo without an accessible name, under 14 px tall, or closer than
//     8 px to the side of its cell or the band
//   - THE BALANCE: kit/balance.js (the same file the page runs) is loaded
//     again and re-measures every mark as drawn. The run fails if any two
//     marks differ in ink weight by more than 10 %, or if any mark sits
//     more than 1 px off its row's shared baseline (centred marks: off the
//     row's centre line)
//   - a figure without its note, a note without a source or an as-of date
//   - the entrance not settling, or running a second time; reduced motion
//     not settled from the start
//   - opening a mark (click, then Escape) not showing and hiding its use line
//   - the marquee (when there is one) not moving, not stopping on Pause, or
//     running at all under reduced motion
//   - a keyboard focus that can't be seen (it presses Tab through the band)
//
//   node scripts/check.mjs out/index.html
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const BALANCE = readFileSync(join(here, '..', '..', 'kit', 'balance.js'), 'utf8')
export const TOLERANCE = 1.1

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
  const phone = vw < 760
  const min = phone ? 16 : 14
  const root = document.querySelector('.pb')
  const LABEL = '.pb-lbl, .pb-sector, .pb-ref, .pb-src, .pb-use a, .pb-drawer a, .pb-caption a, .pb-pause'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], svg, script, style, .pb-dbg')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
    const s = c.match(/color\\(srgb ([^)]+)\\)/)
    if (s) { const p = s[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]] }
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
    let bg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]
    bg = bg.slice(0, 3)
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
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.pb-viewport')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && s.overflowX !== 'clip' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && s.overflowY !== 'clip' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (el.closest('.pb-marquee .pb-viewport')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  if (phone) for (const b of root.querySelectorAll('button')) if (shown(b) && !b.closest('[aria-hidden="true"]') && b.getBoundingClientRect().height < 44) say('a button is under 44px tall on a phone: ' + name(b))
  // figures fit their columns
  for (const f of root.querySelectorAll('.pb-fig')) {
    const col = f.parentElement.getBoundingClientRect()
    for (const k of f.children) { const r = k.getBoundingClientRect(); if (r.width && r.right > col.right + 1) say('a figure runs past its column by ' + Math.round(r.right - col.right) + 'px') }
  }
  // every figure has its note, every note its source and date
  for (const f of root.querySelectorAll('.pb-fig')) {
    const a = f.querySelector('.pb-ref a')
    if (!a) { say('a figure has no note marker: ' + name(f)); continue }
    const n = document.querySelector(a.getAttribute('href'))
    if (!n) say('a figure points at a note that is not there: ' + a.getAttribute('href'))
    else {
      if (!/Source:\\s*\\S/.test(n.textContent)) say('a note has no source: ' + name(n))
      if (!n.querySelector('time[datetime]')) say('a note has no as-of date: ' + name(n))
    }
  }
  for (const a of root.querySelectorAll('.pb-ref a')) if (!document.querySelector(a.getAttribute('href'))) say('a note marker points at nothing: ' + a.getAttribute('href'))
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

/** The balance, measured again from what is drawn, with the same balance.js. */
const BALANCE_CHECK = `(async () => {
  const PB = (() => { ${BALANCE}
    return ProofBalance })()
  const root = document.querySelector('.pb')
  const cfg = JSON.parse(root.getAttribute('data-pb'))
  const dw = cfg.balance.densityWeight
  const out = []
  const marquee = root.classList.contains('pb-marquee')
  if (root.getAttribute('data-balance-problem')) out.push('balance: ' + root.getAttribute('data-balance-problem'))
  const ul = root.querySelector('.pb-marks')
  const band = ul.parentElement.getBoundingClientRect()
  const marks = [...root.querySelectorAll('.pb-mark:not(.pb-clone)')]
  const rows = new Map()
  const weights = []
  for (const li of marks) {
    const svg = li.querySelector('svg')
    const label = (svg.getAttribute('aria-label') || '').trim()
    if (svg.getAttribute('role') !== 'img' || !label) out.push('a logo has no accessible name (role="img" and aria-label)')
    const r = svg.getBoundingClientRect(), c = li.getBoundingClientRect()
    const vb = svg.getAttribute('viewBox').split(/\\s+/).map(Number)
    const m = await PB.measure(svg.outerHTML.replace(/\\swidth="[^"]*"/, '').replace(/\\sheight="[^"]*"/, ''))
    const inkW = r.width * m.ink[2] / vb[2], inkH = r.height * m.ink[3] / vb[3]
    const inkTop = r.top + (m.ink[1] - vb[1]) / vb[3] * r.height
    if (inkH < 14 - 0.05) out.push(label + ' is ' + inkH.toFixed(1) + 'px tall; marks need 14px')
    if (!marquee) {
      if (r.left < c.left + 8 - 0.5 || r.right > c.right - 8 + 0.5) out.push(label + ' comes within 8px of the side of its cell')
      if (r.left < band.left + 8 || r.right > band.right - 8) out.push(label + ' touches the edge of the band')
    }
    if (r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5) out.push(label + ' sticks out of its cell')
    const w = PB.weight(m, inkW, inkH, dw)
    weights.push([label, w])
    const base = r.top + (Number(svg.getAttribute('data-base')) - vb[1]) / vb[3] * r.height
    const key = Math.round(c.top)
    if (!rows.has(key)) rows.set(key, { cellTop: c.top, base: [], mid: [] })
    const row = rows.get(key)
    if (li.getAttribute('data-align') === 'center') row.mid.push([label, inkTop + inkH / 2 - c.top])
    else row.base.push([label, base - c.top])
  }
  const ws = weights.map((x) => x[1])
  const hi = Math.max(...ws), lo = Math.min(...ws)
  const spread = hi / lo
  if (spread > ${TOLERANCE}) out.push('the marks are not balanced: ' + weights.find((x) => x[1] === hi)[0] + ' weighs ' + spread.toFixed(2) + 'x ' + weights.find((x) => x[1] === lo)[0] + ' (allowed ${TOLERANCE})')
  const xMid = parseFloat(getComputedStyle(root).getPropertyValue('--pb-xmid'))
  const baseY = parseFloat(getComputedStyle(root).getPropertyValue('--pb-base'))
  let off = 0
  for (const row of rows.values()) {
    for (const [label, y] of row.base) { const d = Math.abs(y - baseY); off = Math.max(off, d); if (d > 1) out.push(label + ' sits ' + d.toFixed(1) + 'px off the shared baseline') }
    for (const [label, y] of row.mid) { const d = Math.abs(y - (baseY - xMid)); off = Math.max(off, d); if (d > 1) out.push(label + ' sits ' + d.toFixed(1) + 'px off the centre line') }
  }
  return { problems: out, spread: Math.round(spread * 1000) / 1000, off: Math.round(off * 100) / 100, n: marks.length, rows: rows.size }
})()`

const OPEN = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.pb')
  const li = root.querySelector('.pb-mark:not(.pb-clone)')
  const btn = li.querySelector('.pb-btn')
  const use = JSON.parse(root.getAttribute('data-pb')).marks[0].use
  btn.click(); await wait(450)
  if (btn.getAttribute('aria-expanded') !== 'true') out.push('clicking a mark does not set aria-expanded')
  const panel = document.getElementById(btn.getAttribute('aria-controls'))
  if (!panel) out.push('a mark controls nothing: ' + btn.getAttribute('aria-controls'))
  else {
    const s = getComputedStyle(panel)
    const vis = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.95 && !panel.hidden
    if (!vis) out.push('the open mark\\'s use line is not shown')
    if (!panel.textContent.includes(use)) out.push('the open mark shows the wrong use line')
  }
  btn.focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(450)
  if (btn.getAttribute('aria-expanded') !== 'false') out.push('Escape does not close the open mark')
  return out
})()`

const MARQUEE = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.pb')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const cfg = JSON.parse(root.getAttribute('data-pb'))
  if (!cfg.marquee) return { out, info: '' }
  const ul = root.querySelector('.pb-marks')
  if (reduce) {
    if (root.classList.contains('pb-marquee') || root.querySelector('.pb-clone')) out.push('the marquee runs under reduced motion')
    return { out, info: 'marquee off (reduced motion)' }
  }
  const x = () => new DOMMatrix(getComputedStyle(ul).transform).m41
  const a = x(); await wait(500); const b = x()
  if (!(Math.abs(b - a) > 2)) out.push('the marquee does not move')
  const speed = Math.abs(b - a) / 0.5
  const pause = root.querySelector('.pb-pause')
  if (!pause || pause.hidden) out.push('the marquee has no Pause button')
  else {
    pause.click(); await wait(50)
    const c = x(); await wait(500); const d = x()
    if (Math.abs(d - c) > 0.5) out.push('Pause does not stop the marquee')
    if (pause.getAttribute('aria-pressed') !== 'true') out.push('Pause does not set aria-pressed')
    pause.click()
  }
  for (const c of root.querySelectorAll('.pb-clone')) if (c.getAttribute('aria-hidden') !== 'true') out.push('a marquee copy is not hidden from assistive tech')
  return { out, info: 'marquee ' + Math.round(speed) + ' px/s, pauses' }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.pb a[href], .pb button')].filter((el) => el.getClientRects().length && !el.closest('[hidden], [aria-hidden="true"]') && el.tabIndex >= 0).length`)
  await ev(`document.activeElement && document.activeElement.blur(); const r = document.querySelector('.pb'); r.setAttribute('tabindex', '-1'); r.focus({ preventScroll: true }); r.removeAttribute('tabindex')`)
  const seen = new Set()
  let inBand = 0
  for (let i = 0; i < Math.min(count + 1, 40); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await new Promise((r) => setTimeout(r, 40))
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.pb')) return null
      const s = getComputedStyle(el)
      const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2
      return { ring, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    inBand++
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  if (count && !inBand) problems.push('Tab never reaches the band')
  await ev(`document.activeElement && document.activeElement.blur()`)
  return problems
}

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
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
  for (let i = 0; i < 100 && !(await ev('!!window.ProofBand')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.ProofBand'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
  await ev('window.ProofBand.ready.then(() => document.fonts.ready).then(() => true)')
  return { tab, ev, errors }
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  const base = `${server.url}${relative(dirname(file), file)}`
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      const chrome = await launch({ width: Math.max(w, 800), height: h })
      const problems = []
      let info = ''
      try {
        const { tab, ev, errors } = await open(chrome, base, w, h, reduce)
        const below = await ev(`document.querySelector('.pb').getBoundingClientRect().top > innerHeight * 0.8`)
        const before = await ev('document.querySelector(".pb").hasAttribute("data-settled")')
        if (reduce && !before) problems.push('under reduced motion the band is not settled from the start')
        if (!reduce && below && before) problems.push('the entrance ran before the band was in view')
        await ev(`(() => { const r = document.querySelector('.pb'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 16) })()`)
        const ms = await ev('window.ProofBand.settleMs')
        await new Promise((r) => setTimeout(r, (reduce ? 0 : ms) + 600))
        if (!(await ev('document.querySelector(".pb").hasAttribute("data-settled")'))) problems.push('the entrance did not report settled')
        if (!reduce) {
          await ev('scrollTo(0, 0)'); await new Promise((r) => setTimeout(r, 150))
          await ev(`(() => { const r = document.querySelector('.pb'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 16) })()`)
          await new Promise((r) => setTimeout(r, 200))
          const moving = await ev(`[...document.querySelectorAll('.pb [data-e]')].some((el) => el.style.opacity !== '' || el.style.transform !== '' || el.style.getPropertyValue('--e') !== '')`)
          if (moving) problems.push('the entrance ran a second time')
        }
        const r = await ev(AUDIT)
        problems.push(...r.problems)
        const b = await ev(BALANCE_CHECK)
        problems.push(...b.problems)
        const mq = await ev(MARQUEE)
        problems.push(...mq.out)
        problems.push(...(await ev(OPEN)))
        problems.push(...(await focusRings(tab, ev)))
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
        info = `${r.pairs} text pairs, lowest contrast ${r.worst}x its minimum; ${b.n} marks in ${b.rows} row${b.rows > 1 ? 's' : ''}, weight spread ${b.spread}x (max ${TOLERANCE}), baseline off by ${b.off}px${mq.info ? `; ${mq.info}` : ''}`
      } catch (e) {
        problems.push(e.message)
      } finally {
        await chrome.close()
      }
      const tag = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      if (problems.length) { failed++; console.log(`✗ ${tag}: ${info}`); for (const p of problems) console.log(`    - ${p}`) }
      else console.log(`✓ ${tag}: ${info}`)
    }
  } finally {
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
    const failed = await check(input)
    if (failed) { console.log(`${failed} run${failed > 1 ? 's' : ''} failed`); process.exit(1) }
    console.log('all checks passed')
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
