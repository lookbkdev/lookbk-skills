// Integrations kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, with reduced motion at 390 and 1440, and
// with JavaScript off at 390 and 1440. It fails on:
//   - script errors, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px), in
//     HTML and in the drawn diagram
//   - text under WCAG AA contrast against what is actually behind it (in the
//     diagram: the node's surface or the page)
//   - wires, pins, arrows, packets, node frames, open switches, status chips,
//     filter chips and app marks under 3:1 against what is behind them
//   - for every featured app (and every hidden record on a phone, expanded):
//     two diagram labels touching, a label crossing any wire, a label outside
//     the drawing or the screen, a node's text outside its node
//   - the packet rule broken: a wire whose packet gap is not the one its
//     cadence gives, gaps that do not grow as cadence slows, a speed other
//     than the stated one, packets off their wire, packets moving under
//     reduced motion
//   - the tablist: Arrow keys, Home and End not moving the selection and the
//     focus, or the stage not showing the chosen app; on a phone, the list
//     not opening the chosen app in place
//   - the directory: rows shown that do not match the filters, chip counts
//     that disagree with the rows, rows still sliding after 1 s, the empty
//     state missing, or missing the not-supported answer for its keyword
//   - the page not reporting settled after a change
//   - with JavaScript off: an app without its wiring table, a table without
//     one row per record, or the search showing
// App marks are pictures, so their cut is checked at build time, not here.
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const RUNS = [
  [390, 844], [768, 1024], [1024, 768], [1440, 900],
  [390, 844, 'reduce'], [1440, 900, 'reduce'],
  [390, 844, 'nojs'], [1440, 900, 'nojs'],
]

const HELPERS = `
  const vw = document.documentElement.clientWidth
  const phone = vw < 700
  const root = document.querySelector('.ik')
  const parse = (c) => { const m = c && c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1)
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const pageBg = () => { for (let n = root; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] >= 1) return c.slice(0, 3) } return [255, 255, 255] }
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]).slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const nodes = () => [...root.querySelectorAll('.ik-diag .d-node')].map((n) => ({ r: n.getBoundingClientRect(), c: parse(getComputedStyle(n).fill) }))
  const svgBehind = (el) => {
    const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2
    for (const n of nodes()) if (x >= n.r.left && x <= n.r.right && y >= n.r.top && y <= n.r.bottom && n.c) return n.c.slice(0, 3)
    return behind(el.closest('svg').parentElement)
  }
  const ratio = (fg, bg) => { const a = lum(over(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || el.closest('[hidden], .ik-sr, .ik-measure')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const out = [], seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  const hit = (a, b, m = 0) => !(a.right <= b.left + m || a.left >= b.right - m || a.bottom <= b.top + m || a.top >= b.bottom - m)
`

