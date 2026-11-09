// Event Page Kit: proves a built page does what it says.
//
//   node scripts/check.mjs out/index.html
//
// First, without a browser:
//   - time zones: known conversions across both daylight-saving changes in
//     March 2027 (US on the 14th, UK on the 28th), and that a clock time in
//     the skipped hour is refused;
//   - the schedule rules: scripts/kit/fixtures/broken.json must fail with
//     exactly the problems it was written to have (a room double-booked, a
//     person in two places, a session outside opening hours, a time that does
//     not exist, a ticket shown on sale after its sales ended, a quote that
//     points at no session);
//   - the calendar files beside the page: every one parses strictly (CRLF,
//     folding, BEGIN/END, UID, DTSTAMP, UTC times) and its times are the
//     session's.
// Then in headless Chrome, at the preview clock, at 390, 768, 1024 and 1440
// px wide and with reduced motion at 390 and 1440, on every day of the
// programme (and on the phone, every room or track of the switcher). It
// fails on:
//   - script errors, links without an address, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//   - text cut off by its box or off the screen (a session title shortened
//     to one line is allowed only when the block carries the whole title)
//   - a session drawn at the wrong height or place for its times
//   - a glance bar that does not match a session's room, start and end
//   - the now line not at the preview clock; a session marked now that is
//     not running, or the reverse
//   - a phone switcher that is not a working tablist (arrow keys, Home and
//     End move the selection and the focus, and only the chosen room's or
//     track's sessions show)
//   - a speaker's session link that leads nowhere
//   - a keyboard focus that can't be seen
// And once each: the visitor's times on the page against Node's own Intl
// (the DST fixture, built here, seen from New York across the US change);
// the before, during and after states; the real clock when no preview clock
// is asked for; print (one page per day).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from './build.mjs'
import { parse as parseIcs } from './ics.mjs'
import { openPage } from './record.mjs'
import { validate } from './schema.mjs'
import { toUtc, wall } from './tz.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const RUNS = [[390, 844], [768, 1024], [1024, 768], [1440, 900], [390, 844, true], [1440, 900, true]]

/* ---------- without a browser ---------- */
function unit() {
  const out = []
  const L = 'Europe/London', N = 'America/New_York'
  const at = (date, hm, z) => toUtc(date, +hm.slice(0, 2) * 60 + +hm.slice(3), z)
  const cases = [
    ['2027-03-11', '09:00', L, N, '04:00', 'London winter, New York winter (5 h)'],
    ['2027-03-14', '06:30', L, N, '01:30', 'the US Sunday, before 2:00 in New York'],
    ['2027-03-14', '07:30', L, N, '03:30', 'the US Sunday, after 2:00 in New York'],
    ['2027-03-21', '09:00', L, N, '05:00', 'London winter, New York summer (4 h)'],
    ['2027-03-28', '09:00', L, N, '04:00', 'the UK Sunday, both on summer time (5 h again)'],
    ['2027-10-23', '23:00', L, 'Asia/Tokyo', '07:00', 'a late film seen from Tokyo, the next morning'],
  ]
  for (const [d, t, z, v, want, why] of cases) {
    const u = at(d, t, z)
    const got = u === null ? 'null' : wall(v, u).min
    const w = +want.slice(0, 2) * 60 + +want.slice(3)
    if (got !== w) out.push(`time zones: ${d} ${t} ${z} should be ${want} in ${v} (${why}); got ${got === 'null' ? 'nothing' : String(Math.floor(got / 60)).padStart(2, '0') + ':' + String(got % 60).padStart(2, '0')}`)
  }
  if (at('2027-03-28', '01:30', L) !== null) out.push('time zones: 01:30 on 2027-03-28 does not exist in London, and was accepted')
  if (at('2027-03-14', '02:30', N) !== null) out.push('time zones: 02:30 on 2027-03-14 does not exist in New York, and was accepted')
  const broken = JSON.parse(readFileSync(join(here, 'fixtures', 'broken.json'), 'utf8'))
  const v = validate(broken)
  for (const want of broken.expect) if (!v.problems.some((p) => p.startsWith(want))) out.push(`schedule rules: fixtures/broken.json should fail with "${want}"; it did not`)
  return { problems: out, cases: cases.length + 2, broken: broken.expect.length }
}

