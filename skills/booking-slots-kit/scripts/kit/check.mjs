// Booking Slots: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440.
// "Now" and the visitor's time zone are pinned to the config's preview, so a
// run is repeatable, and nothing is sent. At each size it fails on:
//   - script errors, links without an address, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (12 px for the mono
//     labels: weekdays, counts, the legend, the ruler, the second time on a
//     slot), measured on screen
//   - text under WCAG AA contrast against what is behind it (4.5:1, or 3:1
//     from 24 px), and parts that carry meaning under 3:1: free-slot and
//     too-soon borders, field borders, free and booked runs in the day
//     columns, the chosen block on the day track, the hold ring
//   - text cut off or off the screen; controls under 44 px tall on a phone
//   - an entrance that does not run once and report settled, or reduced
//     motion that is not settled from the start; focus that can't be seen
// and once, at 1440:
//   - every slot of every day of the week: its time is the shop's wall clock
//     at its instant, on that day, and with the visitor in another zone its
//     second time is the visitor's wall clock at that instant; each day's
//     count matches its free slots
//   - the same with the visitor in a zone with a clock change inside the
//     next two weeks (New York, or London for a shop in the Americas), over
//     two weeks
//   - the booking flow: hold wording per mode, a tab put to sleep stops the
//     countdown and wakes up to the real time left or to the expired state,
//     the hold taken again, an empty send marks both fields, a taken time
//     selects the next free one and keeps the details, a failed send offers
//     email with every field filled in, a good one is booked with a valid
//     calendar file (UTC times, a stable UID, an alarm)
//   - no endpoint: nothing says "held", the request goes to email with every
//     field, and the card says "Requested"
//   - a diary that fails to load shows no times at all and says why
//   - a week with no free time names the next free day and goes to it
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
  const vw = innerWidth, phone = vw <= 760, min = phone ? 16 : 14
  const root = document.querySelector('.bk')
  const SMALL = '.bk-lbl, .bk-n, .bk-dw, .bk-ct, .bk-legend, .bk-ruler, .bk-tl-cap, .bk-slot small, .bk-clock, .bk-card dt, .bk-ini, .bk-stamp'
  const skip = (el) => el.closest('[hidden], script, style, svg, noscript, .bk-sr, .bk-live')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...root.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + (el.textContent || el.getAttribute('class') || '').trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of root.querySelectorAll('a')) if (!a.getAttribute('href') && !a.closest('noscript')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize), need = el.closest(SMALL) ? 12 : min
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  for (const el of root.querySelectorAll('input')) if (shown(el) && parseFloat(getComputedStyle(el).fontSize) < 16) say('a form field is set under 16px (phones zoom in)')
  let pairs = 0, worst = 99
  for (const el of texts) {
    const fg = parse(getComputedStyle(el).color); if (!fg) continue
    const s = getComputedStyle(el), fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    const r = ratio(fg, behind(el))
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  let nt = 99, ntn = 0
  const part = (el, color, what) => {
    if (!shown(el)) return
    const c = parse(color); if (!c || c[3] === 0) return
    const r = ratio(c, behind(el, true)); ntn++; nt = Math.min(nt, r)
    if (r < 3) say(what + ' is ' + r.toFixed(2) + ':1 against what is behind it (needs 3:1)')
  }
  for (const el of root.querySelectorAll('.bk-slot[data-st=free]')) part(el, getComputedStyle(el).borderTopColor, 'a free slot border')
  for (const el of root.querySelectorAll('.bk-slot[data-st=soon]')) part(el, getComputedStyle(el).borderTopColor, 'a too-soon slot border')
  for (const el of root.querySelectorAll('.bk-slot[aria-checked=true]')) part(el, getComputedStyle(el).backgroundColor, 'the chosen slot')
  for (const el of root.querySelectorAll('.bk-fld input')) part(el, getComputedStyle(el).borderTopColor, 'a field border')
  for (const el of root.querySelectorAll('.bk-runs .f')) part(el, getComputedStyle(el).backgroundColor, 'a free run in a day column')
  for (const el of root.querySelectorAll('.bk-runs .t')) part(el, getComputedStyle(el).backgroundColor, 'a booked run in a day column')
  for (const el of root.querySelectorAll('.bk-day[aria-checked=true]')) part(el, getComputedStyle(el).borderTopColor, 'the chosen day frame')
  for (const el of root.querySelectorAll('.bk-pp[aria-checked=true]')) part(el, getComputedStyle(el).borderTopColor, 'the chosen person frame')
  for (const el of root.querySelectorAll('.bk-tl .bk-blk')) part(el, getComputedStyle(el).backgroundColor, 'the chosen block on the day track')
  for (const el of root.querySelectorAll('.bk-ring')) { const c = parse(getComputedStyle(el).stroke); const r = ratio(c, behind(el.closest('.bk-hold'))); ntn++; nt = Math.min(nt, r); if (r < 3) say('the hold ring is ' + r.toFixed(2) + ':1 (needs 3:1)') }
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('input')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && s.overflowX !== 'clip' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (!el.children.length && el.scrollWidth > el.clientWidth + 2 && s.whiteSpace === 'nowrap') say('text overflows its box: ' + name(el))
  }
  for (const el of texts) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el)) }
  // a day's label must stay inside its cell
  for (const c of root.querySelectorAll('.bk-day')) { const b = c.getBoundingClientRect(); for (const t of c.querySelectorAll('.bk-ct, .bk-dw, .bk-dd')) { const r = t.getBoundingClientRect(); if (shown(t) && (r.left < b.left - 0.5 || r.right > b.right + 0.5)) say('a day label is wider than its cell: ' + name(t)) } }
  if (phone) for (const b of root.querySelectorAll('.bk-sv, .bk-pp, .bk-day, .bk-slot, .bk-wk-nav button, .bk-cta, .bk-fld input, .bk-sum button, .bk-alt > *')) if (shown(b) && b.getBoundingClientRect().height < 44) say('a control is under 44px tall on a phone: ' + name(b))
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, nonText: Math.round(nt * 100) / 100, ntn }
})()`

// every slot of every day of the shown weeks: shop time, visitor time, counts
const LABELS = (weeks) => `(async () => {
  const out = []
  const B = window.BookingSlots, root = document.querySelector('.bk'), I = B.info()
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const clock = (tz, ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { date: p.year + '-' + p.month + '-' + p.day, hm: String(+p.hour % 24).padStart(2, '0') + ':' + p.minute } }
  const two = I.shopTz !== I.visitorTz
  let slots = 0, days = 0, offsets = new Set()
  for (let w = 0; w < ${weeks}; w++) {
    if (w) { const nx = root.querySelector('[data-wk="1"]'); if (nx.getAttribute('aria-disabled') === 'true') break; nx.click(); await wait(80) }
    const ds = [...root.querySelectorAll('.bk-day[data-day]')].map((b) => b.dataset.day)
    for (const d of ds) {
      root.querySelector('.bk-day[data-day="' + d + '"]').click(); await wait(60)
      const cell = root.querySelector('.bk-day[data-day="' + d + '"]')
      const all = [...root.querySelectorAll('.bk-slot')]
      const free = all.filter((b) => b.dataset.st === 'free').length
      const n = cell.querySelector('.bk-ct').textContent.trim()
      if ((n === 'Full' ? 0 : parseInt(n, 10)) !== free) out.push(d + ': the day says ' + JSON.stringify(n) + ' but shows ' + free + ' free slots')
      days++
      for (const b of all) {
        const ms = +b.dataset.ms, shop = clock(I.shopTz, ms), vis = clock(I.visitorTz, ms)
        slots++
        offsets.add(Math.round((Date.UTC(+vis.date.slice(0, 4), +vis.date.slice(5, 7) - 1, +vis.date.slice(8, 10), +vis.hm.slice(0, 2), +vis.hm.slice(3)) - Date.UTC(+shop.date.slice(0, 4), +shop.date.slice(5, 7) - 1, +shop.date.slice(8, 10), +shop.hm.slice(0, 2), +shop.hm.slice(3))) / 60000))
        if (shop.date !== d) out.push(d + ' ' + b.querySelector('.bk-tm').textContent + ': its instant is on ' + shop.date + ' in the shop')
        if (b.querySelector('.bk-tm').textContent !== shop.hm) out.push(d + ': a slot reads ' + b.querySelector('.bk-tm').textContent + ' but its instant is ' + shop.hm + ' shop time')
        const sm = b.querySelector('small')
        if (two && (!sm || sm.textContent !== vis.hm + ' yours')) out.push(d + ' ' + shop.hm + ': the visitor time reads ' + JSON.stringify(sm && sm.textContent) + ', expected ' + vis.hm + ' yours')
        if (!two && sm) out.push(d + ' ' + shop.hm + ': shows a second time although the visitor is in the shop zone')
        if (!b.getAttribute('aria-label').startsWith(shop.hm + (two ? ', ' + vis.hm + ' your time' : ''))) out.push(d + ' ' + shop.hm + ': its spoken label does not give both times')
      }
    }
  }
  if (!slots) out.push('no slots at all in ' + ${weeks} + ' week(s)')
  return { out, slots, days, offsets: [...offsets].sort((a, b) => a - b) }
})()`

const FLOW = (hold) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const B = window.BookingSlots, root = document.querySelector('.bk')
  const I = B.info()
  const card = () => root.querySelector('.bk-card').textContent.replace(/\\s+/g, ' ')
  const pickFirst = async () => { const s = root.querySelector('.bk-slot[data-st=free]'); if (!s) return false; s.click(); await wait(150); return true }
  // a person, a day, a time
  const svc = root.querySelectorAll('.bk-sv')[1] || root.querySelector('.bk-sv'); svc.click(); await wait(80)
  const p = [...root.querySelectorAll('.bk-pp')].find((b) => b.dataset.who !== 'any' && b.getAttribute('aria-disabled') !== 'true' && /Next free/.test(b.textContent)); if (p) { p.click(); await wait(80) }
  if (!root.querySelector('.bk-slot[data-st=free]')) { const d = root.querySelector('.bk-day[data-day]:not(.bk-full)'); if (d) { d.click(); await wait(80) } }
  if (!(await pickFirst())) return ['no free slot to book in the first week']
  const st = B.state()
  if (!st.slot) return ['picking a free slot does not select it']
  if (!/\\d\\d:\\d\\d–\\d\\d:\\d\\d/.test(root.querySelector('[data-line-time]').textContent)) out.push('the card does not show the chosen time')
  if (I.mode === 'hold') {
    if (!/Held for you/.test(card()) || !/Nobody else can take it until \\d\\d:\\d\\d/.test(card())) out.push('hold mode: the card does not say it is held and until when')
    if (!B.info().ticking) out.push('hold mode: the countdown is not running')
    // the tab goes to sleep past the end of the hold
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    if (B.info().ticking) out.push('hold mode: the countdown keeps running in a hidden tab')
    const left0 = root.querySelector('[data-left]').textContent
    B.advance(4 * 60000); await wait(1200)
    if (root.querySelector('[data-left]').textContent !== left0) out.push('hold mode: the countdown changed while the tab was hidden')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    await wait(50)
    const t = root.querySelector('[data-left]').textContent, m = +t.split(':')[0]
    if (!B.info().ticking) out.push('hold mode: the countdown did not restart when the tab came back')
    if (!(m >= ${hold} - 5 && m <= ${hold} - 4)) out.push('hold mode: after 4 minutes asleep a ${hold}-minute hold shows ' + t)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    B.advance(30 * 60000)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    await wait(50)
    if (!B.state().hold || !B.state().hold.expired) out.push('hold mode: a tab that slept past the hold does not show it expired')
    if (!/Your hold on \\d\\d:\\d\\d ended at \\d\\d:\\d\\d/.test(card())) out.push('hold mode: the expired state does not say when the hold ended')
    if (root.querySelector('[data-cta]').getAttribute('aria-disabled') !== 'true') out.push('hold mode: the book button still works after the hold expired')
    if (/-\\d/.test(card())) out.push('hold mode: a negative time shows')
    root.querySelector('[data-rehold]').click(); await wait(200)
    if (!B.state().hold || B.state().hold.expired || !/Held for you/.test(card())) out.push('hold mode: checking the time again does not hold it again')
    if (hidden) delete document.hidden
  } else if (I.mode === 'direct') {
    if (/held/i.test(card())) out.push('direct mode: the card says "held" but nothing is held')
    if (!/Not reserved until you book/.test(card())) out.push('direct mode: the card does not say the time is not reserved yet')
  }
  // an empty send
  root.querySelector('#bk-name').value = ''; root.querySelector('#bk-contact').value = ''
  root.querySelector('.bk-card').requestSubmit(); await wait(60)
  for (const k of ['name', 'contact']) {
    const f = root.querySelector('#bk-' + k), e = root.querySelector('#bk-' + k + '-e')
    if (f.getAttribute('aria-invalid') !== 'true' || e.hidden || !e.textContent.trim()) out.push('an empty send does not mark ' + k)
  }
  if (document.activeElement !== root.querySelector('#bk-name')) out.push('after an empty send, focus is not on the first field to fix')
  if (B.state().phase !== 'pick') out.push('an empty send left the pick phase')
  // a time someone else took meanwhile
  const draft = { name: 'Ana Lima', contact: 'ana@mail.example', note: 'Left knee, second visit' }
  for (const [k, v] of Object.entries(draft)) root.querySelector('#bk-' + k).value = v
  const was = B.state().slot.ms
  B.failNext('taken'); root.querySelector('.bk-card').requestSubmit(); await wait(1200)
  const s2 = B.state()
  if (!/Someone took \\d\\d:\\d\\d while you were choosing/.test(card())) out.push('a taken time does not say so')
  if (s2.slot && s2.slot.ms === was) out.push('a taken time stays selected')
  if (root.querySelector('.bk-slot[data-ms="' + was + '"][data-st=free]')) out.push('a taken time is still offered as free')
  if (root.querySelector('#bk-name').value !== draft.name || root.querySelector('#bk-contact').value !== draft.contact) out.push('a taken time lost the typed details')
  if (!s2.slot && !(await pickFirst())) {
    for (const d of root.querySelectorAll('.bk-day[data-day]:not(.bk-full)')) { d.click(); await wait(80); if (await pickFirst()) break }
    if (!B.state().slot) return out.concat(['nothing else free after the stale time'])
    for (const [k, v] of Object.entries(draft)) if (root.querySelector('#bk-' + k).value !== v) out.push('changing day after a taken time lost the ' + k)
  }
  await wait(150)
  // a failed send
  B.failNext('error'); root.querySelector('.bk-card').requestSubmit(); await wait(1200)
  if (B.state().phase !== 'failed' || !/Not booked yet\\. Nothing was saved on our side\\./.test(card())) out.push('a failed send does not say nothing was saved')
  const mail = root.querySelector('[data-hold] [data-mail]')
  if (!mail) out.push('a failed send offers no email')
  else {
    const body = decodeURIComponent(mail.getAttribute('href').split('body=')[1] || '')
    const st3 = B.state(), svcName = root.querySelector('.bk-sv[aria-checked=true] .bk-sv-nm').textContent
    const want = [svcName, draft.name, draft.contact, draft.note, root.querySelector('[data-line-day]').textContent.trim(), root.querySelector('[data-line-time]').firstChild.textContent.split('–')[0], 'Ref: ']
    const pn = root.querySelector('.bk-card dd:nth-of-type(2)').firstChild.textContent.trim(); if (st3.who !== 'shop') want.push(pn)
    for (const w of want) if (!body.includes(w)) out.push('the email fallback is missing ' + JSON.stringify(w))
    if (!mail.getAttribute('href').startsWith('mailto:')) out.push('the email fallback is not a mailto link')
  }
  // and a good one
  root.querySelector('.bk-card').requestSubmit(); await wait(1300)
  const s4 = B.state()
  if (s4.phase !== 'done') out.push('a good booking does not reach the booked state (' + s4.phase + ')')
  else {
    if (!root.querySelector('.bk-stamp') || !/Booked/.test(root.querySelector('.bk-stamp').textContent)) out.push('the booked card has no stamp')
    if (!/Ref [A-Z]{2,4}-\\d{4}-\\d{4}/.test(card())) out.push('the booked card has no reference')
    if (document.activeElement !== root.querySelector('#bk-card-h')) out.push('after booking, focus does not move to the card')
    const a = root.querySelector('[data-ics]')
    if (!a || !a.hasAttribute('download') || !/\\.ics$/.test(a.getAttribute('download'))) out.push('no calendar file to download')
    else {
      const raw = decodeURIComponent(a.getAttribute('href').replace(/^data:text\\/calendar;charset=utf-8,/, ''))
      if (!/\\r\\n$/.test(raw) || /[^\\r]\\n/.test(raw)) out.push('the calendar file does not use CRLF line endings')
      for (const l of raw.split('\\r\\n')) if (new TextEncoder().encode(l).length > 75 && !/[^\\x00-\\x7f]/.test(l)) out.push('a calendar line is longer than 75 octets')
      const lines = raw.replace(/\\r\\n[ \\t]/g, '').split('\\r\\n').filter(Boolean)
      const get = (k) => { const l = lines.find((x) => x.split(/[;:]/)[0] === k); return l ? l.slice(l.indexOf(':') + 1) : null }
      const order = lines.map((l) => l.split(':')[0])
      if (order[0] !== 'BEGIN' || lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR') out.push('the calendar file is not a VCALENDAR')
      for (const k of ['VERSION', 'PRODID', 'UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY', 'LOCATION']) if (!get(k)) out.push('the calendar file has no ' + k)
      if (get('VERSION') !== '2.0') out.push('the calendar file is not version 2.0')
      const begins = lines.filter((l) => l.startsWith('BEGIN:')).map((l) => l.slice(6)), ends = lines.filter((l) => l.startsWith('END:')).map((l) => l.slice(4))
      if (JSON.stringify(begins) !== JSON.stringify(['VCALENDAR', 'VEVENT', 'VALARM']) || JSON.stringify(ends) !== JSON.stringify(['VALARM', 'VEVENT', 'VCALENDAR'])) out.push('the calendar file nests badly: ' + begins.join('>'))
      const utc = (v) => { const m = /^(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z$/.exec(v || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null }
      const s = utc(get('DTSTART')), e = utc(get('DTEND'))
      if (s === null || e === null) out.push('the calendar times are not UTC (…Z) and have no TZID')
      else {
        if (s !== s4.slot.ms) out.push('the calendar start ' + get('DTSTART') + ' is not the booked instant ' + new Date(s4.slot.ms).toISOString())
        const mins = +root.querySelector('.bk-sv[aria-checked=true] .bk-sv-len .bk-lbl').textContent.split(' ')[0]
        if (e - s !== mins * 60000) out.push('the calendar event lasts ' + (e - s) / 60000 + ' min, not ' + mins)
      }
      if (!/^TRIGGER:-PT\\d+[HM]$/.test(lines.find((l) => l.startsWith('TRIGGER')) || '')) out.push('the calendar alarm has no trigger')
      const uid2 = (B.ics() || '').replace(/\\r\\n[ \\t]/g, '').split('\\r\\n').find((l) => l.startsWith('UID:'))
      if (uid2 !== 'UID:' + get('UID')) out.push('the calendar UID changes between two downloads of the same booking')
      if (/[@]/.test(get('UID')) && !/@[a-z0-9.-]+\\.(example|invalid|test)$/.test(get('UID'))) out.push('the calendar UID names a real host')
      window.__ics = raw
    }
  }
  return out
})()`