const TEXT = `(() => {${HELPERS}
  const min = phone ? 16 : 14
  const LABEL = '.ik-lbl, .ik-chip, .ik-f small, .ik-c-fl, .ik-c-tm, .ik-table th, .ik-st-t thead th, .t-when, .t-sec, .t-dir'
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !el.closest('script, style, .ik-mk') && shown(el))
  // chips in a sideways scroller may sit past the edge; the scroller itself must fit
  for (const g of root.querySelectorAll('.ik-fg')) { const r = g.getBoundingClientRect(); if (shown(g) && (r.left < -1 || r.right > vw + 1)) say('a chip row is wider than the screen') }
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fs = parseFloat(s.fontSize)
    const need = el.closest(LABEL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
    const svg = el instanceof SVGElement
    const fg = parse(svg ? s.fill : s.color)
    if (!fg || fg[3] === 0) continue
    const r = ratio(fg, svg ? svgBehind(el) : behind(el))
    const bold = Number(s.fontWeight) >= 700
    const needC = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / needC)
    if (r < needC) say('contrast ' + r.toFixed(2) + ':1 (needs ' + needC + ':1): ' + name(el))
    const b = el.getBoundingClientRect()
    if ((b.right > vw + 1 || b.left < -1) && !el.closest('.ik-fg')) say('text runs off the screen (' + Math.round(b.left) + '..' + Math.round(b.right) + '): ' + name(el))
  }
  for (const el of root.querySelectorAll('*')) {
    if (el instanceof SVGElement || !shown(el) || !el.textContent.trim() || el.closest('.ik-fg')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  // marks that carry meaning (WCAG 1.4.11): 3:1 against what is behind them
  let marks = 0, low = 99
  const mark = (c, bg, what) => { const p = parse(c); if (!p || p[3] === 0) return; const r = ratio(p, bg); marks++; low = Math.min(low, r); if (r < 3) say(what + ' is ' + r.toFixed(2) + ':1 against what is behind it (needs 3:1)') }
  const page = pageBg()
  const surf = nodes()[0]?.c?.slice(0, 3) ?? page
  for (const el of root.querySelectorAll('.ik-diag .d-wire')) if (shown(el)) { mark(getComputedStyle(el).stroke, page, 'a wire'); mark(getComputedStyle(el).stroke, surf, 'a wire') }
  for (const el of root.querySelectorAll('.ik-diag .d-arrow')) if (shown(el)) mark(getComputedStyle(el).fill, page, 'an arrow')
  for (const el of root.querySelectorAll('.ik-diag .d-pin')) if (shown(el)) mark(getComputedStyle(el).stroke, surf, 'a pin')
  for (const el of root.querySelectorAll('.ik-diag .d-pk')) { mark(getComputedStyle(el).fill, page, 'a packet'); mark(getComputedStyle(el).fill, surf, 'a packet') }
  for (const el of root.querySelectorAll('.ik-diag .d-node')) if (shown(el)) mark(getComputedStyle(el).stroke, page, 'a node frame')
  for (const el of root.querySelectorAll('.ik-diag .d-open, .ik-no-i')) if (shown(el)) mark(getComputedStyle(el).stroke, page, 'an open switch')
  for (const el of root.querySelectorAll('.ik-chip')) if (shown(el)) mark(getComputedStyle(el).borderTopColor, behind(el), 'a status chip outline')
  for (const el of root.querySelectorAll('.ik-chip i, .ik-f i')) if (shown(el)) { const s = getComputedStyle(el); mark(parse(s.backgroundColor)?.[3] ? s.backgroundColor : s.borderTopColor, behind(el.parentElement), 'a status shape') }
  for (const el of root.querySelectorAll('.ik-f')) if (shown(el)) mark(getComputedStyle(el).borderTopColor, behind(el.parentElement), 'a filter chip outline')
  for (const el of root.querySelectorAll('.ik-search')) if (shown(el)) mark(getComputedStyle(el).borderTopColor, behind(el.parentElement), 'the search box outline')
  for (const el of root.querySelectorAll('.ik-time i')) if (shown(el)) { const s = getComputedStyle(el); mark(el.classList.contains('you') ? s.backgroundColor : (s.boxShadow.match(/rgba?\\([^)]+\\)/) || [])[0], behind(el.parentElement), 'a setup bar') }
  for (const el of root.querySelectorAll('.ik-mk')) if (shown(el)) { const sh = el.firstElementChild; mark(getComputedStyle(sh).fill, behind(el.parentElement), 'an app mark') }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, marks, low: Math.round(low * 100) / 100 }
})()`

const DIAGRAM = `(() => {${HELPERS}
  const svg = root.querySelector('.ik-diag svg')
  if (!svg) return { problems: ['no diagram is drawn'], labels: 0 }
  const sr = svg.getBoundingClientRect()
  const texts = [...svg.querySelectorAll('text')].filter(shown).map((el) => ({ el, r: el.getBoundingClientRect() }))
  const wires = [...svg.querySelectorAll('.d-wire')].map((el) => {
    const r = el.getBoundingClientRect()
    return { el, r: r.width < 3 ? { left: r.left + r.width / 2 - 1, right: r.left + r.width / 2 + 1, top: r.top, bottom: r.bottom } : { left: r.left, right: r.right, top: r.top + r.height / 2 - 1, bottom: r.top + r.height / 2 + 1 } }
  })
  const nd = [...svg.querySelectorAll('.d-node')].map((n) => n.getBoundingClientRect())
  for (const a of texts) {
    if (a.r.left < sr.left - 1 || a.r.right > sr.right + 1 || a.r.top < sr.top - 1 || a.r.bottom > sr.bottom + 1) say('a diagram label leaves the drawing: ' + name(a.el))
    if (a.r.right > vw + 1 || a.r.left < -1) say('a diagram label runs off the screen: ' + name(a.el))
    for (const w of wires) if (hit(a.r, w.r)) say('a label crosses a wire: ' + name(a.el))
    // a label that starts inside a node must end inside it
    for (const n of nd) { const cx = a.r.left + 2; const cy = a.r.top + a.r.height / 2; if (cx > n.left && cx < n.right && cy > n.top && cy < n.bottom && (a.r.right > n.right + 1 || a.r.left < n.left - 1)) say('a label runs out of its node: ' + name(a.el)) }
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if (hit(texts[i].r, texts[j].r, 0.5)) say('diagram labels overlap: ' + name(texts[i].el) + ' and ' + name(texts[j].el))
  return { problems: out, labels: texts.length, wires: wires.length }
})()`

