// Feature Tabs Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, with reduced motion at 390 and 1440, and
// with JavaScript off at 390 and 1440. It shows every tab and fails on:
//   - script errors; sideways scrolling at any point down the page
//   - text under 16 px on a phone or 14 px elsewhere (labels and code: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px), in every view
//   - text cut off by its box or running off the screen; side padding
//     under 16 px (safe areas)
//   - the stage changing height between tabs, or the page moving
//   - an empty band in a view: the tallest stretch of the stage with no
//     content in it (text, bars, dots, rules) over 12% of the stage
//   - a switch that doesn't move what the two views share, or a bar that
//     doesn't grow out of the amount it came from
//   - the tablist: roles, aria-selected, the panel's label, the
//     orientation (vertical beside the stage, horizontal as chips), and the
//     Arrow, Home and End keys moving and focusing the right tab
//   - swiping the stage (phones), the tour: running with its clock, pausing
//     off screen, stopping for good on a click, saying so
//   - a keyboard focus that can't be seen
//   - reduced motion with a tour or travel; no JS without every feature
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
  [390, 844, 'reduce'],
  [1440, 900, 'reduce'],
  [390, 844, 'nojs'],
  [1440, 900, 'nojs'],
]
const BAND = 0.12

const AUDIT = `((scope) => {
  const out = []
  const vw = innerWidth
  const min = vw < 760 ? 16 : 14
  const LABEL = '.ftk-label, .ftk-mono, .ftk-chip, .ftk-code, .ftk-kind, .ftk-n'
  const root = document.querySelector(scope)
  const skip = (el) => el.closest('.ftk-sr, .ftk-ghost, .ftk-lnum') || (el.closest('.ftk-copy') && getComputedStyle(el.closest('.ftk-copy')).position === 'absolute')
  const shown = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false }
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...root.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      const c = parse(s.backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
      const img = s.backgroundImage.match(/rgba?\\([^)]+\\)/)
      if (img && n !== el && s.backgroundImage.startsWith('linear-gradient')) { const g = parse(img[0]); if (g && g[3] > 0) layers.push(g) }
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
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !el.textContent.trim() || !shown(el) || el.closest('.ftk-sbody, .ftk-rail, .ftk-copy')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
  }
  // inside the stage: nothing may poke out of the stage body or its own line
  for (const sb of root.querySelectorAll('.ftk-sbody')) {
    if (!shown(sb)) continue
    const b = sb.getBoundingClientRect()
    for (const el of sb.querySelectorAll('*')) {
      if (skip(el) || !own(el) || !shown(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right > b.right + 1 || r.left < b.left - 1 || r.bottom > b.bottom + 1) say('text runs out of the stage: ' + name(el))
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') say('text is cut off: ' + name(el))
    }
  }
  for (const d of root.querySelectorAll('.ftk-docname')) if (shown(d) && d.scrollWidth > d.clientWidth + 1) say('the document name in the stage bar is cut off: ' + name(d))
  for (const el of texts) {
    if (el.closest('.ftk-rail') && vw <= 880) continue // the chips scroll sideways on purpose
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  const sp = getComputedStyle(root)
  if (parseFloat(sp.paddingLeft) < 16 || parseFloat(sp.paddingRight) < 16) say('under 16px of side padding')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})`

/** The tallest stretch of the stage body with nothing drawn in it, as a share of the stage. */
const BAND_JS = `(() => {
  const sb = document.querySelector('.ftk-panel .ftk-sbody'), stage = sb.closest('.ftk-stage')
  const b = sb.getBoundingClientRect(), cs = getComputedStyle(sb)
  const top = b.top + parseFloat(cs.paddingTop), bottom = b.bottom - parseFloat(cs.paddingBottom)
  const spans = []
  for (const el of sb.querySelectorAll('*')) {
    if (el.closest('.ftk-ghost')) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const leaf = !el.firstElementChild
    const paint = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || s.boxShadow !== 'none'
    if (text || leaf || paint) {
      if (text) { const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); spans.push([t.top, t.bottom]) }
      else if (paint && !el.matches('.ftk-v, .ftk-fill')) spans.push([r.top, r.bottom])
      else if (leaf) spans.push([r.top, r.bottom])
    }
    for (const side of ['Top', 'Bottom']) if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none') { const y = side === 'Top' ? r.top : r.bottom; spans.push([y - 1, y + 1]) }
    for (const side of ['Left', 'Right']) if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none') spans.push([r.top, r.bottom])
  }
  spans.sort((p, q) => p[0] - q[0])
  let y = top, gap = 0, at = top
  for (const [a, z] of spans) { if (a > y && a - y > gap) { gap = a - y; at = y } y = Math.max(y, z) }
  if (bottom - y > gap) { gap = bottom - y; at = y }
  const h = stage.getBoundingClientRect().height
  return { gap: Math.round(gap), share: gap / h, at: Math.round(at - b.top), stage: Math.round(h) }
})()`

