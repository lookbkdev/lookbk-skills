// Closing CTA Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it fails on:
//   - script errors, links without an address
//   - sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px); the small mono labels on the coloured
//     stub are measured and reported on their own line (4.5:1)
//   - text cut off by its box or running off the screen; buttons under
//     44 px tall on a phone
//   - the stamp covering any text, button or field (the page places it;
//     this checks it again from the drawn boxes)
//   - the seat dots not matching the count (free dots = places left)
//   - the entrance not running once and reporting settled (live), or
//     reduced motion that is not settled from the start
//   - the price window's today marker off its track, a day count missing
//   - the sentence form: email blank without type, inputmode,
//     autocomplete or label; an empty send not showing its error with
//     aria-invalid; a good address not reaching the sent state
//   - a keyboard focus that can't be seen (it presses Tab through the band)
// and once, at 1440, that the band switches to its after-close copy the
// day after the deadline.
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
  [390, 844, true],
  [1440, 900, true],
]

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const root = document.querySelector('.cc')
  const LABEL = '.cc-lbl, .cc-score small'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], .cc-sr, script, style')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
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
  for (const el of root.querySelectorAll('input, select')) {
    if (!shown(el)) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 16) say('a form field is set at ' + fs + 'px (16px or more, or phones zoom in)')
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
    let bg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]
    bg = bg.slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const ratioOf = (el) => {
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) return null
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  }
  let pairs = 0, worst = 99
  for (const el of texts) {
    const r = ratioOf(el)
    if (r == null) continue
    const s = getComputedStyle(el)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  // the small mono labels on the coloured stub, on their own
  let stubLow = null
  for (const el of root.querySelectorAll('.cc-stub-face .cc-lbl, .cc-hold .cc-lbl')) {
    if (skip(el) || !shown(el)) continue
    const r = ratioOf(el)
    if (r == null) continue
    stubLow = stubLow == null ? r : Math.min(stubLow, r)
    if (r < 4.5) say('stub label contrast ' + r.toFixed(2) + ':1 (needs 4.5:1): ' + name(el))
  }
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.cc-num, .cc-fig, svg, select, input')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  if (phone) for (const b of root.querySelectorAll('.cc-btn')) if (shown(b) && b.getBoundingClientRect().height < 44) say('a button is under 44px tall on a phone: ' + name(b))
  // the figure and the stub numeral fit their columns
  for (const el of root.querySelectorAll('.cc-fig, .cc-fact')) {
    if (!shown(el)) continue
    const box = el.getBoundingClientRect()
    for (const k of el.children) { const r = k.getBoundingClientRect(); if (r.width && r.right > box.right + 2) say('the figure runs past its column by ' + Math.round(r.right - box.right) + 'px') }
  }
  // the stamp covers nothing
  const stamp = root.querySelector('.cc-stamp')
  let stampInfo = ''
  if (stamp && shown(stamp)) {
    const sr = stamp.getBoundingClientRect()
    const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2, rad = stamp.offsetWidth / 2 * 0.98
    const hits = []
    const tk = root.querySelector('.cc-tk')
    const walker = document.createTreeWalker(tk, NodeFilter.SHOW_TEXT)
    const touches = (r) => { const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom)); return (nx - cx) ** 2 + (ny - cy) ** 2 < rad * rad }
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim() || n.parentElement.closest('.cc-stamp, [hidden]')) continue
      const range = document.createRange(); range.selectNodeContents(n)
      for (const r of range.getClientRects()) if (r.width && touches(r)) hits.push(n.textContent.trim().slice(0, 30))
    }
    for (const el of tk.querySelectorAll('.cc-seats, .cc-legend, .cc-barcode, .cc-btn, .cc-link')) if (shown(el) && touches(el.getBoundingClientRect())) hits.push(el.className)
    if (hits.length) say('the stamp covers ' + [...new Set(hits)].join(', '))
    const tr = tk.getBoundingClientRect()
    if (sr.left < tr.left - 2 || sr.right > tr.right + 2 || sr.top < tr.top - 2 || sr.bottom > tr.bottom + 2) say('the stamp hangs off the ticket')
    stampInfo = 'stamp ' + Math.round(stamp.offsetWidth) + 'px, clear'
  }
  // seats
  const seats = root.querySelectorAll('.cc-seats i')
  if (seats.length && shown(root.querySelector('.cc-seats'))) {
    const free = root.querySelectorAll('.cc-seats i.cc-sfree').length
    const legend = root.querySelector('.cc-legend').textContent
    if (!legend.includes(free + ' ')) say('the seat legend does not match the free seats (' + free + ')')
  }
  // price window
  const today = root.querySelector('.cc-today')
  if (today && shown(today)) {
    const t = today.getBoundingClientRect(), tr = root.querySelector('.cc-track').getBoundingClientRect()
    if (t.left < tr.left - 2 || t.right > tr.right + 2) say('the today marker is off its track')
    const lbl = today.querySelector('[data-days]')
    if (lbl && !/\\d/.test(lbl.textContent)) say('the day count is empty')
    const lr = lbl.getBoundingClientRect()
    if (lr.left < -1 || lr.right > vw + 1) say('the today label runs off the screen')
    for (const b of root.querySelectorAll('.cc-win-row > *')) { const br = b.getBoundingClientRect(); if (br.width && lr.width && !(lr.right < br.left || lr.left > br.right || lr.bottom < br.top || lr.top > br.bottom)) say('the today label collides with ' + name(b)) }
  }
  for (const el of root.querySelectorAll('[data-days]')) if (!el.closest('[hidden]') && !el.textContent.trim()) say('a day count was not written')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, stubLow: stubLow && Math.round(stubLow * 100) / 100, stampInfo }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.cc a[href], .cc button, .cc input, .cc select')].filter((el) => el.getClientRects().length && !el.closest('[hidden]')).length`)
  await ev(`document.activeElement && document.activeElement.blur(); const r = document.querySelector('.cc'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 10); document.querySelector('.cc').setAttribute('tabindex', '-1'); document.querySelector('.cc').focus({ preventScroll: true }); document.querySelector('.cc').removeAttribute('tabindex')`)
  const seen = new Set()
  let inBand = 0
  for (let i = 0; i < count + 1; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.cc')) return null
      const s = getComputedStyle(el)
      let ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1
      const blank = el.closest('.cc-blank')
      if (!ring && blank) { const rule = blank.querySelector('.cc-rule'); const rs = getComputedStyle(rule); ring = parseFloat(rs.height) >= 5 || rs.boxShadow !== 'none' }
      return { ring, visible: el.matches(':focus-visible'), name: (el.textContent || el.getAttribute('aria-label') || el.id || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    inBand++
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  if (count && !inBand) problems.push('Tab never reaches the band')
  return problems
}

const FORM = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const form = document.querySelector('.cc-form')
  if (!form || form.closest('[hidden]')) return out
  const input = form.querySelector('input[name="email"]')
  if (input.type !== 'email') out.push('the email blank is not type="email"')
  if (input.inputMode !== 'email') out.push('the email blank has no inputmode="email"')
  if (input.autocomplete !== 'email') out.push('the email blank has no autocomplete="email"')
  for (const c of form.querySelectorAll('input, select')) if (!(c.labels && c.labels.length && c.labels[0].textContent.trim())) out.push('a blank has no label: ' + c.name)
  for (const c of form.querySelectorAll('.cc-cap')) if (!c.textContent.trim()) out.push('a blank has no visible caption')
  // the rule starts where the text starts
  for (const b of form.querySelectorAll('.cc-blank')) {
    const ctl = b.querySelector('input, select'), rule = b.querySelector('.cc-rule')
    const d = Math.abs(rule.getBoundingClientRect().left - ctl.getBoundingClientRect().left)
    if (d > 1.5) out.push('a blank\\'s rule starts ' + d.toFixed(1) + 'px from its text')
  }
  form.setAttribute('action', '#')
  input.value = ''; input.dispatchEvent(new Event('input'))
  form.requestSubmit(); await wait(80)
  if (input.getAttribute('aria-invalid') !== 'true') out.push('an empty send does not mark the email field invalid')
  if (!form.querySelector('.cc-msg').textContent.trim()) out.push('an empty send shows no message')
  if (document.activeElement !== input) out.push('after an error, focus is not in the email field')
  input.value = 'ana@mail'; input.dispatchEvent(new Event('input'))
  form.requestSubmit(); await wait(80)
  if (input.getAttribute('aria-invalid') !== 'true') out.push('a bad address is not caught')
  input.value = 'ana@mail.example'; input.dispatchEvent(new Event('input'))
  form.requestSubmit(); await wait(80)
  if (document.querySelector('.cc').dataset.state !== 'sending') out.push('sending does not show')
  await wait(1300)
  if (document.querySelector('.cc').dataset.state !== 'sent') out.push('a good address does not reach the sent state')
  else if (!document.querySelector('.cc-sent .cc-say').textContent.includes('ana@mail.example')) out.push('the sent line does not repeat the address')
  return out
})()`

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
  for (let i = 0; i < 100 && !(await ev('!!window.ClosingCTA')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.ClosingCTA'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
  await ev('window.ClosingCTA.ready')
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
        // live: the page as a visitor gets it, today pinned so the run is repeatable
        const { tab, ev, errors } = await open(chrome, `${base}?cc-now=${encodeURIComponent((await previewNow(file)) ?? '')}`, w, h, reduce)
        const before = await ev('document.querySelector(".cc").hasAttribute("data-settled")')
        if (reduce && !before) problems.push('under reduced motion the band is not settled from the start')
        if (!reduce && before) problems.push('the entrance ran before the band was in view')
        await ev(`(() => { const r = document.querySelector('.cc'); const t = r.getBoundingClientRect().top + scrollY; scrollTo(0, Math.max(0, r.offsetHeight <= innerHeight ? t - (innerHeight - r.offsetHeight) / 2 : t - 16)) })()`)
        const ms = await ev('window.ClosingCTA.settleMs')
        await new Promise((r) => setTimeout(r, (reduce ? 0 : ms) + 500))
        if (!(await ev('document.querySelector(".cc").hasAttribute("data-settled")'))) problems.push('the entrance did not report settled')
        if (!reduce) {
          await ev('scrollTo(0, 0)'); await new Promise((r) => setTimeout(r, 120))
          await ev(`(() => { const r = document.querySelector('.cc'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 16) })()`)
          await new Promise((r) => setTimeout(r, 150))
          const moving = await ev(`[...document.querySelectorAll('.cc-shadow, .cc-ps-title, .cc-rule')].some((el) => { const s = el.style; return (s.opacity && Number(s.opacity) < 1) || (s.transform && !/translateY\\(0px\\)|scaleX\\(1\\)/.test(s.transform)) })`)
          if (moving) problems.push('the entrance ran a second time')
        }
        const r = await ev(AUDIT)
        problems.push(...r.problems)
        problems.push(...(await focusRings(tab, ev)))
        if (w === 1440 && !reduce) problems.push(...(await ev(FORM)))
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
        info = `${r.pairs} text pairs, lowest contrast ${r.worst}× its minimum${r.stubLow ? `, stub labels ${r.stubLow}:1` : ''}${r.stampInfo ? `, ${r.stampInfo}` : ''}`
      } catch (e) {
        problems.push(e.message)
      } finally {
        await chrome.close()
      }
      const tag = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      if (problems.length) { failed++; console.log(`✗ ${tag}: ${info}`); for (const p of problems) console.log(`    - ${p}`) }
      else console.log(`✓ ${tag}: ${info}`)
    }
    // after the deadline
    const closes = await deadline(file)
    if (closes != null) {
      const chrome = await launch({ width: 1440, height: 900 })
      const problems = []
      try {
        const after = new Date(closes + 864e5).toISOString().slice(0, 10)
        const { ev, errors } = await open(chrome, `${base}?cc-now=${after}`, 1440, 900, true)
        const r = await ev(`(() => {
          const root = document.querySelector('.cc')
          const out = []
          if (!root.hasAttribute('data-closed')) out.push('the band does not switch to its after-close copy')
          if (!root.querySelector('[data-when="closed"]')) out.push('there is no after-close copy')
          for (const el of root.querySelectorAll('[data-when="open"]')) if (!el.hidden) out.push('open copy still shows after the deadline')
          const today = root.querySelector('.cc-today')
          if (today && getComputedStyle(today).display !== 'none') out.push('the today marker still shows after the deadline')
          return out
        })()`)
        problems.push(...r)
        const a = await ev(AUDIT)
        problems.push(...a.problems)
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
      } catch (e) {
        problems.push(e.message)
      } finally {
        await chrome.close()
      }
      if (problems.length) { failed++; console.log('✗ after the deadline (1440)'); for (const p of problems) console.log(`    - ${p}`) }
      else console.log('✓ after the deadline (1440): after-close copy shown, open copy hidden')
    }
  } finally {
    server.close()
  }
  return failed
}

import { readFileSync } from 'node:fs'
const dataOf = (file) => { const m = /data-cc='([^']*)'/.exec(readFileSync(file, 'utf8')); return m ? JSON.parse(m[1].replace(/&#39;/g, "'")) : {} }
async function previewNow(file) { return dataOf(file).previewNow ?? null }
async function deadline(file) { return dataOf(file).closes ?? null }

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
