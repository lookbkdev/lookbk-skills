// Compare Table Kit: serves the built page and opens it in headless Chrome
// at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and
// 1440. At each size it fails on:
//   - script errors; sideways scrolling anywhere down the page
//   - page text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is behind it (4.5:1, or 3:1
//     from 24 px), the source pop-up included
//   - text cut off by its box, or closer than 16 px to a phone's edge
//   - a source mark wrapped onto a line of its own, away from its fact
//   - the tally disagreeing with the verdicts on the rows
//   - the "ahead" underlines not drawn once a group has arrived
//   - a head row that does not stick, or (when the alternatives scroll
//     sideways) a product column that does not stick or a head row that
//     does not follow
//   - a source pop-up that does not open from the keyboard, does not name
//     the source, its kind ("Our study" for your own figures) and its date,
//     or does not close on Escape and give focus back to its mark
//   - on a phone: chips that do not swipe the pair, a swipe that does not
//     move the chips, or a verdict about a column that is not on screen
//     without "not shown"
//   - a keyboard focus that can't be seen
//   - reduced motion that animates anything
// Once per page it also checks the print layout (the whole table, every
// source listed, no pair view) and prints it to PDF.
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

const LABEL = '.ct-eyebrow, .ct-kind, .ct-v, .ct-m, .ct-tally span, .ct-tally small, .ct-ch.ct-lab, .ct-no, .ct-as b, .ct-who, .ct-picks .ct-q, .ct-sources h3, .ct-sn, .ct-sk, .ct-sd, .ct-su, .ct-pw, .ct-pager, .ct-phead small, .ct-pk2'

const AUDIT = `((W) => {
  const out = []
  const vw = W, phone = vw < 700, min = phone ? 16 : 14
  const LABEL = ${JSON.stringify(LABEL)}
  const skip = (el) => el.closest('.ct-sr, .ct-live, [aria-hidden="true"]:not(.ct-tally):not(.ct-phead):not(.ct-pager), script, style, .ct-data')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const scrolled = (el) => el.closest('.ct-scroll, .ct-track, .ct-chips, .ct-headbar')
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const all = [...document.querySelectorAll('.ct *, .ct-layer *')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.replace(/\u2060/g, '').trim().replace(/\\s+/g, ' ').slice(0, 40) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  const vis = all.filter((el) => { const r = el.getBoundingClientRect(); return !(scrolled(el) && (r.right <= 1 || r.left >= vw - 1)) })
  for (const el of vis) {
    const fs = parseFloat(getComputedStyle(el).fontSize), need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
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
  for (const el of vis) {
    const s = getComputedStyle(el), fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, ratio / need)
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of vis) {
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2 && !el.matches('.ct-scroll, .ct-track, .ct-chips, .ct-headbar')) say('text is cut off at the side of its box: ' + name(el))
    const r = el.getBoundingClientRect()
    if (scrolled(el)) continue
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
    if (phone && !el.closest('.ct-pop') && (r.left < 15 || r.right > vw - 15)) say('text within 16px of the screen edge on a phone: ' + name(el))
  }
  // a mark is never alone on its line: it sits on the line of its fact's last word
  let orphans = 0, marks = 0
  for (const sup of document.querySelectorAll('.ct-cf sup')) {
    if (!shown(sup)) continue
    const m = sup.getBoundingClientRect()
    if (scrolled(sup) && (m.right <= 1 || m.left >= vw - 1)) continue
    // the glyphs of the fact's last word (a text range: no padding, no line gap)
    const words = sup.parentElement.querySelector('.ct-u'), range = document.createRange()
    range.selectNodeContents(words)
    const rects = [...range.getClientRects()], last = rects[rects.length - 1]
    const mid = (m.top + m.bottom) / 2
    marks++
    if (!last || mid < last.top || mid > last.bottom || m.left < last.right - 1) { orphans++; say('source mark ' + sup.textContent.trim() + ' sits on its own line, away from ' + name(sup.closest('.ct-cf'))) }
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, marks }
})`

