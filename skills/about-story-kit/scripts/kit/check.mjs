// About Story Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it fails on:
//   - script errors, links without an address
//   - sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box or running off the screen
//   - initials on a portrait tile that are not fully inside the tile with a
//     margin (measured from the glyphs' own ink box, not the line box)
//   - a person without a visible decision line where there is no hover
//     (phones, and every width without a viewer), or a viewer that does not
//     follow the hovered row (index layout, desktop)
//   - the headcount on the page not matching the people listed
//   - every milestone without its evidence note, every number without its
//     footnote
//   - the record not fully drawn under reduced motion, or drawn before the
//     visitor gets to it (live)
//   - rail entries overlapping each other or running past the page
//   - a keyboard focus that can't be seen (it presses Tab through the page)
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
  const phone = vw < 768
  const min = phone ? 16 : 14
  const root = document.querySelector('.ab')
  const LABEL = '.ab-lbl, .ab-n, .ab-mk, .ab-fk, .ab-k, .ab-gaps, .ab-tk'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], .ab-sr, .ab-skip, script, style, .ab-defs')
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
  let smallest = 99, smallestLabel = 99
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const label = !!el.closest(LABEL)
    const need = label ? 12 : min
    if (label) smallestLabel = Math.min(smallestLabel, fs); else smallest = Math.min(smallest, fs)
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
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('svg')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && s.overflowX !== 'clip' && el.scrollWidth > el.clientWidth + 2 && !el.closest('.ab-toc')) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2 && !el.closest('.ab-toc, .ab-tw')) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (el.closest('.ab-toc')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  // the initials sit inside their tile, measured from the glyphs' ink
  const cv = document.createElement('canvas').getContext('2d')
  let tiles = 0, tightest = 99
  for (const m of root.querySelectorAll('.ab-mono')) {
    const tile = m.parentElement
    if (!shown(tile)) continue
    const s = getComputedStyle(m)
    cv.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily
    cv.letterSpacing = s.letterSpacing
    const t = cv.measureText(m.textContent)
    const r = m.getBoundingClientRect(), b = tile.getBoundingClientRect()
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize)
    const fa = t.fontBoundingBoxAscent, fd = t.fontBoundingBoxDescent
    const base = r.top + (lh - (fa + fd)) / 2 + fa
    const ink = { top: base - t.actualBoundingBoxAscent, bottom: base + t.actualBoundingBoxDescent, left: r.left - t.actualBoundingBoxLeft, right: r.left + t.actualBoundingBoxRight }
    const margin = Math.min(ink.top - b.top, b.bottom - ink.bottom, ink.left - b.left, b.right - ink.right) / b.width
    tiles++; tightest = Math.min(tightest, margin)
    if (margin < 0.03) say('initials "' + m.textContent + '" reach the edge of their tile (' + (margin * 100).toFixed(1) + '% margin)')
  }
  // supplied portraits: loaded, and shown through the palette's duotone
  let photos = 0
  for (const img of root.querySelectorAll('.ab-photo img')) {
    if (!shown(img.parentElement)) continue
    if (!img.complete || !img.naturalWidth) say('a portrait did not load: ' + img.getAttribute('src'))
    if (img.classList.contains('ab-duo')) { photos++; if (!getComputedStyle(img).filter.includes('url(')) say('a portrait is not in the duotone: ' + img.getAttribute('src')) }
  }
  // decisions: visible where nothing hovers, and the viewer follows the rows
  const viewer = root.querySelector('.ab-viewer')
  const viewerOn = viewer && shown(viewer)
  const noHover = !matchMedia('(hover: hover)').matches || phone
  for (const p of root.querySelectorAll('.ab-pp')) {
    const d = p.querySelector('.ab-dec')
    if (!d || !d.textContent.trim()) { say('a person has no decision line: ' + name(p.querySelector('h3'))); continue }
    if (noHover) { const r = d.getBoundingClientRect(), t = p.querySelector('.ab-tile').getBoundingClientRect(); if (!shown(d) || (r.top < t.bottom - 1 && r.left < t.right - 1)) say('on a touch screen the decision is not printed beside ' + name(p.querySelector('h3'))) }
  }
  for (const row of root.querySelectorAll('.ab-row')) {
    const d = row.querySelector('.ab-rdec')
    if (!d || !d.textContent.trim()) say('a person has no decision line: ' + name(row.querySelector('h3')))
    else if (!viewerOn && !shown(d)) say('without the viewer, the decision is hidden for ' + name(row.querySelector('h3')))
  }
  // the page agrees with itself
  const sec = root.querySelector('.ab-people')
  const listed = root.querySelectorAll('.ab-pp, .ab-row').length + root.querySelectorAll('.ab-roll li').length
  if (Number(sec.dataset.headcount) !== listed) say('the page says ' + sec.dataset.headcount + ' people but lists ' + listed)
  const ents = root.querySelectorAll('.ab-ent')
  for (const e of ents) { const n = e.querySelector('.ab-note'); if (!n || !n.textContent.trim() || !shown(n)) say('a milestone shows no evidence: ' + name(e.querySelector('h3'))) }
  const figs = root.querySelectorAll('.ab-figs li').length, fns = root.querySelectorAll('.ab-fns li').length
  if (figs !== fns) say(figs + ' numbers but ' + fns + ' sources')
  // rail entries clear of each other and of the page edge
  const rail = root.querySelector('.ab-railjs')
  if (rail) {
    const boxes = [...rail.querySelectorAll('.ab-ent')].map((e) => e.getBoundingClientRect())
    const tb = rail.getBoundingClientRect()
    boxes.forEach((a, i) => {
      if (a.left < tb.left - 1 || a.right > tb.right + 1) say('rail entry ' + (i + 1) + ' runs past the record')
      boxes.forEach((b, k) => { if (k > i && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) say('rail entries ' + (i + 1) + ' and ' + (k + 1) + ' overlap') })
    })
  }
  const mode = rail ? 'rail' : root.querySelector('.ab-rail') ? 'rail as spine' : 'spine'
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, smallest, smallestLabel, tiles, photos, tightest: Math.round(tightest * 1000) / 10, mode, viewer: !!viewerOn }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.ab a[href], .ab [tabindex="0"]')].filter((el) => el.getClientRects().length && !el.closest('[hidden], [aria-hidden="true"]')).length`)
  await ev(`document.activeElement && document.activeElement.blur(); scrollTo(0, 0)`)
  const seen = new Set()
  let inPage = 0
  for (let i = 0; i < Math.min(count, 60) + 8; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.ab')) return null
      const s = getComputedStyle(el)
      return { ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    inPage++
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  if (count && !inPage) problems.push('Tab never reaches the page')
  return problems
}

/** At desktop widths with the index viewer: hovering a row changes the viewer. */
const VIEWER = `(async () => {
  const out = []
  const v = document.querySelector('.ab-viewer')
  if (!v || getComputedStyle(v).display === 'none') return out
  const rows = [...document.querySelectorAll('.ab-row')]
  const last = rows.length - 1
  rows[last].dispatchEvent(new MouseEvent('mouseenter'))
  await new Promise((r) => setTimeout(r, 60))
  const shownPanel = [...v.querySelectorAll('.ab-vp')].findIndex((p) => !p.hidden)
  if (shownPanel !== last) out.push('hovering a row does not change the viewer')
  if (!rows[last].classList.contains('ab-cur')) out.push('the hovered row is not marked')
  const q = v.querySelectorAll('.ab-vp')[last].querySelector('.ab-vq').textContent.trim()
  const line = rows[last].querySelector('.ab-rdec').textContent
  if (!line.includes(q)) out.push('the viewer shows a different decision from the row')
  rows[0].dispatchEvent(new MouseEvent('mouseenter'))
  return out
})()`

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
  if (w < 768) await tab.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  for (let i = 0; i < 100 && !(await ev('!!window.AboutKit')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.AboutKit'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
  await ev('window.AboutKit.ready')
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
        // the record: drawn as the visitor reaches it, or fully drawn under reduced motion
        const p0 = await ev('window.AboutKit.progress()')
        if (reduce && p0 < 1) problems.push(`under reduced motion the record is drawn only to ${p0.toFixed(2)}`)
        if (!reduce && p0 > 0.01) problems.push(`the record is already drawn to ${p0.toFixed(2)} at the top of the page`)
        // walk the page so every section has come into view, then settle at the bottom
        const H = await ev('document.documentElement.scrollHeight')
        for (let y = 0; y <= H; y += Math.round(h * 0.7)) { await ev(`scrollTo(0, ${y})`); await new Promise((r) => setTimeout(r, 70)) }
        await new Promise((r) => setTimeout(r, 600))
        const p1 = await ev('window.AboutKit.progress()')
        if (p1 < 1) problems.push(`at the bottom of the page the record is drawn only to ${p1.toFixed(2)}`)
        const unrisen = await ev(`document.querySelectorAll('.ab-rise:not(.ab-in)').length`)
        if (unrisen) problems.push(`${unrisen} section(s) never faded in`)
        await ev('scrollTo(0, 0)')
        await new Promise((r) => setTimeout(r, 120))
        const r = await ev(AUDIT)
        problems.push(...r.problems)
        if (w >= 1024 && !reduce) problems.push(...(await ev(VIEWER)))
        problems.push(...(await focusRings(tab, ev)))
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
        info = `${r.pairs} text pairs, lowest contrast ${r.worst}× its minimum, smallest copy ${r.smallest}px, smallest label ${r.smallestLabel}px, ${r.tiles ? `${r.tiles} fallback tiles (initials ${r.tightest}% from the edge at least)` : ''}${r.tiles && r.photos ? ', ' : ''}${r.photos ? `${r.photos} portraits in the duotone` : ''}, record: ${r.mode}${r.viewer ? ', viewer on' : ''}`
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
