// How It Works kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440,
// then once more at 390 and 1440 with JavaScript off. At each size it scrolls
// to the top, to every step and to the end, and fails on:
//   - script errors, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px, or 18.66 px bold)
//   - bars, diamonds, the rail and the cursor that carry meaning under 3:1
//     against the page (WCAG 1.4.11)
//   - text cut off by its box or running off the screen
//   - any programme label (week, step, hours, the cursor's flag) overlapping
//     another, crossing the cursor line, or leaving the chart's frame; an
//     hour label that had to be dropped without the list under the chart
//   - bars not drawn to scale (left and width within 1 px of the days), the
//     rail not following floor + K x days on the two-column layout
//   - the buyer's hours on the page not matching the touchpoints and the
//     rounding rule, the step count, or aria-current not on exactly one step
//   - the desk not settling after a move, or (reduced motion) not settled
//     straight away
//   - with JavaScript off: a step or its drawn deliverable not showing
// The drawn deliverables (.ps-obj) are pictures, hidden from assistive
// technology with a text equivalent beside them; their own small type is
// not held to the text rules.
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

const HELPERS = `
  const vw = innerWidth
  const phone = vw < 700
  const parse = (c) => { const m = c && c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]).slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const ratio = (fg, bg) => { const a = lum(over(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const out = [], seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
`

const TEXT = `(() => {${HELPERS}
  const root = document.querySelector('.ps')
  const min = phone ? 16 : 14
  const LABEL = '.ps-lbl, .ps-when, .ps-wks span, .ps-kw small'
  const skip = (el) => el.closest('.ps-obj, .ps-sr, script, style, [hidden]')
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fs = parseFloat(s.fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const r = ratio(fg, behind(el))
    const bold = Number(s.fontWeight) >= 700
    const needC = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / needC)
    if (r < needC) say('contrast ' + r.toFixed(2) + ':1 (needs ' + needC + ':1): ' + name(el))
    const b = el.getBoundingClientRect()
    if (b.right > vw + 1 || b.left < -1) say('text runs off the screen (' + Math.round(b.left) + '..' + Math.round(b.right) + '): ' + name(el))
  }
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim()) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2 && !el.matches('.ps-stage, .ps-desk')) say('text is cut off at the bottom of its box: ' + name(el))
  }
  // marks that carry meaning, against the page (WCAG 1.4.11)
  let marks = 0, lowMark = 99
  const page = behind(root)
  const mark = (c, what) => { const p = parse(c); if (!p || p[3] === 0) return; const r = ratio(p, page); marks++; lowMark = Math.min(lowMark, r); if (r < 3) say(what + ' is ' + r.toFixed(2) + ':1 against the page (needs 3:1)') }
  for (const b of root.querySelectorAll('.ps-bar, .ps-mini i')) {
    if (!shown(b)) continue
    const s = getComputedStyle(b)
    const what = (b.classList.contains('ps-on') ? 'the current ' : b.classList.contains('ps-done') ? 'a done ' : 'an upcoming ') + (b.closest('.ps-mini') ? 'mini bar' : 'bar')
    mark(b.classList.contains('ps-on') || b.classList.contains('ps-done') ? s.backgroundColor : s.borderTopColor, what)
  }
  for (const d of root.querySelectorAll('.ps-mk i')) if (shown(d)) mark(getComputedStyle(d).backgroundColor, 'an hours diamond')
  const fill = root.querySelector('.ps-fill'); if (fill && shown(fill)) mark(getComputedStyle(fill).backgroundColor, 'the rail')
  const lane = root.querySelector('.ps-chart .ps-lane'); if (lane && getComputedStyle(lane, '::after').content !== 'none') mark(getComputedStyle(lane, '::after').backgroundColor, 'the cursor')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, marks, lowMark: Math.round(lowMark * 100) / 100 }
})()`

