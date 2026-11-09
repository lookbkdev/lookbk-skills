// Spec Sheet Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it fails on:
//   - script errors; sideways scrolling anywhere down the page
//   - page text under 16 px on a phone or 14 px elsewhere (labels: 12 px);
//     drawing text under 12 px as it is shown on screen
//   - text under WCAG AA contrast against what is behind it (4.5:1, or 3:1
//     from 24 px), page text and drawing text alike
//   - text cut off by its box, running off the screen, or closer than 16 px
//     to the screen's edge on a phone (safe area)
//   - labels on the drawing that overlap each other or a balloon
//   - the dimensions not drawn after arriving, or drawn more than once
//   - linking that does not work both ways (a line lights its part or
//     dimension; a part lights its lines)
//   - the unit switch not converting the table, the drawing and the notes
//   - compare mode without phantom lines and per-model columns
//   - on a phone, a tapped line not jumping to the view that shows it
//   - a keyboard focus that can't be seen
//   - reduced motion that animates anything
// Once per page it also prints to PDF and fails unless the sheet is one page.
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { PAPER, pdfPages } from './record.mjs'

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
  const vw = innerWidth, phone = vw <= 760, min = phone ? 16 : 14
  const LABEL = '.ss-eyebrow, .ss-ctl .lab, .ss-grp h3, .ss-t thead, .ss-u, .ss-al, .ss-lb small, .ss-box li span, .ss-marks li, .ss-cap, .ss-legend, .ss-bn, .ss-views button, .ss-ctl .val, .ss-print'
  const skip = (el) => el.closest('.ss-sr, .ss-live, [aria-hidden="true"], .ss-pdw, script, style')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const all = [...document.querySelectorAll('.ss *')].filter((el) => own(el) && !skip(el) && shown(el))
  const html = all.filter((el) => !(el instanceof SVGElement))
  const svgText = all.filter((el) => el instanceof SVGElement && el.closest('.ss-sdw'))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const el of html) {
    const fs = parseFloat(getComputedStyle(el).fontSize), need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  let svgMin = 99
  for (const el of svgText) {
    const fs = parseFloat(getComputedStyle(el).fontSize) * el.ownerSVGElement.getScreenCTM().a
    svgMin = Math.min(svgMin, fs)
    if (fs < 11.9) say('drawing text at ' + fs.toFixed(1) + 'px on screen (at least 12px): ' + name(el))
  }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el instanceof SVGElement ? el.closest('.ss-sheet') : el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = [255, 255, 255]; for (const c of layers.reverse()) bg = over(c, bg); return bg
  }
  let pairs = 0, worst = 99
  for (const el of all) {
    const s = getComputedStyle(el), fg = parse(el instanceof SVGElement ? s.fill : s.color)
    if (!fg || fg[3] === 0) continue
    // a balloon's number sits on the balloon
    let bg = behind(el)
    if (el.closest('.ss-bal')) bg = over(parse(getComputedStyle(el.closest('.ss-bal').querySelector('.ss-bc')).fill) || [255, 255, 255, 1], bg)
    let op = 1; for (let n = el; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity
    if (op < 0.99) continue // stepped back while something else is selected
    const L1 = lum(over(fg, bg)), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize) * (el instanceof SVGElement ? el.ownerSVGElement.getScreenCTM().a : 1), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, ratio / need)
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of html) {
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2 && !el.closest('.ss-views')) say('text is cut off at the side of its box: ' + name(el))
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    if (phone && !el.closest('.ss-views') && (r.left < 15 || r.right > vw - 15)) say('text within 16px of the screen edge on a phone: ' + name(el))
  }
  // drawing labels must not collide
  const boxes = [...svgText.map((el) => ({ el, r: el.getBoundingClientRect() })), ...[...document.querySelectorAll('.ss-sdw .ss-bc')].filter(shown).map((el) => ({ el, r: el.getBoundingClientRect(), ball: true }))]
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]
    if (a.ball && b.ball) continue
    if (a.el.closest('.ss-bal') && a.el.closest('.ss-bal') === b.el.closest('.ss-bal')) continue
    if (hit(a.r, b.r)) say('drawing labels overlap: ' + name(a.el) + ' and ' + (b.ball ? 'balloon ' + b.el.parentNode.textContent.trim() : name(b.el)))
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, svgMin: Math.round(svgMin * 10) / 10 }
})()`

const BEHAVE = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const S = window.SpecSheet, spec = JSON.parse(document.querySelector('.ss-data').textContent), phone = innerWidth <= 900, crop = () => document.querySelector('.ss').classList.contains('ss-crop')
  const sdw = () => document.querySelector('.ss-sdw')
  // the draw-in: done once the sheet has arrived, and only once
  document.querySelector('.ss-sheet').scrollIntoView({ block: 'center' }); await wait(1800)
  if (!S.drawn) out.push('the dimensions did not draw when the sheet came into view')
  const undrawn = [...sdw().querySelectorAll('.ss-dim .ss-dl')].filter((p) => +p.style.strokeDashoffset > 0.001 || p.style.strokeDashoffset === '').length
  if (undrawn) out.push(undrawn + ' dimension lines are not fully drawn after arriving')
  scrollTo(0, document.documentElement.scrollHeight); await wait(300); scrollTo(0, 0); await wait(300)
  document.querySelector('.ss-sheet').scrollIntoView({ block: 'center' }); await wait(400)
  if (S.drawCount !== 1) out.push('the dimensions drew ' + S.drawCount + ' times (once only)')
  // a line lights its part or dimension
  const row = document.querySelector('.ss-link')
  if (!phone) {
    row.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await wait(50)
    if (!sdw().classList.contains('ss-hl') || !sdw().querySelector('.on')) out.push('pointing at a line does not light anything on the drawing')
    document.querySelector('.ss-sched').dispatchEvent(new PointerEvent('pointerleave')); await wait(30)
    // a part lights its lines
    const part = sdw().querySelector('.ss-part:not(.ss-open)')
    part.dispatchEvent(new PointerEvent('pointerenter')); await wait(50)
    if (!document.querySelector('.ss-r.on')) out.push('pointing at a part (' + part.dataset.part + ') does not light its line')
    part.dispatchEvent(new PointerEvent('pointerleave')); await wait(30)
  }
  // units: the table, the drawing figures and the notes all convert
  const lenRow = spec.groups.flatMap((g) => g.rows || []).find((r) => r.length !== undefined)
  document.querySelector('[data-len="in"]').click(); await wait(80)
  const u = document.querySelector('.ss-r[data-k="' + lenRow.key + '"] .ss-u')
  if (!u || u.textContent !== 'in') out.push('switching to inches does not convert the table')
  const notes = [...sdw().querySelectorAll('text')].map((t) => t.textContent).join(' ')
  if (!crop() && !/Dimensions in inches/.test(notes)) out.push('switching to inches does not change the drawing notes')
  const figs = [...sdw().querySelectorAll('.ss-fig')].map((t) => t.textContent)
  if (figs.length && !figs.some((f) => /\\d\\.\\d\\d/.test(f))) out.push('switching to inches does not convert the drawing figures (' + figs.join(', ') + ')')
  document.querySelector('[data-mass="lb"]').click(); await wait(50)
  document.querySelector('[data-len="mm"]').click(); document.querySelector('[data-mass="kg"]').click(); await wait(80)
  // compare
  const cmp = document.querySelector('[data-compare]')
  if (cmp) {
    const was = S.state.compare
    if (!was) { cmp.click(); await wait(80) }
    if (!document.querySelector('.ss-cmp')) out.push('compare mode has no per-model columns')
    if (spec.drawing.views.some((v) => v.outline && (!crop() || v.id === S.state.view)) && !sdw().querySelector('.ss-ph')) out.push('compare mode draws no phantom lines')
    if (!was) { cmp.click(); await wait(80) }
  }
  // one view at a time: a tapped line jumps to the view that shows it
  if (crop()) {
    const target = spec.drawing.dims.map((d) => d.row).find((k) => spec.drawing.dims.find((d) => d.row === k).view !== S.state.view)
    if (target) {
      const r = document.querySelector('.ss-r[data-k="' + target + '"]'); r.click(); await wait(120)
      const want = spec.drawing.dims.find((d) => d.row === target).view
      if (S.state.view !== want) out.push('tapping "' + target + '" did not jump to the ' + want + ' view (' + S.state.view + ')')
      if (!document.querySelector('.ss-r.on[data-k="' + target + '"]')) out.push('a tapped line is not marked')
      document.querySelector('.ss-r[data-k="' + target + '"]').click(); await wait(80)
    }
  }
  return out
})()`

