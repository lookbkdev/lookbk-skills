// Story Rail: serves the built page and opens it in headless Chrome at 390,
// 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440. At
// each size it fails on:
//   - script errors, links without an address, pictures without alt text
//     (drawn scenes need role="img" and a label, loops an aria-label)
//   - sideways scrolling of the page
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box; controls under 44 px tall on a phone
//   - the steps: Next and Previous move exactly one card (to that card's
//     snap point), are disabled at the ends, the counter says what is on
//     screen, the header does not move when the counter changes
//   - the fades: at every snap point the snapped card is fully clear of
//     both edge fades
//   - the scale: the bracket covers exactly the part of the rail on screen
//   - the keyboard: Right, Left, Home and End on the rail; Tab reaches each
//     card's link; every focus can be seen
//   - desktop: a mouse drag moves the rail, settles on a card and opens
//     nothing, while a plain click still opens the card; the vertical wheel
//     scrolls the page, not the rail; the horizontal wheel scrolls the rail
//   - phone: a vertical swipe on the rail scrolls the page and leaves the
//     rail alone; a sideways swipe moves the rail
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth, phone = vw < 761
  const min = phone ? 16 : 14
  const LABEL = '.sr-meta, .sr-count, .sr-tag, .sr-nums, .sr-key, .sr-bars, .sr-nsrc, .sr-eye, .sr-hint, .sr-qlab, .sr-en, .sr-qby, .sr-go, .sr-pause'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], script, style, svg, .sr-cursor')
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o }
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && opacityOf(el) > 0.05
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  for (const i of document.querySelectorAll('img')) if (!i.getAttribute('alt')) say('a picture has no alt text: ' + i.getAttribute('src'))
  for (const s of document.querySelectorAll('.sr-media > svg')) if (s.getAttribute('role') !== 'img' || !s.getAttribute('aria-label')) say('a drawn scene has no label')
  for (const v of document.querySelectorAll('video')) if (!v.getAttribute('aria-label')) say('a loop has no aria-label')
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
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
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]).slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  let pairs = 0, worst = 99
  for (const el of texts) {
    if (el.closest('.is-past')) continue
    const s = getComputedStyle(el)
    const fg = parse(s.color); if (!fg) continue
    fg[3] *= opacityOf(el)
    const bg = behind(el)
    const r = (Math.max(lum(over(fg, bg)), lum(bg)) + 0.05) / (Math.min(lum(over(fg, bg)), lum(bg)) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need - 0.005) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of document.querySelectorAll('.sr *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.matches('.sr-vp, .sr-rail, .sr-media')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (el.closest('.sr-vp')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  for (const card of document.querySelectorAll('.sr-card')) {
    const box = card.firstElementChild.getBoundingClientRect()
    for (const t of card.querySelectorAll('.sr-claim, .sr-qtext, .sr-nlab, .sr-et')) {
      const r = t.getBoundingClientRect()
      if (r.right > box.right + 1) say('text sticks out of its card: ' + name(t))
    }
  }
  if (phone) for (const b of document.querySelectorAll('.sr-btn, .sr-seg')) if (shown(b) && !b.hidden && b.getBoundingClientRect().height < 43.5) say('a control is under 44px tall on a phone: ' + (b.getAttribute('aria-label') || name(b)) + ' (' + Math.round(b.getBoundingClientRect().height) + 'px)')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

// steps, counter, fades and bracket, through the page's own API
const RAIL = (reduce) => `(async () => {
  const out = []
  const R = window.StoryRail
  const vp = R.vp, N = R.cards.length
  const settle = () => new Promise((r) => setTimeout(r, ${reduce ? 120 : 1100}))
  const near = (a, b) => Math.abs(a - b) <= 2
  const ctrl = document.querySelector('.sr-ctrl'), head = document.querySelector('.sr-head')
  const nb = document.querySelector('.sr-next'), pb = document.querySelector('.sr-prev')
  vp.scrollLeft = 0; await settle()
  const h0 = head.getBoundingClientRect().height, c0 = nb.getBoundingClientRect().left
  if (!pb.disabled) out.push('Previous is not disabled at the start')
  let steps = 0
  for (let i = 1; i < N && vp.scrollLeft < R.max() - 2; i++) {
    nb.click(); await settle()
    if (!near(vp.scrollLeft, R.target(i))) { out.push('Next ' + i + ' landed at ' + Math.round(vp.scrollLeft) + ', not card ' + (i + 1) + ' (' + Math.round(R.target(i)) + ')'); break }
    steps++
    if (head.getBoundingClientRect().height !== h0 || nb.getBoundingClientRect().left !== c0) out.push('the header moves when the counter changes')
  }
  if (!nb.disabled) out.push('Next is not disabled at the end')
  pb.click(); await settle()
  const back = R.cur()
  if (vp.scrollLeft > R.max() - 2) out.push('Previous does not move from the end')
  // every snap point: the snapped card clear of the fades, counter and bracket right
  const W = document.querySelector('.sr-mm').clientWidth
  let snaps = 0
  for (let i = 0; i < N; i++) {
    if (R.target(i) !== R.pos(i)) continue
    vp.scrollLeft = R.target(i); R.update(); await new Promise((r) => requestAnimationFrame(r))
    snaps++
    const [fl, fr] = R.fades(vp.scrollLeft)
    const v = vp.getBoundingClientRect(), c = R.cards[i].getBoundingClientRect()
    if (c.left < v.left + fl - 1 || c.right > v.right - fr + 1) out.push('card ' + (i + 1) + ' is under an edge fade when snapped (' + Math.round(c.left) + '..' + Math.round(c.right) + ' in ' + Math.round(v.left + fl) + '..' + Math.round(v.right - fr) + ')')
    const on = R.shown().map((x, j) => (x >= 0.6 ? j + 1 : 0)).filter(Boolean)
    const want = String(on[0]).padStart(2, '0') + (on.length > 1 ? '–' + String(on.at(-1)).padStart(2, '0') : '')
    const said = document.querySelector('.sr-count').textContent.trim()
    if (!said.startsWith(want + ' ')) out.push('at card ' + (i + 1) + ' the counter says "' + said + '"; on screen: ' + want)
    if (!said.endsWith('of ' + String(N).padStart(2, '0'))) out.push('the counter does not count ' + N + ' stops')
    const g = parseFloat(getComputedStyle(document.querySelector('.sr-rail')).paddingLeft)
    const span = R.lastEnd()
    const a = Math.max(0, vp.scrollLeft - g), b = Math.min(span, vp.scrollLeft + vp.clientWidth - g)
    const w = document.querySelector('.sr-win'), mm = document.querySelector('.sr-mm').getBoundingClientRect(), wr = w.getBoundingClientRect()
    if (Math.abs(wr.left + 5 - mm.left - (a / span) * W) > 2 || Math.abs(wr.width - 7 - ((b - a) / span) * W) > 2) out.push('at card ' + (i + 1) + ' the bracket does not cover what is on screen')
    for (const [j, s] of [...document.querySelectorAll('.sr-seg')].entries()) if (s.classList.contains('is-on') !== on.includes(j + 1)) { out.push('at card ' + (i + 1) + ' segment ' + (j + 1) + ' is marked wrongly'); break }
  }
  // a segment brings its card to the start
  document.querySelectorAll('.sr-seg')[Math.min(2, N - 1)].click(); await settle()
  if (!near(vp.scrollLeft, R.target(2))) out.push('the third segment does not bring card 3 to the start')
  vp.scrollLeft = 0; await settle()
  return { out, info: steps + ' steps, ' + snaps + ' snap points' }
})()`

async function key(tab, k, code, vk) {
  await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk })
  await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk })
}

