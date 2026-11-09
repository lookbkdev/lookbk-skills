// Contact Desk: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// "Now" and the visitor's time zone are pinned to the config's preview, so a
// run is repeatable. At each size it fails on:
//   - script errors, links without an address, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (12 px for mono labels,
//     the rota's hours and the plans' labels, measured in screen pixels)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - parts that carry meaning under 3:1 against what is behind them: field
//     and chip borders, the rota's boxes, the now line, open dots, the
//     plans' route and marks
//   - text cut off or off the screen, buttons and chips under 44 px on a phone
//   - the rota: ticks not evenly spaced or not starting at the left edge of
//     the boxes, labels overlapping each other or the now chip, the now line
//     off its time, a row with neither a box nor a "next" marker
//   - the plans: labels overlapping each other or a mark, labels or marks
//     outside the drawing, the north point or scale bar covering a label
//   - an entrance that does not run once and report settled, or reduced
//     motion that is not settled from the start
//   - keyboard focus that can't be seen
// and once, at 1440: every reason shapes the form to its own fields, fields
// two reasons share keep their value, an empty send marks every required
// field and moves focus, a good note reaches the sent state with a reference
// and a reply time, and the spam trap is out of reach.
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

const COLOR = `
  const parse = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el, skipSelf) => {
    const layers = []
    for (let n = skipSelf ? el.parentElement : el; n && n.nodeType === 1; n = n.parentElement) {
      if (n instanceof SVGElement && n.tagName !== 'svg') continue
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let bg = (parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]).slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const ratio = (fg, bg) => { const a = lum(over(fg, bg)), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
`