const BEHAVE = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const API = window.CompareTable, data = JSON.parse(document.querySelector('.ct-data').textContent)
  const root = document.querySelector('.ct'), phone = root.clientWidth < 700
  const visible = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'
  // the tally is the verdicts counted
  const rows = [...document.querySelectorAll('.ct-r[data-v]')]
  const count = { us: 0, level: 0, them: 0 }; rows.forEach((r) => count[r.dataset.v]++)
  const shownT = [...document.querySelectorAll('.ct-tally b')].map((b) => parseInt(b.textContent))
  const lv = data.tally.level, ah = data.tally.ahead, be = data.tally.behind
  if (shownT[0] !== ah || shownT[1] !== lv || shownT[2] !== be) out.push('the tally shows ' + shownT.join('/') + ' but the verdicts give ' + [ah, lv, be].join('/'))
  if (count['us'] !== ah) out.push('the tally says ahead on ' + ah + ' but ' + count['us'] + ' rows have the product ahead')
  if (!rows.some((r) => r.dataset.v === 'them')) out.push('no row has an alternative ahead')
  // draw-in: every group, once, as it arrives
  const heads = phone ? [...document.querySelectorAll('.ct-pane[data-i="0"] .ct-pg[data-g]')] : [...document.querySelectorAll('.ct-gh[data-g]')]
  for (const h of heads) { h.scrollIntoView({ block: 'center' }); await wait(1100) }
  for (const h of heads) if (API.drawCount[h.dataset.g] !== 1) out.push('group ' + (+h.dataset.g + 1) + ' drew ' + (API.drawCount[h.dataset.g] || 0) + ' times after arriving (once)')
  const undrawn = [...document.querySelectorAll(phone ? '.ct-pane .win .ct-u, .ct-pane .lvl .ct-u' : '.ct-board .win .ct-u, .ct-board .lvl .ct-u')].filter((u) => !getComputedStyle(u).backgroundSize.startsWith('100%')).length
  if (undrawn) out.push(undrawn + ' "ahead" underlines are not fully drawn after their groups arrived')
  scrollTo(0, 0); await wait(200)
  for (const h of heads) { h.scrollIntoView({ block: 'center' }); await wait(120) }
  if (Object.values(API.drawCount).some((n) => n !== 1)) out.push('a group drew more than once')
  if (!phone) {
    // the head row sticks
    const board = document.querySelector('.ct-board'), bar = document.querySelector('.ct-headbar'), sc = document.querySelector('.ct-scroll')
    scrollTo(0, board.getBoundingClientRect().top + scrollY + board.offsetHeight * 0.45); await wait(200)
    const top = parseFloat(getComputedStyle(bar).top) || 0
    if (Math.abs(bar.getBoundingClientRect().top - top) > 1.5) out.push('the head row does not stick (' + Math.round(bar.getBoundingClientRect().top) + 'px from the top)')
    if (!bar.classList.contains('is-stuck')) out.push('the stuck head row is not marked (no rule under it)')
    // the product column sticks when the alternatives scroll sideways
    if (sc.scrollWidth > sc.clientWidth + 1) {
      if (!sc.hasAttribute('tabindex')) out.push('the sideways table cannot be reached by keyboard')
      sc.scrollLeft = 160; sc.dispatchEvent(new Event('scroll')); await wait(150)
      const cell = [...document.querySelectorAll('.ct-board .ct-c.is-us')].find((c) => { const r = c.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight })
      const sl = sc.getBoundingClientRect().left
      if (!cell || Math.abs(cell.getBoundingClientRect().left - sl) > 1.5) out.push('the product column does not stick on the left when the alternatives scroll (' + (cell ? Math.round(cell.getBoundingClientRect().left - sl) : 'none') + 'px)')
      if (Math.abs(bar.scrollLeft - sc.scrollLeft) > 1) out.push('the head row does not follow the table sideways (' + bar.scrollLeft + ' vs ' + sc.scrollLeft + ')')
      sc.scrollLeft = 0; sc.dispatchEvent(new Event('scroll')); await wait(80)
    }
  } else {
    // chips move the pair, a swipe moves the chips
    const track = document.querySelector('.ct-track'), tabs = [...document.querySelectorAll('.ct-chips [role="tab"]')], step = () => track.clientWidth + parseFloat(getComputedStyle(track).columnGap || 0)
    document.querySelector('.ct-chips').scrollIntoView({ block: 'start' }); await wait(100)
    tabs[1].click(); await wait(900)
    if (Math.abs(track.scrollLeft - step()) > 2) out.push('tapping the second chip does not swipe to its pair (' + track.scrollLeft + ')')
    if (document.querySelector('.ct-phn').textContent !== data.alts[1].name) out.push('the pair head does not name the chosen alternative')
    track.scrollLeft = step() * (tabs.length - 1); track.dispatchEvent(new Event('scroll')); await wait(500)
    if (tabs[tabs.length - 1].getAttribute('aria-selected') !== 'true') out.push('swiping to the last pair does not move the chips')
    tabs[0].click(); await wait(900)
    // a verdict about a column that is not on screen says so
    for (const pane of document.querySelectorAll('.ct-pane')) {
      const alt = data.alts[+pane.dataset.i].id
      pane.querySelectorAll('.ct-pr').forEach((pr, k) => {
        const v = pr.querySelector('.ct-v').textContent
        const named = [data.product, ...data.alts.map((a) => a.id)]
        const r = document.querySelectorAll('.ct-r[data-g]')[k]
        const ids = [...r.querySelectorAll('.ct-c.win, .ct-c.lvl')].map((c) => c.dataset.col)
        const off = ids.some((id) => id !== data.product && id !== alt)
        if (off && !/not shown/.test(v)) out.push('in the ' + alt + ' pair, "' + v + '" names a column that is not on screen but does not say "not shown"')
        if (!off && /not shown/.test(v)) out.push('in the ' + alt + ' pair, "' + v + '" says "not shown" for a column that is shown')
      })
    }
  }
  return out
})()`

const STILL = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  await wait(100)
  const off = [...document.querySelectorAll('.ct-r[data-g], .ct-pr')].filter((r) => !r.classList.contains('ct-on')).length
  if (off) out.push('with reduced motion ' + off + ' rows start without their underlines drawn')
  const tr = [...document.querySelectorAll('.ct *, .ct-layer *')].filter((el) => parseFloat(getComputedStyle(el).transitionDuration) > 0).length
  if (tr) out.push(tr + ' elements still have transitions with reduced motion')
  if (document.getAnimations().length) out.push(document.getAnimations().length + ' animations run with reduced motion')
  return out
})()`