function calendars(outDir) {
  const out = []
  const dir = join(outDir, 'ics')
  if (!existsSync(dir)) return { problems: ['no ics/ folder beside the page'], files: 0 }
  const files = readdirSync(dir).filter((f) => f.endsWith('.ics'))
  const html = readFileSync(join(outDir, 'index.html'), 'utf8')
  const sessions = new Map([...html.matchAll(/data-code="([^"]+)" data-day="[^"]+" data-room="[^"]+" data-track="[^"]+" data-s="\d+" data-e="\d+" data-u0="(\d+)" data-u1="(\d+)"/g)].map((m) => [m[1], [+m[2], +m[3]]]))
  let events = 0
  for (const f of [...files.map((x) => join(dir, x)), join(outDir, 'programme.ics')]) {
    const r = parseIcs(readFileSync(f, 'utf8'))
    for (const p of r.problems) out.push(`${f.split('/').slice(-2).join('/')}: ${p}`)
    for (const e of r.events) {
      events++
      const code = e.summary.split(' · ')[0]
      const s = sessions.get(code)
      if (!s) out.push(`${f.split('/').pop()}: ${code} is not a session on the page`)
      else if (s[0] !== e.start || s[1] !== e.end) out.push(`${f.split('/').pop()}: ${code} has other times than the page`)
    }
  }
  for (const code of sessions.keys()) if (!files.includes(`${code}.ics`)) out.push(`no calendar file for ${code}`)
  return { problems: out, files: files.length + 1, events }
}

