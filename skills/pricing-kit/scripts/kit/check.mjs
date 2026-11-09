// Pricing Kit: serves the built page and opens it in headless Chrome at 390,
// 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440. At each
// size it works the section the way a buyer would (switches billing with a
// click and with the arrow keys, opens the comparison from a card, shows only
// what changes, drags the calculator through every stop, opens questions and
// folded plans), then reads the page and fails on:
//   - script errors, links without an address
//   - sideways scrolling, at any point down the page
//   - copy smaller than 16 px on a phone or 14 px elsewhere; labels under 12 px
//   - text below WCAG AA contrast against what is behind it
//   - text cut off by its box, running off the screen, or inside the 16 px
//     side margin (and the safe areas) on a phone
//   - a billing switch that is not a radio group, prices that don't change or
//     don't roll, a screen-reader price that doesn't say the billed total
//   - a comparison that doesn't open, scroll to itself or mark the plan
//   - a slider without a plan name in its aria-valuetext, a cheapest plan that
//     doesn't light, or anything that moves the layout while it slides
//   - a keyboard focus that can't be seen (Tab through the page)
//   - reduced motion that still moves
//
//   node scripts/check.mjs out/index.html
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const RUNS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [390, 844, true],
  [1440, 900, true],
]

// Runs in the page once everything has drawn: what's wrong with it.
const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.pk-lab, .pk-svg text, .pk-ticks span, .pk-seg-l'
  const skip = (el) => el.closest('.pk-sr, .pk-data, [hidden]')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.querySelectorAll('.pk *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }

  for (const a of document.querySelectorAll('.pk a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))

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
    let bg = [255, 255, 255]
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const faded = (el) => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true; return false }
  for (const el of texts) {
    if (faded(el)) continue
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    // the calculator's lit cell sits on a highlight drawn under it
    let bg = behind(el)
    const cell = el.closest('.pk-cell.on')
    if (cell) bg = parse(getComputedStyle(document.querySelector('.pk-hl')).backgroundColor)
    // the chosen billing radio sits on the sliding thumb
    if (el.closest('.pk-switch [aria-checked="true"]')) bg = parse(getComputedStyle(el.closest('.pk-switch').querySelector('.pk-thumb')).backgroundColor)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }

  const ALLOWED = '.pk-col, .pk-strip, .pk-cmpwrap, .pk-a, .pk-body, .pk-r, .pk-digits'
  for (const el of document.querySelectorAll('.pk *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.matches(ALLOWED) || el.closest('.pk-strip')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (faded(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    else if (phone && (r.left < 15.5 || r.right > vw - 15.5) && !el.closest('.pk-fold')) say('text inside the 16px side margin (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  // a price must fit its card
  for (const p of document.querySelectorAll('.pk-price, .pk-custom')) {
    if (!shown(p)) continue
    const c = p.closest('.pk-card').getBoundingClientRect(), r = p.getBoundingClientRect()
    if (r.right > c.right - 8) say('a price runs into the edge of its card: ' + name(p))
  }
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.pk a[href], .pk button, .pk input')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 90); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body || !el.closest('.pk')) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none')
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

// What a visitor can change, tried for real.
const INTERACT = (reduced) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.pk')
  const D = JSON.parse(root.querySelector('.pk-data').textContent)
  const settle = ${reduced ? 80 : 1500}
  const narrow = document.querySelector('.pk-shell').clientWidth < 1000
  const vis = (el) => el && el.getClientRects().length > 0

  // billing switch
  const group = root.querySelector('.pk-switch')
  if (D.billing) {
    if (!group || group.getAttribute('role') !== 'radiogroup') out.push('the billing switch is not a radio group')
    const radios = [...group.querySelectorAll('[role=radio]')]
    if (radios.length !== 2) out.push('the billing switch needs two radios')
    const other = D.billing.start === 'y' ? 'm' : 'y'
    const btn = radios.find((r) => r.dataset.bill === other)
    btn.click()
    await wait(settle)
    if (btn.getAttribute('aria-checked') !== 'true') out.push('the billing radio does not show it is chosen')
    for (const sr of root.querySelectorAll('.pk-price-sr')) {
      if (sr.textContent !== sr.dataset[other]) out.push('a screen-reader price did not change with the switch')
    }
    const anyY = [...root.querySelectorAll('.pk-price-sr')].some((s) => /billed .*once a year/.test(s.dataset.y))
    if (!anyY) out.push('no screen-reader price says the yearly billed total')
    // every rolling column ends on its digit
    for (const card of root.querySelectorAll('.pk-card')) {
      const i = Number(card.dataset.plan), P = D.plans[i]
      if (P.custom) continue
      const want = String((other === 'y' ? P.y : P.m).toLocaleString('en-US'))
      const strips = [...card.querySelectorAll('.pk-strip')]
      const cols = [...card.querySelectorAll('.pk-col')]
      const fs = parseFloat(getComputedStyle(card.querySelector('.pk-digits')).fontSize)
      const got = cols.map((c) => {
        const s = c.querySelector('.pk-strip')
        if (!s) return c.textContent
        const m = new DOMMatrix(getComputedStyle(s).transform)
        return String(Math.round(-m.m42 / (fs * 1.4)))
      }).join('').trim()
      if (got !== want) out.push('price digits show ' + got + ' instead of ' + want + ' (' + P.name + ')')
      void strips
    }
    // keyboard: arrow back
    btn.focus()
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await wait(settle)
    const back = radios.find((r) => r.dataset.bill !== other)
    if (back.getAttribute('aria-checked') !== 'true') out.push('the arrow keys do not move the billing radio')
    if (document.activeElement !== back) out.push('focus does not follow the arrow keys in the billing radio group')
  }

  // folded plans on narrow screens
  if (narrow) {
    const folds = [...root.querySelectorAll('.pk-fold')].filter(vis)
    if (!folds.length && root.querySelectorAll('.pk-card').length > 1) out.push('plans do not fold on a narrow screen')
    for (const f of folds) if (f.getAttribute('aria-expanded') !== 'false') out.push('a plan is not folded on a narrow screen')
    const f = folds[0]
    if (f) {
      f.click()
      await wait(settle)
      const body = document.getElementById(f.getAttribute('aria-controls'))
      if (f.getAttribute('aria-expanded') !== 'true' || body.hidden || body.getBoundingClientRect().height < 40) out.push('a folded plan does not open')
      f.click()
      await wait(settle)
      if (!body.hidden) out.push('an opened plan does not fold again')
    }
  }

  // comparison from a card
  const wrap = root.querySelector('.pk-cmpwrap')
  if (wrap) {
    const opens = [...root.querySelectorAll('.pk-open')]
    const b = opens.find((o) => vis(o)) || opens[0]
    const rec = root.querySelector('.pk-rec .pk-open')
    const pick = vis(rec) ? rec : b
    const i = Number(pick.dataset.plan)
    if (pick.querySelector('i') && pick.querySelector('i').textContent.trim() !== '↓') out.push('the compare link does not point down to the table')
    scrollTo(0, 0)
    pick.click()
    await wait(${reduced ? 300 : 900})
    const ring = root.querySelector('.pk-colring')
    if (!narrow && parseFloat(ring.style.opacity || '0') < 0.5) out.push('the compared plan is not marked in the table')
    await wait(${reduced ? 200 : 1300})
    if (wrap.hidden || wrap.getBoundingClientRect().height < 100) out.push('the comparison does not open')
    const top = wrap.getBoundingClientRect().top
    if (top < -10 || top > innerHeight * 0.5) out.push('opening the comparison does not scroll to it (top at ' + Math.round(top) + 'px)')
    if (narrow) {
      const tab = root.querySelector('.pk-tab[data-c="' + i + '"]')
      if (tab.getAttribute('aria-checked') !== 'true') out.push('the compared plan is not the one shown in the table')
    }
    const only = root.querySelector('.pk-only')
    const same = root.querySelectorAll('.pk-r[data-same]')
    only.click()
    await wait(settle)
    if (only.getAttribute('aria-checked') !== 'true') out.push('"only what changes" does not switch on')
    if (same.length && [...same].some((r) => !r.hidden)) out.push('"only what changes" leaves rows that are the same everywhere')
    only.click()
    await wait(settle)
    if ([...same].some((r) => r.hidden)) out.push('"only what changes" does not bring the rows back')
    root.querySelector('.pk-close').click()
    await wait(settle)
    if (!wrap.hidden) out.push('the comparison does not close')
  }

  // calculator: every stop names the cheapest plan, and nothing moves the layout
  const range = root.querySelector('.pk-range')
  if (range) {
    range.scrollIntoView({ block: 'center' })
    await wait(100)
    const box = () => { const r = root.querySelector('.pk-res').getBoundingClientRect(); const c = [...root.querySelectorAll('.pk-cell')].map((e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round).join(',') }); return [Math.round(r.height), document.documentElement.scrollHeight, Math.round(range.getBoundingClientRect().top), c.join('|')].join(' ') }
    const first = box()
    const N = Number(range.max) + 1
    let shift = 0, named = 0, lit = 0
    for (let k = 0; k < N; k += Math.max(1, Math.floor(N / 40))) {
      range.value = String(k)
      range.dispatchEvent(new Event('input', { bubbles: true }))
      const on = root.querySelector('.pk-cell.on')
      const vt = range.getAttribute('aria-valuetext') || ''
      if (on) {
        lit++
        const nm = D.plans[Number(on.dataset.c)].name
        if (vt.includes(nm)) named++
        else out.push('the slider says "' + vt + '" without the cheapest plan (' + nm + ')')
      }
      if (box() !== first) shift++
    }
    if (!lit) out.push('the calculator never lights a plan')
    if (shift) out.push('the layout moves while the slider moves (' + shift + ' stops)')
    await wait(${reduced ? 50 : 500})
    const hl = root.querySelector('.pk-hl').getBoundingClientRect(), on = root.querySelector('.pk-cell.on')
    if (on) {
      const c = on.getBoundingClientRect()
      if (Math.abs(hl.left - c.left) > 2 || Math.abs(hl.top - c.top) > 2) out.push('the highlight does not sit on the cheapest plan')
    }
  }

  // questions
  const q = root.querySelectorAll('.pk-q button')[1] || root.querySelector('.pk-q button')
  if (q) {
    q.click()
    await wait(settle)
    const panel = document.getElementById(q.getAttribute('aria-controls'))
    if (q.getAttribute('aria-expanded') !== 'true' || panel.hidden || panel.getBoundingClientRect().height < 20) out.push('a question does not open')
  }
  // leave the comparison open so the reading below covers the table too
  if (wrap) { (root.querySelector('.pk-rec .pk-open') || root.querySelector('.pk-open')).click(); await wait(settle + 300) }
  return out
})()`

const STILL = `(async () => {
  const out = []
  if (!document.querySelector('.pk').classList.contains('pk-still')) out.push('reduced motion is not detected')
  const parts = [...document.querySelectorAll('.pk-card, .pk-strip, .pk-hl, .pk-svg circle, .pk-thumb')]
  const snap = () => parts.map((el) => { const s = getComputedStyle(el); return s.transform + '|' + s.opacity + '|' + (el.getAttribute('cx') || '') })
  const a = snap()
  await new Promise((r) => setTimeout(r, 900))
  if (a.some((v, i) => v !== snap()[i])) out.push('something still moves with reduced motion')
  if ([...document.querySelectorAll('.pk-card')].some((el) => parseFloat(getComputedStyle(el).opacity) < 1)) out.push('a plan stays hidden with reduced motion')
  if (document.getAnimations().length) out.push(document.getAnimations().length + ' CSS animations run with reduced motion')
  return out
})()`

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  if (!/viewport-fit=cover/.test(readFileSync(file, 'utf8'))) console.log('note: the page has no viewport-fit=cover, so phone safe areas are left to the browser')
  const server = await serve(dirname(file))
  const url = `${server.url}${relative(dirname(file), file)}`
  const chrome = await launch({ width: 1440, height: 900 })
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      const tab = await chrome.page()
      const errors = []
      chrome.on('Runtime.exceptionThrown', (p, s) => s === tab.sessionId && errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
      await tab.send('Page.enable')
      await tab.send('Runtime.enable')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
      if (reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      const loaded = tab.once('Page.loadEventFired', 60000)
      await tab.send('Page.navigate', { url })
      await loaded
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      await ev('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 600)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 90))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
        }
      }
      await ev('scrollTo(0, 0); new Promise((r) => setTimeout(r, 1600))')
      if (reduce) problems.push(...(await ev(STILL)))
      problems.push(...(await ev(INTERACT(reduce))))
      if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) problems.push('the page scrolls sideways with the comparison open')
      for (const p of await ev(AUDIT)) problems.push(p)
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const what = await ev(`(() => { const s = document.querySelector('.pk-shell').clientWidth; return (s < 1000 ? 'folded plans' : s < 1180 ? 'plan columns' : 'plan columns + label column') + ', ' + document.querySelectorAll('.pk-card').length + ' plans' })()`)
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${what}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${what}${reduce ? ', still' : ''}`)
      const targets = (await chrome.send('Target.getTargets')).targetInfos
      const id = targets.find((t) => t.type === 'page' && t.url.startsWith(server.url))?.targetId
      if (id) await chrome.send('Target.closeTarget', { targetId: id }).catch(() => {})
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
