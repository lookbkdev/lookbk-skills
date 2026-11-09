// Footer Kit: serves the built page and opens it in headless Chrome at 390,
// 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440. At
// each size it scrolls the whole page, rests at the end, and fails on:
//   - script errors, links without an address
//   - sideways scrolling, at any point down the page
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px), on the sheet and on the board
//   - text cut off by its box or running off the screen; the floor not
//     clearing the bottom of the screen (safe area)
//   - the name not filling the measure: the inked pixels of the name are
//     found in a screenshot and must touch both edges of the measure and the
//     top and bottom of its box (within 2 px)
//   - a name on one line under the stacking height when it may break
//   - the lift not working (board not under the sheet, no shadow mid-way,
//     not finished at the end), back to top not going to the top
//   - the newsletter form not showing its error and sent states; the place
//     hours without a status or a today row; map labels under 12 px
//   - a keyboard focus that can't be seen (Tab through the page)
//   - reduced motion that isn't the finished state (board under the sheet,
//     a shadow, a moving floor, running animations)
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
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

/** A Chrome screenshot PNG (8-bit RGB/RGBA, not interlaced) to { w, h, px(x, y) -> [r, g, b] }. */
function png(buf) {
  let o = 8, w, h, ct, idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9] }
    else if (type === 'IDAT') idat.push(d)
    o += 12 + len
  }
  const bpp = ct === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      out[y * stride + x] = v & 255
    }
  }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]] } }
}

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.fk-label, .fk-mapl, .fk-pg, .fk-note, .fk-no, .fk-d, .fk-socials a span'
  const skip = (el) => el.closest('.fk-sr, [aria-hidden="true"]:not(.fk-wl)')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el) && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE')
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
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
  for (const el of document.body.querySelectorAll('.fk *, .fk-page *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.fk-wm, .fk-map')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && !el.matches('.fk-board, .fk-wm') && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  for (const el of document.querySelectorAll('.fk-mapl')) if (parseFloat(getComputedStyle(el).fontSize) < 12) say('a map label is under 12px: ' + name(el))
  // the floor clears the bottom of the screen at the end of the page
  const fl = document.querySelector('.fk-floor')
  if (parseFloat(getComputedStyle(fl).paddingBottom) < 14) say('the floor has under 14px below the name')
  const wm = document.querySelector('.fk-wm').getBoundingClientRect()
  if (wm.bottom > innerHeight + 1) say('the name runs past the bottom of the screen at the end of the page')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('a[href], button, input')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length`)
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

/** The name's inked pixels must reach every edge of its box (the measure). */
async function inkFit(tab, ev) {
  await ev('scrollTo(0, document.documentElement.scrollHeight); new Promise((r) => setTimeout(r, 400))')
  const box = await ev(`(() => { const r = document.querySelector('.fk-wm').getBoundingClientRect(); const s = getComputedStyle(document.querySelector('.fk-board')).backgroundColor.match(/\\d+/g).map(Number); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, bg: s, lines: window.FooterKit.fit.lines, inkH: window.FooterKit.fit.inkH, br: !!document.querySelector('.fk-wl[data-set="2"]'), stack: JSON.parse(document.querySelector('.fk').dataset.fk).stackBelow } })()`)
  const pad = 6
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2, scale: 1 }
  const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip })
  const img = png(Buffer.from(data, 'base64'))
  let l = img.w, r = -1, t = img.h, b = -1
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const p = img.px(x, y)
      if (Math.abs(p[0] - box.bg[0]) + Math.abs(p[1] - box.bg[1]) + Math.abs(p[2] - box.bg[2]) > 90) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y }
    }
  const ox = box.x - clip.x, oy = box.y - clip.y
  const e = { left: l - ox, right: ox + box.w - 1 - r, top: t - oy, bottom: oy + box.h - 1 - b }
  const problems = []
  for (const [k, v] of Object.entries(e)) if (Math.abs(v) > 2) problems.push(`the name's ink is ${v.toFixed(0)}px from the ${k} edge of the measure (fit off)`)
  if (box.lines === 1 && box.br && box.inkH < box.stack - 0.5) problems.push(`the name is ${box.inkH.toFixed(0)}px tall on one line; it should stack under ${box.stack}px`)
  return { problems, info: `name ${box.lines} line${box.lines > 1 ? 's' : ''}, ${Math.round(box.inkH)}px tall, ink edges ${Object.values(e).map((v) => v.toFixed(0)).join('/')}px` }
}

