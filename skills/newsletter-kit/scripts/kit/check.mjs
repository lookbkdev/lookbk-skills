// Newsletter Kit: serves the built page and opens it in headless Chrome at
// 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440,
// in the reader's time zone from the config (demo.readerTz). It fails on:
//   - script errors, links without an address
//   - sideways scrolling anywhere down the page, and layout shift (CLS > 0.01)
//   - text under 16 px on a phone or 14 px elsewhere (labels, the chart's
//     axis labels included: 12 px), measured at the size it renders
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box (except the inbox's one-line subjects, which
//     end in an ellipsis on purpose) or running off the screen
//   - the form: no visible label tied to the field, a field that isn't
//     type=email with autocomplete and inputmode email, no live status line
//   - the form's states moving anything: every state (empty, typing,
//     invalid, sending, confirm, already, done, error) must leave the form's
//     box and everything under it where it was, to the pixel
//   - typing not showing up on the sample email's "to:" line
//   - the form end to end against stand-in addresses on the local server:
//     an empty or broken address (invalid, focus kept), a 2xx (check your
//     inbox, with the confirmation landing in the inbox), 409 (already
//     subscribed), 422 (the list refused it), 500 (error, the address kept),
//     the field name and spam trap in what was posted, JSON for proxy
//   - the next issue's day and time not following the reader's time zone
//     (checked again from Los Angeles against the schedule, worked out here)
//   - a keyboard focus that can't be seen (Tab through the page)
//   - reduced motion that isn't the finished state (no running animations,
//     nothing offset or clipped)
//
//   node scripts/check.mjs out/index.html
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { fmt } from './dates.mjs'
import { openPage } from './record.mjs'
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
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const skip = (el) => el.closest('.nk-sr, .nk-hp, [aria-hidden="true"]:not(.nk-plotwrap):not(.nk-legend):not(.nk-cal)')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el) && !['SCRIPT', 'STYLE'].includes(el.tagName))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.getAttribute('href')) say('a link has no address: ' + name(a))
  let smallest = 99
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest('.nk-l') ? 12 : min
    smallest = Math.min(smallest, fs)
    if (fs < need - 0.01) say('text at ' + fs + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
    let bg = [255, 255, 255]
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    let op = 1
    for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity)
    if (op < 0.99) continue
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, ratio / need)
    if (ratio < need) say('contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of document.body.querySelectorAll('.nk *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('.nk-rowbox')) continue
    const s = getComputedStyle(el)
    if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  // the inbox rows must fit their fixed height (two rows show; the third arrives on confirm)
  for (const row of document.querySelectorAll('.nk-row')) if (shown(row)) for (const c of row.children) if (shown(c) && c.getBoundingClientRect().bottom > row.getBoundingClientRect().bottom + 1) say('an inbox row is taller than its slot: ' + name(row))
  const clipped = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.overflow !== 'visible' && n.getBoundingClientRect().right <= vw + 1 && n.getBoundingClientRect().left >= -1) return true } return false }
  for (const el of texts) { const r = el.getBoundingClientRect(); if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el)) }
  if (!document.querySelector('meta[name=viewport][content*="viewport-fit=cover"]')) say('the viewport meta lacks viewport-fit=cover (safe areas)')
  for (const el of document.querySelectorAll('.nk *')) if (getComputedStyle(el).position === 'fixed') say('a fixed element would sit under a notch or home bar: ' + name(el))
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100, smallest }
})()`

const FORM = `(() => {
  const out = []
  const input = document.querySelector('#nk-email')
  const label = document.querySelector('label[for="nk-email"]')
  if (!label || !label.textContent.trim() || getComputedStyle(label).display === 'none' || label.getBoundingClientRect().height === 0) out.push('the email field has no visible label tied to it')
  if (input.type !== 'email') out.push('the field is not type=email')
  if (input.getAttribute('autocomplete') !== 'email') out.push('the field lacks autocomplete=email')
  if (input.getAttribute('inputmode') !== 'email') out.push('the field lacks inputmode=email')
  const msg = document.querySelector('#nk-msg')
  if (!msg || msg.getAttribute('aria-live') !== 'polite') out.push('the status line is not aria-live')
  if (!(input.getAttribute('aria-describedby') || '').includes('nk-msg')) out.push('the field is not described by its status line')
  if (!document.querySelector('.nk-form button[type=submit]')) out.push('no submit button')
  // every state leaves the form's box and everything after it in place
  const box = () => { const z = document.querySelector('.nk-zone').getBoundingClientRect(); const n = document.querySelector('.nk-privacy').getBoundingClientRect(); return [Math.round(z.top + scrollY), Math.round(z.height), Math.round(n.top + scrollY), document.documentElement.scrollHeight] }
  const K = window.NewsletterKit
  const base = (K.state('empty', ''), box())
  const states = [['typing', 'ana@weiss'], ['invalid', 'ana@weiss'], ['sending', 'ana@weiss.example'], ['confirm', 'ana@weiss.example'], ['already', 'ana@weiss.example'], ['done', 'ana@weiss.example'], ['error', 'ana@weiss.example']]
  for (const [s, v] of states) {
    K.state(s, v)
    const b = box()
    if (b.some((x, i) => Math.abs(x - base[i]) > 1)) out.push('the ' + s + ' state moves the layout (form box top/height, next block, page height: ' + base.join('/') + ' -> ' + b.join('/') + ')')
    const shownPanel = s === 'confirm' ? '.nk-confirm' : s === 'already' ? '.nk-already' : s === 'done' ? '.nk-subd' : null
    if (shownPanel && getComputedStyle(document.querySelector(shownPanel)).visibility !== 'visible') out.push('the ' + s + ' panel does not show')
    if ((s === 'invalid' || s === 'error') && !document.querySelector('#nk-msg').textContent.trim()) out.push('the ' + s + ' state has no message')
  }
  K.state('empty', '')
  return out
})()`

const FLOWS = (base) => `(async () => {
  const out = []
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const K = window.NewsletterKit, D = K.data
  const form = document.querySelector('.nk-form'), input = document.querySelector('#nk-email'), btn = form.querySelector('button[type=submit]')
  const root = document.querySelector('.nk[data-nk]')
  const st = () => root.getAttribute('data-state')
  const action0 = form.getAttribute('action'), mode0 = D.form.mode
  const go = async (value, ms = 700) => { K.state('empty', ''); input.value = value; input.dispatchEvent(new Event('input')); btn.click(); await wait(ms) }
  await go('', 100)
  if (st() !== 'invalid' || input.getAttribute('aria-invalid') !== 'true' || document.activeElement !== input) out.push('an empty address does not give the invalid state with focus kept in the field')
  await go('ana@weiss', 100)
  if (st() !== 'invalid' || !/dot/.test(document.querySelector('#nk-msg').textContent)) out.push('an address without its ending does not say what is missing')
  for (const mode of ['fetch', 'json']) {
    D.form.mode = mode
    form.setAttribute('action', '${base}__nk/ok')
    await go('ana@weiss.example')
    if (st() !== 'confirm') out.push(mode + ': a 2xx does not reach "check your inbox" (' + st() + ')')
    if (getComputedStyle(document.querySelector('.nk-confirmrow')).display === 'none') out.push(mode + ': the confirmation email does not land in the sample inbox')
    if (!document.activeElement || !document.activeElement.classList.contains('nk-confirm')) out.push(mode + ': focus does not move to the "check your inbox" panel')
    const last = await (await fetch('${base}__nk/last')).json()
    if (mode === 'fetch' && (!last.body.includes(encodeURIComponent(D.form.field) + '=ana%40weiss.example') || !last.body.includes(D.form.honeypot + '='))) out.push('fetch: the post lacks the email field "' + D.form.field + '" or the spam trap: ' + last.body)
    if (mode === 'json' && (!last.type.includes('application/json') || JSON.parse(last.body)[D.form.field] !== 'ana@weiss.example')) out.push('json: the post is not JSON with the email field')
  }
  D.form.mode = 'fetch'
  form.setAttribute('action', '${base}__nk/already'); await go('ana@weiss.example')
  if (st() !== 'already') out.push('a 409 does not give "already subscribed" (' + st() + ')')
  form.setAttribute('action', '${base}__nk/invalid'); await go('ana@weiss.example')
  if (st() !== 'invalid') out.push('a 422 does not give the invalid state (' + st() + ')')
  form.setAttribute('action', '${base}__nk/fail'); await go('ana@weiss.example')
  if (st() !== 'error' || input.value !== 'ana@weiss.example') out.push('a 500 does not give the error state with the address kept (' + st() + ')')
  if (/subscribed|confirm/i.test(document.querySelector('#nk-msg').textContent) && !/not subscribed/.test(document.querySelector('#nk-msg').textContent)) out.push('the error message claims success')
  form.setAttribute('action', '${base}__nk/subscribed'); await go('ana@weiss.example')
  if (st() !== 'done') out.push('a {"state":"subscribed"} reply does not give the subscribed state (' + st() + ')')
  form.setAttribute('action', action0); D.form.mode = mode0
  K.state('empty', '')
  return out
})()`

async function typeMirror(tab, ev) {
  await ev(`window.NewsletterKit.state('empty', ''); document.querySelector('#nk-email').focus({ preventScroll: true })`)
  await tab.send('Input.insertText', { text: 'ana@we' })
  const r = await ev(`({ to: document.querySelector('[data-nk="to"]').textContent, state: document.querySelector('.nk[data-nk]').getAttribute('data-state') })`)
  await ev(`window.NewsletterKit.state('empty', '')`)
  const out = []
  if (r.to !== 'ana@we') out.push(`typing does not show on the sample email's "to:" line (it says "${r.to}")`)
  if (r.state !== 'typing') out.push(`typing does not give the typing state (${r.state})`)
  return out
}