const REQUEST = `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const B = window.BookingSlots, root = document.querySelector('.bk')
  if (B.info().mode !== 'request') return ['the request-mode page is not in request mode']
  const card = () => root.querySelector('.bk-card').textContent.replace(/\\s+/g, ' ')
  let s = root.querySelector('.bk-slot[data-st=free]')
  if (!s) { const d = root.querySelector('.bk-day[data-day]:not(.bk-full)'); d && d.click(); await wait(60); s = root.querySelector('.bk-slot[data-st=free]') }
  s.click(); await wait(100)
  if (/held/i.test(card() + (root.querySelector('[data-bar]').textContent))) out.push('no endpoint, but the card or bar says "held"')
  if (!/We confirm by email/.test(card()) || !/not reserved until we reply/.test(card())) out.push('no endpoint: the card does not say the time is confirmed by email')
  if (root.querySelector('[data-cta-t]').textContent !== 'Request this time') out.push('no endpoint: the button does not say "Request this time"')
  const draft = { name: 'Ana Lima', contact: '+44 7700 900431', note: 'First visit' }
  for (const [k, v] of Object.entries(draft)) root.querySelector('#bk-' + k).value = v
  root.querySelector('.bk-card').requestSubmit(); await wait(100)
  const st = B.state()
  if (st.phase !== 'requested') out.push('no endpoint: sending does not reach the requested state')
  const href = B.reqHref() || ''
  if (!href.startsWith('mailto:')) out.push('no endpoint: the request is not an email')
  const body = decodeURIComponent(href.split('body=')[1] || '')
  const svcName = root.querySelector('.bk-sv[aria-checked=true] .bk-sv-nm').textContent
  for (const w of [svcName, draft.name, draft.contact, draft.note, 'Day: ', 'Time: ', 'Ref: ']) if (!body.includes(w)) out.push('the request email is missing ' + JSON.stringify(w))
  if (!root.querySelector('.bk-stamp.bk-req') || !/Requested/.test(root.querySelector('.bk-stamp').textContent)) out.push('the requested card is not stamped "Requested"')
  if (root.querySelector('[data-ics]')) out.push('a request that is not confirmed offers a calendar file')
  if (/held|Booked/.test(card())) out.push('the requested card says held or booked')
  return out
})()`