/* ---------- in the browser ---------- */
const AUDIT = `(() => {
  const out = []
  const vw = innerWidth, phone = vw < 760
  const min = phone ? 16 : 14
  const root = document.querySelector('.ev')
  const LABEL = '.ev-ven dt, .ev-lbl, .ev-st, .ev-ft, .ev-tg, .ev-gl, .ev-nb-c, .ev-nb-m, .ev-ref, .ev-rh, .ev-hs, .ev-code, .ev-now, .ev-se, .ev-roll a, .ev-ent, .ev-tz, .ev-dt span, .ev-fn.ev-live'
  const skip = (el) => el.closest('[aria-hidden="true"]:not(.ev-colh):not(.ev-fl):not(.ev-rl):not(.ev-gl > div), [hidden], .ev-sr, .ev-skip, script, style')
  const shown = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set(), say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  let smallest = 99, smallestLabel = 99
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const label = !!el.closest(LABEL)
    if (label) smallestLabel = Math.min(smallestLabel, fs); else smallest = Math.min(smallest, fs)
    if (fs < (label ? 12 : min) - 0.01) say('text at ' + fs + 'px (at least ' + (label ? 12 : min) + 'px here): ' + name(el))
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
    const s = getComputedStyle(el), fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const bg = behind(el), L1 = lum(over(fg, bg)), L2 = lum(bg)
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  let clipped = 0
  for (const el of root.querySelectorAll('*')) {
    if (skip(el) || !shown(el) || !el.textContent.trim()) continue
    const s = getComputedStyle(el)
    const ellipsis = s.textOverflow === 'ellipsis'
    if (ellipsis && el.scrollWidth > el.clientWidth + 1) {
      const art = el.closest('.ev-s, .ev-swb')
      if (el.classList.contains('ev-ti') && el.title === el.textContent && art && art.getAttribute('aria-label').includes(el.textContent)) { clipped++; continue }
      if (art && art.classList.contains('ev-swb') && art.getAttribute('aria-selected') !== null) { clipped++; continue }
      say('text is cut short: ' + name(el)); continue
    }
    if (s.overflowX !== 'visible' && s.overflowX !== 'clip' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  for (const el of texts) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el)) }
  // sessions at their times: top and height from the minutes
  const day = [...root.querySelectorAll('.ev-day')].find((d) => !d.hidden)
  const board = day.querySelector('.ev-board'), bt = board.getBoundingClientRect().top
  const ppm = parseFloat(getComputedStyle(board).getPropertyValue('--ppm'))
  const gs = +day.dataset.gs
  let placed = 0
  for (const s of day.querySelectorAll('.ev-s')) {
    if (!shown(s)) continue
    const r = s.getBoundingClientRect()
    const top = (+s.dataset.s - gs) * ppm + 2, h = (+s.dataset.e - +s.dataset.s) * ppm - 4
    if (Math.abs(r.top - bt - top) > 1.5 || Math.abs(r.height - h) > 1.5) say(s.dataset.code + ' is drawn at ' + Math.round(r.top - bt) + 'px, ' + Math.round(r.height) + 'px tall; its times say ' + Math.round(top) + 'px, ' + Math.round(h) + 'px')
    placed++
  }
  // nothing in one column overlaps (room view)
  const cols = {}
  for (const s of day.querySelectorAll('.ev-s')) if (shown(s)) (cols[Math.round(s.getBoundingClientRect().left)] ??= []).push(s.getBoundingClientRect())
  for (const list of Object.values(cols)) list.forEach((a, i) => list.forEach((b, k) => { if (k > i && a.top < b.bottom - 1 && b.top < a.bottom - 1) say('two sessions overlap in one column') }))
  // the now line at the clock
  const line = day.querySelector('.ev-now')
  const t = window.EventKit.clock()
  const m = (t - +day.dataset.gsu) / 60000
  const inDay = m >= 0 && m <= +day.dataset.ge - gs
  if (inDay === line.hidden) say('the now line is ' + (line.hidden ? 'missing' : 'shown') + ' at ' + new Date(t).toISOString())
  if (inDay && !line.hidden && Math.abs(line.getBoundingClientRect().top - bt - m * ppm) > 1.5) say('the now line is not at the clock')
  for (const s of root.querySelectorAll('.ev-s')) {
    const on = +s.dataset.u0 <= t && +s.dataset.u1 > t, past = +s.dataset.u1 <= t
    if (on !== s.classList.contains('ev-on')) say(s.dataset.code + (on ? ' is running but not marked now' : ' is marked now but is not running'))
    if (past !== s.classList.contains('ev-past')) say(s.dataset.code + ' past state is wrong')
  }
  // glance bars match sessions, and sit at their times
  let bars = 0
  for (const b of root.querySelectorAll('.ev-gb')) {
    const s = root.querySelector('.ev-s[data-code="' + CSS.escape(b.dataset.code) + '"]')
    if (!s || s.dataset.room !== b.dataset.room || s.dataset.day !== b.dataset.day || s.dataset.s !== b.dataset.s || s.dataset.e !== b.dataset.e || s.dataset.u0 !== b.dataset.u0) { say('glance bar ' + b.dataset.code + ' does not match its session'); continue }
    const row = b.closest('.ev-gl-rows'), a0 = +row.dataset.a0, a1 = +row.dataset.a1
    const tr = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect()
    const x = tr.left + ((+s.dataset.s - a0) / (a1 - a0)) * tr.width, w = ((+s.dataset.e - +s.dataset.s) / (a1 - a0)) * tr.width
    if (Math.abs(r.left - x) > 1 || Math.abs(r.width - w) > 1) say('glance bar ' + b.dataset.code + ' is not at its times')
    bars++
  }
  if (bars !== root.querySelectorAll('.ev-s').length) say(bars + ' glance bars for ' + root.querySelectorAll('.ev-s').length + ' sessions')
  // speakers' links lead to a session
  for (const a of root.querySelectorAll('.ev-go')) if (!root.querySelector(a.getAttribute('href'))) say('a speaker link leads nowhere: ' + a.dataset.go)
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, smallest, smallestLabel, placed, bars, clipped }
})()`

async function key(tab, k, code, vk) {
  await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk })
  await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk })
}