const PACKETS = (reduced) => `(() => {${HELPERS}
  const K = window.IntegrationsKit
  const { speed, tiers } = K.rules()
  const ws = K.packets()
  const want = (s) => tiers.find((t) => t.upTo === null || s <= t.upTo).interval
  for (const w of ws) {
    if (Math.abs(w.interval - want(w.seconds)) > 1e-9) say('"' + w.record + '" crosses every ' + w.seconds + ' s, so its packet gap must be ' + want(w.seconds) + ' s, not ' + w.interval)
    // the same packet, half a second apart, at several moments
    let tried = 0
    for (let e = 0.2; e < 12 && tried < 4; e += 0.7) {
      const a = K.positions(ws.indexOf(w), e), b = K.positions(ws.indexOf(w), e + 0.25)
      for (const p of a) { const q = b.find((x) => x.k === p.k); if (!q) continue; tried++; const d = (q.u - p.u) * w.len / 0.25; if (Math.abs(d - speed) > 0.5) say('packets on "' + w.record + '" move at ' + d.toFixed(1) + ' px/s, not ' + speed) }
    }
    if (!tried) say('no packet found in flight on "' + w.record + '"')
  }
  const sorted = [...ws].sort((x, y) => x.seconds - y.seconds)
  for (let i = 1; i < sorted.length; i++) if (sorted[i].interval < sorted[i - 1].interval) say('the packet gap shrinks as cadence slows: "' + sorted[i].record + '"')
  const coming = !!root.querySelector('.ik-soon')
  const pk = [...root.querySelectorAll('.ik-diag .d-pk')]
  const wireEls = [...root.querySelectorAll('.ik-diag .d-wire')]
  if (!coming) {
    if (${reduced} && pk.length !== wireEls.length) say('under reduced motion each wire should show one parked packet (' + pk.length + ' for ' + wireEls.length + ' wires)')
    for (const p of pk) {
      const w = wireEls[Number(p.dataset.i)]
      if (!w) continue
      const a = p.getBoundingClientRect(), b = w.getBoundingClientRect()
      const off = b.width < 3 ? Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) : Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2)
      if (off > 1) say('a packet sits ' + off.toFixed(1) + ' px off its wire')
    }
  } else if (pk.length) say('an app that is coming shows packets; nothing crosses yet')
  return { problems: out, wires: ws.length, packets: pk.length, snap: pk.map((p) => p.getAttribute('x') + ',' + p.getAttribute('y')).join(' ') }
})()`

