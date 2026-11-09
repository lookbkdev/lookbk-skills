// Phone Screen Showcase: serves the built page and opens it in headless
// Chrome at 390x844, 768x1024, 1024x768 and 1440x900, then at 1440x900 and
// 390x844 with reduced motion. At every size it walks the story step by step
// and fails on:
//   - script errors
//   - sideways scrolling, words off the screen or cut off in their box
//   - page text under 14 px (16 px on a phone); labels (eyebrow, step
//     numbers, the note beside the phone) under 12 px
//   - text under WCAG AA contrast (4.5:1, 3:1 for large text) against the
//     colour behind it
//   - layout shift: the buttons, the chapter list or the phone caption moving
//     or changing height between steps
//   - a step whose screen is not fully showing when it rests, or a moment the
//     recorder may take a still from where two screens show, one is off
//     sideways or faded, or a sheet is still rising
//   - the fingertip ring covering any letter of the thing it taps, or the
//     thing not dipping when tapped
//   - a composed screen that leaves more than 32% of itself empty
//   - the phone running into the copy, and (desktop) the phone or the
//     buttons below the first screen, (phone) the phone or the caption's
//     title below the first screen
//   - scrolling not reaching every step, or scrolling back up not playing
//     the steps backwards; the open chapter's bar not following the scroll
//   - controls without a visible focus ring, links without an address
//   - reduced motion that still moves, or (phone) does not show the steps
//     as a stack of still screens
// The app screens are pictures of the app (hidden from screen readers and
// described by the phone's label), so their interface text is not held to
// the page's sizes.
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const SIZES = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
]