const LIFT = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fk = document.querySelector('.fk'), board = document.querySelector('.fk-board'), upper = document.querySelector('.fk-upper')
  const end = document.documentElement.scrollHeight - innerHeight
  if (!fk.classList.contains('fk-lift')) { if (upper.offsetHeight >= board.offsetHeight) out.push('the board is not under the sheet'); return out }
  scrollTo(0, end - board.offsetHeight * 0.5); await wait(250)
  if (getComputedStyle(board).position !== 'sticky') out.push('the board does not stay under the sheet')
  const lift = parseFloat(getComputedStyle(fk).getPropertyValue('--lift'))
  if (!(lift > 0.2)) out.push('the sheet does not lift half way down the board (--lift ' + lift + ')')
  const sh = document.querySelector('.fk-shade')
  if (getComputedStyle(sh).display === 'none' || parseFloat(getComputedStyle(sh).opacity) < 0.5) out.push('no shadow under the sheet half way')
  if (!document.querySelector('.fk-floor').style.transform) out.push('the name does not rise half way')
  scrollTo(0, end); await wait(500)
  if (!fk.classList.contains('fk-done')) out.push('the lift does not finish at the end of the page')
  if (document.querySelector('.fk-floor').style.transform) out.push('the floor is not at rest at the end')
  return out
})()`

const INTERACT = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const form = document.querySelector('.fk-form')
  if (form) {
    const input = form.querySelector('input')
    input.value = ''
    form.requestSubmit()
    await wait(100)
    if (form.dataset.state !== 'error' || input.getAttribute('aria-invalid') !== 'true') out.push('an empty address does not show the error state')
    if (!form.querySelector('.fk-fine').textContent.trim()) out.push('the error state has no message')
    input.value = 'reader@example.com'
    input.dispatchEvent(new Event('input'))
    form.requestSubmit()
    await wait(form.getAttribute('action') === '#' ? 150 : 2500)
    if (form.dataset.state !== 'sent') out.push('a valid address does not reach the sent state (' + form.dataset.state + ')')
    window.FooterKit.form('empty', '')
  }
  const hours = document.querySelector('.fk-hours')
  if (hours) {
    if (!hours.querySelector('.fk-status').textContent.trim()) out.push('the hours have no open/closed status')
    if (hours.querySelectorAll('tr.fk-today').length !== 1) out.push('the hours do not mark today')
  }
  const top = document.querySelector('.fk-top')
  scrollTo(0, document.documentElement.scrollHeight)
  await wait(200)
  top.click()
  for (let i = 0; i < 30 && scrollY > 2; i++) await wait(100)
  if (scrollY > 2) out.push('back to top does not reach the top (' + Math.round(scrollY) + 'px)')
  return out
})()`

const STILL = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fk = document.querySelector('.fk')
  if (!fk.classList.contains('fk-still')) out.push('reduced motion is not detected')
  if (fk.classList.contains('fk-lift') || getComputedStyle(document.querySelector('.fk-board')).position === 'sticky') out.push('with reduced motion the board is still under the sheet')
  if (getComputedStyle(document.querySelector('.fk-shade')).display !== 'none') out.push('with reduced motion the shadow is still drawn')
  const parts = [...document.querySelectorAll('.fk-floor, .fk-lead, .fk-rt, .fk-field, .fk-upper')]
  const snap = () => parts.map((el) => { const s = getComputedStyle(el); return s.transform + '|' + s.opacity + '|' + s.strokeDashoffset })
  const end = document.documentElement.scrollHeight - innerHeight
  scrollTo(0, end - innerHeight * 0.6); await wait(200)
  const a = snap()
  scrollTo(0, end); await wait(300)
  const b = snap()
  if (a.some((v, i) => v !== b[i])) out.push('something still moves with the scroll under reduced motion')
  if (parts.some((el) => el.matches('.fk-floor') && getComputedStyle(el).transform !== 'none')) out.push('the floor is displaced with reduced motion')
  const wm = document.querySelector('.fk-wm').getBoundingClientRect()
  if (wm.bottom > innerHeight + 1 || wm.top < 0) out.push('the name is not fully visible at the end with reduced motion')
  if (document.getAnimations().length) out.push(document.getAnimations().length + ' animations run with reduced motion')
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
      await ev('document.fonts.ready.then(() => window.FooterKit && window.FooterKit.ready).then(() => new Promise((r) => setTimeout(r, 500)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 60))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
        }
      }
      await ev('scrollTo(0, document.documentElement.scrollHeight); new Promise((r) => setTimeout(r, 600))')
      const audit = await ev(AUDIT)
      problems.push(...audit.problems)
      const fit = await inkFit(tab, ev)
      problems.push(...fit.problems)
      if (reduce) problems.push(...(await ev(STILL)))
      else problems.push(...(await ev(LIFT)))
      problems.push(...(await ev(INTERACT)))
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const info = `${audit.pairs} text/background pairs (lowest ${audit.worst}x the minimum), ${fit.info}${reduce ? ', finished state' : ''}`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}`)
      await chrome.send('Target.closeTarget', { targetId: (await chrome.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page' && t.url.startsWith(server.url))?.targetId }).catch(() => {})
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