const AUDIT = `(() => {
  ${COLOR}
  const out = []
  const vw = innerWidth, phone = vw < 760, min = phone ? 16 : 14
  const root = document.querySelector('.ck')
  const SMALL = '.ck-lbl, .ck-tick, .ck-nowchip, .ck-nextm, .ck-refn, .ck-k, .ck-n, .ck-loc, .ck-time'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], .ck-trap, script, style, svg')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...root.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + (el.textContent || el.getAttribute('class') || '').trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of root.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize), need = el.closest(SMALL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  for (const el of root.querySelectorAll('input:not([type=radio]), select, textarea')) if (shown(el) && !el.closest('.ck-trap') && parseFloat(getComputedStyle(el).fontSize) < 16) say('a form field is set under 16px (phones zoom in)')
  // text contrast
  let pairs = 0, worst = 99
  for (const el of texts) {
    const fg = parse(getComputedStyle(el).color); if (!fg) continue
    const s = getComputedStyle(el), fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    const r = ratio(fg, behind(el))
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  // parts that carry meaning: 3:1
  let nt = 99, ntn = 0
  const part = (el, color, what) => {
    if (!shown(el)) return
    const c = parse(color); if (!c || c[3] === 0) return
    const r = ratio(c, behind(el, true)); ntn++; nt = Math.min(nt, r)
    if (r < 3) say(what + ' is ' + r.toFixed(2) + ':1 against what is behind it (needs 3:1)')
  }
  for (const el of root.querySelectorAll('.ck-f input:not([type=radio]), .ck-f select, .ck-f textarea')) part(el, getComputedStyle(el).borderTopColor, 'a field border')
  for (const el of root.querySelectorAll('.ck-chip')) part(el, getComputedStyle(el).borderTopColor, 'a choice border')
  for (const el of root.querySelectorAll('.ck-blk')) part(el, getComputedStyle(el).borderTopColor, el.classList.contains('live') ? 'a working-now box in the rota' : 'an off-shift box in the rota')
  for (const el of root.querySelectorAll('.ck-nowline, .ck-nowtick')) part(el, getComputedStyle(el).borderLeftColor, 'the now line')
  for (const el of root.querySelectorAll('.ck-dot.on')) part(el, getComputedStyle(el).backgroundColor, 'an open dot')
  for (const el of root.querySelectorAll('.ck-plan')) {
    const route = el.querySelector('.ck-pl-route'), ground = getComputedStyle(el.querySelector('.ck-pl-ground')).fill
    const r = ratio(parse(getComputedStyle(route).stroke), parse(ground).slice(0, 3)); ntn++; nt = Math.min(nt, r)
    if (r < 3) say('a plan route is ' + r.toFixed(2) + ':1 against the plan (needs 3:1)')
    const lab = el.querySelector('.ck-pl-lb')
    if (lab) { const r2 = ratio(parse(getComputedStyle(lab).fill), parse(ground).slice(0, 3)); if (r2 < 4.5) say('plan labels are ' + r2.toFixed(2) + ':1 against the plan (needs 4.5:1)') }
  }
  // cut off, off screen, small targets
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('select, input, textarea, .ck-track')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2 && !el.matches('.ck-slip, .ck-fields, .ck-office')) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el)) }
  if (phone) for (const b of root.querySelectorAll('.ck-send, .ck-chip, .ck-ro, .ck-f input:not([type=radio]), .ck-f select')) if (shown(b) && b.getBoundingClientRect().height < 44) say('a control is under 44px tall on a phone: ' + name(b))
  // the rota
  const rota = root.querySelector('[data-rota]')
  const tracks = [...rota.querySelectorAll('[data-track]')]
  const tr0 = tracks[0].getBoundingClientRect()
  const ticks = [...rota.querySelectorAll('.ck-tick')].map((t) => t.getBoundingClientRect().left)
  if (ticks.length !== 9) say('the ruler has ' + ticks.length + ' ticks, expected 9 (every 3 hours over 24)')
  if (Math.abs(ticks[0] - tr0.left) > 1) say('the ruler starts ' + Math.round(ticks[0] - tr0.left) + 'px from the left edge of the rota boxes')
  if (Math.abs(ticks[8] - tr0.right) > 1.5) say('the ruler ends ' + Math.round(ticks[8] - tr0.right) + 'px from the right edge of the rota boxes')
  const gaps = ticks.slice(1).map((x, i) => x - ticks[i])
  if (Math.max(...gaps) - Math.min(...gaps) > 1) say('the ruler ticks are not evenly spaced (' + gaps.map((g) => g.toFixed(1)).join(', ') + ')')
  const labs = [...rota.querySelectorAll('.ck-tick span')].filter(shown).map((s) => s.getBoundingClientRect())
  const hours = [...rota.querySelectorAll('.ck-tick span')].map((s) => s.textContent)
  for (let i = 1; i < hours.length; i++) { const a = hours[i - 1].split(':').map(Number), b = hours[i].split(':').map(Number); if (((b[0] * 60 + b[1]) - (a[0] * 60 + a[1]) + 1440) % 1440 !== 180) say('the ruler labels are not 3 hours apart: ' + hours.join(' ')) }
  for (let i = 1; i < labs.length; i++) if (labs[i].left < labs[i - 1].right + 2) say('two ruler labels overlap')
  const chip = rota.querySelector('[data-nowchip]').getBoundingClientRect()
  for (const l of labs) if (!(chip.bottom <= l.top || chip.top >= l.bottom || chip.right <= l.left || chip.left >= l.right)) say('the now chip covers a ruler label')
  if (labs.length && chip.bottom > Math.min(...labs.map((l) => l.top)) + 0.5) say('the now chip is not above the ruler')
  const info = window.ContactDesk.info()
  const start = Math.floor(info.now / 6e4) * 6e4
  for (const t of tracks) {
    const row = t.closest('.ck-rrow')
    if (!t.querySelector('.ck-blk') && !t.querySelector('.ck-nextm')) say('a rota row is empty: ' + name(row.querySelector('.ck-who b')))
    const nm = t.querySelector('.ck-nextm'); if (nm && !/next: .+\\d\\d:\\d\\d/.test(nm.textContent)) say('a next marker has no time')
  }
  const line = getComputedStyle(rota.querySelector('[data-nowline]')).display === 'none' ? tracks[0].querySelector('.ck-nowtick') : rota.querySelector('[data-nowline]')
  if (line && shown(line)) {
    const x = line.getBoundingClientRect().left + (phone ? 1 : 1)
    const tick0 = ticks[0], h0 = hours[0].split(':').map(Number), nowH = new Intl.DateTimeFormat('en-GB', { timeZone: info.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(info.now)).split(':').map(Number)
    const mins = ((nowH[0] * 60 + nowH[1]) - (h0[0] * 60 + h0[1]) + 1440) % 1440
    const want = tick0 + (mins / 1440) * tr0.width
    if (Math.abs(x - want) > 2.5) say('the now line is ' + Math.round(x - want) + 'px off its time')
  } else say('the now line is missing')
  // plans
  let planInfo = []
  for (const svg of root.querySelectorAll('.ck-plan')) {
    const box = svg.getBoundingClientRect()
    const labsP = [...svg.querySelectorAll('.ck-pl-lb')].map((t) => ({ t, r: t.getBoundingClientRect() }))
    const marks = [...svg.querySelectorAll('.ck-pl-mk')].map((g) => g.getBoundingClientRect())
    const hit = (a, b, pad = 1) => !(a.right <= b.left + pad || a.left >= b.right - pad || a.bottom <= b.top + pad || a.top >= b.bottom - pad)
    const inside = (a) => a.left >= box.left - 0.5 && a.right <= box.right + 0.5 && a.top >= box.top - 0.5 && a.bottom <= box.bottom + 0.5
    const vb = svg.viewBox.baseVal, k = box.width / vb.width
    let smallest = 99
    for (const { t, r } of labsP) {
      const px = parseFloat(t.getAttribute('font-size')) * k; smallest = Math.min(smallest, px)
      if (px < 11.95) say('a plan label renders at ' + px.toFixed(1) + 'px: ' + name(t))
      if (!inside(r)) say('a plan label runs outside the drawing: ' + name(t))
      for (const m of marks) if (hit(r, m)) say('a plan label covers a mark: ' + name(t))
      for (const o of labsP) if (o.t !== t && hit(r, o.r)) say('two plan labels overlap: ' + name(t) + ' and ' + name(o.t))
    }
    for (const m of marks) if (!inside(m)) say('a plan mark is cut off by the edge of the drawing')
    for (const el of svg.querySelectorAll('.ck-pl-n, .ck-pl-sc')) { const r = el.getBoundingClientRect(); for (const { t, r: q } of labsP) if (hit(r, q)) say('the ' + (el.classList.contains('ck-pl-n') ? 'north point' : 'scale bar') + ' covers ' + name(t)); for (const m of marks) if (hit(r, m)) say('the ' + (el.classList.contains('ck-pl-n') ? 'north point' : 'scale bar') + ' covers a mark'); if (!inside(r)) say('the north point or scale bar is outside the drawing') }
    planInfo.push((vb.x || vb.y ? 'crop ' : 'full ') + Math.round(smallest * 10) / 10 + 'px')
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, nonText: Math.round(nt * 100) / 100, ntn, plans: planInfo.join(', ') }
})()`

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('.ck a[href], .ck button, .ck input:not([type=radio]), .ck select, .ck textarea, .ck input[type=radio]:checked')].filter((el) => el.getClientRects().length && !el.closest('[hidden], .ck-trap') && !el.disabled).length`)
  await ev(`document.activeElement && document.activeElement.blur(); const r = document.querySelector('.ck'); r.setAttribute('tabindex', '-1'); r.focus({ preventScroll: true }); r.removeAttribute('tabindex')`)
  const seen = new Set()
  let inside = 0
  for (let i = 0; i < count + 2; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.ck')) return null
      if (el.closest('.ck-trap')) return { trap: true }
      const s = getComputedStyle(el)
      let ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1
      if (!ring && el.type === 'radio') { const host = el.closest('.ck-ro, .ck-chip'); const hs = getComputedStyle(host); ring = hs.outlineStyle !== 'none' && parseFloat(hs.outlineWidth) >= 1 }
      return { ring, name: (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.name || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (r.trap) { problems.push('Tab reaches the spam trap field'); continue }
    inside++
    if (!r.ring) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  if (count && !inside) problems.push('Tab never reaches the section')
  return problems
}

const FORM = (routes) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const D = window.ContactDesk, root = document.querySelector('.ck')
  const routes = ${JSON.stringify(routes)}
  const visible = () => [...root.querySelectorAll('.ck-fields > .ck-f')].filter((f) => !f.hidden && f.style.position !== 'absolute').map((f) => f.dataset.k)
  // the spam trap
  const trap = root.querySelector('.ck-trap input')
  if (!trap || trap.tabIndex !== -1 || trap.autocomplete !== 'off') out.push('the spam trap is missing, or reachable by Tab, or autofilled')
  // every reason shapes the form
  const shared = root.querySelector('.ck-f[data-k="email"] input')
  shared.value = 'keep@this.example'
  for (const r of routes) {
    D.choose(r.id); await wait(700)
    const v = visible().sort().join(','), want = r.fields.map((f) => f.k).sort().join(',')
    if (v !== want) out.push('reason "' + r.id + '" shows ' + v + ', expected ' + want)
    for (const f of r.fields) {
      const el = root.querySelector('.ck-f[data-k="' + f.k + '"]')
      if (el.querySelector('.ck-lab').textContent !== f.label) out.push('reason "' + r.id + '": field ' + f.k + ' is labelled "' + el.querySelector('.ck-lab').textContent + '"')
      if (el.style.transform || el.style.opacity) out.push('reason "' + r.id + '": field ' + f.k + ' did not settle')
    }
    if (root.querySelector('[data-mail]').getAttribute('href') !== 'mailto:' + r.email) out.push('reason "' + r.id + '": the email fallback does not go to ' + r.email)
    if (!/Expect a reply by .+\\d\\d:\\d\\d/.test(root.querySelector('[data-eta]').textContent)) out.push('reason "' + r.id + '": no reply time')
  }
  if (shared.value !== 'keep@this.example') out.push('the email typed under one reason was lost when switching')
  // an empty send
  D.choose(routes[0].id); await wait(700)
  for (const el of root.querySelectorAll('.ck-fields input:not([type=radio]), .ck-fields textarea, .ck-fields select')) el.value = ''
  for (const el of root.querySelectorAll('.ck-fields input[type=radio]')) el.checked = false
  root.querySelector('.ck-desk').requestSubmit(); await wait(120)
  for (const f of routes[0].fields.filter((f) => f.required)) {
    const el = root.querySelector('.ck-f[data-k="' + f.k + '"]')
    const t = el.classList.contains('ck-f-group') ? el : el.querySelector('input, select, textarea')
    if (t.getAttribute('aria-invalid') !== 'true') out.push('an empty send does not mark ' + f.k + ' invalid')
    const err = el.querySelector('.ck-err'); if (!err || !err.textContent.trim()) out.push('no message under ' + f.k)
    else if (!(t.getAttribute('aria-describedby') || '').includes(err.id)) out.push('the message under ' + f.k + ' is not tied to its field')
  }
  if (!root.querySelector('[data-errsum]').textContent.trim()) out.push('an empty send has no summary for screen readers')
  const firstReq = routes[0].fields.find((f) => f.required)
  if (!document.activeElement.closest('.ck-f[data-k="' + firstReq.k + '"]')) out.push('after an error, focus is not in the first field to fix')
  // fill it properly
  const good = { email: 'ana@mail.example', url: 'https://ana.example/work', date: '2027-01-15' }
  for (const f of routes[0].fields) {
    const el = root.querySelector('.ck-f[data-k="' + f.k + '"]')
    if (f.type === 'choice' || f.type === 'swatch') { el.querySelector('input').checked = true; continue }
    const c = el.querySelector('input, select, textarea')
    if (f.type === 'select') c.value = c.options[1].value
    else c.value = good[f.type] || (f.pattern ? f.example : 'Ana Lima')
    c.dispatchEvent(new Event('input', { bubbles: true }))
  }
  D.dry = true
  root.querySelector('.ck-desk').requestSubmit(); await wait(100)
  if (root.querySelector('.ck-err')) out.push('a good note still shows errors: ' + [...root.querySelectorAll('.ck-err')].map((e) => e.parentNode.dataset.k).join(', '))
  if (D.state() !== 'sending') out.push('sending does not show (state ' + D.state() + ')')
  await wait(1700)
  if (D.state() !== 'sent') out.push('a good note does not reach the sent state')
  else {
    const s = root.querySelector('[data-sent]')
    if (!/[A-Z]{2,4}-\\d{4}-\\d{3}/.test(root.querySelector('[data-ref]').textContent)) out.push('the sent state has no reference number')
    if (!s.textContent.includes('ana@mail.example')) out.push('the sent state does not say where the copy went')
    if (!/by .*\\d\\d:\\d\\d/.test(s.textContent)) out.push('the sent state does not say when the reply comes')
    if (document.activeElement !== s) out.push('focus does not move to the sent message')
  }
  return out
})()`

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  for (let i = 0; i < 100 && !(await ev('!!window.ContactDesk')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.ContactDesk'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
  await ev('window.ContactDesk.ready')
  return { tab, ev, errors }
}

const dataOf = (file) => { const m = /data-ck='([^']*)'/.exec(readFileSync(file, 'utf8')); return m ? JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&')) : {} }
const sample = (pattern) => {
  // a value that matches a field's pattern, for the send test
  if (/OR1-/.test(pattern)) return 'OR1-AB12-CD34'
  if (/OR-/.test(pattern)) return 'OR-123456'
  return null
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const data = dataOf(file)
  const q = `?ck-now=${encodeURIComponent(data.preview?.now ?? new Date().toISOString())}&ck-tz=${encodeURIComponent(data.preview?.tz ?? 'Europe/London')}`
  const routes = (data.routes ?? []).map((r) => ({ id: r.id, email: r.email, fields: r.fields.map((f) => ({ ...f, example: f.pattern ? sample(f.pattern) ?? '' : '' })) }))
  const server = await serve(dirname(file))
  const base = `${server.url}${relative(dirname(file), file)}${q}`
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      const chrome = await launch({ width: Math.max(w, 800), height: h })
      const problems = []
      let info = ''
      try {
        const { tab, ev, errors } = await open(chrome, base, w, h, reduce)
        const before = await ev('document.querySelector(".ck").hasAttribute("data-settled")')
        if (reduce && !before) problems.push('under reduced motion the section is not settled from the start')
        if (!reduce) {
          if (before) problems.push('the section settled before it was seen')
          for (const sel of ['.ck-desk', '[data-rota]', '.ck-visit']) {
            await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) scrollTo(0, e.getBoundingClientRect().top + scrollY - 40) })()`)
            await new Promise((r) => setTimeout(r, 2600))
          }
          if (!(await ev('document.querySelector(".ck").hasAttribute("data-settled")'))) problems.push('the entrances did not report settled')
          await ev('scrollTo(0, 0)'); await new Promise((r) => setTimeout(r, 200))
          const again = await ev(`[...document.querySelectorAll('.ck-blk, .ck-ro, .ck-right')].some((el) => el.style.opacity && Number(el.style.opacity) < 1)`)
          if (again) problems.push('an entrance ran a second time')
        }
        const r = await ev(AUDIT)
        problems.push(...r.problems)
        problems.push(...(await focusRings(tab, ev)))
        if (w === 1440 && !reduce) problems.push(...(await ev(FORM(routes))))
        if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
        info = `${r.pairs} text pairs, lowest ${r.worst}× its minimum; ${r.ntn} parts that carry meaning, lowest ${r.nonText}:1; plan labels ${r.plans}`
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