const MORPH = `(async () => {
  const out = [], info = []
  const T = window.FeatureTabs, n = document.querySelectorAll('[role=tab]').length
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    T.show(i, false)
    await new Promise((r) => setTimeout(r, 30))
    const sb = document.querySelector('.ftk-panel .ftk-sbody')
    const before = new Set([...sb.querySelectorAll('[data-k]')].map((e) => e.dataset.k))
    T.show(j, true)
    const anims = document.querySelector('.ftk').getAnimations({ subtree: true })
    const moved = anims.filter((a) => a.effect.target && a.effect.target.matches('[data-k]') && !a.effect.target.closest('.ftk-ghost') && String(a.effect.getKeyframes()[0].transform || '').includes('translate'))
    const bars = anims.filter((a) => a.effect.target && a.effect.target.matches('[data-from]') && !a.effect.target.closest('.ftk-ghost'))
    const shared = [...sb.querySelectorAll('.ftk-v [data-k]')].filter((e) => !e.closest('.ftk-ghost') && before.has(e.dataset.k)).length
    const wantBars = [...sb.querySelectorAll('.ftk-v [data-from]')].filter((e) => !e.closest('.ftk-ghost') && before.has(e.dataset.from)).length
    if (reduce) {
      if (moved.length || bars.length) out.push('with reduced motion, switch ' + (i + 1) + '→' + (j + 1) + ' still moves things')
    } else {
      if (shared && moved.length < shared) out.push('switch ' + (i + 1) + '→' + (j + 1) + ': ' + shared + ' shared items but only ' + moved.length + ' travel')
      if (wantBars && bars.length < wantBars) out.push('switch ' + (i + 1) + '→' + (j + 1) + ': ' + wantBars + ' bars should grow from their amounts, ' + bars.length + ' do')
      for (const a of bars) {
        const k0 = String(a.effect.getKeyframes()[0].transform || '')
        if (!/translate\\(/.test(k0) || !/scale\\(/.test(k0) || /scale\\(1(, ?1)?\\)/.test(k0)) out.push('switch ' + (i + 1) + '→' + (j + 1) + ': a bar does not start at the amount it came from (' + k0 + ')')
      }
      info.push((i + 1) + '→' + (j + 1) + ' ' + moved.length + ' travel' + (bars.length ? ', ' + bars.length + ' bars grow' : ''))
    }
    await new Promise((r) => setTimeout(r, reduce ? 200 : 900))
    if (sb.querySelector('.ftk-ghost')) out.push('switch ' + (i + 1) + '→' + (j + 1) + ': the old view is still on the stage after the switch')
  }
  T.show(0, false)
  return { out, info }
})()`

async function keys(tab, ev, horizontal) {
  const problems = []
  const press = async (key) => {
    const code = { ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, Tab: 9 }[key]
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code })
    await new Promise((r) => setTimeout(r, 60))
  }
  const state = () => ev(`(() => { const t = [...document.querySelectorAll('[role=tab]')]; const sel = t.findIndex((x) => x.getAttribute('aria-selected') === 'true'); return { n: t.length, sel, focus: t.indexOf(document.activeElement), tabindex: t.map((x) => x.tabIndex), panel: document.querySelector('[role=tabpanel]').getAttribute('aria-labelledby'), id: t[sel] && t[sel].id, orient: document.querySelector('[role=tablist]').getAttribute('aria-orientation'), roles: !!document.querySelector('[role=tablist] [role=tab][aria-controls]') } })()`)
  await ev(`window.FeatureTabs.show(0, false); document.querySelector('[role=tab]').focus()`)
  let s = await state()
  if (!s.roles) problems.push('the tabs are not role="tab" inside role="tablist" with aria-controls')
  if (s.orient !== (horizontal ? 'horizontal' : 'vertical')) problems.push(`aria-orientation is ${s.orient}; the tabs are laid out ${horizontal ? 'in a row' : 'in a column'}`)
  const next = horizontal ? 'ArrowRight' : 'ArrowDown', prev = horizontal ? 'ArrowLeft' : 'ArrowUp'
  const expect = async (key, want) => {
    await press(key)
    s = await state()
    if (s.sel !== want || s.focus !== want) problems.push(`${key}: tab ${s.sel + 1} selected, tab ${s.focus + 1} focused; expected tab ${want + 1}`)
    if (s.panel !== s.id) problems.push(`${key}: the tabpanel is labelled by ${s.panel}, not the selected tab ${s.id}`)
    if (s.tabindex.filter((x) => x === 0).length !== 1 || s.tabindex[want] !== 0) problems.push(`${key}: more or less than one tab is in the Tab order (${s.tabindex.join(',')})`)
  }
  await expect(next, 1)
  await expect(next, 2)
  await expect(prev, 1)
  await expect('End', s.n - 1)
  await expect(next, 0)
  await expect('Home', 0)
  await expect(prev, s.n - 1)
  await expect(horizontal ? 'ArrowDown' : 'ArrowRight', 0)
  await ev('window.FeatureTabs.show(0, false)')
  return { problems, info: `keys ${next}/${prev}/Home/End ok` }
}

