// Booking Slots: builds booking.json into
//   out/index.html           the section on a plain page (to look at, check and record)
//   out/booking-embed.html   the section alone, to paste into a page
//
//   node scripts/build.mjs booking.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DAYS, VOICES, contrast, lum, mix, parseHours, rgb, soften, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** A colour toward `toward` from `c` until it holds `need`:1 on every background. */
function hold(c, bgs, need, toward) {
  for (let t = 0; t <= 1; t += 0.02) { const m = mix(c, toward, t); if (bgs.every((b) => contrast(m, b) >= need)) return m }
  return toward
}

export function tokens(c) {
  const t = c.theme
  const v = VOICES[t.voice ?? 'serif']
  const dark = lum(t.page) < 0.2
  const field = dark ? mix(t.page, '#000000', 0.2) : mix(t.surface, '#ffffff', 0.5)
  const bgs = [t.page, t.surface, field]
  let mute = soften(t.ink, t.surface, 5.2)
  for (const bg of bgs) if (contrast(mute, bg) < 5) mute = soften(t.ink, bg, 5.2)
  const worst = (n) => { let m = soften(t.ink, t.surface, n); for (const bg of bgs) if (contrast(m, bg) < n) m = soften(t.ink, bg, n); return m }
  const x = {
    '--page': t.page, '--surface': t.surface, '--ink': t.ink, '--accent': t.accent, '--on-accent': t.onAccent, '--hold': t.hold,
    '--mute': mute,
    '--accent-ink': hold(t.accent, [t.page, t.surface], 4.5, t.ink),
    '--hold-ink': hold(t.hold, [t.page, t.surface], 4.5, t.ink),
    '--accent-soft': mix(t.page, t.accent, dark ? 0.2 : 0.14),
    // marks that carry meaning (field and slot borders, booked runs) hold 3:1
    '--edge': worst(3.2),
    '--taken': worst(3.05),
    '--past': mix(t.ink, t.page, dark ? 0.62 : 0.55),
    '--rule': `rgba(${rgb(t.ink)},${dark ? 0.14 : 0.16})`,
    '--rule2': `rgba(${rgb(t.ink)},${dark ? 0.3 : 0.3})`,
    '--notice': `rgba(${rgb(mute)},0.14)`,
    '--field': field,
    '--halo': `rgba(${rgb(t.ink)},0.14)`,
    '--error': hold(dark ? '#ff8f75' : '#a3271a', [t.surface, field], 4.5, t.ink),
    '--shadow': dark ? 'none' : `6px 6px 0 rgba(${rgb(t.ink)},.08)`,
    '--display': v.family, '--display-w': v.weight, '--display-track': v.track, '--em-style': v.emStyle, '--caps': v.caps,
    '--text': v.text, '--mono': v.mono,
    '--radius': (t.corners ?? 'soft') === 'square' ? '0px' : '3px',
  }
  return Object.entries(x).map(([k, val]) => `${k}:${val}`).join(';')
}
export const fontsHref = (c) => `https://fonts.googleapis.com/css2?${VOICES[c.theme.voice ?? 'serif'].google.join('&')}&display=swap`

function hoursText(week) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const groups = []
  for (const d of order) {
    const s = week[d].map(([a, b]) => `${hm(a)} to ${hm(b)}`).join(', ')
    const last = groups.at(-1)
    if (last && last.s === s && order.indexOf(d) === order.indexOf(last.to) + 1) last.to = d
    else groups.push({ from: d, to: d, s })
  }
  const cap = (d) => DAYS[d][0].toUpperCase() + DAYS[d].slice(1)
  return groups.filter((g) => g.s).map((g) => `${cap(g.from)}${g.to !== g.from ? ` to ${cap(g.to)}` : ''} ${g.s}`).join('; ')
}