async function keyboard(tab, ev, reduce) {
  const out = []
  const t = reduce ? 150 : 1100
  await ev('window.StoryRail.vp.scrollLeft = 0; window.StoryRail.vp.focus(); 1')
  await wait(200)
  await key(tab, 'ArrowRight', 'ArrowRight', 39); await wait(t)
  if (!(await ev('Math.abs(StoryRail.vp.scrollLeft - StoryRail.target(1)) <= 2'))) out.push('Right arrow on the rail does not move one card')
  await key(tab, 'ArrowLeft', 'ArrowLeft', 37); await wait(t)
  if (!(await ev('StoryRail.vp.scrollLeft <= 2'))) out.push('Left arrow on the rail does not move back one card')
  await key(tab, 'End', 'End', 35); await wait(t + 300)
  if (!(await ev('StoryRail.vp.scrollLeft >= StoryRail.max() - 2'))) out.push('End does not go to the last card')
  await key(tab, 'Home', 'Home', 36); await wait(t + 300)
  if (!(await ev('StoryRail.vp.scrollLeft <= 2'))) out.push('Home does not go to the first card')
  await ev('StoryRail.vp.focus(); 1')
  await key(tab, 'Tab', 'Tab', 9); await wait(80)
  if (!(await ev('document.activeElement === StoryRail.cards[0].querySelector("a")'))) out.push("Tab from the rail does not reach the first card's link")
  // tab through every card link: each gets focus once, and the rail brings it into view
  let reached = 1
  for (let i = 1; i < 12; i++) {
    await key(tab, 'Tab', 'Tab', 9); await wait(reduce ? 120 : 700)
    const r = await ev(`(() => { const a = document.activeElement, c = a && a.closest('.sr-card'); if (!c) return null; const v = StoryRail.vp.getBoundingClientRect(), b = c.getBoundingClientRect(); return { i: StoryRail.cards.indexOf(c), inView: b.left >= v.left - 1 && b.right <= v.right + 1 } })()`)
    if (!r) break
    reached = r.i + 1
    if (!r.inView) out.push('card ' + (r.i + 1) + ' has focus but is not fully on screen')
  }
  const n = await ev('StoryRail.cards.length')
  if (reached !== n) out.push(`Tab reached ${reached} of ${n} cards`)
  await ev('StoryRail.vp.scrollLeft = 0; document.activeElement.blur(); 1')
  return out
}

