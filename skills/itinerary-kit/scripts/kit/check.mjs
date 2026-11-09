// Itinerary Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// At each size it fails on:
//   - script errors; sideways scrolling anywhere down the page; a page over 400 KB
//   - page text under 16 px on a phone or 14 px elsewhere (labels: 12 px),
//     map labels under 12 px
//   - text under WCAG AA contrast against what is behind it (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box, off the screen, or closer than 16 px to a phone's edge
//   - the three views disagreeing: each day's slice of the height strip must
//     be that day's own profile (resampled, same vertical scale), every
//     profile must share the one scale, and the drawn route of each day must
//     measure the distance printed on its card (within 2%)
//   - totals, meal counts, effort grades or places left that do not follow
//     from the days and departures (effort is recomputed from the stated rule)
//   - scrolling to a day that does not make it the active day on the map, the
//     strip, the ledger and the panel head, or a map that does not end up
//     showing all of that day's route
//   - map labels that overlap each other, sit outside the map, or sit on the
//     route without a leader line
//   - a strip band that does not take you to its day when tapped
//   - a chart panel that does not stick (phone: one that takes more than 45%
//     of the screen)
//   - a keyboard focus that can't be seen; reduced motion that animates anything
//
//   node scripts/check.mjs out/index.html
import { existsSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { EFFORT_STEPS, TERRAIN } from './schema.mjs'

const RUNS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [390, 844, true],
  [1440, 900, true],
]
const LABEL = '.it-lab, .it-lab *, .it-band, .it-op, .it-deps thead th'

const AUDIT = `((W) => {
  const out = []
  const vw = W, phone = vw <= 860, min = phone ? 16 : 14
  const LABEL = ${JSON.stringify(LABEL)}
  const skip = (el) => el.closest('.it-sr, script, style, .it-data, svg, .it-band span')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const all = [...document.querySelectorAll('.it *, .it-bar *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const el of all) {
    const fs = parseFloat(getComputedStyle(el).fontSize), need = el.matches(LABEL) || el.closest('.it-lab') ? 12 : el.closest('.it-why, .it-note, .it-mnote, .it-asof, .it-rule, .it-fact small, .it-sh p, .it-terms, .it-link, .it-eff, .it-bar') && !phone ? 14 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  for (const t of document.querySelectorAll('.it-over text')) { const fs = parseFloat(getComputedStyle(t).fontSize); if (fs < 12) say('map label at ' + fs + 'px: "' + t.textContent + '"') }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; bg = bg.slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  let pairs = 0, worst = 99
  const ratioOf = (fg, bg) => { const L1 = lum(over(fg, bg)), L2 = lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) }
  for (const el of all) {
    const s = getComputedStyle(el), fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const r = ratioOf(fg, behind(el)), fs = parseFloat(s.fontSize), need = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  // map labels: their fill against the panel colour behind the halo
  const panel = parse(getComputedStyle(document.querySelector('.it-panel')).backgroundColor).slice(0, 3)
  for (const t of document.querySelectorAll('.it-over text')) { const c = parse(getComputedStyle(t).fill); if (!c) continue; const r = ratioOf(c, panel); pairs++; worst = Math.min(worst, r / 4.5); if (r < 4.5) say('map label contrast ' + r.toFixed(2) + ':1: "' + t.textContent + '"') }
  for (const el of all) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    if (phone && (r.left < 15 || r.right > vw - 15)) say('text within 16px of the screen edge on a phone: ' + name(el))
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})`