const DIRECTORY = `(async () => {${HELPERS}
  const K = window.IntegrationsKit
  const rows = [...root.querySelectorAll('.ik-row')]
  const data = JSON.parse(root.dataset.ik)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const visible = () => rows.filter((r) => !r.hidden)
  const agree = (f, tag) => {
    const m = (r, g) => (!g.cat || r.dataset.cat === g.cat) && (!g.status || r.dataset.status === g.status) && (!g.q || g.q.split(/\\s+/).every((w) => r.dataset.q.includes(w)))
    const want = rows.filter((r) => m(r, f)).length
    if (visible().length !== want) say(tag + ': ' + visible().length + ' rows shown, ' + want + ' match')
    for (const b of root.querySelectorAll('.ik-f[data-cat]')) { const n = rows.filter((r) => m(r, { ...f, cat: b.dataset.cat })).length; if (Number(b.querySelector('[data-n]').textContent) !== n) say(tag + ': the "' + b.textContent.trim() + '" chip says ' + b.querySelector('[data-n]').textContent + ', its rows are ' + n) }
    for (const b of root.querySelectorAll('.ik-f[data-status]')) { const n = rows.filter((r) => m(r, { ...f, status: b.dataset.status })).length; if (Number(b.querySelector('[data-n]').textContent) !== n) say(tag + ': the "' + b.textContent.trim() + '" chip says ' + b.querySelector('[data-n]').textContent + ', its rows are ' + n) }
    return want
  }
  const settle = async (tag) => { for (let i = 0; i < 20 && !root.hasAttribute('data-settled'); i++) await wait(50); if (!root.hasAttribute('data-settled')) say(tag + ': still moving after 1 s'); if (rows.some((r) => r.style.transform || r.style.opacity)) say(tag + ': rows left mid-slide') }
  const runs = []
  K.filter({ status: 'native', cat: '', q: '' }); await settle('Native'); runs.push(agree({ status: 'native', cat: '', q: '' }, 'Native'))
  const cat = data.apps[0].category
  K.filter({ status: '', cat, q: '' }); await settle(cat); runs.push(agree({ status: '', cat, q: '' }, cat))
  const word = data.apps[1].flows[0].record.split(' ')[0].toLowerCase()
  K.filter({ status: '', cat: '', q: word }); await settle('search'); runs.push(agree({ status: '', cat: '', q: word }, 'search "' + word + '"'))
  if (root.querySelector('.ik-live').textContent.indexOf(String(visible().length)) < 0) say('the live line does not say how many rows show')
  // an unsupported keyword that matches no row
  let probe = null, which = -1
  data.unsupported.forEach((u, i) => { if (probe) return; for (const w of [u.kw, ...u.k.split(/\\s+/)]) if (w.length > 3 && !rows.some((r) => r.dataset.q.includes(w))) { probe = w; which = i; return } })
  if (probe) {
    K.filter({ status: '', cat: '', q: probe }); await settle('empty')
    const e = root.querySelector('.ik-empty')
    if (e.hidden || visible().length) say('searching "' + probe + '" should show the empty state')
    else if (!/support/.test(e.textContent)) say('searching "' + probe + '" should say it is not supported and why')
    if (!root.querySelectorAll('.ik-no li')[which].classList.contains('ik-hit')) say('the matching not-supported item is not marked')
  }
  K.filter({ status: '', cat: '', q: 'zzzzqx' }); await settle('no match')
  if (root.querySelector('.ik-empty').hidden) say('a search with no match shows no empty state')
  K.filter({ status: '', cat: '', q: '' }); await settle('clear')
  if (visible().length !== rows.length) say('clearing the filters does not bring every row back')
  return { problems: out, runs: runs.join('/'), probe }
})()`

