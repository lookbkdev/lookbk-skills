// Contact Desk: builds contact.json into
//   out/index.html           the section on a plain demo page (to look at, check and record)
//   out/contact-embed.html   the section alone, to paste into a page
//
//   node scripts/build.mjs contact.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VOICES, contrast, lum, mix, parseHours, replyText, rgb, soften, validate, DAYS } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const bold = (s) => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>')
const n2 = (v) => Math.round(v * 100) / 100

export function tokens(c) {
  const t = c.theme
  const v = VOICES[t.voice ?? 'spectral']
  const dark = lum(t.page) < 0.2
  const field = dark ? mix(t.page, '#000000', 0.15) : mix(t.surface, '#ffffff', 0.6)
  // muted text that holds 5:1 on the page, the surface and the reply band
  const band = mix(t.surface, t.accent, 0.06)
  let mute = soften(t.ink, t.surface, 5.2)
  for (const bg of [t.page, band, field]) if (contrast(mute, bg) < 5) mute = soften(t.ink, bg, 5.2)
  const x = {
    '--page': t.page, '--surface': t.surface, '--ink': t.ink, '--accent': t.accent, '--on-accent': t.onAccent, '--open': t.open,
    '--mute': mute,
    '--btn': dark ? t.accent : t.ink, '--btn-ink': dark ? t.onAccent : t.page, '--btn-bar': dark ? t.onAccent : t.accent, '--band': band, '--field': field,
    '--error': t.error ?? (contrast(t.accent, t.surface) >= 4.5 ? t.accent : dark ? '#ff8f75' : '#a3271a'),
    // borders that carry meaning (inputs, off-shift hours) hold 3:1 against what is behind them
    '--edge': soften(t.ink, field, 3.2),
    '--shift': soften(t.ink, t.page, 3.3),
    '--shift-fill': `rgba(${rgb(soften(t.ink, t.page, 3.3))},${dark ? 0.2 : 0.14})`,
    '--rule': `rgba(${rgb(t.ink)},${dark ? 0.14 : 0.16})`,
    '--plan-fill': dark ? mix(t.page, t.ink, 0.06) : mix(t.page, '#000000', 0.045),
    '--plan-hatch': `rgba(${rgb(t.ink)},${dark ? 0.22 : 0.36})`,
    '--plan-line': `rgba(${rgb(t.ink)},${dark ? 0.42 : 0.62})`,
    '--water': dark ? '#7fa4c0' : '#46708f',
    '--display': v.family, '--display-w': v.weight, '--display-track': v.track, '--em-style': v.emStyle,
    '--text': v.text, '--mono': v.mono,
    '--radius': (t.corners ?? 'square') === 'round' ? '10px' : '2px',
    '--pill': (t.corners ?? 'square') === 'round' ? '999px' : '2px',
    '--shadow': dark ? 'none' : `0 1px 0 rgba(${rgb(t.ink)},.05),0 14px 30px -18px rgba(${rgb(t.ink)},.28)`,
  }
  return Object.entries(x).map(([k, val]) => `${k}:${val}`).join(';')
}
const fontsHref = (c) => `https://fonts.googleapis.com/css2?${VOICES[c.theme.voice ?? 'spectral'].google.join('&')}&display=swap`

