// Work Index: serves the built site and opens the index and two case pages in
// headless Chrome at 390, 768, 1024 and 1440 px wide, and with reduced motion
// at 390 and 1440. At each size it fails on:
//   - script errors, links without an address, pictures without alt text
//     (the decorative chips carry alt="" on purpose), loops without a label
//   - sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px), measured at rest
//   - text cut off by its box or running off the screen; controls under
//     44 px tall on a phone
//   - the plate (desktop sizes): for every row on screen it hovers the row and
//     fails if the plate overlaps that row, leaves the screen, rises above the
//     list into the statement or the controls, if its caption is not exactly
//     as wide as the picture, or if any text it sits over is still visible;
//     under reduced motion the plate must be in place at once
//   - the filter: every discipline shows exactly its count, the live line says so
//   - Grid view: no sideways scroll, every card has its picture
//   - phones: the thumbnail opens the plate inline (aria-expanded, a height)
//     and closes it again
//   - a keyboard focus that can't be seen (it presses Tab through the page)
//
//   node scripts/check.mjs out/index.html
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
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
  const vw = innerWidth, phone = vw < 761
  const min = phone ? 16 : 14
  const LABEL = '.wi-lbl, .wi-no, .wi-yr, .wi-cl small, .wi-filters sup, .wi-pcap, .wi-icap span, .wi-tag'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], .wi-sr, .wi-skip, script, style')
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
  for (const i of document.querySelectorAll('img')) if (!i.hasAttribute('alt')) say('a picture has no alt attribute: ' + i.getAttribute('src'))
  for (const i of document.querySelectorAll('.wi-hero img, .wi-inl img, .wi-gallery img')) if (!i.getAttribute('alt')) say('a project picture has empty alt text: ' + i.getAttribute('src'))
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
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o }
  let pairs = 0, worst = 99
  for (const el of texts) {
    if (el.closest('.wi-plate, .wi-cursor')) continue
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
  for (const el of document.querySelectorAll('.wi *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('svg, .wi-filters, .wi-inl, .wi-plate')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) {
    if (el.closest('.wi-filters')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  if (phone) for (const b of document.querySelectorAll('.wi button, .wi-menu, .wi-icap a')) if (shown(b) && !skip(b) && b.getBoundingClientRect().height < 43.5) say('a control is under 44px tall on a phone: ' + name(b) + ' (' + Math.round(b.getBoundingClientRect().height) + 'px)')
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

const PLATE = (reduce) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const W = window.WorkIndex
  const idx = document.querySelector('.wi-idx')
  scrollTo(0, idx.getBoundingClientRect().top + scrollY - Math.round(innerHeight * 0.2))
  await wait(120)
  const rows = [...document.querySelectorAll('.wi-row')]
  let tested = 0, below = 0, above = 0, scaled = 0
  for (let i = 0; i < rows.length; i++) {
    const rb = rows[i].getBoundingClientRect()
    if (rb.top < 0 || rb.bottom > innerHeight) continue
    W.hover(i)
    await wait(${reduce ? 40 : 900})
    const st = W.state()
    const fr = document.querySelector('.wi-frame').getBoundingClientRect()
    const cap = document.querySelector('.wi-pcap').getBoundingClientRect()
    const pl = document.querySelector('.wi-plate').getBoundingClientRect()
    const r = rows[i].getBoundingClientRect()
    tested++; st.side === 'below' ? below++ : above++
    if (fr.width < 200) scaled++
    const n = '#' + (i + 1)
    if (!st.plate) { out.push(n + ': no plate'); continue }
    if (st.rev < 0.999) out.push(n + ': the plate is not fully revealed (' + st.rev.toFixed(2) + ')' + (${reduce} ? ' under reduced motion' : ''))
    if (pl.bottom > r.top + 1 && pl.top < r.bottom - 1) out.push(n + ': the plate overlaps its own row')
    if (pl.top < -1 || pl.bottom > innerHeight + 1 || pl.left < -1 || pl.right > innerWidth + 1) out.push(n + ': the plate leaves the screen')
    if (st.side === 'above' && pl.top < idx.getBoundingClientRect().top - 1) out.push(n + ': the plate rises over the controls or the statement')
    if (Math.abs(cap.width - fr.width) > 1) out.push(n + ': the caption is ' + Math.round(cap.width) + 'px wide under a ' + Math.round(fr.width) + 'px picture')
    if (cap.right > fr.right + 1 || cap.left < fr.left - 1) out.push(n + ': the caption sticks out of the plate')
    for (const c of document.querySelectorAll('.wi-row:not([hidden]) .wi-ti, .wi-row:not([hidden]) .wi-cl, .wi-row:not([hidden]) .wi-oc, .wi-row:not([hidden]) .wi-yr, .wi-row:not([hidden]) .wi-no, .wi-row:not([hidden]) .wi-ds')) {
      if (c.closest('.wi-row') === rows[i]) continue
      const b = c.getBoundingClientRect()
      if (!b.width || !(b.right > pl.left && b.left < pl.right && b.bottom > pl.top && b.top < pl.bottom)) continue
      let o = 1; for (let e = c; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity)
      if (o > 0.02) out.push(n + ': text under the plate is still visible (' + c.textContent.trim().slice(0, 24) + ', ' + o.toFixed(2) + ')')
    }
  }
  W.hide()
  await wait(400)
  if (!tested) out.push('no row was on screen to test the plate')
  return { out, info: tested + ' rows hovered (' + below + ' below, ' + above + ' above' + (scaled ? ', ' + scaled + ' scaled' : '') + ')' }
})()`

const FILTER = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const b of document.querySelectorAll('.wi-filters button')) {
    b.click(); await wait(80)
    const n = [...document.querySelectorAll('.wi-row')].filter((r) => !r.hidden).length
    const want = Number(b.querySelector('sup').textContent)
    if (n !== want) out.push('the filter "' + b.dataset.f + '" shows ' + n + ' rows; its count says ' + want)
    if (!document.getElementById('wi-count').textContent.startsWith(n + ' ')) out.push('the live line does not say ' + n + ' projects for "' + b.dataset.f + '"')
    if (b.getAttribute('aria-pressed') !== 'true') out.push('the filter "' + b.dataset.f + '" is not marked pressed')
  }
  document.querySelector('.wi-filters [data-f="*"]').click(); await wait(700)
  document.querySelector('.wi-views [data-v="grid"]').click(); await wait(1500)
  if (document.querySelector('.wi-idx').dataset.view !== 'grid') out.push('Grid does not switch the view')
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('Grid view scrolls sideways')
  for (const c of document.querySelectorAll('.wi-row:not([hidden]) .wi-chip')) { const r = c.getBoundingClientRect(); if (r.width < 60 || r.height < 40) { out.push('a grid card has no picture (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')'); break } }
  for (const el of document.querySelectorAll('.wi-row .wi-ti, .wi-row .wi-chip')) if (el.style.transform && el.style.transform !== 'none' && el.style.transform !== '') { out.push('a FLIP transform was left behind'); break }
  document.querySelector('.wi-views [data-v="index"]').click(); await wait(900)
  return out
})()`

const INLINE = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const row = document.querySelectorAll('.wi-row')[1]
  const b = row.querySelector('.wi-tg'), box = row.querySelector('.wi-inl')
  b.click(); await wait(1100)
  if (b.getAttribute('aria-expanded') !== 'true') out.push('the thumbnail does not mark itself expanded')
  if (box.hidden || box.getBoundingClientRect().height < 100) out.push('the plate does not open inline (' + Math.round(box.getBoundingClientRect().height) + 'px)')
  const fig = box.querySelector('figure').getBoundingClientRect()
  if (fig.right > innerWidth + 1 || fig.left < -1) out.push('the inline plate runs off the screen')
  const th = b.querySelector('.th').getBoundingClientRect(), tl = b.querySelector('.tl').getBoundingClientRect()
  if (tl.top < th.bottom - 1) out.push('the open/close label sits on the thumbnail')
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways with a plate open')
  b.click(); await wait(700)
  if (b.getAttribute('aria-expanded') !== 'false' || !box.hidden) out.push('the thumbnail does not close the plate')
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  await ev(`document.activeElement && document.activeElement.blur(); scrollTo(0, 0)`)
  const seen = new Set()
  for (let i = 0; i < 18; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      return { ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) { seen.add(m); problems.push(m) } }
  }
  return problems
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
  await ev('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => {}) })))')
  return { tab, ev, errors }
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the site first`)
  const dir = dirname(file)
  const server = await serve(dir)
  const cases = existsSync(join(dir, 'work')) ? readdirSync(join(dir, 'work')).filter((f) => f.endsWith('.html')).sort() : []
  const loopCase = cases.find((f) => /<video/.test(String(readFileSafe(join(dir, 'work', f)))))
  const pages = [relative(dir, file), ...(cases[0] ? [`work/${cases[0]}`] : []), ...(loopCase && loopCase !== cases[0] ? [`work/${loopCase}`] : [])]
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      for (const pg of pages) {
        const chrome = await launch({ width: Math.max(w, 800), height: h })
        const problems = []
        let info = ''
        try {
          const { tab, ev, errors } = await open(chrome, server.url + pg, w, h, reduce)
          const isIndex = await ev('!!window.WorkIndex')
          const r = await ev(AUDIT)
          problems.push(...r.problems)
          info = `${r.pairs} text pairs, lowest contrast ${r.worst}× its minimum`
          if (isIndex) {
            if (w >= 761) { const p = await ev(PLATE(!!reduce)); problems.push(...p.out); info += `; plate: ${p.info}` }
            else problems.push(...(await ev(INLINE)))
            if (!reduce) problems.push(...(await ev(FILTER)))
          }
          if (!reduce) problems.push(...(await focusRings(tab, ev)))
          if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
        } catch (e) {
          problems.push(e.message)
        } finally {
          await chrome.close()
        }
        const tag = `${w}x${h}${reduce ? ' reduced motion' : ''} ${pg}`
        if (problems.length) { failed++; console.log(`✗ ${tag}: ${info}`); for (const p of problems) console.log(`    - ${p}`) }
        else console.log(`✓ ${tag}: ${info}`)
      }
    }
  } finally {
    server.close()
  }
  return failed
}
import { readFileSync } from 'node:fs'
function readFileSafe(f) { try { return readFileSync(f, 'utf8') } catch { return '' } }

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