/** opens a mark by keyboard, reads the pop-up, closes it with Escape */
async function popup(tab, ev) {
  const problems = []
  const key = async (k, code, vk) => { await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(k === 'Enter' ? { text: '\r' } : {}) }); await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }) }
  // a claim about an alternative from the seller's own study, if there is one
  const ok = await ev(`(() => {
    const data = JSON.parse(document.querySelector('.ct-data').textContent)
    const own = data.sources.filter((s) => s.kind === 'own' && !s.estimate).map((s) => s.n)
    const marks = [...document.querySelectorAll('.ct-c.is-alt .ct-m')].filter((m) => m.getClientRects().length && m.closest('.ct-pane, .ct-board') && (!m.closest('.ct-pane') || m.closest('.ct-pane').dataset.i === '0'))
    const m = marks.find((x) => own.includes(+x.dataset.s)) || marks[0]
    if (!m) return false
    m.scrollIntoView({ block: 'center' }); m.focus(); window.__mark = m; return true
  })()`)
  if (!ok) return ['no source mark to open']
  await key('Enter', 'Enter', 13); await new Promise((r) => setTimeout(r, 400))
  const r = await ev(`(() => {
    const data = JSON.parse(document.querySelector('.ct-data').textContent)
    const pop = document.querySelector('.ct-pop'), m = window.__mark, s = data.sources.find((x) => x.n === +m.dataset.s)
    const out = []
    if (pop.hidden) return ['Enter on a source mark does not open its source']
    if (document.activeElement !== pop && !pop.contains(document.activeElement)) out.push('the open source does not take focus')
    const t = pop.textContent
    if (!t.includes(s.text)) out.push('the pop-up does not show the source text')
    if (!t.includes(s.label)) out.push('the pop-up does not say what kind of source it is ("' + s.label + '")')
    if (s.kind === 'own' && !s.estimate && !/Our study/.test(t)) out.push('a figure from your own study is not labelled "Our study" in the pop-up')
    if (!t.includes(s.asOf)) out.push('the pop-up does not give the date ("' + s.asOf + '")')
    const li = document.querySelector('.ct-sources li[data-s="' + s.n + '"]')
    if (!li.classList.contains('is-lit')) out.push('the source list does not light the open source')
    if (s.kind === 'own' && !/Our (study|estimate)/.test(li.textContent)) out.push('the source list does not label source ' + s.n + ' as ours')
    const pr = pop.getBoundingClientRect()
    if (pr.right > innerWidth + 1 || pr.left < -1 || pr.bottom > innerHeight + 1 || pr.top < -1) out.push('the pop-up runs off the screen')
    return out
  })()`)
  problems.push(...r)
  const audit = await ev(`${AUDIT}(innerWidth)`)
  problems.push(...audit.problems.filter((p) => /contrast|text at/.test(p)).map((p) => p + ' (source open)'))
  await key('Escape', 'Escape', 27); await new Promise((r) => setTimeout(r, 200))
  const after = await ev(`({ hidden: document.querySelector('.ct-pop').hidden, back: document.activeElement === window.__mark, expanded: window.__mark.getAttribute('aria-expanded') })`)
  if (!after.hidden) problems.push('Escape does not close the source')
  if (!after.back) problems.push('closing the source does not give focus back to its mark')
  if (after.expanded !== 'false') problems.push('the mark still says it is expanded after closing')
  return problems
}