/* ---------- the doorstep plan ---------- */
const pts = (p) => p.map(([x, y]) => `${n2(x)},${n2(y)}`).join(' ')
function planSvg(o, i) {
  const p = o.plan, [W, H] = p.size ?? [600, 340], id = `ck-p${i}`
  const crop = p.crop ?? [0, 0, W, H]
  // door swing: hinge on the first point, the leaf opens into the building
  let door = ''
  if (p.door) {
    const [[x1, y1], [x2, y2]] = p.door
    const cx = p.us.reduce((s, q) => s + q[0], 0) / p.us.length, cy = p.us.reduce((s, q) => s + q[1], 0) / p.us.length
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy)
    let nx = -dy / len, ny = dx / len
    if ((cx - x1) * nx + (cy - y1) * ny < 0) { nx = -nx; ny = -ny }
    const ex = x1 + nx * len, ey = y1 + ny * len
    const sweep = (dx * ny - dy * nx) > 0 ? 0 : 1
    door = `<line class="ck-pl-gap" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="ck-pl-leaf" x1="${x1}" y1="${y1}" x2="${n2(ex)}" y2="${n2(ey)}"/><path class="ck-pl-swing" d="M${x2} ${y2} A${n2(len)} ${n2(len)} 0 0 ${sweep} ${n2(ex)} ${n2(ey)}"/>`
  }
  let stairs = ''
  if (p.stairs) {
    const [[a, b], [c2, d]] = p.stairs.at, n = p.stairs.treads, w = p.stairs.width / 2
    const L = Math.hypot(c2 - a, d - b), ux = (c2 - a) / L, uy = (d - b) / L, nx = -uy, ny = ux
    for (let k = 0; k <= n; k++) { const x = a + (c2 - a) * k / n, y = b + (d - b) * k / n; stairs += `<line x1="${n2(x + nx * w)}" y1="${n2(y + ny * w)}" x2="${n2(x - nx * w)}" y2="${n2(y - ny * w)}"/>` }
    stairs = `<g class="ck-pl-stairs">${stairs}<line x1="${n2(a + nx * w)}" y1="${n2(b + ny * w)}" x2="${n2(c2 + nx * w)}" y2="${n2(d + ny * w)}"/><line x1="${n2(a - nx * w)}" y1="${n2(b - ny * w)}" x2="${n2(c2 - nx * w)}" y2="${n2(d - ny * w)}"/></g>`
  }
  const route = `M${p.route.map(([x, y]) => `${x} ${y}`).join(' L')}`
  let len = 0
  for (let k = 1; k < p.route.length; k++) len += Math.hypot(p.route[k][0] - p.route[k - 1][0], p.route[k][1] - p.route[k - 1][1])
  const sc = p.scale ?? { metres: 20, units: 80 }
  const desc = o.steps.map((s, k) => `${k + 1}. ${s.replace(/\*/g, '')}`).join(' ')
  return `<svg class="ck-plan" viewBox="0 0 ${W} ${H}" data-full="0 0 ${W} ${H}" data-crop="${crop.join(' ')}" role="img" aria-labelledby="${id}-t ${id}-d" preserveAspectRatio="xMidYMid meet">
<title id="${id}-t">Plan of the way in to ${esc(o.city)}</title><desc id="${id}-d">${esc(desc)}</desc>
<defs>
<pattern id="${id}-h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="ck-pl-hl"/></pattern>
<pattern id="${id}-w" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q4 1 8 4 T16 4" class="ck-pl-wl"/></pattern>
<mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path class="ck-pl-reveal" d="${route}" style="stroke-dasharray:${n2(len + 2)} ${n2(len + 2)};stroke-dashoffset:0" data-len="${n2(len + 2)}"/></mask>
</defs>
<rect class="ck-pl-ground" x="0" y="0" width="${W}" height="${H}"/>
${(p.water ?? []).map((s) => `<polygon class="ck-pl-water" points="${pts(s)}" fill="url(#${id}-w)"/>`).join('')}
${(p.green ?? []).map((s) => `<polygon class="ck-pl-green" points="${pts(s)}"/>`).join('')}
${p.blocks.map((s) => `<polygon class="ck-pl-block" points="${pts(s)}"/><polygon class="ck-pl-hatch" points="${pts(s)}" fill="url(#${id}-h)"/>`).join('')}
${(p.courts ?? []).map((s) => `<polygon class="ck-pl-court" points="${pts(s)}"/>`).join('')}
${stairs}
<polygon class="ck-pl-us" points="${pts(p.us)}"/>
${door}
${p.gate ? `<line class="ck-pl-gate" x1="${p.gate[0][0]}" y1="${p.gate[0][1]}" x2="${p.gate[1][0]}" y2="${p.gate[1][1]}"/>` : ''}
${p.bay ? `<line class="ck-pl-bay" x1="${p.bay.at[0][0]}" y1="${p.bay.at[0][1]}" x2="${p.bay.at[1][0]}" y2="${p.bay.at[1][1]}"/>` : ''}
<g mask="url(#${id}-m)"><path class="ck-pl-route" d="${route}"/></g>
${(p.labels ?? []).concat(p.bay ? [{ text: p.bay.label, at: [(p.bay.at[0][0] + p.bay.at[1][0]) / 2, p.bay.at[0][1] + 20] }] : []).map((l) => `<text class="ck-pl-lb" x="${l.at[0]}" y="${l.at[1]}" text-anchor="middle" font-size="12"${l.angle ? ` transform="rotate(${l.angle} ${l.at[0]} ${l.at[1]})"` : ''}>${esc(l.text)}</text>`).join('')}
${p.marks.map(([x, y], k) => `<g class="ck-pl-mk" data-x="${x}" data-y="${y}" transform="translate(${x} ${y})"><circle r="11"/><text y="4.4" text-anchor="middle" font-size="12">${k + 1}</text></g>`).join('')}
<g class="ck-pl-n" data-angle="${p.north ?? 0}" transform="translate(${W - 30} 34)"><circle r="13"/><path d="M0 -9 L5 6 L0 3 L-5 6Z" transform="rotate(${p.north ?? 0})"/><text y="-18" text-anchor="middle" font-size="12">N</text></g>
<g class="ck-pl-sc" data-units="${sc.units}" transform="translate(${W - 24 - sc.units - 40} ${H - 18})"><line x1="0" y1="0" x2="${sc.units}" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="${sc.units / 2}" y1="-3" x2="${sc.units / 2}" y2="3"/><line x1="${sc.units}" y1="-4" x2="${sc.units}" y2="4"/><text x="${sc.units + 8}" y="4" font-size="12">${sc.metres} m</text></g>
</svg>`
}

