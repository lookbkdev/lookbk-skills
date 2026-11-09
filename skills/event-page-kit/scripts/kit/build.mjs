// Event Page Kit: builds event.json into
//   out/index.html         the event page, with a demo nav (to look at, check and record)
//   out/event-embed.html   the page's sections alone, to paste into an existing site
//   out/ics/<code>.ics     one calendar file per session
//   out/programme.ics      every session in one calendar file
//
//   node scripts/build.mjs event.json out
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { write as writeIcs } from './ics.mjs'
import { TITLES, TYPES, contrast, mix, soften, validate } from './schema.mjs'
import { cityOf, hm, toUtc } from './tz.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const two = (n) => String(n).padStart(2, '0')
const r3 = (x) => Math.round(x * 1000) / 1000
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ---------- dates in words ---------- */
function dateParts(date, lang) {
  const [y, m, d] = date.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d, 12)
  const f = (o) => new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...o }).format(t)
  return { y, m, d, wdLong: f({ weekday: 'long' }), wd: f({ weekday: 'short' }), month: f({ month: 'long' }), mon: f({ month: 'short' }) }
}
/** "Thu 11 and Fri 12 March 2027" */
function spanWords(days, lang) {
  const p = days.map((d) => dateParts(d.date, lang))
  const one = (x, month) => `${x.wd} ${x.d}${month ? ' ' + x.month : ''}`
  const sameMonth = p.every((x) => x.m === p[0].m && x.y === p[0].y)
  if (p.length === 1) return `${one(p[0], true)} ${p[0].y}`
  const joinWord = p.length === 2 ? ' and ' : ' to '
  const a = p[0], b = p.at(-1)
  return sameMonth ? `${one(a)}${joinWord}${one(b, true)} ${b.y}` : `${one(a, true)}${joinWord}${one(b, true)} ${b.y}`
}
/** The zone's short name at an instant in the page's language ("GMT", "BST"). */
function zoneShort(zone, ms, lang) {
  const p = new Intl.DateTimeFormat(lang, { timeZone: zone, timeZoneName: 'short' }).formatToParts(ms)
  return p.find((x) => x.type === 'timeZoneName')?.value ?? ''
}
function stampWords(ms, zone, lang) {
  const f = (o) => new Intl.DateTimeFormat(lang, { timeZone: zone, ...o }).format(ms)
  return `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}, ${f({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} ${zoneShort(zone, ms, lang)}`
}

