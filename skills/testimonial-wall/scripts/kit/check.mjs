// Testimonial Wall: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it scrolls the whole section, lets it run, and fails on:
//   - script errors, links without an address
//   - sideways scrolling, at any point down the page
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is behind it
//   - text cut off by its box, off the screen, or inside the 16 px phone gutter
//   - a review shown twice on the wall at once, or a visible review cut by the wall's edge
//   - a wall that doesn't move, or keeps moving when paused or hovered
//   - a letter tab or a case arrow that doesn't answer, or a page that shifts
//     when the letter changes
//   - a keyboard focus that can't be seen (Tab through the page)
//   - reduced motion that still moves
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
  const skip = (el) => el.closest('.tw-sr')
  const shown = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none') return false }
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest('.tw-l, .tw-mono, .tw-tile') ? 12 : min
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
  const faded = (el) => { for (let n = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.99) return true; return false }
  for (const el of texts) {
    if (faded(el) || el.closest('.tw-mono')) continue
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  const ALLOW = '.tw, .tw-cols, .tw-col, .tw-wall, .tw-ln, .tw-rail, .tw-rail-wrap, .tw-ph, .tw-hist i, .tw-title .tw-tl'
  for (const el of document.body.querySelectorAll('.tw *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.matches(ALLOW)) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (el.closest('.tw-rail, .tw-cols') || faded(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    else if (phone && (r.left < 15.5 || r.right > vw - 15.5)) say('text sits inside the 16px phone gutter (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  return out
})()`

// The wall at this moment: what is visible, cut, or shown twice.
const WALL = `(() => {
  const w = document.querySelector('.tw-wall'); const box = w.getBoundingClientRect()
  const vis = [...w.querySelectorAll('.tw-cols .tw-note')].filter((n) => parseFloat(getComputedStyle(n).opacity) > 0.05)
  const out = { dup: [], cut: [], n: vis.length, tracks: [...w.querySelectorAll('.tw-track')].map((t) => getComputedStyle(t).transform) }
  const seen = new Set()
  for (const n of vis) {
    const r = n.getBoundingClientRect()
    if (r.bottom < box.top || r.top > box.bottom) continue
    const t = n.querySelector('p').textContent
    if (seen.has(t)) out.dup.push(t.slice(0, 40)); seen.add(t)
    if (r.top < box.top - 1 || r.bottom > box.bottom + 1) out.cut.push(t.slice(0, 40))
  }
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('a[href], button, [tabindex="0"]')].filter((el) => el.getClientRects().length && !el.hidden).length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 60); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none')
      return { ring, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  return problems
}

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
      const ev = async (expression) => (await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
      const wait = (ms) => ev(`new Promise((r) => setTimeout(r, ${ms}))`)
      await ev('(window.TestimonialWall ? window.TestimonialWall.ready : Promise.resolve()).then(() => new Promise((r) => setTimeout(r, 400)))')
      await ev(`try { sessionStorage.removeItem('tw-paused') } catch (e) {}`)
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 90))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
        }
      }
      await ev('scrollTo(0, 0)')
      await wait(1400)
      for (const p of await ev(AUDIT)) problems.push(p)

      // the wall, looked at over three seconds
      await ev(`document.querySelector('.tw-wall').scrollIntoView({ block: 'center' })`)
      await wait(300)
      const dup = new Set(), cut = new Set()
      let first = null, last = null
      for (let i = 0; i < 6; i++) {
        const s = await ev(WALL)
        s.dup.forEach((d) => dup.add(d)); s.cut.forEach((c) => cut.add(c))
        if (!first) first = s
        last = s
        await wait(500)
      }
      for (const d of dup) problems.push(`a review is on the wall twice at once: "${d}…"`)
      for (const c of cut) problems.push(`a visible review is cut by the wall's edge: "${c}…"`)
      if (!reduce) {
        if (JSON.stringify(first.tracks) === JSON.stringify(last.tracks)) problems.push('the wall does not move')
        // pause button
        await ev(`document.querySelector('.tw-pause').click()`)
        await wait(200)
        const a = await ev(WALL), pa = await ev(`document.querySelector('.tw-tab[aria-selected="true"]').style.getPropertyValue('--p')`)
        await wait(800)
        const b = await ev(WALL), pb = await ev(`document.querySelector('.tw-tab[aria-selected="true"]').style.getPropertyValue('--p')`)
        if (JSON.stringify(a.tracks) !== JSON.stringify(b.tracks)) problems.push('the wall keeps moving after Pause motion')
        if (pa !== pb) problems.push('the lead letter keeps running after Pause motion')
        if ((await ev(`document.querySelector('.tw-pause').getAttribute('aria-pressed')`)) !== 'true') problems.push('the pause button does not show it is pressed')
        await ev(`document.querySelector('.tw-pause').click()`)
        // hover pauses a column
        const c = await ev(`(() => { const r = document.querySelector('.tw-cols .tw-col').getBoundingClientRect(); return [r.left + r.width / 2, Math.max(r.top, 0) + 40] })()`)
        await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] })
        await wait(250)
        const h1 = (await ev(WALL)).tracks[0]
        await wait(700)
        const h2 = (await ev(WALL)).tracks[0]
        if (h1 !== h2) problems.push('a wall column keeps moving under the pointer')
        await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
      }

      // the lead letter: a tab switches it, and nothing below moves
      await ev(`document.querySelector('.tw-lead').scrollIntoView({ block: 'start' })`)
      await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
      const below = `(() => { const el = document.querySelector('.tw-cases, .tw-press:last-child') || document.querySelector('.tw-wall'); return Math.round(el.getBoundingClientRect().top + scrollY) })()`
      const y0 = await ev(below)
      await ev(`document.querySelectorAll('.tw-tab')[1].click()`)
      await wait(reduce ? 200 : 2600)
      if ((await ev(`document.querySelectorAll('.tw-tab')[1].getAttribute('aria-selected')`)) !== 'true' || (await ev(`document.querySelectorAll('.tw-slot')[1].hidden`)))
        problems.push('the second letter does not show when its tab is clicked')
      if ((await ev(below)) !== y0) problems.push(`the page below shifts when the letter changes (${y0} → ${await ev(below)})`)

      // the cases: next and back
      if (await ev(`!!document.querySelector('.tw-rail')`)) {
        await ev(`document.querySelector('.tw-cases').scrollIntoView({ block: 'center' })`)
        await ev(`document.querySelector('.tw-arrow[data-dir="1"]').click()`)
        await wait(900)
        if ((await ev(`document.querySelector('.tw-rail').scrollLeft`)) < 10) problems.push('the next-case arrow does not move the cards')
        else if ((await ev(`document.querySelector('.tw-arrow[data-dir="-1"]').getAttribute('aria-disabled')`)) !== 'false') problems.push('the previous-case arrow stays disabled after moving')
        await ev(`document.querySelector('.tw-arrow[data-dir="-1"]').click()`)
        await wait(900)
      }

      if (reduce) {
        const parts = `[...document.querySelectorAll('.tw-track, .tw-ln > span, .tw-note, .tw-hist b, .tw-no, .tw-att, .tw-res')].map((el) => { const s = getComputedStyle(el); return s.transform + '|' + s.opacity }).join(',')`
        const a = await ev(parts)
        await wait(900)
        if (a !== (await ev(parts))) problems.push('something still moves with reduced motion')
        if (await ev(`!document.documentElement.querySelector('.tw.tw-still')`)) problems.push('reduced motion is not detected')
        const anims = await ev('document.getAnimations().length')
        if (anims) problems.push(`${anims} CSS animations run with reduced motion`)
      }
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const cols = await ev(`document.querySelectorAll('.tw-cols .tw-col').length`)
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: wall in ${cols} column${cols > 1 ? 's' : ''}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: wall in ${cols} column${cols > 1 ? 's' : ''}, ${first.n} reviews visible${reduce ? ', still' : ''}`)
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