/* ---------- hours as words, for the no-script page and screen readers ---------- */
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
function hoursText(h) {
  const week = parseHours(h, '', () => {})
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

/* ---------- fields ---------- */
function fieldHtml(k, defs, routes, c) {
  const f = defs[0].f
  const type = f.type ?? 'text'
  const inRoutes = defs.map((d) => d.r.id)
  const always = defs.length === routes.length && defs.every((d) => d.f.required)
  const id = `ck-f-${k}`
  const label = `<span class="ck-lab" data-swap>${esc(f.label)}</span>`
  const opt = `<span class="ck-opt" data-opt${f.required ? ' hidden' : ''}>optional</span>`
  const hint = `<span class="ck-hint" id="${id}-h" data-hint${f.hint ? '' : ' hidden'}>${esc(f.hint ?? '')}</span>`
  const req = always ? ' required' : ''
  let ctl
  if (type === 'textarea') ctl = `<textarea id="${id}" name="${k}" rows="4" aria-describedby="${id}-h"${req} placeholder="${esc(f.placeholder ?? '')}"></textarea>`
  else if (type === 'select') ctl = `<span class="ck-sel"><select id="${id}" name="${k}" aria-describedby="${id}-h"${req}><option value="">Choose one</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select></span>`
  else if (type === 'choice' || type === 'swatch') {
    const opts = f.options.map((o, i) => {
      const lab = typeof o === 'string' ? o : o.label
      const dot = typeof o === 'string' ? '' : `<span class="ck-led${o.color === 'none' ? ' ck-led-off' : ''}" style="${o.color === 'none' ? '' : `background:${o.color}`}" aria-hidden="true"></span>`
      return `<label class="ck-chip"><input type="radio" name="${k}" value="${esc(lab)}"${i === 0 && req ? ' required' : ''}>${dot}<span>${esc(lab)}</span></label>`
    }).join('')
    return `<div class="ck-f ck-f-group" data-k="${k}" data-routes="${inRoutes.join(' ')}" role="radiogroup" aria-labelledby="${id}-l" aria-describedby="${id}-h"><div class="ck-lrow"><span class="ck-l" id="${id}-l">${label}${opt}</span>${hint}</div><div class="ck-chips">${opts}</div></div>`
  } else {
    const it = { email: 'email', tel: 'tel', url: 'url', date: 'date' }[type] ?? 'text'
    const ac = f.autocomplete ?? (type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off')
    const im = type === 'email' ? ' inputmode="email"' : type === 'url' ? ' inputmode="url"' : ''
    ctl = `<input id="${id}" name="${k}" type="${it}" autocomplete="${esc(ac)}"${im}${f.mono ? ' class="ck-mono" autocapitalize="characters" spellcheck="false"' : ''} aria-describedby="${id}-h"${req} placeholder="${esc(f.placeholder ?? (type === 'email' ? 'you@example.com' : ''))}">`
  }
  return `<div class="ck-f${type === 'textarea' ? ' ck-f-area' : ''}" data-k="${k}" data-routes="${inRoutes.join(' ')}"><div class="ck-lrow"><label class="ck-l" for="${id}">${label}${opt}</label>${hint}</div>${ctl}</div>`
}

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const notes = []
  const routes = c.routes
  // one element per field key, in first-seen order; each reason picks its own order, labels and widths
  const byKey = new Map()
  for (const r of routes) for (const f of r.fields) { if (!byKey.has(f.k)) byKey.set(f.k, []); byKey.get(f.k).push({ r, f }) }
  const honey = c.form?.honeypot ?? 'company_website'
  const first = routes[0]
  const labels = { routes: 'What is it about?', note: 'Your note', rota: 'Who is at the desk', visit: 'Come and see us', visitNote: 'Appointments only, so someone is there to meet you.', ...(c.labels ?? {}) }
  const people = c.people
  const personLine = (r) => (r.to.length > 1 ? `<b>${esc(r.desk)}</b><span class="ck-sep">·</span>${r.to.map((id) => esc(people[id].city)).join(', ')}` : `<b>${esc(people[r.to[0]].name)}</b><span class="ck-sep">·</span>${esc(people[r.to[0]].role.split(',')[0])}`)
  const rows = routes.map((r, i) => `<label class="ck-ro" data-route="${r.id}"><input type="radio" name="route" value="${r.id}"${i === 0 ? ' checked' : ''}><span class="ck-k">${String(i + 1).padStart(2, '0')}</span><span class="ck-t">${esc(r.title)}</span><span class="ck-w">${personLine(r)}</span><span class="ck-w"><span class="ck-dot" data-route-dot></span><span data-route-here>&nbsp;</span><span class="ck-sep ck-sep2">·</span><span class="ck-rep">replies within ${esc(r.reply.say ?? replyText(r.reply))}</span></span><span class="ck-chev" aria-hidden="true">→</span></label>`).join('')
  const aside = c.aside ? `<div class="ck-aside"><p><b>${esc(c.aside.lead)}</b> ${esc(c.aside.body)}</p>${c.aside.phone ? `<p class="ck-ph"><span class="ck-lbl">${esc(c.aside.phoneLabel)}</span><a href="tel:${c.aside.phone.replace(/\s/g, '')}">${esc(c.aside.phone)}</a><span class="ck-ph-h">${esc(c.aside.phoneHours)}</span></p>` : ''}</div>` : ''
  const endpoint = c.form?.endpoint ?? null
  const action = endpoint ?? `mailto:${first.email}`
  const fields = [...byKey.entries()].map(([k, defs]) => fieldHtml(k, defs, routes, c)).join('')
  const clock = `<svg class="ck-clock" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16.5"/>${[0, 90, 180, 270].map((a) => `<line x1="18" y1="3" x2="18" y2="5.5" transform="rotate(${a} 18 18)"/>`).join('')}<line class="ck-hh" x1="18" y1="18" x2="18" y2="9.5" transform="rotate(0 18 18)"/><line class="ck-mh" x1="18" y1="18" x2="18" y2="5.5" transform="rotate(0 18 18)"/></svg>`
  const slip = `<div class="ck-slip" data-state="ready">
<div class="ck-slip-hd"><dl class="ck-to"><dt class="ck-lbl">To</dt><dd data-to data-swap>${personLine(first).replace(/<span class="ck-sep">·<\/span>/, ' · ')}</dd><dt class="ck-lbl">Re</dt><dd data-re data-swap>${esc(first.title)}</dd></dl><p class="ck-ref"><span class="ck-lbl" data-ref-l>Step 2</span><span class="ck-refn" data-ref>of 2</span></p></div>
<div class="ck-eta">${clock}<p><span data-eta data-swap>Replies within ${esc(first.reply.say ?? replyText(first.reply))}.</span><small data-eta-note data-swap>${esc(first.note ?? '')}</small></p></div>
<div class="ck-banner" data-banner role="status" hidden></div>
<div class="ck-fields">${fields}</div>
<p class="ck-errsum" data-errsum role="alert"></p>
<div class="ck-trap" aria-hidden="true"><label>Leave this empty <input type="text" name="${honey}" tabindex="-1" autocomplete="off"></label></div>
<div class="ck-slip-ft"><button class="ck-send" type="submit"><span data-send data-swap>${esc(first.button ?? `Send to ${first.to.length > 1 ? first.desk.toLowerCase().replace(/^/, 'the ') : people[first.to[0]].name.split(' ')[0]}`)}</span><span class="ck-ar" aria-hidden="true">→</span><span class="ck-bar" aria-hidden="true"></span></button><p class="ck-alt">Rather use email? <a data-mail href="mailto:${esc(first.email)}">${esc(first.email)}</a><br>${esc(c.form?.alt ?? 'A person reads every note.')}</p></div>
<div class="ck-sent" data-sent hidden tabindex="-1"></div>
</div>`
  const ppl = Object.entries(people)
  const rota = `<section class="ck-sec" aria-labelledby="ck-rota-h"><div class="ck-sec-hd"><h3 id="ck-rota-h">${esc(labels.rota)}</h3><p class="ck-note" data-tz-note>Each person's working hours, in their own time.</p></div>
<div class="ck-rota" data-rota><div class="ck-axis" aria-hidden="true"><span></span><div class="ck-axis-in"><span class="ck-nowchip" data-nowchip hidden></span><div class="ck-ruler" data-ruler></div></div><span></span></div>
${ppl.map(([id, p]) => `<div class="ck-rrow" data-person="${id}"><div class="ck-who"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></div><div class="ck-track" data-track><span class="ck-base"></span><span class="ck-hours-txt">${esc(hoursText(p.hours))} (${esc(p.city)} time)</span></div><div class="ck-rst" data-status><span class="ck-dot"></span><span><b>${esc(p.city)}</b><small>${esc(hoursText(p.hours))}</small></span></div></div>`).join('')}
<span class="ck-nowline" data-nowline aria-hidden="true" hidden></span></div></section>`
  const offices = (c.offices ?? []).map((o, i) => `<article class="ck-office" data-office="${i}"><div class="ck-office-hd"><div><h4>${esc(o.city)}</h4><address>${o.address.map(esc).join('<br>')}</address></div><p class="ck-rst ck-ost" data-ostatus><span class="ck-dot"></span><span><b>${esc(hoursText(o.hours))}</b><small>${esc(o.note ?? 'local time')}</small></span></p></div>
<div class="ck-plan-wrap">${planSvg(o, i)}</div><ol class="ck-arrive">${o.steps.map((s, k) => `<li><span class="ck-m" aria-hidden="true">${k + 1}</span><span>${bold(s)}</span></li>`).join('')}</ol>${o.directions ? `<p class="ck-dir"><a href="${esc(o.directions)}" rel="noopener">Directions in your maps app</a></p>` : ''}</article>`).join('')
  const visit = offices ? `<section class="ck-sec" aria-labelledby="ck-visit-h"><div class="ck-sec-hd"><h3 id="ck-visit-h">${esc(labels.visit)}</h3><p class="ck-note">${esc(labels.visitNote)}</p></div><div class="ck-visit">${offices}</div></section>` : ''
  const board = (c.offices ?? []).length ? `<ul class="ck-board" aria-label="Offices now">${c.offices.map((o, i) => `<li data-board="${i}"><span class="ck-dot"></span><span><b>${esc(o.city.split(' ')[0])}</b><span class="ck-st" data-bst> · ${esc(hoursText(o.hours))}</span></span><span class="ck-time" data-btime></span></li>`).join('')}</ul>` : ''
  // what the runtime needs: people, routes, offices' hours, per-reason field settings, preview
  const data = {
    brand: c.brand, endpoint, honeypot: honey,
    people: Object.fromEntries(ppl.map(([id, p]) => [id, { name: p.name, role: p.role, city: p.city, tz: p.tz, hours: parseHours(p.hours, '', () => {}), away: p.away ?? [] }])),
    routes: routes.map((r) => ({ id: r.id, title: r.title, to: r.to, desk: r.desk, reply: r.reply, say: r.reply.say ?? replyText(r.reply), email: r.email, ref: r.ref, note: r.note ?? '', button: r.button ?? null, sent: r.sent,
      fields: r.fields.map((f) => ({ k: f.k, type: f.type ?? 'text', label: f.label, hint: f.hint ?? '', placeholder: f.placeholder ?? (f.type === 'email' ? 'you@example.com' : ''), required: !!f.required, half: !!f.half, pattern: f.pattern ?? null, patternMessage: f.patternMessage ?? null })) })),
    offices: (c.offices ?? []).map((o) => ({ city: o.city, tz: o.tz, hours: parseHours(o.hours, '', () => {}) })),
    preview: c.preview ?? {},
  }
  const dataAttr = JSON.stringify(data).replace(/&/g, '&amp;').replace(/'/g, '&#39;')
  const section = `<section class="ck" id="contact" aria-labelledby="ck-h" style="${tokens(c)}" data-ck='${dataAttr}'>
<div class="ck-wrap">
<header class="ck-head"><div><p class="ck-eyebrow"><i aria-hidden="true"></i><span class="ck-lbl">${esc(c.eyebrow)}</span></p><h2 id="ck-h" class="ck-h">${turn(c.headline)}</h2></div>${board}</header>
<form class="ck-desk" action="${esc(action)}" method="post"${endpoint ? '' : ' enctype="text/plain"'} data-route="${first.id}">
<div class="ck-left"><fieldset class="ck-route"><legend class="ck-step"><span class="ck-n" aria-hidden="true">1</span>${esc(labels.routes)}</legend><div class="ck-rows"><span class="ck-ind" aria-hidden="true"></span>${rows}</div></fieldset>${aside}</div>
<div class="ck-right"><p class="ck-step" id="ck-note-h"><span class="ck-n" aria-hidden="true">2</span>${esc(labels.note)}</p>${slip}${aside.replace('class="ck-aside"', 'class="ck-aside ck-aside-after"')}</div>
</form>
${rota}
${visit}
</div>
</section>`
  const css = readFileSync(join(KIT, 'contact.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- Contact Desk: paste this where the contact section goes. It brings its own fonts, styles and script; every class starts with ck-. -->
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
  return { html, embed, notes }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs contact.json [out]')
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
  writeFileSync(join(outDir, 'contact-embed.html'), r.embed)
  for (const n of r.notes) console.log(`note: ${n}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'contact-embed.html'))}`)
}