const LIB = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3]))
  const sec = document.querySelector('.pss')
  const page = parse(getComputedStyle(sec).backgroundColor)
  const behind = (el) => {
    const layers = []
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c[3] > 0.01) { layers.push(c); if (c[3] >= 0.99) break }
    }
    let base = layers.length && layers[layers.length - 1][3] >= 0.99 ? layers.pop().slice(0, 3) : page.slice(0, 3)
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base)
    return base
  }
  const visible = (el) => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || n.hidden) return false } return true }
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ' "' + el.textContent.trim().slice(0, 40) + '"'
  const box = (el) => el.getBoundingClientRect()
  const hit = (a, b, pad = 0) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad
  window.__pssCheck = { parse, ratio, over, behind, visible, name, box, hit }
})()`

const AUDIT = (minPx) => `(() => {
  const { parse, ratio, over, behind, visible, name, box, hit } = window.__pssCheck
  const out = []
  const vw = innerWidth, vh = innerHeight
  if (document.documentElement.scrollWidth > vw + 1) out.push('the page scrolls sideways (' + document.documentElement.scrollWidth + ' > ' + vw + ')')
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) out.push('a link has no address: "' + a.textContent.trim() + '"')
  for (const el of document.querySelectorAll('.pss *')) {
    if (el.closest('script,style,svg,.pss-app,[hidden]')) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || !visible(el)) continue
    const cs = getComputedStyle(el)
    const px = parseFloat(cs.fontSize)
    const min = el.closest('[data-label]') ? 12 : ${minPx}
    if (px < min - 0.01) out.push(name(el) + ' is ' + px + 'px (at least ' + min + 'px here)')
    if (r.left < -1 || r.right > vw + 1) out.push(name(el) + ' runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + ')')
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') out.push(name(el) + ' is cut off in its box: shorten it')
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    const bg = behind(el)
    const got = ratio(over(parse(cs.color), bg), bg)
    if (got < need) out.push(name(el) + ' contrast ' + got.toFixed(2) + ':1, needs ' + need + ':1')
  }
  // what runs into what, and what has to be in the first screen
  const rig = document.querySelector('.pss-pin .pss-rig')
  const R = box(rig)
  for (const c of [...document.querySelectorAll('.pss-bar, .pss-eyebrow, .pss-h1, .pss-lede, .pss-chap, .pss-copy .pss-ctas, .pss-cap')].filter(visible))
    if (hit(R, box(c), 2)) out.push('the phone runs into ' + name(c).slice(0, 44) + ': shorten the headline or the introduction')
  if (R.bottom > vh + 1) out.push('the phone runs ' + Math.round(R.bottom - vh) + 'px below the first screen')
  if (getComputedStyle(document.querySelector('.pss-cap')).display === 'none') {
    const ctas = document.querySelector('.pss-copy .pss-ctas')
    if (visible(ctas) && box(ctas).bottom > vh + 1) out.push('the buttons are ' + Math.round(box(ctas).bottom - vh) + 'px below the first screen: shorten the introduction or a step body')
  } else {
    const t = [...document.querySelectorAll('.pss-caps > div')].find((d) => !d.hasAttribute('aria-hidden'))
    const h = t && t.querySelector('h2')
    if (h && box(h).bottom > vh + 1) out.push('the caption title is below the first screen')
  }
  return out
})()`

// where everything that must not move sits, and how big the story's parts are
const LAYOUT = `(() => { const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',') }; return [g('.pss-copy .pss-ctas'), g('.pss-chap'), g('.pss-cap'), g('.pss-pin .pss-rig'), g('.pss-h1')].join(' | ') })()`

// the resting screen of step i is fully there, and how much of it is empty
const SCREEN = (i) => `(() => {
  const app = document.querySelector('.pss-pin .pss-app')
  const S = app.querySelectorAll('.pss-scr')[${i}]
  const out = []
  if (getComputedStyle(S).visibility !== 'visible') return ['step ${i + 1}: its screen is not showing at rest']
  const m = new DOMMatrix(getComputedStyle(S).transform)
  const sheet = S.querySelector('.pss-sheetp')
  const sm = sheet ? new DOMMatrix(getComputedStyle(sheet).transform) : new DOMMatrix()
  if (Math.abs(m.e) > 0.5 || Math.abs(m.f) > 0.5 || Math.abs(m.a - 1) > 0.001 || Math.abs(sm.f) > 0.5 || Number(getComputedStyle(S).opacity) < 0.99) out.push('step ${i + 1}: its screen is still moving at rest')
  if (!S.classList.contains('shot')) {
    const a = app.getBoundingClientRect(), z = a.width / 390
    const body = S.querySelector('.pss-body')
    const kids = [...body.children].filter((k) => !k.classList.contains('pss-grab') && !k.classList.contains('dock'))
    const top = (body.getBoundingClientRect().top - a.top) / z
    const bottom = Math.max(...kids.map((k) => (k.getBoundingClientRect().bottom - a.top) / z))
    const tabs = S.querySelector('.pss-tabs')
    const dock = S.querySelector('.dock')
    const floor = dock ? (dock.getBoundingClientRect().top - a.top) / z : tabs ? 844 - 86 : 844 - 34
    const empty = (floor - bottom) / (floor - top)
    if (empty > 0.32) out.push('step ${i + 1}: the screen is ' + Math.round(empty * 100) + '% empty above ' + (dock ? 'its docked button' : tabs ? 'the tabs' : 'the bottom') + ' (at most 32%): add a block')
    if (bottom > floor + 2) out.push('step ${i + 1}: the screen\\'s blocks run under ' + (dock ? 'the docked button' : 'the tabs') + ' by ' + Math.round(bottom - floor) + 'pt: remove a block or shorten a list')
  }
  return out
})()`

// at the moment of the tap: the ring clears every letter of its target, and the target dips
const TAP = (i) => `(() => {
  const app = document.querySelector('.pss-pin .pss-app')
  const ring = app.querySelector('.pss-tap')
  if (Number(getComputedStyle(ring).opacity) < 0.5) return ['step ${i + 1}: the fingertip ring is not showing at the tap']
  const rr = ring.getBoundingClientRect()
  const cx = (rr.left + rr.right) / 2, cy = (rr.top + rr.bottom) / 2, rad = rr.width / 2
  const S = app.querySelectorAll('.pss-scr')[${i}]
  const el = [...S.querySelectorAll('.pss-is-target')][0]
  if (!el) return []
  const out = []
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim()) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    for (const r of rg.getClientRects()) {
      const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom))
      if (Math.hypot(nx - cx, ny - cy) < rad - 0.5) out.push('step ${i + 1}: the fingertip ring covers "' + n.textContent.trim().slice(0, 20) + '" on the thing it taps')
    }
  }
  const m = new DOMMatrix(getComputedStyle(el).transform)
  if (!(m.a < 0.99)) out.push('step ${i + 1}: the tapped thing does not dip when pressed')
  return out
})()`

const SIGN = `JSON.stringify([...document.querySelectorAll('.pss-scr,.pss-tap,.pss-tilt,.pss-ch,.pss-note,.pss-caps > div')].map((e) => getComputedStyle(e).transform + getComputedStyle(e).opacity + getComputedStyle(e).visibility + e.className))`

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  const url = `${server.url}${relative(dirname(file), file)}`
  const chrome = await launch({ width: 1440, height: 900 })
  let failed = 0
  const open = async (w, h, { reduce = false, record = false } = {}) => {
    const tab = await chrome.page()
    const errors = []
    chrome.on('Runtime.exceptionThrown', (p, s) => s === tab.sessionId && errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
    if (reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: url + (record ? '?pss-record=1' : '') })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!(window.PSS && window.PSS.ready)')); i++) await new Promise((r) => setTimeout(r, 100))
    await ev('window.PSS.ready.then(() => new Promise((r) => setTimeout(r, 400)))')
    await ev(LIB)
    return { tab, ev, errors }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const report = (label, problems, okLine) => {
    if (problems.length) {
      failed += problems.length
      console.log(`FAIL ${label}`)
      for (const p of problems) console.log(`       ${p}`)
    } else console.log(`ok   ${label}: ${okLine}`)
  }
  try {
    for (const [w, h] of SIZES) {
      const problems = []
      const add = (p, tag) => {
        const line = tag ? `${p} [${tag}]` : p
        if (!problems.some((x) => x.replace(/ \[[^\]]+\]$/, '') === p)) problems.push(line)
      }
      const minPx = w < 760 ? 16 : 14
      // 1. every step, seeked exactly
      const A = await open(w, h, { record: true })
      const n = await A.ev('window.PSS.steps')
      const layouts = []
      for (let i = 0; i < n; i++) {
        await A.ev(`window.PSS.seek(window.PSS.stepAt(${i}))`)
        await wait(60)
        for (const p of await A.ev(AUDIT(minPx))) add(p, `step ${i + 1}`)
        for (const p of await A.ev(SCREEN(i))) add(p)
        layouts.push(await A.ev(LAYOUT))
        if (i < n - 1) {
          await A.ev(`(() => { const s = document.querySelectorAll('.pss-pin .pss-scr')[${i}]; const id = JSON.parse(document.querySelector('.pss-data').textContent).tap[${i}]; const el = id && id.id ? s.querySelector('[data-id="' + CSS.escape(id.id) + '"]') : null; document.querySelectorAll('.pss-is-target').forEach((e) => e.classList.remove('pss-is-target')); if (el) el.classList.add('pss-is-target') })()`)
          await A.ev(`window.PSS.seek(window.PSS.tapAt(${i}))`)
          await wait(40)
          for (const p of await A.ev(TAP(i))) add(p)
          // halfway through the change, the page must not have moved either
          await A.ev(`window.PSS.seek(window.PSS.tapAt(${i}) + 0.55)`)
          layouts.push(await A.ev(LAYOUT))
        }
      }
      // every settled stretch the recorder may take a still from really is settled
      for (const [kind, step, a, b] of await A.ev('window.PSS.moments(0.3)'))
        for (const t of [a, (a + b) / 2, b]) {
          await A.ev(`window.PSS.seek(${t})`)
          const r = await A.ev('window.PSS.settled()')
          if (!r.ok) add(`step ${step + 1} ${kind} moment at ${t.toFixed(2)} s is not settled: ${r.bad.join('; ')}`)
        }
      const moved = layouts.filter((l) => l !== layouts[0])
      if (moved.length) add(`layout shift between steps: ${layouts[0]} became ${moved[0]} (buttons | chapters | caption | phone | headline)`)
      problems.push(...A.errors.map((e) => `script error: ${e}`))
      await A.tab.send('Page.close').catch(() => {})
      // 2. scrolling drives the story, both ways
      const B = await open(w, h)
      const play = await B.ev("document.querySelector('.pss').dataset.play")
      if (play === 'scroll') {
        const reached = []
        for (let i = 0; i < n; i++) {
          await B.ev(`(() => { const s = document.querySelector('.pss'); const range = s.offsetHeight - s.querySelector('.pss-pin').offsetHeight; scrollTo(0, s.offsetTop + (${i} / ${n - 1}) * range) })()`)
          await wait(900)
          reached.push(await B.ev('window.PSS.state().from'))
        }
        if (reached.join() !== [...Array(n).keys()].join()) add(`scrolling down reached steps ${reached.map((x) => x + 1).join(', ')} (want 1 to ${n})`)
        // halfway through step 1's stretch, its bar is about half full
        await B.ev(`(() => { const s = document.querySelector('.pss'); const range = s.offsetHeight - s.querySelector('.pss-pin').offsetHeight; scrollTo(0, s.offsetTop + 0.3 / ${n - 1} * range) })()`)
        await wait(700)
        const pr = await B.ev("Number(getComputedStyle(document.querySelector(getComputedStyle(document.querySelector('.pss-cap')).display !== 'none' ? '.pss-segs button' : '.pss-ch.on')).getPropertyValue('--p'))")
        if (!(pr > 0.2 && pr < 0.4)) add(`the open step's progress bar reads ${pr.toFixed(2)} at 30% of its scroll (want about 0.30)`)
        const back = []
        for (let i = n - 1; i >= 0; i--) {
          await B.ev(`(() => { const s = document.querySelector('.pss'); const range = s.offsetHeight - s.querySelector('.pss-pin').offsetHeight; scrollTo(0, s.offsetTop + (${i} / ${n - 1}) * range) })()`)
          await wait(900)
          back.push(await B.ev('window.PSS.state().from'))
        }
        if (back.join() !== [...Array(n).keys()].reverse().join()) add(`scrolling back up reached steps ${back.map((x) => x + 1).join(', ')} (want ${n} to 1)`)
        await B.ev('scrollTo(0, 0)')
        await wait(300)
      }
      // keyboard: every control shows where the focus is
      await B.ev('document.activeElement && document.activeElement.blur()')
      const want = await B.ev("[...document.querySelectorAll('.pss a[href], .pss button')].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden').length")
      const seen = new Set()
      for (let i = 0; i < want + 2; i++) {
        await B.tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
        await B.tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
        const r = await B.ev(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { id: [...document.querySelectorAll('.pss a[href], .pss button')].indexOf(el) + ' ' + el.outerHTML.slice(0, 60), ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 } })()`)
        if (!r) continue
        seen.add(r.id)
        if (!r.ring) add(`no visible focus ring on ${r.id}`)
      }
      if (seen.size < want) add(`Tab reached ${seen.size} of ${want} controls`)
      problems.push(...B.errors.map((e) => `script error: ${e}`))
      await B.tab.send('Page.close').catch(() => {})
      const mode = w / h < 0.9 && w <= 1100 || w < 760 ? 'one phone, caption under it' : 'chapters beside the phone'
      report(`${w}x${h}`, problems, `${mode}; ${n} steps: text, contrast, no layout shift, screens rest and fill, the ring clears every label and the target dips, in the first screen${play === 'scroll' ? ', scroll down and back up' : ''}, focus`)
    }
    // reduced motion
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ]) {
      const problems = []
      const C = await open(w, h, { reduce: true })
      const n = await C.ev("document.querySelectorAll('.pss-pin .pss-scr').length")
      for (const p of await C.ev(AUDIT(w < 760 ? 16 : 14))) if (!(w < 760 && /phone runs|caption title/.test(p))) problems.push(p)
      const a = await C.ev(SIGN)
      await wait(1200)
      await C.ev('scrollBy(0, 300)')
      await wait(400)
      const b = await C.ev(SIGN)
      if (a !== b) problems.push('reduced motion still moves (two looks 1.6 s apart differ)')
      const running = await C.ev("document.getAnimations().filter((x) => x.playState === 'running').length")
      if (running) problems.push(`reduced motion still animates (${running} CSS animations running)`)
      if (w < 760) {
        const items = await C.ev("[...document.querySelectorAll('.pss-stack .item')].filter((e) => e.getBoundingClientRect().height > 0).length")
        if (items !== n) problems.push(`reduced motion on a phone shows ${items} still screens (want all ${n} as a stack)`)
        const sw = await C.ev('document.documentElement.scrollWidth')
        if (sw > w + 1) problems.push(`the page scrolls sideways (${sw} > ${w})`)
        const shows = await C.ev(`[...document.querySelectorAll('.pss-stack .item')].map((it, i) => getComputedStyle(it.querySelectorAll('.pss-scr')[i]).visibility).join()`)
        if (shows.split(',').some((v) => v !== 'visible')) problems.push('reduced motion: a still screen in the stack is not its own step')
      } else {
        await C.ev("document.querySelectorAll('.pss-chb')[1].click()")
        await wait(50)
        const s = await C.ev('window.PSS.state()')
        if (s.from !== 1 || s.f !== 0) problems.push('reduced motion: choosing a chapter does not show its screen at once')
      }
      problems.push(...C.errors.map((e) => `script error: ${e}`))
      report(`${w}x${h} reduced motion`, problems, w < 760 ? `all ${n} steps as a still stack, nothing moves` : 'nothing moves, chapters switch the screen at once')
      await C.tab.send('Page.close').catch(() => {})
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
    console.log(`all clear: ${input}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