async function focusRings(tab, ev) {
  const problems = []
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const count = await ev(`[...document.querySelectorAll('.ct button, .ct a, .ct [tabindex="0"]')].filter((el) => el.getClientRects().length).length`)
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 140); i++) {
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
      await ev('document.fonts.ready.then(() => window.CompareTable && window.CompareTable.ready).then(() => new Promise((r) => setTimeout(r, 400)))')
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 40))`)
        const sw = await ev('Math.max(document.documentElement.scrollWidth, innerWidth)')
        if (sw > w + 1 && !problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${sw} > ${w})`)
      }
      if (reduce) problems.push(...(await ev(STILL)))
      else problems.push(...(await ev(BEHAVE)))
      // audit every screenful
      let pairs = 0, worst = 99, marks = 0
      for (let y = 0; y <= height; y += Math.round(h * 0.8)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 60))`)
        const a = await ev(`${AUDIT}(${w})`)
        for (const p of a.problems) if (!problems.includes(p)) problems.push(p)
        pairs += a.pairs; worst = Math.min(worst, a.worst); marks += a.marks
      }
      if (!reduce) {
        // every pair on a phone: the marks and text of the other panes too
        if (w < 700) for (let i = 1; i < (await ev(`document.querySelectorAll('.ct-chips [role="tab"]').length`)); i++) {
          await ev(`(() => { const t = document.querySelector('.ct-track'); t.style.scrollBehavior = 'auto'; t.scrollLeft = ${i} * (t.clientWidth + parseFloat(getComputedStyle(t).columnGap || 0)); t.dispatchEvent(new Event('scroll')) })(); new Promise((r) => setTimeout(r, 300))`)
          for (let y = 0; y <= height; y += Math.round(h * 0.8)) {
            await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 40))`)
            const a = await ev(`${AUDIT}(${w})`)
            for (const p of a.problems) { const q = p + ` (pair ${i + 1})`; if (!problems.includes(q)) problems.push(q) }
            pairs += a.pairs; marks += a.marks
          }
        }
        await ev(`(() => { const t = document.querySelector('.ct-track'); if (t) { t.scrollLeft = 0; t.dispatchEvent(new Event('scroll')) } })(); new Promise((r) => setTimeout(r, 300))`)
        problems.push(...(await popup(tab, ev)))
      }
      if (w === 1440 || w === 390) problems.push(...(await focusRings(tab, ev)))
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const info = `${pairs} text/background pairs (lowest ${worst}x the minimum), ${marks} source marks on their fact's line`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}`)
      await chrome.send('Target.closeTarget', { targetId: (await chrome.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page' && t.url.startsWith(server.url))?.targetId }).catch(() => {})
    }
    // print: the whole table, every source, no pair view
    const tab = await chrome.page()
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url })
    await loaded
    const ev = async (expression) => (await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
    await ev('document.fonts.ready.then(() => window.CompareTable.ready)')
    const [pw, ph] = PAPER.A4
    await tab.send('Emulation.setDeviceMetricsOverride', { width: Math.round(pw * 96 - 2 * 11 / 25.4 * 96), height: Math.round(ph * 96), deviceScaleFactor: 1, mobile: false })
    await tab.send('Emulation.setEmulatedMedia', { media: 'print' })
    await new Promise((r) => setTimeout(r, 300))
    const pr = await ev(`(() => {
      const out = []
      const vis = (s) => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0 }
      if (!vis('.ct-board')) out.push('the table does not print')
      if (vis('.ct-pair')) out.push('the phone pair view prints')
      if (!vis('.ct-sources')) out.push('the sources list does not print')
      const data = JSON.parse(document.querySelector('.ct-data').textContent)
      const lis = [...document.querySelectorAll('.ct-sources li')].filter((li) => li.getClientRects().length)
      if (lis.length !== data.sources.length) out.push('only ' + lis.length + ' of ' + data.sources.length + ' sources print')
      const sc = document.querySelector('.ct-scroll')
      if (sc.scrollWidth > sc.clientWidth + 1) out.push('the printed table is wider than the page (' + sc.scrollWidth + ' > ' + sc.clientWidth + ')')
      const cols = document.querySelectorAll('.ct-headbar [role="columnheader"]').length
      if (cols !== data.alts.length + 2) out.push('the printed table has ' + cols + ' columns')
      const undrawn = [...document.querySelectorAll('.ct-board .win .ct-u')].filter((u) => !getComputedStyle(u).backgroundSize.startsWith('100%')).length
      if (undrawn) out.push(undrawn + ' "ahead" underlines are missing in print')
      return out
    })()`)
    await tab.send('Emulation.setEmulatedMedia', { media: '' })
    const r = await tab.send('Page.printToPDF', { landscape: true, paperWidth: pw, paperHeight: ph, printBackground: true, preferCSSPageSize: true })
    const pages = pdfPages(Buffer.from(r.data, 'base64'))
    if (pr.length) { failed += pr.length; console.log('FAIL print:'); for (const p of pr) console.log(`       ${p}`) }
    else console.log(`ok   print: the whole table and every source, ${pages} A4 landscape page${pages === 1 ? '' : 's'}`)
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