async function focusRings(tab, ev) {
  const problems = []
  await ev(`document.activeElement && document.activeElement.blur(); scrollTo(0, 0)`)
  const seen = new Set()
  let inPage = 0
  for (let i = 0; i < 70; i++) {
    await key(tab, 'Tab', 'Tab', 9)
    const r = await ev(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el); return { ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1, visible: el.matches(':focus-visible'), name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) } })()`)
    if (!r) continue
    inPage++
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  if (!inPage) problems.push('Tab never reaches the page')
  return problems
}

/** The phone switcher: a tablist that moves with the keys and shows only the chosen sessions. */
async function switcher(tab, ev) {
  const problems = []
  const info = await ev(`(() => { const t = [...document.querySelectorAll('.ev-swb')]; return { n: t.length, key: document.querySelector('.ev-dayset').classList.contains('ev-sw-track') ? 'track' : 'room', role: document.querySelector('.ev-sw').getAttribute('role'), ids: t.map((x) => x.dataset.sel) } })()`)
  if (info.role !== 'tablist') problems.push('the phone switcher is not a tablist')
  await ev(`document.querySelector('.ev-swb[aria-selected="true"]').focus()`)
  const state = () => ev(`(() => {
    const sel = document.querySelector('.ev-swb[aria-selected="true"]')
    const day = [...document.querySelectorAll('.ev-day')].find((d) => !d.hidden)
    const vis = [...day.querySelectorAll('.ev-s')].filter((s) => getComputedStyle(s).display !== 'none')
    return { sel: sel.dataset.sel, focus: document.activeElement === sel, tabindex: [...document.querySelectorAll('.ev-swb')].map((x) => x.tabIndex).join(','), wrong: vis.filter((s) => s.dataset.${info.key} !== sel.dataset.sel).length, shown: vis.length, controls: sel.getAttribute('aria-controls') }
  })()`)
  const steps = [['ArrowRight', 'ArrowRight', 39, 1], ['ArrowRight', 'ArrowRight', 39, 2], ['End', 'End', 35, info.n - 1], ['Home', 'Home', 36, 0], ['ArrowLeft', 'ArrowLeft', 37, info.n - 1]]
  let visits = 0
  for (const [k, c, vk, want] of steps) {
    await key(tab, k, c, vk)
    await new Promise((r) => setTimeout(r, 60))
    const s = await state()
    if (s.sel !== info.ids[want % info.n]) problems.push(`${k} on the switcher selected ${s.sel}, not ${info.ids[want % info.n]}`)
    if (!s.focus) problems.push(`after ${k} the focus is not on the selected tab`)
    if (s.tabindex.split(',').filter((x) => x === '0').length !== 1) problems.push('more than one switcher tab is in the Tab order')
    if (s.wrong) problems.push(`with ${s.sel} chosen, ${s.wrong} other session(s) still show`)
    visits++
  }
  return { problems, visits }
}

/** Day tabs: arrow keys move between days and show that day's panel. */
async function dayTabs(tab, ev) {
  const problems = []
  const n = await ev(`document.querySelectorAll('.ev-dt').length`)
  if (n < 2) return problems
  await ev(`document.querySelector('.ev-dt[aria-selected="true"]').focus()`)
  await key(tab, 'ArrowRight', 'ArrowRight', 39)
  const r = await ev(`(() => { const t = document.querySelector('.ev-dt[aria-selected="true"]'); const p = document.getElementById(t.getAttribute('aria-controls')); return { focus: document.activeElement === t, shown: !p.hidden, others: [...document.querySelectorAll('.ev-day')].filter((d) => d !== p && !d.hidden).length, role: t.parentElement.getAttribute('role') } })()`)
  if (r.role !== 'tablist') problems.push('the day tabs are not a tablist')
  if (!r.focus || !r.shown || r.others) problems.push('ArrowRight on the day tabs did not move to the next day and show only its panel')
  return problems
}

async function printPages(chrome, ev, tab) {
  const { data } = await tab.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true })
  const pdf = Buffer.from(data, 'base64').toString('latin1')
  return (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length
}

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const outDir = dirname(file)
  let failed = 0
  const report = (tag, problems, info) => {
    if (problems.length) { failed++; console.log(`✗ ${tag}: ${info}`); for (const p of problems) console.log(`    - ${p}`) }
    else console.log(`✓ ${tag}: ${info}`)
  }

  const u = unit()
  report('time zones and schedule rules', u.problems, `${u.cases} conversions across the March 2027 clock changes, ${u.broken} deliberate faults in fixtures/broken.json all caught`)
  const cal = calendars(outDir)
  report('calendar files', cal.problems, `${cal.files} files, ${cal.events} events parsed back, all in UTC and matching the page`)

  for (const [w, h, reduce] of RUNS) {
    const problems = []
    let info = ''
    let P
    try {
      P = await openPage(file, { size: `${w}x${h}`, clock: 'preview', reduce, record: false })
      const { tab, ev, errors } = P
      const days = await ev(`[...document.querySelectorAll('.ev-dt')].map((t) => t.dataset.day)`)
      const sw = await ev(`[...document.querySelectorAll('.ev-swb')].map((t) => t.dataset.sel)`)
      let last
      for (const d of days) {
        await ev(`document.querySelector('.ev-dt[data-day="${d}"]').click()`)
        const views = w < 760 ? sw : [null]
        for (const s of views) {
          if (s) await ev(`document.querySelector('.ev-swb[data-sel="${s}"]').click()`)
          await new Promise((r) => setTimeout(r, 80))
          const r = await ev(AUDIT)
          problems.push(...r.problems.map((p) => `${d}${s ? '/' + s : ''}: ${p}`))
          last = r
        }
      }
      await ev(`document.querySelector('.ev-dt').click()`)
      if (w < 760) { await ev(`document.querySelector('.ev-swb').click()`); const r = await switcher(tab, ev); problems.push(...r.problems) }
      problems.push(...(await dayTabs(tab, ev)))
      problems.push(...(await focusRings(tab, ev)))
      if (errors.length) problems.push(`script errors: ${errors.join(' | ')}`)
      const seenMsg = new Set()
      const dedup = problems.filter((p) => { const k = p.replace(/^[a-z0-9-]+(\/[^:]+)?: /, ''); if (seenMsg.has(k)) return false; seenMsg.add(k); return true })
      problems.length = 0; problems.push(...dedup)
      info = `${last.pairs} text pairs, lowest contrast ${last.worst}× its minimum, smallest copy ${last.smallest}px, smallest label ${last.smallestLabel}px, ${last.placed} sessions placed to the minute, ${last.bars} glance bars matched, ${days.length} days${w < 760 ? ` × ${sw.length} switcher tabs` : ''}`
    } catch (e) {
      problems.push(e.message)
    } finally {
      if (P) await P.close()
    }
    report(`${w}x${h}${reduce ? ' reduced motion' : ''}`, problems, info)
  }

  // visitor times against Node's Intl: this page, and the DST fixture
  const tmp = mkdtempSync(join(tmpdir(), 'event-page-kit-check-'))
  try {
    const fx = JSON.parse(readFileSync(join(here, 'fixtures', 'dst.json'), 'utf8'))
    const v = validate(fx)
    if (v.problems.length) throw new Error(`fixtures/dst.json: ${v.problems.join('; ')}`)
    const r = build(fx, v, { css: readFileSync(join(KIT, 'event.css'), 'utf8'), js: readFileSync(join(KIT, 'runtime.js'), 'utf8') })
    mkdirSync(join(tmp, 'dst'), { recursive: true })
    writeFileSync(join(tmp, 'dst', 'index.html'), r.page)
    for (const [page, zone, expect] of [[join(tmp, 'dst', 'index.html'), fx.expect.zone, fx.expect.times], [file, 'America/New_York', null], [file, 'Asia/Tokyo', null]]) {
      const problems = []
      const P = await openPage(page, { size: '1440x900', clock: 'preview', zone, record: false })
      try {
        await P.ev(`document.querySelector('.ev-tz [data-tz="mine"]') && document.querySelector('.ev-tz [data-tz="mine"]').click()`)
        const got = await P.ev(`(() => ({ differs: window.EventKit.differs, rows: [...document.querySelectorAll('.ev-s')].map((s) => ({ code: s.dataset.code, u0: +s.dataset.u0, u1: +s.dataset.u1, text: s.querySelector('.ev-tm').textContent, shown: getComputedStyle(s.querySelector('.ev-tm')).display !== 'none' })) }))()`)
        const online = await P.ev(`!!document.querySelector('.ev-online')`)
        if (online && !got.differs) problems.push(`${zone} differs from the venue, but the page does not offer the visitor's time`)
        if (got.differs) for (const s of got.rows) {
          const a = wall(zone, s.u0), b = wall(zone, s.u1)
          const hm = (x) => String(Math.floor(x.min / 60)).padStart(2, '0') + ':' + String(x.min % 60).padStart(2, '0')
          const want = `${hm(a)}–${hm(b)}`
          if (!s.text.startsWith(want)) problems.push(`${s.code}: the page says ${s.text} in ${zone}, Intl says ${want}`)
          if (expect?.[s.code] && !s.text.startsWith(expect[s.code])) problems.push(`${s.code}: expected ${expect[s.code]} in ${zone}, the page says ${s.text}`)
          if (!s.shown) problems.push(`${s.code}: with "Mine" chosen the visitor's time is not shown`)
        }
        report(`visitor times, ${page === file ? 'this page' : 'fixtures/dst.json'} from ${zone}`, problems, got.differs ? `${got.rows.length} sessions match Intl${expect ? ', across the US clock change on 14 March 2027' : ''}` : 'the visitor column stays off (no online sessions, or the same clock)')
      } finally { await P.close() }
    }
  } catch (e) {
    report('visitor times', [e.message], '')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  // before, during, after; the real clock; print
  {
    const problems = []
    const seenStates = []
    for (const clock of ['before', 'preview', 'after']) {
      const P = await openPage(file, { size: '1440x900', clock, record: false })
      try {
        const r = await P.ev(`(() => ({ phase: window.EventKit.phase(), lines: [...document.querySelectorAll('.ev-now')].filter((x) => !x.hidden).length, nb: document.querySelector('.ev-nb').textContent, onSale: document.querySelectorAll('.ev-tr:not(.ev-ended)').length, tickets: document.querySelectorAll('.ev-tr').length, past: document.querySelectorAll('.ev-s.ev-past').length, all: document.querySelectorAll('.ev-s').length }))()`)
        seenStates.push(r.phase)
        const want = { before: 'before', preview: 'during', after: 'after' }[clock]
        if (r.phase !== want) problems.push(`at the ${clock} clock the page says ${r.phase}`)
        if (clock !== 'preview' && r.lines) problems.push(`at the ${clock} clock a now line shows`)
        if (clock === 'preview' && r.lines !== 1) problems.push(`during the event ${r.lines} now lines show`)
        if (clock === 'before' && !/Starts in/.test(r.nb)) problems.push('before the event the now / next row does not count down')
        if (clock === 'after' && (r.onSale || r.past !== r.all || !/Ended/.test(r.nb))) problems.push('after the event something is still on sale, not past, or not marked ended')
        if (clock === 'preview' && !r.onSale) problems.push('at the preview clock nothing is on sale')
      } finally { await P.close() }
    }
    const P = await openPage(file, { size: '1440x900', record: false })
    try {
      const r = await P.ev(`({ t: window.EventKit.clock(), now: Date.now() })`)
      if (Math.abs(r.t - r.now) > 5000) problems.push('without a preview clock the page does not use the real clock')
      await P.tab.send('Emulation.setEmulatedMedia', { media: 'print' })
      const pages = await printPages(P.chrome, P.ev, P.tab)
      const days = await P.ev(`document.querySelectorAll('.ev-day').length`)
      if (pages !== days) problems.push(`print makes ${pages} pages for ${days} days`)
      report('states, live clock and print', problems, `${seenStates.join(', ')}; live clock in use without ?ev-clock; print is ${pages} A4 pages for ${days} days`)
    } finally { await P.close() }
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