const TOUR = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const T = window.FeatureTabs, st = () => T.state()
  if (!st().touring) return ['the tour does not run']
  document.querySelector('.ftk-panel .ftk-stage').scrollIntoView({ block: 'center' })
  await wait(700)
  const a = st()
  if (!(a.progress > 0)) out.push('the tour clock does not move with the stage in view')
  const t = document.querySelector('[role=tab][aria-selected=true]')
  if (!(parseFloat(t.style.getPropertyValue('--t')) > 0)) out.push('the active tab does not show the tour clock')
  const sp = document.createElement('div'); sp.style.height = '300vh'; document.body.append(sp)
  scrollTo(0, document.documentElement.scrollHeight); await wait(400)
  const b = st().progress; await wait(500); const c = st().progress
  if (c !== b) out.push('the tour keeps running with the stage off screen')
  sp.remove(); document.querySelector('.ftk-panel .ftk-stage').scrollIntoView({ block: 'center' }); await wait(400)
  if (!(st().progress > c)) out.push('the tour does not resume when the stage is back in view')
  const sel = st().tab
  document.querySelectorAll('[role=tab]')[(sel + 1) % document.querySelectorAll('[role=tab]').length].click()
  await wait(50)
  const d = st()
  if (!d.stopped) out.push('a click does not stop the tour')
  if (!/stopped/i.test(document.querySelector('.ftk-tour span').textContent) && getComputedStyle(document.querySelector('.ftk-tour')).display !== 'none') out.push('the tour does not say it stopped')
  const p0 = d.progress, tab0 = d.tab; await wait(800)
  if (st().tab !== tab0 || st().progress !== p0) out.push('the tour starts again after a click')
  return out
})()`

const SWIPE = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const T = window.FeatureTabs
  T.show(0, false)
  const st = document.querySelector('.ftk-panel .ftk-stage')
  st.scrollIntoView({ block: 'center' }); await wait(100)
  const r = st.getBoundingClientRect(), y = r.top + r.height / 2
  const ptr = (type, x, yy) => st.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: yy }))
  ptr('pointerdown', r.right - 40, y); ptr('pointerup', r.left + 60, y + 10); await wait(50)
  if (T.state().tab !== 1) out.push('swiping the stage left does not go to the next tab')
  ptr('pointerdown', r.left + 40, y); ptr('pointerup', r.right - 60, y - 8); await wait(50)
  if (T.state().tab !== 0) out.push('swiping the stage right does not go back')
  ptr('pointerdown', r.left + 100, y); ptr('pointerup', r.left + 130, y + 120); await wait(50)
  if (T.state().tab !== 0) out.push('a vertical drag on the stage changes the tab')
  T.show(0, false)
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  for (let i = 0; i < 4; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, visible: el.matches(':focus-visible'), role: el.getAttribute('role') || el.tagName, name: el.textContent.trim().slice(0, 30) } })()`)
    if (r && r.role === 'tab' && (!r.ring || !r.visible)) problems.push(`keyboard focus can't be seen on the tab "${r.name}"`)
    if (r && r.role === 'tab') break
  }
  return problems
}