async function focusRings(tab, ev) {
  const problems = []
  const count = await ev(`[...document.querySelectorAll('a[href], button, input:not([tabindex="-1"]):not([type=hidden])')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length`)
  await ev('document.activeElement && document.activeElement.blur(); scrollTo(0, 0)')
  const seen = new Set()
  for (let i = 0; i < Math.min(count + 2, 60); i++) {
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    const r = await ev(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const f = el.closest('.nk-field')
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (el.matches('input') && f && getComputedStyle(f).boxShadow !== 'none')
      return { ring, visible: el.matches(':focus-visible'), hp: !!el.closest('.nk-hp'), name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) }
    })()`)
    if (!r) continue
    if (r.hp) problems.push('the spam trap can be reached with Tab')
    if (!r.ring || !r.visible) { const m = `keyboard focus can't be seen on "${r.name}"`; if (!seen.has(m)) problems.push(m), seen.add(m) }
  }
  return problems
}

/** The next issue's day and time, worked out here from the schedule, must match what the page shows in `tz`. */
async function zoneCheck(ev, tz) {
  const r = await ev(`(() => { const D = window.NewsletterKit.data; const now = Date.now(); const after = Math.max(now, D.latest.at); const n = D.upcoming.find((u) => u.at > after); return { n, tz: D.tz, readerTz: window.NewsletterKit.readerTz, day: document.querySelector('[data-nk="next-day"]')?.textContent, yours: document.querySelector('[data-nk="yours"]')?.textContent, sent: document.querySelector('.nk-when time')?.textContent, latest: D.latest.at } })()`)
  const out = []
  if (r.readerTz !== tz) out.push(`the page runs in ${r.readerTz}, not ${tz}`)
  const day = fmt(r.n.at, tz, 'day')
  if (r.day !== day) out.push(`in ${tz} the next issue should read "${day}", the page says "${r.day}"`)
  const mine = fmt(r.n.at, tz, 'wdtime'), theirs = fmt(r.n.at, r.tz, 'wdtime')
  if (mine !== theirs && !(r.yours ?? '').includes(mine)) out.push(`in ${tz} the cadence should add "${mine} your time", it says "${r.yours}"`)
  if (mine === theirs && (r.yours ?? '').trim()) out.push(`in the sender's own zone the cadence should not add "your time" ("${r.yours}")`)
  const sent = fmt(r.latest, tz, 'daytime')
  if (r.sent !== sent) out.push(`in ${tz} the issue's send time should read "${sent}", the page says "${r.sent}"`)
  return { out, info: `${tz}: next ${r.day}${r.yours ? ' ' + r.yours : ''}` }
}