/** the three views and the figures, from the page alone */
const VIEWS = `(() => {
  const out = []
  const api = window.Itinerary, data = api.data
  const pathPts = (d) => { const t = d.match(/[MLlz]|-?\\d*\\.?\\d+(?:e-?\\d+)?/g); const p = []; let c = 'M', x = 0, y = 0
    for (let i = 0; i < t.length;) { if (/[MLlz]/.test(t[i])) { c = t[i++]; continue } const a = +t[i], b = +t[i + 1]; i += 2; if (c === 'l') { x += a; y += b } else { x = a; y = b; if (c === 'M') c = 'L' } p.push([x, y]) } return p }
  const strip = document.querySelector('.it-strip-svg'), lo = +strip.dataset.lo, hi = +strip.dataset.hi, total = +strip.dataset.total
  const at = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0] || 1) } return pts[pts.length - 1][1] }
  let worstDiff = 0
  document.querySelectorAll('.it-mini').forEach((m, i) => {
    if (+m.dataset.lo !== lo || +m.dataset.hi !== hi) out.push('day ' + (i + 1) + ' profile uses ' + m.dataset.lo + ' to ' + m.dataset.hi + ' m, the strip ' + lo + ' to ' + hi + ' m: one scale for all')
    const km = +m.dataset.km
    const mini = pathPts(m.querySelector('.it-ml').getAttribute('d')).map(([x, y]) => [x / 600 * km, lo + (1 - (y - 4) / 72) * (hi - lo)])
    const g = document.querySelector('.it-sd[data-i="' + i + '"]'), off = +g.dataset.off
    const sl = pathPts(g.querySelector('.it-sl').getAttribute('d')).map(([x, y]) => [x / 1000 * total - off, lo + (1 - (y - 4) / 92) * (hi - lo)])
    for (let k = 0; k <= 60; k++) { const x = km * k / 60, d = Math.abs(at(mini, x) - at(sl, x)) / (hi - lo); worstDiff = Math.max(worstDiff, d) }
    const slx = sl[sl.length - 1][0] - sl[0][0]
    if (Math.abs(slx - km) / km > 0.01) out.push('day ' + (i + 1) + ' takes ' + slx.toFixed(1) + ' km of the strip but is ' + km + ' km long')
  })
  if (worstDiff > 0.01) out.push('a day slice of the strip differs from that day profile by ' + (worstDiff * 100).toFixed(1) + '% of the scale (1% allowed)')
  // drawn route length against the card
  api.lines.forEach((l, i) => { let d = 0; for (let k = 1; k < l.length; k++) d += Math.hypot(l[k][0] - l[k - 1][0], l[k][1] - l[k - 1][1]); const card = data.days[i].km; if (Math.abs(d - card) / card > 0.02) out.push('day ' + (i + 1) + ': the route drawn on the map is ' + d.toFixed(1) + ' km but the card says ' + card + ' km') })
  // printed figures follow from the days
  const cards = [...document.querySelectorAll('.it-day')]
  cards.forEach((c, i) => {
    const d = data.days[i], dd = c.querySelector('.it-stats dd').textContent
    if (parseFloat(dd.replace(/,/g, '')) !== +d.km.toFixed(d.km >= 100 ? 0 : 1)) out.push('day ' + (i + 1) + ' card says ' + dd + ', measured ' + d.km)
    const T = ${JSON.stringify(Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, v.factor])))}, STEPS = ${JSON.stringify(EFFORT_STEPS)}
    const pts = (d.foot.km + d.foot.up / 100) * T[d.foot.terrain]; let g = 0; while (g < 4 && Math.round(pts * 10) / 10 >= STEPS[g]) g++
    const words = ['Easy', 'Gentle', 'Steady', 'Hard', 'Very hard']
    if (c.querySelector('.it-effw').textContent !== words[g]) out.push('day ' + (i + 1) + ' is rated ' + c.querySelector('.it-effw').textContent + ' but the rule gives ' + words[g])
    if (c.querySelectorAll('.it-cells b.f').length !== g + 1) out.push('day ' + (i + 1) + ' shows ' + c.querySelectorAll('.it-cells b.f').length + ' effort cells for ' + words[g])
    if (!c.querySelector('.it-why').textContent.startsWith(words[g] + ':')) out.push('day ' + (i + 1) + ' does not say why it is ' + words[g])
  })
  const tot = data.days.reduce((s, d) => s + d.km, 0)
  const shown = parseFloat(document.querySelector('.it-fact b').textContent.replace(/,/g, ''))
  if (Math.round(tot) !== shown) out.push('the total distance says ' + shown + ' km but the days add up to ' + tot.toFixed(1))
  const meals = [...document.querySelectorAll('.it-yes li strong')].pop()?.textContent || ''
  const cnt = ['breakfast', 'lunch', 'dinner'].map((k) => cards.filter((c) => [...c.querySelectorAll('.it-meal')].find((m) => m.textContent.toLowerCase().startsWith(k))?.classList.contains('y')).length)
  if (!cnt.every((n, k) => new RegExp('\\\\b' + n + ' ' + ['breakfast', 'lunch', 'dinner'][k]).test(meals))) out.push('the meals line "' + meals + '" does not match the days (' + cnt.join(', ') + ')')
  document.querySelectorAll('.it-deps tbody tr').forEach((tr) => {
    const left = +tr.dataset.left, cap = +tr.dataset.cap, free = tr.querySelectorAll('.it-seats i:not(.b)').length
    if (free !== left || tr.querySelectorAll('.it-seats i').length !== cap) out.push('a departure shows ' + free + ' free seats of ' + tr.querySelectorAll('.it-seats i').length + ' for ' + left + ' of ' + cap)
    const txt = tr.querySelector('.it-left').textContent
    if (left ? txt !== left + ' of ' + cap + ' places left' : txt !== 'Full') out.push('a departure says "' + txt + '" for ' + left + ' places left')
  })
  if (!/^Places as of \\S/.test(document.querySelector('.it-asof')?.textContent || '')) out.push('the dates table has no "Places as of" date')
  if (/hurry|only \\d+ left|selling fast|last chance/i.test(document.body.textContent)) out.push('the page uses urgency wording')
  return out
})()`