const NOJS = `(() => {
  const out = []
  const ui = document.querySelector('.ftk-ui'), stack = document.querySelector('.ftk-stack')
  if (getComputedStyle(ui).display !== 'none') out.push('without JavaScript the empty tablist is still shown')
  if (getComputedStyle(stack).display === 'none') out.push('without JavaScript the features are hidden')
  const items = [...stack.querySelectorAll('.ftk-item')]
  const tabs = document.querySelectorAll('[role=tab]').length
  if (items.length !== tabs) out.push('without JavaScript ' + items.length + ' of ' + tabs + ' features show')
  for (const [i, it] of items.entries()) if (!it.querySelector('.ftk-v') || it.querySelector('.ftk-v').getBoundingClientRect().height < 80) out.push('without JavaScript feature ' + (i + 1) + ' has no view')
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
    for (const [w, h, mode] of RUNS) {
      const tab = await chrome.page()
      const errors = []
      chrome.on('Runtime.exceptionThrown', (p, s) => s === tab.sessionId && errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
      await tab.send('Page.enable')
      await tab.send('Runtime.enable')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
      if (mode === 'reduce') await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      if (mode === 'nojs') await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
      const loaded = tab.once('Page.loadEventFired', 60000)
      await tab.send('Page.navigate', { url })
      await loaded
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      const problems = []
      const notes = []
      if (mode === 'nojs') {
        await new Promise((r) => setTimeout(r, 1200))
        problems.push(...(await ev(NOJS)))
        const a = await ev(`${AUDIT}('.ftk')`)
        problems.push(...a.problems)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) problems.push('the page scrolls sideways without JavaScript')
        notes.push(`stacked, ${a.pairs} text/background pairs (lowest ${a.worst}x the minimum)`)
      } else {
        await ev('document.fonts.ready.then(() => window.FeatureTabs && window.FeatureTabs.ready).then(() => new Promise((r) => setTimeout(r, 500)))')
        const n = await ev('document.querySelectorAll("[role=tab]").length')
        // every tab: what it says, how it looks, and that nothing moves the page
        let stageH = null, pageH = null, worst = 99, pairs = 0, bands = []
        for (let i = 0; i < n; i++) {
          await ev(`window.FeatureTabs.show(${i}, false); new Promise((r) => setTimeout(r, 80))`)
          const sh = await ev(`Math.round(document.querySelector('.ftk-panel .ftk-stage').getBoundingClientRect().height * 10) / 10`)
          const ph = await ev('document.documentElement.scrollHeight')
          if (stageH === null) { stageH = sh; pageH = ph }
          if (Math.abs(sh - stageH) > 0.5) problems.push(`the stage is ${sh}px tall on tab ${i + 1} and ${stageH}px on tab 1`)
          if (Math.abs(ph - pageH) > 0.5) problems.push(`the page is ${ph}px tall on tab ${i + 1} and ${pageH}px on tab 1`)
          const band = await ev(BAND_JS)
          bands.push(Math.round(band.share * 100))
          if (band.share > BAND) problems.push(`tab ${i + 1}: an empty band of ${band.gap}px (${Math.round(band.share * 100)}% of the ${band.stage}px stage, ${band.at}px down; at most ${BAND * 100}%)`)
          const ys = await ev(`[...Array(Math.ceil(document.documentElement.scrollHeight / ${Math.round(h / 2)}) + 1).keys()].map((k) => k * ${Math.round(h / 2)})`)
          for (const y of i === 0 ? ys : []) {
            await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 40))`)
            if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) { problems.push(`the page scrolls sideways (at ${y}px down)`); break }
          }
          await ev(`document.querySelector('.ftk-panel').scrollIntoView({ block: 'nearest' })`)
          const a = await ev(`${AUDIT}('.ftk')`)
          problems.push(...a.problems.map((p) => `tab ${i + 1}: ${p}`))
          worst = Math.min(worst, a.worst); pairs += a.pairs
        }
        notes.push(`${n} tabs, stage ${stageH}px on every tab, largest empty band ${Math.max(...bands)}% (${bands.join('/')}), ${pairs} text/background pairs (lowest ${worst}x the minimum)`)
        const m = await ev(MORPH)
        problems.push(...m.out)
        if (m.info.length) notes.push(m.info.join('; '))
        const horizontal = await ev(`matchMedia('(max-width: 880px)').matches`)
        const k = await keys(tab, ev, horizontal)
        problems.push(...k.problems)
        notes.push(k.info)
        if (w < 760) {
          const sw = await ev(SWIPE)
          problems.push(...sw)
          if (!sw.length) notes.push('swipe ok')
        }
        if (mode === 'reduce') {
          if ((await ev('window.FeatureTabs.state().touring'))) problems.push('the tour runs with reduced motion')
        } else {
          await tab.send('Page.reload')
          await tab.once('Page.loadEventFired', 60000)
          await ev('document.fonts.ready.then(() => window.FeatureTabs.ready).then(() => new Promise((r) => setTimeout(r, 300)))')
          const t = await ev(TOUR)
          problems.push(...t)
          if (!t.length) notes.push('tour runs, pauses off screen, stops on a click')
        }
        if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      }
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${mode ? ' ' + (mode === 'reduce' ? 'reduced motion' : 'no JavaScript') : ''}`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${notes.join('; ')}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${notes.join('; ')}`)
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