const STILL = `(async () => {
  const out = []
  const n = document.getAnimations().length
  if (n) out.push(n + ' animations run with reduced motion')
  for (const el of document.querySelectorAll('.nk-client, .nk-sel, .nk-open, .nk-cal li, .nk-draw, .nk-pt, .nk-cl')) {
    const s = getComputedStyle(el)
    const moved = !el.matches('.nk-pt, .nk-cl') && s.transform !== 'none' && s.transform !== 'matrix(1, 0, 0, 1, 0, 0)'
    if (parseFloat(s.opacity) < 1 || moved || el.style.clipPath) { out.push('with reduced motion part of the inbox is not in its finished state: ' + el.className); break }
  }
  window.NewsletterKit.state('confirm', 'ana@weiss.example')
  if (document.querySelector('.nk-rows').style.transform) out.push('with reduced motion the confirmation row still slides')
  window.NewsletterKit.state('empty', '')
  return out
})()`

export async function check(input) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const server = await serve(dirname(file))
  const chrome = await launch({ width: 1440, height: 900 })
  let failed = 0
  try {
    for (const [w, h, reduce] of RUNS) {
      const errors = []
      chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
      const { tab, ev } = await openPage(chrome, server, file, { w, h, reduce, query: '' })
      await ev(`window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })`)
      const problems = []
      const height = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y <= height; y += Math.round(h * 0.5)) {
        await ev(`scrollTo(0, ${y}); new Promise((r) => setTimeout(r, 80))`)
        if (await ev('document.documentElement.scrollWidth > innerWidth + 1')) {
          if (!problems.some((p) => p.startsWith('the page scrolls sideways'))) problems.push(`the page scrolls sideways (at ${y}px down: ${await ev('document.documentElement.scrollWidth')} > ${w})`)
        }
      }
      await ev(`document.querySelector('.nk-client').scrollIntoView({ block: 'center' }); new Promise((r) => setTimeout(r, 2200))`)
      const cls = await ev('window.__cls')
      if (cls > 0.01) problems.push(`layout shift ${cls.toFixed(3)} (over 0.01)`)
      const audit = await ev(AUDIT)
      problems.push(...audit.problems)
      problems.push(...(await ev(FORM)))
      problems.push(...(await typeMirror(tab, ev)))
      if (reduce) problems.push(...(await ev(STILL)))
      let zinfo = ''
      if (!reduce && (w === 1440 || w === 390)) {
        problems.push(...(await ev(FLOWS(server.url))))
        problems.push(...(await focusRings(tab, ev)))
      }
      if (w === 1440 && !reduce) {
        const own = await ev('window.NewsletterKit.readerTz')
        const z1 = await zoneCheck(ev, own)
        await tab.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' })
        await ev('location.reload()').catch(() => {})
        await new Promise((r) => setTimeout(r, 400))
        for (let i = 0; i < 50 && !(await ev('!!window.NewsletterKit').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 100))
        await ev('window.NewsletterKit.ready')
        const z2 = await zoneCheck(ev, 'America/Los_Angeles')
        problems.push(...z1.out, ...z2.out)
        zinfo = `; ${z1.info}; ${z2.info}`
      }
      problems.push(...errors.map((e) => `script error: ${e}`))
      const label = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const info = `${audit.pairs} text/background pairs (lowest ${audit.worst}x the minimum), smallest text ${audit.smallest}px, CLS ${cls.toFixed(3)}${reduce ? ', finished state' : ''}${zinfo}`
      if (problems.length) {
        failed += problems.length
        console.log(`FAIL ${label}: ${info}`)
        for (const p of problems) console.log(`       ${p}`)
      } else console.log(`ok   ${label}: ${info}`)
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