export function money(c, v) {
  if (v.priceText) return v.priceText
  if (v.price === null || v.price === undefined) return ''
  const m = c.money ?? {}
  return new Intl.NumberFormat(m.locale ?? 'en-GB', { style: 'currency', currency: m.currency ?? 'GBP', maximumFractionDigits: Number.isInteger(v.price) ? 0 : 2, minimumFractionDigits: Number.isInteger(v.price) ? 0 : 2 }).format(v.price)
}

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const notes = []
  const bad = (m) => problems.push(m)
  const hours = parseHours(c.hours, 'hours', bad)
  const people = (c.people ?? []).map((p) => ({ id: p.id, name: p.name, role: p.role, initials: p.initials ?? p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), shifts: parseHours(p.shifts, p.id, bad), away: p.away ?? [] }))
  // no people: one chair, open whenever the shop is
  const solo = !people.length
  if (solo) people.push({ id: 'shop', name: c.shop.name ?? c.brand, role: '', initials: '', shifts: hours, away: [] })
  const rules = { step: 30, notice: 120, horizon: 28, hold: 10, weekStart: 'mon', ...(c.rules ?? {}) }
  const services = c.services.map((v) => ({ id: v.id, name: v.name, desc: v.desc, minutes: v.minutes, buffer: v.buffer ?? 0, price: money(c, v), who: solo ? ['shop'] : v.who }))
  const labels = { service: 'Service', day: 'Day', time: 'Time', confirm: 'Confirm', ...(c.labels ?? {}), who: c.peopleLabel ?? 'Who' }
  const longest = Math.max(...services.map((s) => s.minutes))
  const first = services[0]
  const svcRows = services.map((s, i) => `<button type="button" class="bk-sv" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-svc="${s.id}"><span class="bk-sv-nm">${esc(s.name)}</span><span class="bk-sv-pr">${esc(s.price)}</span><span class="bk-sv-ds">${esc(s.desc)}</span><span class="bk-sv-len" aria-hidden="true"><span class="bk-sv-bar" style="width:${Math.round((s.minutes / longest) * 150)}px"></span><span class="bk-lbl">${s.minutes} min</span></span><span class="bk-sr">, ${s.minutes} minutes</span></button>`).join('')
  const pplRows = solo ? '' : [{ id: 'any', name: c.anyLabel ?? 'Anyone free', role: '', initials: '∗' }, ...people].map((p, i) => `<button type="button" class="bk-pp" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-who="${p.id}"><span class="bk-ini" aria-hidden="true">${esc(p.initials)}</span><span class="bk-pn">${esc(p.name)}${p.role ? ` <small>· ${esc(p.role)}</small>` : ''}</span><span class="bk-nx" data-next>&nbsp;</span></button>`).join('')
  const open = hoursText(hours)
  const endpoint = c.endpoint ?? null
  const mode = endpoint ? (endpoint.hold ? 'hold' : 'direct') : 'request'
  const card = c.card
  const data = {
    brand: c.brand, lang: c.lang ?? 'en', locale: c.money?.locale ?? 'en-GB', shop: { name: c.shop.name ?? c.brand, address: c.shop.address, where: c.shop.where, city: c.shop.city, tz: c.shop.tz, phone: c.shop.phone ?? null },
    hours, closed: (c.closed ?? []).map((x) => ({ from: x.from, to: x.to ?? x.from, label: x.label })),
    people, solo, services, rules, bookings: c.bookings ?? [], bookingsUrl: c.bookingsUrl ?? null,
    endpoint: endpoint ? { url: endpoint.url, adapter: endpoint.adapter ?? 'json', hold: endpoint.hold ?? null } : null, mode,
    email: c.email, card, cancelList: !!c.cancelList, labels, preview: c.preview ?? {},
  }
  const dataAttr = JSON.stringify(data).replace(/&/g, '&amp;').replace(/'/g, '&#39;')
  const sv = (s) => `mailto:${c.email}?subject=${encodeURIComponent(`Booking request: ${s.name}`)}&body=${encodeURIComponent(`I would like to book: ${s.name} (${s.minutes} min).\nDays and times that suit me:\nName:\nPhone or email:\n`)}`
  const noscript = `<noscript><div class="bk-nojs"><p class="bk-fine">Times need JavaScript to show. Ask for a time by email instead; we answer with what is free. Open ${esc(open)}.</p><ul>${services.map((s) => `<li><a href="${esc(sv(s))}">Request a ${esc(s.name.toLowerCase())}</a> · ${s.minutes} min · ${esc(s.price)}</li>`).join('')}</ul></div></noscript>`
  const section = `<section class="bk" id="booking" aria-labelledby="bk-h" data-voice="${c.theme.voice ?? 'serif'}" data-corners="${c.theme.corners ?? 'soft'}" style="${tokens(c)}" data-bk='${dataAttr}'>
<div class="bk-wrap">
<header class="bk-head"><div><p class="bk-eyebrow"><i aria-hidden="true"></i><span class="bk-lbl">${esc(c.eyebrow)}</span></p><h2 id="bk-h" class="bk-h">${turn(c.headline)}</h2></div>
<div class="bk-shop"><div class="bk-row bk-addr"><span><b>${esc(c.shop.name ?? c.brand)}</b><br>${esc(c.shop.address)}</span></div><div class="bk-row bk-open"><span>Open today</span><span class="bk-num" data-open>${esc(open)}</span></div><div class="bk-row"><span class="bk-tz" data-tz>Times in ${esc(c.shop.city)} time</span></div></div></header>
<div class="bk-body">
<div class="bk-col bk-c1">
<div class="bk-sum" data-sum><button type="button" data-unfold aria-expanded="false"><span class="bk-n" aria-hidden="true">1</span><span><b data-sum-a>${esc(first.name)}</b><small data-sum-b>${first.minutes} min · ${esc(first.price)}</small></span><em>Change</em></button></div>
<div class="bk-block"><h3 class="bk-step" id="bk-s1"><span class="bk-n" aria-hidden="true">1</span>${esc(labels.service)}</h3><div class="bk-svc" role="radiogroup" aria-labelledby="bk-s1" data-svcs>${svcRows}</div></div>
${solo ? '' : `<div class="bk-block"><h3 class="bk-step" id="bk-s2"><span class="bk-n" aria-hidden="true">2</span>${esc(labels.who)}<span class="bk-opt">optional</span></h3><div class="bk-ppl" role="radiogroup" aria-labelledby="bk-s2" data-ppl>${pplRows}</div></div>`}
</div>
<div class="bk-col bk-c2">
<div class="bk-block"><h3 class="bk-step" id="bk-s3"><span class="bk-n" aria-hidden="true">${solo ? 2 : 3}</span>${esc(labels.day)}<span class="bk-opt" data-day-note></span></h3>
<div class="bk-wk-top"><span class="bk-rng" data-range aria-live="polite"></span><span class="bk-wk-nav"><button type="button" data-wk="-1" aria-label="Earlier week">←</button><button type="button" data-wk="1" aria-label="Later week">→</button></span></div>
<div class="bk-week" role="radiogroup" aria-labelledby="bk-s3" data-week></div><div class="bk-legend" data-legend aria-hidden="true"></div></div>
<div class="bk-block"><h3 class="bk-step" id="bk-s4"><span class="bk-n" aria-hidden="true">${solo ? 3 : 4}</span>${esc(labels.time)}<span class="bk-opt">${rules.step}-min starts</span></h3><div data-time></div></div>
${noscript}
</div>
<div class="bk-col bk-c3"><div class="bk-c3-in"><h3 class="bk-step" id="bk-s5"><span class="bk-n" aria-hidden="true">${solo ? 4 : 5}</span>${esc(labels.confirm)}</h3>
<form class="bk-card" data-card action="${esc(endpoint ? endpoint.url : `mailto:${c.email}`)}" method="post" novalidate aria-labelledby="bk-card-h">
<div class="bk-card-top"><h4 id="bk-card-h" tabindex="-1">${esc(card.title)}</h4><span class="bk-lbl">${esc(c.shop.name ?? c.brand)}</span></div>
<div data-lines></div><div data-hold></div>
<div class="bk-form" data-form>
<div class="bk-fld"><label for="bk-name">Name</label><input id="bk-name" name="name" autocomplete="name" aria-describedby="bk-name-e"><span class="bk-err" id="bk-name-e" data-err="name" hidden></span></div>
<div class="bk-fld"><label for="bk-contact">Mobile or email <span>for the reminder</span></label><input id="bk-contact" name="contact" autocomplete="email" inputmode="email" aria-describedby="bk-contact-e"><span class="bk-err" id="bk-contact-e" data-err="contact" hidden></span></div>
<div class="bk-fld"><label for="bk-note">Anything we should know <span>optional</span></label><input id="bk-note" name="note" autocomplete="off"></div>
<button type="submit" class="bk-cta" data-cta aria-disabled="true"><span data-cta-t>${esc(mode === 'request' ? 'Request this time' : card.cta)}</span><span aria-hidden="true">→</span><span class="bk-bar-run" aria-hidden="true"></span></button>
<p class="bk-fine" data-fine>${esc(card.policy)}</p>
</div>
<div class="bk-done" data-done hidden></div>
<p class="bk-live" aria-live="polite" data-live></p>
</form></div></div>
</div>
</div>
<div class="bk-bar" data-bar hidden><span><b data-bar-a></b><small data-bar-b></small></span><button type="button" class="bk-cta" data-bar-go><span>Continue</span><span aria-hidden="true">→</span></button></div>
</section>`
  const css = readFileSync(join(KIT, 'booking.css'), 'utf8')
  const js = readFileSync(join(KIT, 'engine.js'), 'utf8') + '\n' + readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- Booking Slots: paste this where the booking section goes. It brings its own fonts, styles and script; every class starts with bk-. -->
${fonts}
<style>${css}</style>
${section}
<script>${js}</script>
`
  const html = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
${fonts}
<style>*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:${c.theme.page};color:${c.theme.ink};overflow-x:hidden}</style>
<style>${css}</style>
</head>
<body>
<main>
${section}
</main>
<script>${js}</script>
</body>
</html>
`
  if (problems.length) return { problems }
  if (!c.preview?.pin && c.preview) notes.push('preview.pin is off: the built page runs on the real clock, so its week moves with the date')
  return { html, embed, notes }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs booking.json [out]')
    process.exit(1)
  }
  let c
  try {
    c = JSON.parse(readFileSync(input, 'utf8'))
  } catch (e) {
    console.error(`${input}: ${e.message}`)
    process.exit(1)
  }
  const r = build(c)
  if (r.problems) {
    console.error(`${input}: ${r.problems.length} problem${r.problems.length > 1 ? 's' : ''}, nothing written:`)
    for (const p of r.problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), r.html)
  writeFileSync(join(outDir, 'booking-embed.html'), r.embed)
  for (const n of r.notes) console.log(`note: ${n}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'booking-embed.html'))}`)
}