/** each day by scrolling, then by tapping its band */
const DAYS = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const api = window.Itinerary, data = api.data, n = data.days.length
  const phone = innerWidth <= 860, RM = matchMedia('(prefers-reduced-motion: reduce)').matches
  const panel = document.querySelector('.it-panel'), wrap = document.querySelector('.it-mapwrap')
  document.documentElement.style.scrollBehavior = 'auto'
  const off = () => phone ? panel.getBoundingClientRect().height : parseFloat(getComputedStyle(document.querySelector('.it')).getPropertyValue('--top')) + 16
  const checkDay = (i, how) => {
    const s = api.state()
    if (s.active !== i) { out.push(how + ' day ' + (i + 1) + ' makes day ' + (s.active + 1) + ' active'); return }
    const d = data.days[i]
    if (!document.querySelector('.it-day[data-i="' + i + '"]').classList.contains('is-on')) out.push(how + ' day ' + (i + 1) + ': the ledger does not mark it')
    if (!document.querySelector('.it-sd[data-i="' + i + '"]').classList.contains('is-on')) out.push(how + ' day ' + (i + 1) + ': the strip does not mark it')
    if (!document.querySelector('.it-leg[data-i="' + i + '"]').classList.contains('is-on')) out.push(how + ' day ' + (i + 1) + ': the map does not mark its route')
    if (document.querySelector('.it-where').textContent !== 'Day ' + (i + 1) + ': ' + d['from'] + ' to ' + d['to']) out.push(how + ' day ' + (i + 1) + ': the panel head says "' + document.querySelector('.it-where').textContent + '"')
    const F = s.frame, W = wrap.clientWidth, H = wrap.clientHeight
    const bad = api.lines[i].filter(([x, y]) => { const px = F.tx + x * F.s, py = F.ty + y * F.s; return px < 0 || px > W || py < 0 || py > H }).length
    if (bad) out.push(how + ' day ' + (i + 1) + ': ' + bad + ' points of its route are outside the map')
    // labels
    const boxes = [...document.querySelectorAll('.it-over .it-lbl')].map((t) => { const b = t.getBBox(); return { t: t.textContent, b } })
    for (let a = 0; a < boxes.length; a++) for (let c = a + 1; c < boxes.length; c++) { const p = boxes[a].b, q = boxes[c].b; if (p.x < q.x + q.width - 1 && p.x + p.width > q.x + 1 && p.y < q.y + q.height - 2 && p.y + p.height > q.y + 2) out.push('day ' + (i + 1) + ': map labels "' + boxes[a].t + '" and "' + boxes[c].t + '" overlap') }
    for (const { t, b } of boxes) if (b.x < 0 || b.x + b.width > W || b.y < 0 || b.y + b.height > H) out.push('day ' + (i + 1) + ': map label "' + t + '" runs outside the map')
    for (const L of s.layout) if (L.score - (L.leader ? 0.5 : 0) >= 1) out.push('day ' + (i + 1) + ': map label "' + L.text + '" sits on the route or another label' + (L.leader ? ' even on a leader line' : ''))
  }
  for (let i = 0; i < n; i++) {
    const e = document.querySelector('.it-day[data-i="' + i + '"]')
    scrollTo(0, e.getBoundingClientRect().top + scrollY - off()); await wait(RM ? 120 : 950)
    checkDay(i, 'scrolling to')
    if (!RM && window.__settled !== true) out.push('the map has not settled 0.95 s after reaching day ' + (i + 1))
    if (RM) { const s = api.state(); if (s.cur.some((v, k) => Math.abs(v - s.target[k]) > 1e-6)) out.push('with reduced motion the map still moves to day ' + (i + 1)) }
    const pr = panel.getBoundingClientRect(), top = phone ? 0 : parseFloat(getComputedStyle(document.querySelector('.it')).getPropertyValue('--top'))
    if (Math.abs(pr.top - top) > 1.5) out.push('the chart panel does not stick at day ' + (i + 1) + ' (' + Math.round(pr.top) + 'px from the top)')
    if (phone && pr.height > innerHeight * 0.45) out.push('the sticky map strip takes ' + Math.round(pr.height / innerHeight * 100) + '% of the screen (45% at most)')
  }
  // tapping a band takes you to its day
  const order = [n - 1, 1, Math.floor(n / 2)]
  for (const i of order) {
    const b = document.querySelector('.it-band[data-i="' + i + '"]')
    b.click(); await wait(RM ? 200 : 1500)
    checkDay(i, 'tapping the band for')
    if (b.getAttribute('aria-current') !== 'step') out.push('the band for day ' + (i + 1) + ' is not marked current')
  }
  scrollTo(0, 0); await wait(RM ? 100 : 900)
  if (api.state().active !== -1) out.push('back at the top the map does not show the whole route')
  return out
})()`

const STILL = `(async () => {
  const out = []
  await new Promise((r) => setTimeout(r, 100))
  const tr = [...document.querySelectorAll('.it *')].filter((el) => parseFloat(getComputedStyle(el).transitionDuration) > 0).length
  if (tr) out.push(tr + ' elements still have transitions with reduced motion')
  if (document.getAnimations().length) out.push(document.getAnimations().length + ' animations run with reduced motion')
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const count = await ev(`[...document.querySelectorAll('.it button, .it a, .it-bar a')].filter((el) => el.getClientRects().length).length`)
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 80); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1
      return { ring, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  return problems
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const kb = Math.round(statSync(file).size / 1024)
  const server = await serve(dirname(file))
  const url = `${server.url}${relative(dirname(file), file)}`
  const chrome = await launch({ width: 1440, height: 900 })
  let failed = 0
  if (kb > 400) { failed++; console.log(`FAIL the page is ${kb} KB (400 KB at most): simplify the map file`) }
  else console.log(`ok   page weight ${kb} KB (400 KB at most)`)
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
      await ev('document.fonts.ready.then(() => window.Itinerary && window.Itinerary.ready).then(() => new Promise((r) => setTimeout(r, 900)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 30))`)
        const sw = await ev('Math.max(document.documentElement.scrollWidth, innerWidth)')
        if (sw > w + 1 && !problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${sw} > ${w})`)
      }
      await ev('scrollTo(0, 0); new Promise((r) => setTimeout(r, 900))')
      if (reduce) problems.push(...(await ev(STILL)))
      problems.push(...(await ev(VIEWS)))
      problems.push(...(await ev(DAYS)))
      let pairs = 0, worst = 99
      for (let y = 0; y <= height; y += Math.round(h * 0.8)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, ${reduce ? 80 : 900}))`)
        const a = await ev(`${AUDIT}(${w})`)
        for (const p of a.problems) if (!problems.includes(p)) problems.push(p)
        pairs += a.pairs; worst = Math.min(worst, a.worst)
      }
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const info = `${pairs} text/background pairs (lowest ${worst}x the minimum)`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}; every day active by scroll and by its band, three views agree`)
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