/* ---------- tokens ---------- */
export function tokens(c) {
  const t = c.theme
  const ty = TYPES[t.type ?? 'grotesk']
  const dark = contrast(t.bg, '#000000') < contrast(t.bg, '#ffffff')
  const v = {
    '--bg': t.bg, '--surface': t.surface, '--past': t.past, '--ink': t.ink, '--accent': t.accent, '--on-accent': t.onAccent,
    '--mute': soften(t.ink, t.bg, 5.2, [t.bg, t.surface, t.past]),
    '--rule': mix(t.bg, t.ink, dark ? 0.2 : 0.2), '--rule-soft': mix(t.bg, t.ink, dark ? 0.11 : 0.1), '--box': mix(t.surface, t.ink, dark ? 0.2 : 0.75),
    '--display': ty.display, '--text': ty.text, '--mono': ty.mono, '--ppm': `${c.ppm ?? 2.6}px`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

/* ---------- the model ---------- */
function model(c) {
  const lang = c.lang ?? 'en'
  const zone = c.venue.zone
  const rooms = c.rooms, tracks = c.tracks
  const days = c.days.map((d, i) => {
    const ss = c.sessions.filter((s) => s._dayIx === i)
    const bs = (c.breaks ?? []).filter((b) => b._dayIx === i)
    const all = [...ss, ...bs]
    const gs = Math.floor(Math.min(...all.map((x) => x._s)) / 60) * 60
    const ge = Math.ceil(Math.max(...all.map((x) => x._e)) / 30) * 30
    const p = dateParts(d.date, lang)
    return { ...d, i, sessions: ss.sort((a, b) => a._s - b._s || a._room - b._room), breaks: bs, gs, ge, label: d.label ?? p.wdLong, short: p.wd, dateWords: `${p.d} ${p.month}`, p,
      gsUtc: toUtc(d.date, gs, zone) }
  })
  const people = Object.fromEntries((c.people ?? []).map((p) => [p.id, p]))
  return { lang, zone, rooms, tracks, days, people }
}

/* ---------- pieces ---------- */
const mClass = (tr) => `ev-m-${tr.mark}${tr.accent ? ' ev-m-acc' : ''}`
const markClass = (tr) => `ev-mk ${mClass(tr)}`

function glance(c, M) {
  const A0 = Math.min(...M.days.map((d) => d.gs)), A1 = Math.max(...M.days.map((d) => d.ge))
  const pct = (m) => r3(((m - A0) / (A1 - A0)) * 100)
  const step = A1 - A0 > 600 ? 180 : 120
  const ticks = []
  for (let t = Math.ceil(A0 / 60) * 60; t <= A1; t += step) ticks.push(t)
  const major = new Set([ticks[0], ticks[Math.floor((ticks.length - 1) / 2)], ticks.at(-1)])
  const n = c.sessions.length
  const rows = M.days.map((d) => `<div class="ev-gl-day" data-day="${esc(d.id)}"><span class="ev-gl-d">${esc(d.short)}</span><div class="ev-gl-rows" data-a0="${A0}" data-a1="${A1}">${M.rooms.map((r) => `<div class="ev-gl-t"><span class="ev-gl-r">${esc(r.id)}</span>${d.sessions.filter((s) => s.room === r.id).map((s) => `<i class="ev-gb" data-code="${esc(s.code)}" data-day="${esc(d.id)}" data-room="${esc(r.id)}" data-s="${s._s}" data-e="${s._e}" data-u0="${s._u0}" data-u1="${s._u1}" style="left:${pct(s._s)}%;width:${r3(pct(s._e) - pct(s._s))}%"></i>`).join('')}</div>`).join('')}<i class="ev-gl-now" hidden></i></div></div>`).join('')
  const axis = ticks.map((t) => `<span class="${major.has(t) ? 'ev-gl-m' : ''}" style="left:${pct(t)}%">${hm(t)}</span>`).join('')
  return `<div class="ev-gl" role="img" aria-label="The programme at a glance: ${M.days.length} day${M.days.length > 1 ? 's' : ''}, ${M.rooms.length} rooms, ${n} sessions">
<div class="ev-gl-h" aria-hidden="true"><span class="ev-lbl">At a glance</span><span class="ev-lbl ev-gl-k">${M.rooms.map((r) => `${esc(r.id)} ${esc(r.name)}`).join(' · ')}</span></div>
<div aria-hidden="true">${rows}<div class="ev-gl-ax">${axis}</div></div>
</div>`
}

function facts(c, M, span) {
  const first = M.days[0], last = M.days.at(-1)
  const lastEnd = Math.max(...last.sessions.map((s) => s._e))
  const when = `<div class="ev-fact"><p class="ev-lbl">When</p><p class="ev-fv">${esc(spanWords(c.days, M.lang))}</p><p class="ev-fn">Doors ${esc(first.opens)}, the last session ends ${M.days.length > 1 ? esc(last.short) + ' ' : ''}${hm(lastEnd)}</p></div>`
  const where = `<div class="ev-fact"><p class="ev-lbl">Where</p><p class="ev-fv">${esc(c.venue.short)}</p><p class="ev-fn">${esc(c.venue.note)}</p></div>`
  let third
  if (c.online) {
    const on = c.sessions.filter((s) => c.online.rooms.includes(s.room) && s._dayIx === 0)
    const a = Math.min(...on.map((s) => s._s)), b = Math.max(...on.map((s) => s._e))
    third = `<div class="ev-fact"><p class="ev-lbl">Online</p><p class="ev-fv">${esc(c.online.what)}</p><p class="ev-fn"><span class="ev-online" data-u0="${Math.min(...on.map((s) => s._u0))}" data-u1="${Math.max(...on.map((s) => s._u1))}">${hm(a)} to ${hm(b)} ${esc(c.venue.city)} time</span>${c.online.after ? `. ${esc(c.online.after)}` : ''}</p></div>`
  } else if (c.facts?.extra) {
    const x = c.facts.extra
    third = `<div class="ev-fact"><p class="ev-lbl">${esc(x.label)}</p><p class="ev-fv">${esc(x.value)}</p>${x.note ? `<p class="ev-fn">${esc(x.note)}</p>` : ''}</div>`
  } else third = `<div class="ev-fact"><p class="ev-lbl">Programme</p><p class="ev-fv">${c.sessions.length} sessions</p><p class="ev-fn">${M.rooms.length} rooms</p></div>`
  const tickets = `<div class="ev-fact ev-ftk"><p class="ev-lbl">Tickets</p><p class="ev-fv"><a href="#tickets">${esc(c.tickets.length)} kinds of ticket</a></p><p class="ev-fn ev-live" data-tickets></p></div>`
  return `<section class="ev-facts" aria-label="The essentials"><div class="ev-wrap ev-fg">${when}${where}${third}${tickets}</div></section>`
}

function names(c, M, s) {
  return (s.people ?? []).map((id) => M.people[id].name).join(', ')
}

function session(c, M, d, s) {
  const tr = M.tracks[s._track], room = M.rooms[s._room]
  const h = (s._e - s._s) * (c.ppm ?? 2.6) - 4
  const who = s.people?.length ? names(c, M, s) : s.meta
  const extra = [tr.name, ...(s.access ?? []), ...(s.status === 'full' ? ['Full, waitlist'] : []), ...(s.status === 'cancelled' ? ['Cancelled'] : [])]
  const label = `${s.code}, ${s.start} to ${s.end}, ${room.name}. ${s.title}.${who ? ' ' + who + '.' : ''}${s.status ? ' ' + (s.status === 'full' ? 'Full.' : 'Cancelled.') : ''}`
  return `<article class="ev-s ${mClass(tr)}${h < 76 ? ' ev-cmp' : ''}${s.status ? ' ev-' + s.status : ''}" id="s-${esc(slug(s.code))}" data-code="${esc(s.code)}" data-day="${esc(d.id)}" data-room="${esc(room.id)}" data-track="${esc(tr.id)}" data-s="${s._s}" data-e="${s._e}" data-u0="${s._u0}" data-u1="${s._u1}" style="--s:${s._s - d.gs};--d:${s._e - s._s};--c:${s._room};--l:${s._lane};--ls:${s._lanes}" aria-label="${esc(label)}">
<p class="ev-st"><span class="ev-code">${esc(s.code)}</span><span class="ev-tv">${esc(s.start)}–${esc(s.end)}</span><span class="ev-tm" data-u0="${s._u0}" data-u1="${s._u1}"></span><span class="ev-tag" hidden></span></p>
<h4 class="ev-ti" title="${esc(s.title)}">${esc(s.title)}</h4>
${who ? `<p class="ev-who">${esc(who)}</p>` : ''}${s.line ? `<p class="ev-lg">${esc(s.line)}</p>` : ''}
<p class="ev-ft"><span><b class="ev-ftn">${esc(tr.name)}</b>${extra.slice(1).map((x) => `<b class="ev-fx">${esc(x)}</b>`).join('')}</span><a href="ics/${esc(s.code)}.ics" download="${esc(slug(c.brand))}-${esc(s.code)}.ics" aria-label="Add ${esc(s.code)} to your calendar">+ .ics</a></p>
</article>`
}

function day(c, M, d, i) {
  const ppm = c.ppm ?? 2.6
  const min = d.ge - d.gs
  // print: the day fits one portrait A4 page
  const ppmPrint = r3(Math.min(ppm, 820 / min))
  let rail = ''
  for (let t = d.gs; t < d.ge; t += 60) rail += `<div class="ev-h" style="--s:${t - d.gs}"><div class="ev-hs"><b>${hm(t)}</b><span class="ev-vz" data-u="${toUtc(d.date, t, M.zone)}"></span></div></div>`
  const vr = M.rooms.slice(1).map((_, k) => `<i class="ev-vr" style="--c:${k + 1}"></i>`).join('')
  const brk = d.breaks.map((b) => `<div class="ev-brk" style="--s:${b._s - d.gs};--d:${b._e - b._s};--c:${b._c0};--cs:${b._cs}" data-u0="${toUtc(d.date, b._s, M.zone)}" data-u1="${toUtc(d.date, b._e, M.zone)}" data-title="${esc(b.title)}" data-rooms="${esc([...b._rooms].join(' '))}"><span><b>${esc(b.title)}</b> ${esc(b.start)}–${esc(b.end)} · ${esc(b.where)}</span></div>`).join('')
  const heads = M.rooms.map((r) => `<div class="ev-ch"><p class="ev-cn"><span class="ev-code">${esc(r.id)}</span>${esc(r.name)}</p>${r.note ? `<p class="ev-lbl">${esc(r.note)}</p>` : ''}</div>`).join('')
  return `<div class="ev-day" id="ev-day-${esc(d.id)}" role="tabpanel" aria-labelledby="ev-tab-${esc(d.id)}" data-day="${esc(d.id)}" data-gs="${d.gs}" data-ge="${d.ge}" data-gsu="${d.gsUtc}" data-date="${esc(d.date)}" style="--min:${min};--ppm-print:${ppmPrint}px"${i ? ' data-later' : ''}>
<h3 class="ev-pday">${esc(d.label)} ${esc(d.dateWords)}<span class="ev-lbl">${esc(c.brand)} · times are ${esc(c.venue.city)} time</span></h3>
<div class="ev-colh" aria-hidden="true"><div class="ev-rh"><p><b>${esc(c.venue.city)}</b>venue</p><p class="ev-rhv"><b>You</b><span class="ev-city"></span></p></div>${heads}</div>
<div class="ev-board">
<div class="ev-rl" aria-hidden="true">${rail}</div>${vr}
${brk}
${d.sessions.map((s) => session(c, M, d, s)).join('\n')}
<div class="ev-now" hidden aria-hidden="true"><i></i></div>
</div>
</div>`
}

function programme(c, M) {
  const T = { ...TITLES, ...c.titles }
  const sw = c.phoneSwitch ?? 'room'
  const items = sw === 'room' ? M.rooms.map((r) => ({ id: r.id, name: r.name })) : M.tracks.map((t) => ({ id: t.id, name: t.name }))
  const dayTabs = M.days.map((d, i) => `<button class="ev-dt" type="button" role="tab" id="ev-tab-${esc(d.id)}" aria-controls="ev-day-${esc(d.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-day="${esc(d.id)}"><b>${esc(d.label)}</b><span>${esc(d.dateWords)}</span></button>`).join('')
  const key = M.tracks.map((t) => `<li><i class="${markClass(t)}" aria-hidden="true"></i>${esc(t.name)}</li>`).join('')
  const swTabs = items.map((x, i) => `<button class="ev-swb" type="button" role="tab" id="ev-sw-${esc(x.id)}" aria-controls="ev-days" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sel="${esc(x.id)}">${sw === 'track' ? `<i class="${markClass(M.tracks.find((t) => t.id === x.id))}" aria-hidden="true"></i>` : ''}<span>${esc(x.name)}</span><i class="ev-dot" hidden aria-hidden="true"></i><span class="ev-sr ev-dot-sr" hidden>, something on now</span></button>`).join('')
  return `<section class="ev-sec ev-prog" id="programme" aria-labelledby="ev-prog-h">
<div class="ev-wrap">
<div class="ev-shead"><span class="ev-no" aria-hidden="true">01</span><h2 id="ev-prog-h">${esc(T.programme)}</h2><p class="ev-lbl ev-zn">All times are ${esc(c.venue.city)} time</p></div>
<div class="ev-ctlw">
<div class="ev-ctl"><div class="ev-ctl-l" aria-hidden="true"></div><div class="ev-ctl-r">
<div class="ev-days" role="tablist" aria-label="Days">${dayTabs}</div>
<ul class="ev-key" aria-label="Tracks">${key}</ul>
<div class="ev-tz" role="radiogroup" aria-label="Show times in" hidden><button type="button" role="radio" aria-checked="false" data-tz="venue" tabindex="-1">${esc(c.venue.city)}</button><button type="button" role="radio" aria-checked="true" data-tz="both" tabindex="0">Both</button><button type="button" role="radio" aria-checked="false" data-tz="mine" tabindex="-1">Mine</button></div>
</div></div>
<div class="ev-sw" role="tablist" aria-label="${sw === 'room' ? 'Rooms' : 'Tracks'}">${swTabs}</div>
</div>
<div class="ev-nb" aria-live="polite" hidden></div>
<div class="ev-dayset ev-sw-${sw}" id="ev-days" data-sel="${esc(items[0].id)}" style="--n:${M.rooms.length}">
${M.days.map((d, i) => day(c, M, d, i)).join('\n')}
</div>
</div>
</section>`
}

/** Phone switcher rules: which sessions show for the selected room or track. */
function switchCss(c, M) {
  const sw = c.phoneSwitch ?? 'room'
  const ids = sw === 'room' ? M.rooms.map((r) => r.id) : M.tracks.map((t) => t.id)
  const attr = sw === 'room' ? 'data-room' : 'data-track'
  return `@media (max-width:759px){${ids.map((id) => `.ev-dayset[data-sel="${id}"] .ev-s:not([${attr}="${id}"])`).join(',')}{display:none}${sw === 'room' ? ids.map((id) => `.ev-dayset[data-sel="${id}"] .ev-brk:not([data-rooms~="${id}"])`).join(',') + '{display:none}' : ''}}`
}

function speakers(c, M) {
  const T = { ...TITLES, ...c.titles }
  const feat = c.people.filter((p) => p.featured)
  const rest = c.people.filter((p) => !p.featured)
  const ref = (code) => {
    const s = c.sessions.find((x) => x.code === code)
    const d = M.days[s._dayIx]
    return `<a class="ev-go" href="#s-${esc(slug(code))}" data-go="${esc(code)}">${esc(code)}</a><span>${esc(d.short)} ${esc(s.start)}</span><span>${esc(M.rooms[s._room].name)}</span><a class="ev-ics" href="ics/${esc(code)}.ics" download aria-label="Add ${esc(code)} to your calendar">+ .ics</a>`
  }
  const cards = feat.map((p) => `<li class="ev-sp" id="p-${esc(p.id)}"><h3>${esc(p.name)}</h3><p class="ev-role">${esc(p.role)}</p><blockquote><p>${esc(p.says)}</p></blockquote><p class="ev-ref">${ref(p.talk)}${p._sessions.length > 1 ? `<span class="ev-also">also ${p._sessions.filter((x) => x !== p.talk).map((x) => `<a class="ev-go" href="#s-${esc(slug(x))}" data-go="${esc(x)}">${esc(x)}</a>`).join(', ')}</span>` : ''}</p></li>`).join('')
  const roll = rest.length ? `<div class="ev-roll"><p class="ev-lbl">Also ${c.titles?.speakers ? 'with us' : 'speaking'}</p><ul>${rest.map((p) => `<li><b>${esc(p.name)}</b> <span>${esc(p.role)}</span> ${p._sessions.map((x) => `<a class="ev-go" href="#s-${esc(slug(x))}" data-go="${esc(x)}">${esc(x)}</a>`).join(' ')}</li>`).join('')}</ul></div>` : ''
  return `<section class="ev-sec" id="speakers" aria-labelledby="ev-spk-h"><div class="ev-wrap">
<div class="ev-shead"><span class="ev-no" aria-hidden="true">02</span><h2 id="ev-spk-h">${esc(T.speakers)}</h2><p class="ev-lbl">${c.people.length} ${c.people.length === 1 ? 'person' : 'people'} · ${feat.length} in their own words</p></div>
<ul class="ev-spk">${cards}</ul>
${roll}
</div></section>`
}

function tickets(c, M) {
  const T = { ...TITLES, ...c.titles }
  const rows = c.tickets.map((t) => `<li class="ev-tr" data-u1="${t._u1}"${t.stock !== undefined ? ` data-stock="${t.stock}"` : ''}><h3 class="ev-tn">${esc(t.name)}</h3><p class="ev-inc">${esc(t.includes)}</p><p class="ev-pr">${esc(t.price)}</p><div class="ev-se"><p class="ev-left" hidden></p><p class="ev-when">${t.endsNote ? `Until ${esc(stampWords(t._u1, M.zone, M.lang))}, ${esc(t.endsNote)}` : `Sales end ${esc(stampWords(t._u1, M.zone, M.lang))}`}</p>${t.stock !== undefined ? `<p class="ev-stock">${t.stock} places left</p>` : ''}<a class="ev-btn" href="${esc(t.url)}">Book<span class="ev-sr"> ${esc(t.name)}</span></a></div></li>`).join('')
  return `<section class="ev-sec" id="tickets" aria-labelledby="ev-tk-h"><div class="ev-wrap">
<div class="ev-shead"><span class="ev-no" aria-hidden="true">03</span><h2 id="ev-tk-h">${esc(T.tickets)}</h2><p class="ev-lbl">Sales end in ${esc(c.venue.city)} time</p></div>
<div class="ev-tkh ev-lbl" aria-hidden="true"><span>Ticket</span><span>What it includes</span><span>Price</span><span>Sales end</span></div>
<ul class="ev-tk">${rows}</ul>
</div></section>`
}

function plan(c) {
  const P = c.venue.plan
  if (!P) return ''
  return `<div class="ev-plan" role="img" aria-label="Plan of ${esc(c.venue.name)}: ${esc(P.floors.map((f) => `${f.name}, ${f.rooms.map((r) => r.label).join(', ')}`).join('; '))}">${P.floors.map((f) => `<div class="ev-fl" aria-hidden="true"><p class="ev-lbl">${esc(f.name)}</p><div class="ev-flb" style="aspect-ratio:${f.w}/${f.h}">${f.rooms.map((r) => `<div class="ev-rm${r.open ? ' ev-rm-open' : ''}${r.solid ? ' ev-rm-solid' : ''}${r.screen ? ' ev-rm-screen' : ''}" style="left:${r3((r.x / f.w) * 100)}%;top:${r3((r.y / f.h) * 100)}%;width:${r3((r.w / f.w) * 100)}%;height:${r3((r.h / f.h) * 100)}%"><p class="ev-prn">${r.room ? `<span class="ev-code">${esc(r.room)}</span>` : ''}${esc(r.label)}</p>${r.note ? `<p class="ev-lbl">${esc(r.note)}</p>` : ''}</div>`).join('')}</div>${f.entrance ? `<p class="ev-ent">${esc(f.entrance)}</p>` : ''}</div>`).join('')}</div>`
}

function venue(c) {
  const T = { ...TITLES, ...c.titles }
  return `<section class="ev-sec" id="venue" aria-labelledby="ev-vn-h"><div class="ev-wrap">
<div class="ev-shead"><span class="ev-no" aria-hidden="true">04</span><h2 id="ev-vn-h">${esc(T.venue)}</h2><p class="ev-lbl">${esc(c.venue.name)}</p></div>
<div class="ev-ven"><dl>${c.venue.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${plan(c)}</div>
</div></section>`
}

function content(c, M) {
  const title = c.title.lines.map((l, i) => `<span class="ev-tl${i === c.title.accent ? ' ev-tl-acc' : ''}">${esc(l)}</span>`).join('')
  return `<main class="ev ev-tz-off ev-t-${c.theme.type ?? 'grotesk'}" id="top" style="${tokens(c)}">
<section class="ev-cover" aria-labelledby="ev-title">
<div class="ev-wrap ev-cv"><h1 class="ev-title" id="ev-title">${title}</h1><p class="ev-kicker">${esc(c.kicker)}</p></div>
<div class="ev-wrap">${glance(c, M)}</div>
</section>
${facts(c, M)}
${programme(c, M)}
${speakers(c, M)}
${tickets(c, M)}
${venue(c)}
<footer class="ev-foot"><div class="ev-wrap"><p>${c.footer ? esc(c.footer) : esc(c.brand)}</p><p><a href="programme.ics" download="${esc(slug(c.brand))}.ics">The whole programme as one calendar file (.ics, ${c.sessions.length} sessions)</a></p></div></footer>
</main>`
}

function data(c, M, v) {
  const d = {
    brand: c.brand, lang: M.lang, zone: M.zone, city: c.venue.city, online: !!c.online,
    preview: { clock: v.preview.clock, before: v.preview.before, after: v.preview.after, zone: c.preview.visitorZone ?? null },
    first: v.span.firstUtc, last: v.span.lastUtc, after: c.after ?? `${c.brand} has ended.`,
    switch: c.phoneSwitch ?? 'room',
    rooms: M.rooms.map((r) => ({ id: r.id, name: r.name })), tracks: M.tracks.map((t) => ({ id: t.id, name: t.name })),
    days: M.days.map((x) => ({ id: x.id, date: x.date, label: x.label, short: x.short })),
    tickets: c.tickets.map((t) => ({ name: t.name, price: t.price, u1: t._u1 })),
  }
  return `<script type="application/json" id="ev-data">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`
}

function fontsHref(c) { return `https://fonts.googleapis.com/css2?${TYPES[c.theme.type ?? 'grotesk'].google}&display=swap` }

export function build(c, v, { css, js }) {
  const M = model(c)
  const style = `<style>${css}${switchCss(c, M)}</style>`
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(fontsHref(c))}">`
  const body = `${content(c, M)}
${data(c, M, v)}
<script>${js}</script>`
  const T = { ...TITLES, ...c.titles }
  const page = `<!doctype html>
<html lang="${esc(M.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.brand)} · ${esc(spanWords(c.days, M.lang))}</title>
<meta name="description" content="${esc(c.kicker)}">
${fonts}
${style}
</head>
<body class="ev-page" style="background:${c.theme.bg};margin:0">
<a class="ev-skip" href="#programme">Skip to the programme</a>
<header class="ev-run" style="${tokens(c)}"><div class="ev-wrap"><a class="ev-brand" href="#top">${esc(c.brand)}</a><nav aria-label="Sections"><ul><li><a href="#programme">${esc(T.programme)}</a></li><li><a href="#speakers">Speakers</a></li><li><a href="#tickets">${esc(T.tickets)}</a></li><li><a href="#venue">${esc(T.venue)}</a></li></ul></nav><a class="ev-btn ev-btn-run" href="#tickets">Tickets</a></div></header>
${body}
</body>
</html>
`
  const embed = `<!-- Event Page Kit: paste this where the page content goes, and copy ics/ and programme.ics beside the page. -->
${fonts}
${style}
${body}
`
  // calendar files
  const address = c.venue.rows.find(([k]) => /address/i.test(k))?.[1] ?? c.venue.name
  const events = []
  const ics = {}
  const prodid = '-//Lookbk//Event Page Kit//EN'
  for (const s of c.sessions) {
    if (s.status === 'cancelled') continue
    const e = {
      uid: `${slug(c.brand)}-${slug(s.code)}-${s.day}`, start: s._u0, end: s._u1,
      summary: `${s.code} · ${s.title}`, location: `${M.rooms[s._room].name}, ${address}`,
      description: [s.people?.length ? names(c, M, s) : s.meta, s.line].filter(Boolean).join('. '),
    }
    events.push(e)
    ics[s.code] = writeIcs([e], { name: c.brand, prodid })
  }
  const all = writeIcs(events, { name: c.brand, prodid })
  return { page, embed, ics, all }
}

export async function main(argv) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs event.json out')
    process.exit(1)
  }
  let c
  try { c = JSON.parse(readFileSync(resolve(input), 'utf8')) } catch (e) { console.error(`${input}: ${e.message}`); process.exit(1) }
  const v = validate(c)
  for (const w of v.warnings) console.warn(`warning: ${w}`)
  if (v.problems.length) {
    console.error(`${input} has ${v.problems.length} problem${v.problems.length > 1 ? 's' : ''}; nothing was written:`)
    for (const p of v.problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  const css = readFileSync(join(KIT, 'event.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const out = resolve(outDir)
  const r = build(c, v, { css, js })
  mkdirSync(out, { recursive: true })
  rmSync(join(out, 'ics'), { recursive: true, force: true })
  mkdirSync(join(out, 'ics'), { recursive: true })
  writeFileSync(join(out, 'index.html'), r.page)
  writeFileSync(join(out, 'event-embed.html'), r.embed)
  for (const [code, text] of Object.entries(r.ics)) writeFileSync(join(out, 'ics', `${code}.ics`), text)
  writeFileSync(join(out, 'programme.ics'), r.all)
  console.log(`built ${join(outDir, 'index.html')} and ${join(outDir, 'event-embed.html')}: ${c.days.length} days, ${c.rooms.length} rooms, ${c.sessions.length} sessions checked (no room double-booked, everyone in one place at a time, all inside opening hours), ${Object.keys(r.ics).length} calendar files`)
}
