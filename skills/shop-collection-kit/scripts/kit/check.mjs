// Shop Collection Kit: serves the built page and opens it in headless Chrome
// at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and
// 1440. At each size it works the page the way a buyer would (turns a plate
// over by hover, focus and the turn button, changes a swatch, filters by a
// category and an option, sorts, opens the quick view, picks an option and
// adds to bag, opens the filter sheet on narrow screens), then reads the page
// and fails on:
//   - script errors, links without an address
//   - sideways scrolling, at any point down the page and with a sheet open
//   - copy smaller than 16 px on a phone or 14 px elsewhere; labels under 12 px
//   - text below WCAG AA contrast against what is behind it
//   - text cut off by its box, running off the screen, or inside the 16 px
//     side margin on a phone
//   - a plate without its reverse, or whose turn label, caption and photo
//     don't agree; a grid that ends in a hole
//   - a filter that leaves plates that don't match, or plates that jump
//     instead of gliding (FLIP), or a count that is wrong
//   - a quick view that doesn't open, trap focus or close on Escape, an Add
//     that doesn't show the bag slip, a slip out of view on a short screen
//   - a keyboard focus that can't be seen (Tab through the page)
//   - reduced motion that still moves
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
  [390, 844, true],
  [1440, 900, true],
]

// Runs in the page once everything has drawn: what's wrong with it.
const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.sck-lab, .sck-chip .n, .sck-filterbtn .n, .sck-mat, .sck-stock'
  const skip = (el) => el.closest('.sck-sr, .sck-data, [hidden], .sck-sheet:not(.on), .sck-card.gone, .sck-card.leaving, .sck-end.gone, .sck-scrim:not(.on)')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.querySelectorAll('.sck *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('.sck a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    // labels: mono caps (and on a phone the plate's material and stock lines)
    const label = el.closest(LABEL) && (el.closest('.sck-lab, .sck-chip .n, .sck-filterbtn .n') || phone)
    const need = label ? 12 : min
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
    if (faded(el)) continue
    // labels on a photograph are checked against the plate colour the photograph is shot on
    if (el.closest('.sck-ph, .sck-ed-pic, .sck-sh-img figure')) continue
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
  // a plate label against its plate's own colour (the photograph's ground)
  for (const el of document.querySelectorAll('.sck-ph .sck-lab, .sck-ed-pic .sck-lab')) {
    if (skip(el) || !shown(el) || faded(el)) continue
    const fg = parse(getComputedStyle(el).color), bg = parse(getComputedStyle(el.parentElement).backgroundColor)
    if (!fg || !bg) continue
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05)
    if (ratio < 4.5) say('plate label contrast ' + ratio.toFixed(2) + ':1 on the plate colour: ' + name(el))
  }
  const ALLOWED = '.sck-mat, .sck-count, .sck-scroll, .sck-ph, .sck-ed, .sck-ed-pic, .sck-sheet, .sck-sh-img figure'
  for (const el of document.querySelectorAll('.sck *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.matches(ALLOWED)) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const s of document.querySelectorAll('.sck-mat span')) {
    if (skip(s) || !shown(s) || phone) continue
    if (s.scrollWidth > s.clientWidth + 1) say('a plate caption is cut off with ...: ' + name(s))
  }
  for (const el of texts) {
    if (faded(el) || el.closest('.sck-scroll')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    else if (phone && (r.left < 15.5 || r.right > vw - 15.5) && !el.closest('.sck-ph, .sck-ed-pic, .sck-sh-img')) say('text inside the 16px side margin (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  // swatch rings must stay inside the plate's column
  for (const sw of document.querySelectorAll('.sck-sw[aria-pressed="true"]')) {
    if (skip(sw) || !shown(sw)) continue
    const card = sw.closest('.sck-card').getBoundingClientRect(), r = sw.getBoundingClientRect()
    if (r.left - 4 < card.left - 0.5) say('a chosen swatch ring pokes ' + Math.round(card.left - (r.left - 4)) + 'px out of its plate')
  }
  // every plate: a reverse photo, a turn label, a caption that names it
  for (const c of document.querySelectorAll('.sck-card')) {
    const back = c.querySelector('img.back.on'), lab = c.querySelector('.sck-turnlab'), cap = c.querySelectorAll('.sck-mat span')[1]
    if (!back || !back.getAttribute('src')) say('a plate has no photo of its reverse: ' + c.dataset.id)
    if (!lab || !lab.textContent.trim()) say('a plate has no turn label: ' + c.dataset.id)
    if (!cap || !cap.textContent.trim()) say('a plate has no turn caption: ' + c.dataset.id)
    if (back && !back.alt.includes(cap ? cap.textContent.trim() : '~')) say('the reverse photo is not described by the caption the plate shows: ' + c.dataset.id)
  }
  // the grid never ends in a hole
  const grid = document.querySelector('.sck-grid')
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const items = [...grid.children].filter((el) => shown(el) && !el.matches('.sck-empty, .sck-card.leaving'))
  const cells = items.reduce((n, el) => n + (el.matches('.sck-ed') ? cols : el.matches('.sck-end') ? (parseInt((el.style.gridColumn.match(/span (\\d+)/) || [0, 1])[1])) : 1), 0)
  if (cells % cols) say('the grid ends with ' + (cols - (cells % cols)) + ' empty cell(s)')
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.sck a[href], .sck button, .sck select')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 70); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body || !el.closest('.sck')) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none')
      const card = el.closest('.sck-card')
      return { ring, visible: el.matches(':focus-visible'), turned: card ? card.classList.contains('turned') : null, name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) {
      const m = `keyboard focus can't be seen on "${r.name}"`
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
    if (r.turned === false) {
      const m = 'keyboard focus on a plate does not turn it over'
      if (!seen.has(m)) problems.push(m), seen.add(m)
    }
  }
  return problems
}

// What a visitor can change, tried for real.
const INTERACT = (reduced) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const root = document.querySelector('.sck')
  const D = JSON.parse(root.querySelector('.sck-data').textContent)
  const settle = ${reduced ? 120 : 1300}
  const vis = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  const cards = [...root.querySelectorAll('.sck-card')]
  const phone = innerWidth < 760
  const grid = root.querySelector('.sck-grid')
  grid.scrollIntoView({ block: 'start' })
  await wait(100)

  // turn over: by the turn button on touch sizes, by hover/focus elsewhere
  const c1 = cards[1]
  if (phone) {
    const b = c1.querySelector('.sck-turnbtn')
    if (!vis(b)) out.push('no turn button on a phone')
    else {
      b.click()
      await wait(settle)
      if (!c1.classList.contains('turned') || b.getAttribute('aria-pressed') !== 'true') out.push('the turn button does not turn the plate over')
      b.click()
      await wait(settle)
    }
  } else {
    c1.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await wait(settle)
    if (!c1.classList.contains('turned')) out.push('hovering a plate does not turn it over')
    const back = c1.querySelector('img.back.on')
    if (back && parseFloat(getComputedStyle(back).opacity) < 0.99) out.push('the reverse photo does not show when turned')
    const lab = c1.querySelector('.sck-turnlab')
    if (parseFloat(getComputedStyle(lab).opacity) < 0.99) out.push('the turn label does not show when turned')
    c1.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    await wait(settle)
    if (c1.classList.contains('turned')) out.push('a plate stays turned after the pointer leaves')
  }

  // swatch
  const multi = cards.find((c) => c.querySelectorAll('.sck-sw[data-v]').length > 1)
  if (multi) {
    const sw = multi.querySelectorAll('.sck-sw[data-v]')[1]
    sw.click()
    await wait(settle)
    const on = multi.querySelector('img.front.on')
    if (!on || on.dataset.v !== sw.dataset.v || parseFloat(getComputedStyle(on).opacity) < 0.99) out.push('a swatch does not change the photograph')
    if (multi.querySelector('img.back.on')?.dataset.v !== sw.dataset.v) out.push('a swatch does not change the reverse photograph to match')
    if (sw.getAttribute('aria-pressed') !== 'true') out.push('the chosen swatch does not say it is chosen')
    multi.querySelectorAll('.sck-sw[data-v]')[0].click()
    await wait(settle)
  }

  // filter by category: right plates, glide not jump, right count
  const cat = D.categories.find((k) => D.products.some((p) => p.category === k.id) && D.products.some((p) => p.category !== k.id))
  if (cat) {
    const chip = [...root.querySelectorAll('[data-f="' + cat.id + '"]')].find(vis)
    if (!chip) out.push('no visible chip for ' + cat.label)
    else {
      const before = new Map(cards.map((c) => [c, c.getBoundingClientRect().top + ',' + c.getBoundingClientRect().left]))
      chip.click()
      if (!${reduced}) {
        await wait(260)
        const moving = cards.filter((c) => !c.classList.contains('gone') && !c.classList.contains('leaving') && c.getAnimations().length)
        const want = cards.filter((c) => !c.classList.contains('gone') && !c.classList.contains('leaving'))
        const moved = want.filter((c) => before.get(c) !== c.getBoundingClientRect().top + ',' + c.getBoundingClientRect().left)
        if (moved.length && !moving.length) out.push('filtered plates jump to their new places instead of gliding')
      }
      await wait(settle)
      const shownIds = cards.filter((c) => !c.classList.contains('gone') && !c.classList.contains('leaving') && vis(c)).map((c) => c.dataset.id)
      const wantIds = D.products.filter((p) => p.category === cat.id).map((p) => p.id)
      if (shownIds.sort().join() !== wantIds.sort().join()) out.push('filtering by ' + cat.label + ' shows ' + shownIds.join(',') + ' instead of ' + wantIds.join(','))
      const nums = [...root.querySelectorAll('.sck-card:not(.gone) .sck-no')].map((n) => n.textContent)
      if (nums.some((n, i) => !n.includes(D.products.find((p) => p.id === cards.filter((c) => !c.classList.contains('gone'))[i]?.dataset.id)?.no ?? '~'))) out.push('plate numbers changed with the filter')
      const count = root.querySelector('.sck-shown')
      if (vis(count) && !count.textContent.startsWith(wantIds.length + ' of')) out.push('the count says "' + count.textContent + '" with ' + wantIds.length + ' plates')
      ;[...root.querySelectorAll('[data-f="all"]')].find(vis).click()
      await wait(settle)
      if (cards.some((c) => c.classList.contains('gone'))) out.push('All does not bring every plate back')
    }
  }

  // option filter + in stock + sort (bar on wide screens, the filter sheet on narrow ones)
  const fbtn = [...root.querySelectorAll('.sck-filterbtn')].find(vis)
  const fs = root.querySelector('.sck-fs')
  if (fbtn) {
    fbtn.click()
    await wait(settle)
    if (!fs.classList.contains('on')) out.push('the Filter button does not open the filter sheet')
    const r = fs.getBoundingClientRect()
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1) out.push('the filter sheet does not fit the screen')
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways with the filter sheet open')
  }
  const scope = fbtn ? fs : root.querySelector('.sck-bar')
  const oid = Object.keys(Object.fromEntries(D.products.flatMap((p) => p.options.map((o) => [o.id, 1]))))[0]
  const ochip = [...scope.querySelectorAll('[data-o]')].find(vis)
  if (ochip) {
    ochip.click()
    await wait(settle)
    const o = ochip.dataset.o
    const bad = cards.filter((c) => !c.classList.contains('gone') && !c.classList.contains('leaving')).filter((c) => !D.products.find((p) => p.id === c.dataset.id).options.some((x) => x.id === o))
    if (bad.length) out.push('the ' + o + ' filter leaves plates without it: ' + bad.map((c) => c.dataset.id).join(','))
    ochip.click()
    await wait(settle)
  }
  const st = [...scope.querySelectorAll('[data-stock]')].find(vis)
  if (st) {
    st.click()
    await wait(settle)
    const bad = cards.filter((c) => !c.classList.contains('gone') && !c.classList.contains('leaving')).filter((c) => ['out', 'soon'].includes(D.products.find((p) => p.id === c.dataset.id).stock.state))
    if (bad.length) out.push('"In stock" leaves sold out or back-soon plates: ' + bad.map((c) => c.dataset.id).join(','))
    if (st.getAttribute('aria-checked') !== 'true') out.push('the In stock switch does not say it is on')
    st.click()
    await wait(settle)
  }
  if (D.sort.some((s) => s.id === 'price-low')) {
    const sb = scope.querySelector('[data-sort="price-low"]'), sel = scope.querySelector('select[data-sortsel]')
    if (sb && vis(sb)) sb.click()
    else if (sel) { sel.value = 'price-low'; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    await wait(settle)
    const tops = cards.map((c) => [c.getBoundingClientRect().top, c.getBoundingClientRect().left, D.products.find((p) => p.id === c.dataset.id).price]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2])
    if (tops.some((v, i) => i && v < tops[i - 1])) out.push('sorting by price does not order the plates by price')
    if (sb && vis(sb)) scope.querySelector('[data-sort]').click()
    else if (sel) { sel.value = D.sort[0].id; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    await wait(settle)
  }
  if (fbtn) {
    fs.querySelector('.sck-fs-show').click()
    await wait(settle)
    if (fs.classList.contains('on')) out.push('Show does not close the filter sheet')
  }

  // quick view, choose, add, slip in view, Escape
  const qcard = cards.find((c) => D.products.find((p) => p.id === c.dataset.id).choices) || cards[0]
  qcard.scrollIntoView({ block: 'center' })
  await wait(100)
  qcard.querySelector('.sck-name').click()
  await wait(settle)
  const qv = root.querySelector('.sck-qv')
  if (!qv.classList.contains('on')) out.push('the quick view does not open from a plate name')
  else {
    const r = qv.getBoundingClientRect()
    if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) out.push('the quick view does not fit the screen')
    if (!qv.contains(document.activeElement)) out.push('focus does not move into the quick view')
    if (phone && r.top < innerHeight * 0.05 && r.height >= innerHeight) out.push('the phone quick view is not a bottom sheet')
    const back = qv.querySelector('.sck-qv-back')
    if (!back.getAttribute('src')) out.push('the quick view does not show the reverse')
    const choice = [...qv.querySelectorAll('[data-qc]')].find((b) => b.getAttribute('aria-disabled') !== 'true' && b.getAttribute('aria-checked') !== 'true')
    if (choice) {
      choice.click()
      await wait(80)
      if (qv.querySelector('[data-qc="' + choice.dataset.qc + '"]').getAttribute('aria-checked') !== 'true') out.push('a choice in the quick view does not stay chosen')
    }
    const add = qv.querySelector('.sck-add')
    if (add.disabled) out.push('Add to bag is disabled for an item in stock')
    add.click()
    await wait(settle)
    const slip = qv.querySelector('.sck-slip')
    if (!qv.classList.contains('added') || !vis(slip)) out.push('Add to bag does not show the bag slip')
    else {
      const s = slip.getBoundingClientRect(), q = qv.getBoundingClientRect()
      if (s.top < q.top - 1 || s.bottom > Math.min(q.bottom, innerHeight) + 1) out.push('the bag slip is not fully in view after Add (' + Math.round(s.top) + '..' + Math.round(s.bottom) + ' in ' + Math.round(q.top) + '..' + Math.round(Math.min(q.bottom, innerHeight)) + ')')
    }
    const count = root.querySelector('.sck-count')
    if (!count.classList.contains('on') || count.querySelector('.sck-count-next').textContent !== String(D.bag.items + 1)) out.push('the bag count does not go up')
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways with the quick view open')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wait(settle)
    if (qv.classList.contains('on')) out.push('Escape does not close the quick view')
  }
  scrollTo(0, 0)
  await wait(200)
  return out
})()`

const STILL = `(async () => {
  const out = []
  if (!document.querySelector('.sck').classList.contains('sck-still')) out.push('reduced motion is not detected')
  const c = document.querySelectorAll('.sck-card')[1]
  c.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
  c.querySelector('.sck-turnbtn')?.click()
  await new Promise((r) => setTimeout(r, 30))
  const imgs = [...document.querySelectorAll('.sck-ph img, .sck-card')]
  const snap = () => imgs.map((el) => { const s = getComputedStyle(el); return s.transform + '|' + s.opacity })
  const a = snap()
  await new Promise((r) => setTimeout(r, 600))
  if (a.some((v, i) => v !== snap()[i])) out.push('something still moves with reduced motion')
  const chip = [...document.querySelectorAll('.sck [data-f]')].find((b) => b.dataset.f !== 'all' && b.getClientRects().length)
  chip?.click()
  await new Promise((r) => setTimeout(r, 30))
  if (document.getAnimations().filter((x) => x.playState === 'running' && (x.effect?.getComputedTiming().duration ?? 0) > 5).length) out.push('filtering still animates with reduced motion')
  document.querySelectorAll('.sck [data-f="all"]')[0].click()
  return out
})()`

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  if (!/viewport-fit=cover/.test(readFileSync(file, 'utf8'))) console.log('note: the page has no viewport-fit=cover, so phone safe areas are left to the browser')
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
      await ev('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 600)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 120))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
        }
        // every plate photograph in view has loaded
      }
      await ev('scrollTo(0, 0); new Promise((r) => setTimeout(r, 300))')
      if (reduce) problems.push(...(await ev(STILL)))
      problems.push(...(await ev(INTERACT(reduce))))
      for (const p of await ev(AUDIT)) problems.push(p)
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const what = await ev(`(() => { const g = document.querySelector('.sck-grid'); return getComputedStyle(g).gridTemplateColumns.split(' ').length + ' columns, ' + document.querySelectorAll('.sck-card').length + ' plates' })()`)
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${what}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${what}${reduce ? ', still' : ''}`)
      const targets = (await chrome.send('Target.getTargets')).targetInfos
      const id = targets.find((t) => t.type === 'page' && t.url.startsWith(server.url))?.targetId
      if (id) await chrome.send('Target.closeTarget', { targetId: id }).catch(() => {})
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