const NOJS = `(() => {${HELPERS}
  if (document.documentElement.scrollWidth > vw + 1) say('without JavaScript the page scrolls sideways')
  const data = JSON.parse(root.dataset.ik)
  const st = [...root.querySelectorAll('.ik-static details')]
  if (!shown(root.querySelector('.ik-static'))) say('without JavaScript the wiring tables do not show')
  if (st.length !== data.apps.length) say('without JavaScript ' + st.length + ' wiring tables for ' + data.apps.length + ' apps')
  st.forEach((d, i) => { const n = d.querySelectorAll('tbody tr').length; if (n !== data.apps[i].flows.length) say(data.apps[i].name + ': ' + n + ' table rows for ' + data.apps[i].flows.length + ' records') })
  if (shown(root.querySelector('.ik-railcol')) || shown(root.querySelector('.ik-stage'))) say('without JavaScript the empty rail or stage shows')
  if (!root.querySelector('.ik-search').hidden) say('without JavaScript the search box shows')
  if (root.querySelectorAll('.ik-row').length !== data.apps.length) say('the directory does not list every app')
  st.forEach((d) => (d.open = true))
  return { problems: out, tables: st.length }
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
  const key = async (k, code) => {
    for (const type of ['keyDown', 'keyUp']) await tab.send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: code })
  }
  if (mode !== 'nojs') {
    for (let i = 0; i < 100 && !(await ev('!!window.IntegrationsKit')); i++) await wait(100)
    if (!(await ev('!!window.IntegrationsKit'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.IntegrationsKit.ready')
  } else await ev('document.fonts.ready.then(() => true)')
  return { tab, ev, key, errors }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function settled(ev, ms = 3000) {
  for (let i = 0; i < ms / 50; i++) { if (await ev('document.querySelector(".ik").hasAttribute("data-settled")')) return true; await wait(50) }
  return false
}

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
        const { ev, key, errors } = await open(chrome, url, w, h, mode)
        if (mode === 'nojs') {
          const n = await ev(NOJS)
          problems.push(...n.problems)
          const t = await ev(TEXT)
          problems.push(...t.problems)
          info = `JavaScript off: ${n.tables} wiring tables, ${t.pairs} text pairs, lowest ${t.worst}x its minimum`
        } else {
          await ev(`document.querySelector('.ik-panel').scrollIntoView({ block: 'start' }); true`)
          if (!(await settled(ev))) problems.push('the stage did not report settled after it came into view')
          const data = await ev('JSON.parse(document.querySelector(".ik").dataset.ik)')
          const phone = (await ev('window.IntegrationsKit.mode()')) === 'phone'
          let labels = 0, wires = 0, text = null, pk = 0
          const look = async (tag) => {
            const d = await ev(DIAGRAM)
            labels += d.labels; wires += d.wires ?? 0
            problems.push(...d.problems.map((p) => `${tag}: ${p}`))
          }
          for (const [k, id] of data.featured.entries()) {
            if (phone) await ev(`document.querySelector('.ik-pb[data-app="${id}"]').click(); true`)
            else if (k === 0) { /* already selected */ } else await ev(`window.IntegrationsKit.select(${JSON.stringify(id)}); true`)
            if (!(await settled(ev))) problems.push(`${id}: did not settle after it was chosen`)
            await wait(mode === 'reduce' ? 50 : 700)
            const app = data.apps.find((a) => a.id === id)
            if ((await ev('window.IntegrationsKit.selected()')) !== id) problems.push(`${id}: choosing it did not select it`)
            if (phone && (await ev(`document.querySelector('.ik-pb[data-app="${id}"]').getAttribute('aria-expanded')`)) !== 'true') problems.push(`${id}: its row did not open`)
            if (phone && !(await ev(`!!document.querySelector('.ik-pi[data-app="${id}"] .ik-stage')`))) problems.push(`${id}: the wiring did not open under its row`)
            await look(app.name)
            const p = await ev(PACKETS(mode === 'reduce'))
            pk += p.packets
            problems.push(...p.problems.map((x) => `${app.name}: ${x}`))
            if (mode === 'reduce') { await wait(300); const q = await ev(PACKETS(true)); if (q.snap !== p.snap) problems.push(`${app.name}: packets move under reduced motion`) }
            if (phone && (await ev('!!document.querySelector(".ik-more-btn")'))) {
              await ev('document.querySelector(".ik-more-btn").click(); true')
              await wait(100)
              await look(`${app.name}, all records`)
              if ((await ev('document.querySelector(".ik-more-btn").getAttribute("aria-expanded")')) !== 'true') problems.push(`${app.name}: the more button does not say it is open`)
            }
            if (k === 0) { const t = await ev(TEXT); problems.push(...t.problems); text = t }
          }
          // keys
          if (!phone) {
            const first = data.featured[0], second = data.featured[1], last = data.featured[data.featured.length - 1]
            await ev(`window.IntegrationsKit.select(${JSON.stringify(first)}); document.querySelector('.ik-tab[data-app="${first}"]').focus(); true`)
            const at = async () => ev('[document.activeElement?.dataset?.app, window.IntegrationsKit.selected(), document.querySelector(".ik-stage h3")?.textContent]')
            await key('ArrowDown', 40); let a = await at()
            if (a[0] !== second || a[1] !== second || !a[2]?.includes(data.apps.find((x) => x.id === second).name)) problems.push(`ArrowDown should move to ${second} (focus ${a[0]}, selected ${a[1]})`)
            await key('End', 35); a = await at()
            if (a[0] !== last || a[1] !== last) problems.push(`End should move to ${last} (focus ${a[0]}, selected ${a[1]})`)
            await key('Home', 36); a = await at()
            if (a[0] !== first || a[1] !== first) problems.push(`Home should move to ${first} (focus ${a[0]}, selected ${a[1]})`)
            await key('ArrowUp', 38); a = await at()
            if (a[0] !== last) problems.push('ArrowUp from the first tab should wrap to the last')
            const sel = await ev('document.querySelectorAll(".ik-tab[aria-selected=true]").length')
            if (sel !== 1) problems.push(`${sel} tabs say they are selected`)
          }
          // the directory
          const d = await ev(DIRECTORY)
          problems.push(...d.problems)
          const t2 = await ev(TEXT)
          problems.push(...t2.problems)
          text = { ...text, worst: Math.min(text.worst, t2.worst), low: Math.min(text.low, t2.low) }
          info = `${text.pairs} text pairs, lowest ${text.worst}x its minimum; ${text.marks} marks, lowest ${text.low}:1; ${labels} diagram labels clear of each other and of ${wires} wires across ${data.featured.length} apps; ${pk} packets on their wires; directory rows ${d.runs}${d.probe ? `, "${d.probe}" answered from the not-supported list` : ''}`
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