async function focusRings(tab, ev) {
  const problems = []
  await ev(`document.activeElement && document.activeElement.blur(); scrollTo(0, 0)`)
  const seen = new Set()
  for (let i = 0; i < 16; i++) {
    await key(tab, 'Tab', 'Tab', 9)
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      return { ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) { seen.add(m); problems.push(m) } }
  }
  await ev('document.activeElement && document.activeElement.blur(); StoryRail.vp.scrollLeft = 0; scrollTo(0, 0)')
  return problems
}

async function mouse(tab, ev, reduce) {
  const out = []
  await ev(`window.__clicks = 0; document.addEventListener('click', (e) => { if (e.target.closest('.sr-card a')) { window.__clicks++; e.preventDefault() } }); StoryRail.vp.scrollLeft = 0; scrollTo(0, StoryRail.vp.getBoundingClientRect().top + scrollY - 120); 1`)
  await wait(300)
  const p = await ev(`(() => { const r = StoryRail.cards[0].querySelector('.sr-media, .sr-qbox, .sr-nbox').getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.5 } })()`)
  const m = (type, x, y, extra = {}) => tab.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra })
  // a drag
  await m('mousePressed', p.x, p.y)
  for (let k = 1; k <= 12; k++) await m('mouseMoved', p.x - k * 25, p.y)
  await m('mouseReleased', p.x - 300, p.y)
  await wait(reduce ? 400 : 1800)
  const after = await ev('({ L: StoryRail.vp.scrollLeft, clicks: window.__clicks, snapped: StoryRail.cards.some((c, i) => Math.abs(StoryRail.target(i) - StoryRail.vp.scrollLeft) <= 2), drag: StoryRail.vp.classList.contains("is-drag") })')
  if (after.L < 100) out.push('a 300 px mouse drag did not move the rail (' + Math.round(after.L) + ')')
  if (after.clicks) out.push('a mouse drag opened a card')
  if (!after.snapped) out.push('a mouse drag did not settle on a card (' + Math.round(after.L) + ')')
  if (after.drag) out.push('the rail is still in drag mode after the release')
  // a plain click still opens the card
  await ev('StoryRail.vp.scrollLeft = 0; 1'); await wait(300)
  const q = await ev(`(() => { const r = StoryRail.cards[0].querySelector('.sr-claim, .sr-qtext').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 } })()`)
  await m('mousePressed', q.x, q.y); await m('mouseReleased', q.x, q.y)
  await wait(150)
  if ((await ev('window.__clicks')) !== 1) out.push('a plain click on a card does not open it')
  // the vertical wheel scrolls the page, not the rail
  await ev('scrollTo(0, 0); StoryRail.vp.scrollLeft = 0; 1'); await wait(200)
  const c = await ev(`(() => { const r = StoryRail.vp.getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(innerHeight - 40, r.top + 80) } })()`)
  await tab.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c.x, y: c.y, deltaX: 0, deltaY: 300 })
  await wait(600)
  const w = await ev('({ y: scrollY, L: StoryRail.vp.scrollLeft, room: document.documentElement.scrollHeight - innerHeight })')
  if (w.y < Math.min(50, w.room - 2)) out.push('the vertical wheel over the rail does not scroll the page (' + Math.round(w.y) + ')')
  if (w.L > 2) out.push('the vertical wheel moved the rail sideways')
  const c2 = await ev(`(() => { const r = StoryRail.vp.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
  await tab.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c2.x, y: c2.y, deltaX: 700, deltaY: 0 })
  await wait(1200)
  if ((await ev('StoryRail.vp.scrollLeft')) < 50) out.push('the horizontal wheel does not move the rail')
  await ev('StoryRail.vp.scrollLeft = 0; scrollTo(0, 0); 1')
  return out
}

async function touch(tab, ev) {
  const out = []
  await tab.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await ev('scrollTo(0, 0); StoryRail.vp.scrollLeft = 0; 1'); await wait(200)
  const c = await ev(`(() => { const r = StoryRail.vp.getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(innerHeight - 120, r.top + 120) } })()`)
  await tab.send('Input.synthesizeScrollGesture', { x: Math.round(c.x), y: Math.round(c.y), yDistance: -300, xDistance: 0, gestureSourceType: 'touch', speed: 800 })
  await wait(700)
  const v = await ev('({ y: scrollY, L: StoryRail.vp.scrollLeft, room: document.documentElement.scrollHeight - innerHeight })')
  if (v.y < Math.min(100, v.room - 2)) out.push('a vertical swipe on the rail does not scroll the page (' + Math.round(v.y) + ')')
  if (v.L > 2) out.push('a vertical swipe moved the rail sideways (' + Math.round(v.L) + ')')
  const c2 = await ev(`(() => { const r = StoryRail.vp.getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: Math.max(40, Math.min(innerHeight - 40, r.top + r.height / 2)) } })()`)
  const y0 = v.y
  await tab.send('Input.synthesizeScrollGesture', { x: Math.round(c2.x), y: Math.round(c2.y), xDistance: -220, yDistance: 0, gestureSourceType: 'touch', speed: 800 })
  await wait(1200)
  const h = await ev('({ y: scrollY, L: StoryRail.vp.scrollLeft, snapped: StoryRail.cards.some((c, i) => Math.abs(StoryRail.target(i) - StoryRail.vp.scrollLeft) <= 2) })')
  if (h.L < 50) out.push('a sideways swipe does not move the rail')
  if (!h.snapped) out.push('a sideways swipe does not settle on a card (' + Math.round(h.L) + ')')
  if (Math.abs(h.y - y0) > 4) out.push('a sideways swipe scrolled the page')
  await tab.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await ev('StoryRail.vp.scrollLeft = 0; scrollTo(0, 0); 1')
  return out
}

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 761 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  for (let i = 0; i < 100 && !(await ev('!!window.StoryRailReady')); i++) await wait(100)
  await ev('window.StoryRailReady.then(() => true)')
  await wait(200)
  return { tab, ev, errors }
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      const chrome = await launch({ width: Math.max(w, 800), height: h })
      const problems = []
      let info = ''
      try {
        const { tab, ev, errors } = await open(chrome, server.url + basename(file), w, h, reduce)
        const a = await ev(AUDIT)
        problems.push(...a.problems)
        info = `${a.pairs} text pairs, lowest contrast ${a.worst}× its minimum`
        const r = await ev(RAIL(!!reduce))
        problems.push(...r.out)
        info += `; ${r.info}`
        problems.push(...(await keyboard(tab, ev, !!reduce)))
        if (w >= 761) { problems.push(...(await mouse(tab, ev, !!reduce))); info += '; drag, click, wheel' }
        else { problems.push(...(await touch(tab, ev))); info += '; swipes' }
        if (!reduce) problems.push(...(await focusRings(tab, ev)))
        // the audit again, after all that, at rest
        await wait(500)
        problems.push(...(await ev(AUDIT)).problems.filter((p) => !problems.includes(p)))
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
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