const DIARY = `(() => {
  const root = document.querySelector('.bk'), out = []
  if (root.querySelector('.bk-slot')) out.push('the diary did not load, but times are shown')
  if (!/We could not check what is free/.test(root.textContent)) out.push('the diary did not load, and the page does not say so')
  if ([...root.querySelectorAll('.bk-nx')].some((n) => /Next free/.test(n.textContent))) out.push('the diary did not load, but "next free" times are shown')
  return out
})()`

const NONE = `(async () => {
  const out = [], root = document.querySelector('.bk'), B = window.BookingSlots
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  if (!B.force('none')) return []
  const none = root.querySelector('.bk-none')
  if (!none) return ['a week with no free time does not show the none state']
  if (!/fully booked/.test(none.textContent)) out.push('the none state does not say who is fully booked')
  const go = none.querySelector('[data-jump]')
  if (go) { const d = go.dataset.jump; go.click(); await wait(100); if (B.state().day !== d || !root.querySelector('.bk-slot[data-st=free]')) out.push('"Show" does not go to the next free day') }
  return out
})()`

async function focusRings(tab, ev) {
  const problems = []
  await ev(`document.activeElement && document.activeElement.blur(); const r = document.querySelector('.bk'); r.setAttribute('tabindex', '-1'); r.focus({ preventScroll: true }); r.removeAttribute('tabindex')`)
  const seen = new Set()
  let inside = 0
  for (let i = 0; i < 40; i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || !el.closest('.bk')) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || /0px 0px 0px 3px/.test(s.boxShadow)
      return { ring, name: (el.getAttribute('aria-label') || el.textContent || el.name || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    inside++
    if (!r.ring) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  if (!inside) problems.push('Tab never reaches the section')
  return problems
}

async function open(chrome, url, w, h, reduce) {
  const tab = await chrome.page()
  const errors = []
  chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 760 })
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await tab.send('Page.navigate', { url })
  await loaded
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  for (let i = 0; i < 100 && !(await ev('!!window.BookingSlots')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await ev('!!window.BookingSlots'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
  await ev('window.BookingSlots.ready')
  return { tab, ev, errors }
}

const dataOf = (file) => { const m = /data-bk='([^']*)'/.exec(readFileSync(file, 'utf8')); return m ? JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&')) : {} }

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const data = dataOf(file)
  const pv = data.preview ?? {}
  const base = `?bk-test=1&bk-now=${encodeURIComponent(pv.now ?? new Date().toISOString())}&bk-tz=${encodeURIComponent(pv.tz ?? data.shop.tz)}`
  const server = await serve(dirname(file))
  const page = `${server.url}${relative(dirname(file), file)}`
  let failed = 0
  const report = (tag, problems, info) => {
    if (problems.length) { failed++; console.log(`✗ ${tag}${info ? `: ${info}` : ''}`); for (const p of problems) console.log(`    - ${p}`) }
    else console.log(`✓ ${tag}${info ? `: ${info}` : ''}`)
  }
  const once = async (w, h, reduce, url, fn) => {
    const chrome = await launch({ width: Math.max(w, 800), height: h })
    try { const o = await open(chrome, url, w, h, reduce); const r = await fn(o); if (o.errors.length) r.problems.push(`script errors: ${o.errors.join(' | ')}`); return r }
    catch (e) { return { problems: [e.message], info: '' } }
    finally { await chrome.close() }
  }
  try {
    for (const [w, h, reduce] of RUNS) {
      const r = await once(w, h, reduce, page + base, async ({ tab, ev }) => {
        const problems = []
        const before = await ev('document.querySelector(".bk").hasAttribute("data-settled")')
        if (reduce && !before) problems.push('under reduced motion the section is not settled from the start')
        if (!reduce) {
          await ev(`scrollTo(0, document.querySelector('[data-week]').getBoundingClientRect().top + scrollY - 200)`)
          await new Promise((r) => setTimeout(r, 1600))
          if (!(await ev('document.querySelector(".bk").hasAttribute("data-settled")'))) problems.push('the entrance did not report settled')
          await ev('scrollTo(0, 0)'); await new Promise((r) => setTimeout(r, 300))
          if (await ev(`[...document.querySelectorAll('.bk-runs')].some((el) => getComputedStyle(el).transform !== 'none')`)) problems.push('the entrance ran a second time or did not finish')
        }
        // a chosen time, so the track, the card and the hold are audited too
        await ev(`(async () => { const s = document.querySelector('.bk-slot[data-st=free]'); if (s) s.click(); await new Promise((r) => setTimeout(r, 200)) })()`)
        const a = await ev(AUDIT)
        problems.push(...a.problems)
        problems.push(...(await focusRings(tab, ev)))
        return { problems, info: `${a.pairs} text pairs, lowest ${a.worst}× its minimum; ${a.ntn} parts that carry meaning, lowest ${a.nonText}:1` }
      })
      report(`${w}x${h}${reduce ? ' reduced motion' : ''}`, r.problems, r.info)
    }
    // slot labels with the preview's visitor
    let r = await once(1440, 900, false, page + base, async ({ ev }) => { const x = await ev(LABELS(2)); return { problems: x.out, info: `${x.slots} slots on ${x.days} days, visitor ${pv.tz ?? data.shop.tz}; visitor minus shop: ${x.offsets.map((o) => `${o} min`).join(', ')}` } })
    report('slot times', r.problems, r.info)
    // and with a visitor whose clocks change inside the next two weeks
    const dstTz = /^America\//.test(data.shop.tz) ? 'Europe/London' : 'America/New_York'
    const dstNow = /^America\//.test(data.shop.tz) ? '2026-10-20T14:00:00Z' : '2026-10-27T14:00:00Z'
    r = await once(1440, 900, false, `${page}?bk-test=1&bk-now=${encodeURIComponent(dstNow)}&bk-tz=${dstTz}`, async ({ ev }) => {
      const x = await ev(LABELS(2))
      const problems = [...x.out]
      if (x.offsets.length < 2) problems.push(`the two weeks show one offset only (${x.offsets.join(', ')} min); expected the clock change in ${dstTz}`)
      return { problems, info: `${x.slots} slots on ${x.days} days from ${dstNow.slice(0, 10)}, visitor ${dstTz}; visitor minus shop: ${x.offsets.map((o) => `${o} min`).join(', ')}` }
    })
    report('slot times across a clock change', r.problems, r.info)
    // the booking flow in the page's own mode
    r = await once(1440, 900, false, page + base, async ({ ev }) => ({ problems: await ev(FLOW(data.rules.hold)), info: `mode ${await ev('window.BookingSlots.info().mode')}` }))
    report('booking flow', r.problems, r.info)
    if (data.mode !== 'hold') {
      r = await once(1440, 900, false, page + base + '&bk-mode=hold', async ({ ev }) => ({ problems: await ev(FLOW(data.rules.hold)), info: 'with a hold endpoint' }))
      report('booking flow, hold mode', r.problems, r.info)
    }
    if (data.mode !== 'direct') {
      r = await once(1440, 900, false, page + base + '&bk-mode=direct', async ({ ev }) => ({ problems: await ev(FLOW(data.rules.hold)), info: 'with an endpoint that does not hold' }))
      report('booking flow, direct mode', r.problems, r.info)
    }
    r = await once(1440, 900, false, page + base + '&bk-mode=request', async ({ ev }) => ({ problems: await ev(REQUEST), info: 'no endpoint' }))
    report('request by email', r.problems, r.info)
    r = await once(390, 844, false, page + base + '&bk-mode=request', async ({ ev }) => ({ problems: await ev(REQUEST), info: 'no endpoint, phone' }))
    report('request by email, phone', r.problems, r.info)
    r = await once(1440, 900, false, page + base + '&bk-diary=fail', async ({ ev }) => ({ problems: await ev(DIARY), info: 'diary failed to load' }))
    report('diary failure', r.problems, r.info)
    r = await once(1440, 900, false, page + base, async ({ ev }) => ({ problems: await ev(NONE), info: 'a week with nothing free' }))
    report('no free time', r.problems, r.info)
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
    if (failed) { console.log(`${failed} check${failed > 1 ? 's' : ''} failed`); process.exit(1) }
    console.log('all checks passed')
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