const CHART = `(() => {${HELPERS}
  const root = document.querySelector('.ps')
  const chart = root.querySelector('.ps-chart')
  const cr = chart.getBoundingClientRect()
  const labels = [...chart.querySelectorAll('.ps-axis span, .ps-nm .ps-lbl, .ps-tt, .ps-mk b, .ps-flag')].filter(shown)
  const boxes = labels.map((el) => ({ el, r: el.getBoundingClientRect() }))
  for (const { el, r } of boxes) if (r.left < cr.left - 0.5 || r.right > cr.right + 0.5 || r.top < cr.top - 0.5 || r.bottom > cr.bottom + 0.5) say('a chart label leaves the frame: ' + name(el))
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue
    if (hit(a.r, b.r)) say('chart labels overlap: ' + name(a.el) + ' and ' + name(b.el))
  }
  // the cursor: a 2 px segment in each lane, at --cx
  const lanes = [...chart.querySelectorAll('.ps-lane')]
  let segs = 0
  for (const lane of lanes) {
    const st = getComputedStyle(lane, '::after')
    if (st.content === 'none' || st.display === 'none') continue
    const lr = lane.getBoundingClientRect()
    const x = lr.left + parseFloat(st.left) + 1
    const line = { left: x - 1, right: x + 1, top: lr.top + parseFloat(st.top), bottom: lr.top + parseFloat(st.top) + parseFloat(st.height) }
    segs++
    for (const { el, r } of boxes) if (hit(line, r)) say('the cursor crosses a label: ' + name(el))
    if (x < lr.left - 1 || x > lr.right + 1) say('the cursor leaves its lane')
  }
  const fl = chart.querySelector('.ps-flag')
  if (shown(fl)) {
    const f = fl.getBoundingClientRect(), lr = lanes[0].getBoundingClientRect()
    const x = lr.left + parseFloat(getComputedStyle(lanes[0], '::after').left) + 1
    if (f.left > x + 1 || f.right < x - 1) say('the flag is not over its cursor')
  }
  const line = segs > 0
  const off = chart.querySelectorAll('.ps-mk b.ps-off').length
  if (off && !shown(root.querySelector('.ps-ylist'))) say(off + ' hour labels were dropped and the list under the chart is not showing')
  return { problems: out, labels: boxes.length, line: !!line }
})()`

const TRUTH = `(() => {${HELPERS}
  const root = document.querySelector('.ps')
  const cfg = JSON.parse(root.dataset.ps)
  const steps = root.querySelectorAll('.ps-step')
  if (steps.length !== cfg.n || root.querySelectorAll('ol.ps-steps > li').length !== cfg.n) say('the list does not have one item per step')
  if (window.ProcessSteps && root.querySelectorAll('[aria-current="step"]').length !== 1) say('aria-current="step" is not on exactly one step')
  // to scale
  const lane = root.querySelector('.ps-chart .ps-row .ps-lane').getBoundingClientRect()
  root.querySelectorAll('.ps-chart .ps-bar').forEach((b, i) => {
    const r = b.getBoundingClientRect(), s = cfg.steps[i]
    const x = lane.left + lane.width * s.s / cfg.total, w = lane.width * s.l / cfg.total
    if (Math.abs(r.left - x) > 1 || Math.abs(r.width - Math.max(w, 6)) > 1) say('bar ' + (i + 1) + ' is not drawn to scale (' + r.left.toFixed(1) + ', ' + r.width.toFixed(1) + ' against ' + x.toFixed(1) + ', ' + w.toFixed(1) + ')')
  })
  if (window.ProcessSteps) {
    const g = window.ProcessSteps.geo()
    if (g.two) steps.forEach((li, i) => { const want = Math.round(g.F + g.K * cfg.steps[i].l); if (Math.abs(li.offsetHeight - want) > 1) say('step ' + (i + 1) + ' is ' + li.offsetHeight + 'px tall on the rail, not ' + want + ' (floor + K x days)') })
  }
  // the buyer's hours
  const dd = root.querySelector('.ps-yours dd')
  const mins = [...root.querySelectorAll('.ps-mk')].reduce((a, m) => a + Number(m.dataset.min), 0)
  if (Number(dd.dataset.minutes) !== mins) say('the hours fact says ' + dd.dataset.minutes + ' minutes, the touchpoints add up to ' + mins)
  const h = Math.floor(mins / 60 + 0.5), exact = mins % 60 === 0
  const want = mins < 60 ? mins + ' minutes' : (exact ? '' : 'about ') + h + (h === 1 ? ' hour' : ' hours')
  if (dd.textContent.trim().replace(/\\s+/g, ' ') !== want) say('the hours fact reads "' + dd.textContent.trim() + '", the rule gives "' + want + '"')
  return { problems: out, minutes: mins }
})()`