const STILL = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await wait(100)
  const undrawn = [...document.querySelectorAll('.ss-sdw .ss-dim .ss-dl')].filter((p) => +p.style.strokeDashoffset > 0.001).length
  if (undrawn) out.push('with reduced motion ' + undrawn + ' dimension lines start undrawn')
  document.querySelector('[data-len="in"]').click(); await wait(30)
  const und2 = [...document.querySelectorAll('.ss-sdw .ss-dim .ss-dl')].filter((p) => +p.style.strokeDashoffset > 0.001).length
  if (und2) out.push('with reduced motion the dimensions redraw after a change')
  document.querySelector('[data-len="mm"]').click()
  const tr = [...document.querySelectorAll('.ss *')].filter((el) => parseFloat(getComputedStyle(el).transitionDuration) > 0).length
  if (tr) out.push(tr + ' elements still have transitions with reduced motion')
  if (document.getAnimations().length) out.push(document.getAnimations().length + ' animations run with reduced motion')
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const count = await ev(`[...document.querySelectorAll('button, [tabindex="0"]')].filter((el) => el.getClientRects().length).length`)
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 90); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none')
      return { ring, visible: el.matches(':focus-visible'), name: (el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
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
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      await ev('document.fonts.ready.then(() => window.SpecSheet && window.SpecSheet.ready).then(() => new Promise((r) => setTimeout(r, 400)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 40))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1'))
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
      }
      if (reduce) problems.push(...(await ev(STILL)))
      else problems.push(...(await ev(BEHAVE)))
      await ev(`document.querySelector('.ss-sheet').scrollIntoView({ block: 'start' }); new Promise((r) => setTimeout(r, 1200))`)
      const audit = await ev(AUDIT)
      problems.push(...audit.problems)
      // and again with the other models compared, and in inches
      await ev(`(() => { const c = document.querySelector('[data-compare]'); if (c) c.click(); document.querySelector('[data-len="in"]').click() })(); new Promise((r) => setTimeout(r, 1200))`)
      const audit2 = await ev(AUDIT)
      problems.push(...audit2.problems.map((p) => p + ' (compared, inches)'))
      await ev(`(() => { const c = document.querySelector('[data-compare]'); if (c) c.click(); document.querySelector('[data-len="mm"]').click() })()`)
      // every model on its own, in inches (the longest figures): its geometry differs
      if (!reduce) for (const id of await ev(`[...document.querySelectorAll('[data-model]')].map((b) => b.dataset.model)`)) {
        await ev(`document.querySelector('[data-model="${id}"]').click(); document.querySelector('[data-len="in"]').click(); new Promise((r) => setTimeout(r, 1200))`)
        problems.push(...(await ev(AUDIT)).problems.map((p) => p + ` (${id}, inches)`))
      }
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const info = `${audit.pairs + audit2.pairs} text/background pairs (lowest ${Math.min(audit.worst, audit2.worst)}x the minimum), drawing text from ${Math.min(audit.svgMin, audit2.svgMin)}px`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}`)
      await chrome.send('Target.closeTarget', { targetId: (await chrome.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page' && t.url.startsWith(server.url))?.targetId }).catch(() => {})
    }
    // print: one sheet
    const tab = await chrome.page()
    await tab.send('Page.enable')
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url })
    await loaded
    await tab.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => window.SpecSheet.ready)', awaitPromise: true })
    const paper = (await tab.send('Runtime.evaluate', { expression: `JSON.parse(document.querySelector('.ss-data').textContent).print?.paper || 'A4'`, returnByValue: true })).result.value
    const [pw, ph] = PAPER[paper]
    const r = await tab.send('Page.printToPDF', { landscape: true, paperWidth: pw, paperHeight: ph, printBackground: true, preferCSSPageSize: true })
    const pages = pdfPages(Buffer.from(r.data, 'base64'))
    if (pages !== 1) { failed++; console.log(`FAIL print: the sheet prints on ${pages} pages of ${paper}, not one`) }
    else console.log(`ok   print: one ${paper} landscape page`)
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