const NOJS = `(() => {${HELPERS}
  const root = document.querySelector('.ps')
  if (document.documentElement.scrollWidth > vw + 1) say('without JavaScript the page scrolls sideways')
  root.querySelectorAll('.ps-step').forEach((li, i) => {
    if (!shown(li.querySelector('.ps-t3'))) say('without JavaScript step ' + (i + 1) + ' has no visible title')
    if (!shown(li.querySelector('.ps-inline'))) say('without JavaScript step ' + (i + 1) + ' does not show its deliverable')
  })
  if (shown(root.querySelector('.ps-stagecol'))) say('without JavaScript the empty desk shows')
  return { problems: out }
})()`

async function open(chrome, url, w, h, mode) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: mode === 'reduce' ? 'reduce' : 'no-preference' }] })
  if (mode === 'nojs') await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    if (mode === 'nojs') await tab.send('Emulation.setScriptExecutionDisabled', { value: false })
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (mode === 'nojs') await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  if (mode !== 'nojs') {
    for (let i = 0; i < 100 && !(await ev('!!window.ProcessSteps')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.ProcessSteps'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.ProcessSteps.ready')
  } else await ev('document.fonts.ready.then(() => true)')
  return { tab, ev, errors }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  const url = `${server.url}${relative(dirname(file), file)}`
  let failed = 0
  try {
    for (const [w, h, mode] of RUNS) {
      const chrome = await launch({ width: Math.max(w, 800), height: h })
      const problems = []
      let info = ''
      try {
        const { ev, errors } = await open(chrome, url, w, h, mode)
        if (mode === 'nojs') {
          problems.push(...(await ev(NOJS)).problems)
          const t = await ev(TEXT)
          problems.push(...t.problems.filter((p) => !/bar|diamond|rail|cursor/.test(p)))
          info = `JavaScript off: ${t.pairs} text pairs, every step and deliverable shown`
        } else {
          const n = await ev('JSON.parse(document.querySelector(".ps").dataset.ps).n')
          const ys = [0, ...(await ev(`Array.from({ length: ${n} }, (_, i) => window.ProcessSteps.dwellY(i))`)), await ev('document.documentElement.scrollHeight')]
          let labels = 0, text = null, unsettled = 0
          for (const [k, y] of ys.entries()) {
            await ev(`scrollTo(0, ${y}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`)
            await wait(mode === 'reduce' ? 60 : 900)
            if (!(await ev('document.querySelector(".ps").hasAttribute("data-settled")'))) unsettled++
            if (k > 0 && k <= n) {
              const a = await ev(`(() => { const s = document.querySelector('.ps'); const on = s.querySelector('.ps-stage .ps-art[data-i="' + s.dataset.active + '"]'); return { active: Number(s.dataset.active), o: on ? Number(on.style.opacity) : 1 } })()`)
              if (a.active !== k - 1) problems.push(`at step ${k} the anchor finds step ${a.active + 1}`)
              if (a.o < 0.999) problems.push(`step ${k}'s paper is not fully on the desk (opacity ${a.o})`)
            }
            const c = await ev(CHART)
            labels = Math.max(labels, c.labels)
            problems.push(...c.problems.map((p) => `${k === 0 ? 'top' : k > n ? 'end' : `step ${k}`}: ${p}`))
            if (k === 0 || k === Math.min(3, n)) {
              const t = await ev(TEXT)
              problems.push(...t.problems)
              text = text ? { ...t, worst: Math.min(text.worst, t.worst), lowMark: Math.min(text.lowMark, t.lowMark), pairs: Math.max(text.pairs, t.pairs) } : t
            }
          }
          if (unsettled) problems.push(`${unsettled} position${unsettled > 1 ? 's' : ''} did not report settled${mode === 'reduce' ? ' at once under reduced motion' : ' after 900 ms'}`)
          const tr = await ev(TRUTH)
          problems.push(...tr.problems)
          info = `${text.pairs} text pairs, lowest ${text.worst}x its minimum; ${text.marks} marks, lowest ${text.lowMark}:1; ${labels} chart labels clear at ${ys.length} positions; your time ${tr.minutes} min`
        }
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
      } catch (e) {
        problems.push(e.message)
      } finally {
        await chrome.close()
      }
      const tag = `${w}x${h}${mode === 'reduce' ? ' reduced motion' : mode === 'nojs' ? ' no JavaScript' : ''}`
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
  if (!input) { console.log('usage: node scripts/check.mjs out/index.html'); process.exit(1) }
  try {
    const failed = await check(input)
    if (failed) { console.log(`${failed} run${failed > 1 ? 's' : ''} failed`); process.exit(1) }
    console.log('all checks passed')
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
