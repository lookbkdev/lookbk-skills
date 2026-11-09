// Footer Kit: builds footer.json into
//   out/index.html         a page that ends with the footer (to look at, check and record)
//   out/footer-embed.html  the footer alone, to paste in as the last thing in <body>
//
//   node scripts/build.mjs footer.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, contrast, lum, mix, rgb, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** _italic turn_ and a line break at "\n" */
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\n/g, '<br>')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')
const a = (l, cls = 'fk-u') => `<a class="${cls}" href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a>`

/** A mute colour that holds `need`:1 against `bg`, as close to the background as that allows. */
function mute(ink, bg, need = 5) {
  for (let t = 0.6; t >= 0; t -= 0.02) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

export function tokens(t) {
  const d = DISPLAYS[t.display]
  const darkSheet = lum(t.sheet) < 0.2
  const m = mute(t.ink, t.sheet)
  const bm = mute(t.boardInk, t.board)
  const block = mix(t.sheet, t.ink, darkSheet ? 0.07 : 0.06)
  const v = {
    '--sheet': t.sheet, '--ink': t.ink, '--mute': m, '--turn': t.turn,
    '--accent': t.accent, '--on-accent': t.onAccent,
    '--board': t.board, '--board-ink': t.boardInk, '--board-mute': bm,
    '--rule': `rgba(${rgb(t.ink)},.16)`, '--rule-strong': `rgba(${rgb(t.ink)},.42)`,
    '--ring': t.ink, '--board-ring': t.boardInk,
    '--lip': darkSheet ? mix(t.sheet, '#ffffff', 0.14) : mix(t.sheet, '#ffffff', 0.7),
    '--edge': darkSheet ? mix(t.sheet, '#000000', 0.55) : mix(t.sheet, t.ink, 0.16),
    '--shade': rgb(mix(t.board, '#000000', 0.78)),
    '--bow': darkSheet ? '0,0,0' : rgb(mix(t.sheet, '#000000', 0.6)),
    '--bow-a': darkSheet ? '.32' : '.10',
    '--error': t.error ?? (darkSheet ? '#ff9a7e' : '#a3271a'),
    '--wm-mark': t.mark ?? t.boardInk,
    '--block': block, '--park': mix(block, '#7a9a52', darkSheet ? 0.16 : 0.22), '--water': mix(block, '#4f7d9c', darkSheet ? 0.2 : 0.22),
    '--map-label': mute(t.ink, block, 4.6),
    '--display': d.family, '--display-w': d.weight, '--display-track': d.track, '--em': d.em,
    '--text': "'Hanken Grotesk', system-ui, sans-serif", '--mono': "'IBM Plex Mono', ui-monospace, monospace",
    '--radius': t.buttons === 'pill' ? '999px' : '0px',
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

const fontsHref = (t) => `https://fonts.googleapis.com/css2?${DISPLAYS[t.display].google}&family=Hanken+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap`

function meta(c) {
  const socials = (c.socials ?? []).length
    ? `<ul class="fk-socials" aria-label="Elsewhere">${c.socials.map((s) => `<li><a class="fk-u" href="${esc(s.href)}"${ext(s.href)}>${esc(s.label)}<span aria-hidden="true">↗</span></a></li>`).join('')}</ul>`
    : ''
  return { socials, top: topButton(c) }
}
const topButton = (c) =>
  `<button class="fk-top" type="button"><span>${esc(c.backToTop.label)}</span><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="fk-trk" cx="18" cy="18" r="16.5" fill="none" stroke-width="1"/><circle class="fk-bar" cx="18" cy="18" r="16.5" fill="none" stroke-width="1.5" pathLength="100" transform="rotate(-90 18 18)"/><path d="M18 24.5V11.5M12.8 16.7 18 11.5l5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>`

const column = (col, cls = '') =>
  `<nav class="fk-col${cls}" aria-label="${esc(col.title)}"><h3 class="fk-label">${esc(col.title)}</h3><ul>${col.links.map((l) => `<li>${a(l)}${l.note ? `<span class="fk-note">${esc(l.note)}</span>` : ''}</li>`).join('')}</ul></nav>`

function cta(c) {
  const k = c.cta
  return `<section class="fk-cta" aria-label="${esc(k.eyebrow)}">
  <p class="fk-label fk-eyebrow">${esc(k.eyebrow)}</p>
  <h2 class="fk-h">${rich(k.headline)}</h2>
  <div class="fk-side">${k.lede ? `<p>${rich(k.lede)}</p>` : ''}<div class="fk-btns"><a class="fk-btn fk-primary" href="${esc(k.primary.href)}"${ext(k.primary.href)}>${esc(k.primary.label)} <span class="fk-ar" aria-hidden="true">→</span></a>${k.secondary ? `<a class="fk-btn fk-ghost" href="${esc(k.secondary.href)}"${ext(k.secondary.href)}>${esc(k.secondary.label)}</a>` : ''}</div></div>
</section>`
}
const visitCol = (c, span = 'fk-wide') =>
  c.visit ? `<div class="fk-col fk-info ${span}"><h3 class="fk-label">Visit</h3>${c.visit.map((v) => `<p><b>${esc(v.city)}</b><br>${esc(v.address)}${v.hours ? `<br><span>${esc(v.hours)}</span>` : ''}</p>`).join('')}</div>` : ''

function layoutWordmark(c) {
  const m = meta(c)
  return `${cta(c)}<div class="fk-rule"></div>
<div class="fk-cols">${c.columns.map((x) => column(x)).join('')}${visitCol(c)}<div class="fk-meta">${m.socials}${m.top}</div></div>`
}

function layoutIndex(c) {
  const groups = new Map()
  for (const col of c.columns)
    for (const l of col.links) {
      const k = /[0-9]/.test(l.label[0]) ? '#' : l.label[0].toUpperCase()
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push({ ...l, ref: l.note ?? col.title })
    }
  const keys = [...groups.keys()].sort((x, y) => (x === '#') - (y === '#') || x.localeCompare(y))
  for (const k of keys) groups.get(k).sort((x, y) => x.label.localeCompare(y.label))
  const m = meta(c)
  const v = c.visit?.[0]
  return `${cta(c)}<div class="fk-rule"></div>
<nav class="fk-ix" aria-label="Index">${keys.map((k) => `<div class="fk-grp"><span class="fk-letter" aria-hidden="true">${esc(k)}</span><ul>${groups.get(k).map((l) => `<li><a href="${esc(l.href)}"${ext(l.href)}><span class="fk-u">${esc(l.label)}</span><span class="fk-lead" aria-hidden="true"></span><span class="fk-pg">${esc(l.ref)}</span></a></li>`).join('')}</ul></div>`).join('')}</nav>
<div class="fk-ixbar">${m.socials || '<span></span>'}<p class="fk-visitline">${v ? `<b>${esc(v.city)}</b> · ${esc(v.address)}${v.hours ? ` · ${esc(v.hours)}` : ''}${c.visit.length > 1 ? ` <span>+${c.visit.length - 1} more</span>` : ''}` : ''}</p>${m.top}</div>`
}

function layoutDispatch(c) {
  const d = c.dispatch
  const m = meta(c)
  const issues = d.issues ?? []
  return `<section class="fk-dp" aria-label="${esc(d.eyebrow)}">
  <div class="fk-lead-in"><p class="fk-label fk-eyebrow">${esc(d.eyebrow)}</p><h2 class="fk-h">${rich(d.headline)}</h2>
  <form class="fk-form" action="${esc(d.action)}" method="post" novalidate data-state="empty" data-fine="${esc(d.fine)}" data-err="${esc(d.error ?? 'That address is missing something: check the @ and the part after it.')}" data-sending="${esc(d.sending ?? 'Sending…')}" data-failed="${esc(d.failed ?? 'That did not go through. Check your connection and try again.')}">
    <div class="fk-field"><label class="fk-sr" for="fk-email">Email address</label><input id="fk-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${esc(d.placeholder ?? 'you@example.com')}" aria-describedby="fk-fine"><button type="submit">${esc(d.button ?? 'Subscribe')} <span aria-hidden="true">→</span></button></div>
    <p class="fk-sent" tabindex="-1">${esc(d.sent)}</p>
    <p class="fk-fine" id="fk-fine" aria-live="polite">${esc(d.fine)}</p>
  </form></div>
  ${issues.length ? `<div class="fk-issues"><h3 class="fk-label">${esc(d.issuesTitle ?? 'Recent letters')}</h3><ul style="list-style:none">${issues.map((x) => `<li><a href="${esc(x.href)}"${ext(x.href)}><span class="fk-no">${esc(x.no)}</span><span class="fk-u">${esc(x.title)}</span><span class="fk-d">${esc(x.date ?? '')}</span></a></li>`).join('')}</ul></div>` : ''}
</section><div class="fk-rule"></div>
<div class="fk-cols">${c.columns.map((x) => column(x)).join('')}<div class="fk-meta">${m.socials}${m.top}</div></div>`
}

function mapSVG(c) {
  const mp = c.place.map
  const P = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  const label = (text, [x, y], angle = 0, cls = '') => `<span class="fk-mapl${cls}" style="left:${x}%;top:${y}%;transform:translateY(-100%) rotate(${angle}deg)">${esc(text)}</span>`
  const labels = [
    ...mp.streets.filter((s) => s.name).map((s) => label(s.name, s.labelAt, s.labelAngle ?? 0)),
    ...['water', 'park'].filter((k) => mp[k]?.name).map((k) => label(mp[k].name, mp[k].labelAt)),
    label(`● ${mp.from}`, [mp.route[0][0] + 1.5, mp.route[0][1] - 1.5], 0, ' fk-from'),
    label(c.brand.name, [Math.min(mp.pin[0] - 3, 78), mp.pin[1] - 6], 0, ' fk-here'),
  ]
  return `<figure class="fk-map" aria-label="${esc(c.place.mapLabel ?? `Map: ${c.brand.name} at ${c.place.address.split('\n')[0]}, from ${mp.from}`)}">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    ${mp.water ? `<path class="fk-water" d="${P(mp.water.shape)}Z"/>` : ''}${mp.park ? `<path class="fk-park" d="${P(mp.park.shape)}Z"/>` : ''}
    ${mp.streets.map((s) => `<path class="fk-st" stroke-width="${((s.width ?? 3) * 0.55).toFixed(2)}" d="${P(s.points)}"/>`).join('')}
    <path class="fk-rt" pathLength="1" d="${P(mp.route)}"/>
  </svg>
  <svg viewBox="0 0 100 100" aria-hidden="true" style="overflow:visible"><circle class="fk-ring" cx="${mp.pin[0]}" cy="${mp.pin[1]}" r="4.6"/><circle class="fk-pin" cx="${mp.pin[0]}" cy="${mp.pin[1]}" r="2"/></svg>
  ${labels.join('')}<span class="fk-mapl fk-n" aria-hidden="true">N ↑</span>
</figure>`
}

function layoutPlace(c) {
  const p = c.place
  const k = c.cta
  const m = meta(c)
  const rows = DAYS.map((d, i) => { const v = p.hours[d]; return `<tr><td>${esc(p.dayNames[i])}</td><td>${v === 'closed' ? esc(p.text.closedDay) : esc(v.replace('-', '–').replace('24:00', '00:00'))}</td></tr>` }).join('')
  const here = (p.gettingHere ?? []).length ? `<div class="fk-col fk-info fk-wide"><h3 class="fk-label">${esc(p.gettingHereTitle ?? 'Getting here')}</h3>${p.gettingHere.map((g) => `<p><b>${esc(g.mode)}</b> · ${esc(g.text)}</p>`).join('')}</div>` : ''
  return `<section class="fk-pl" aria-label="${esc(k.eyebrow)}">
  <div class="fk-say"><p class="fk-label fk-eyebrow">${esc(k.eyebrow)}</p><h2 class="fk-h">${rich(k.headline)}</h2>
    <address>${esc(p.address).replace(/\n/g, '<br>')}${p.phone ? `<br><a class="fk-u" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}</address>
    <div class="fk-btns"><a class="fk-btn fk-primary" href="${esc(k.primary.href)}"${ext(k.primary.href)}>${esc(k.primary.label)} <span class="fk-ar" aria-hidden="true">→</span></a><a class="fk-btn fk-ghost" href="${esc(p.directions.href)}"${ext(p.directions.href)}>${esc(p.directions.label)}</a></div></div>
  ${mapSVG(c)}
  <div class="fk-hours"><h3 class="fk-label"><span>${esc(p.hoursTitle ?? 'Hours')}</span><b class="fk-status" aria-live="polite"></b></h3><table><caption class="fk-sr">Opening hours</caption>${rows}</table></div>
</section><div class="fk-rule"></div>
<div class="fk-cols">${c.columns.map((x) => column(x)).join('')}${here}<div class="fk-meta">${m.socials}${m.top}</div></div>`
}

function floorHTML(c) {
  const b = c.brand
  const mark = b.mark ? `<i>${esc(b.mark)}</i>` : ''
  const [l1, l2] = (b.break ?? '').split('|')
  return `<div class="fk-board">
  <div class="fk-shade" aria-hidden="true"></div>
  <div class="fk-in fk-floor">
    <div class="fk-legal"><p>© ${b.year} ${esc(b.legal)}</p><ul aria-label="Legal">${c.legalLinks.map((l) => `<li>${a(l)}</li>`).join('')}</ul></div>
    <div class="fk-wm" role="img" aria-label="${esc(b.name)}" data-lines="1">
      <span class="fk-wl" data-set="1" aria-hidden="true">${esc(b.name)}${mark}</span>${b.break ? `<span class="fk-wl" data-set="2" aria-hidden="true">${esc(l1)}</span><span class="fk-wl" data-set="2" aria-hidden="true">${esc(l2)}${mark}</span>` : ''}
    </div>
  </div>
</div>`
}

export function footerHTML(c) {
  const t = c.theme
  const body = { wordmark: layoutWordmark, index: layoutIndex, dispatch: layoutDispatch, place: layoutPlace }[c.layout](c)
  const data = {
    lift: c.reveal.lift, rise: c.reveal.rise, stackBelow: c.reveal.stackBelow,
    ...(c.layout === 'place' ? { hours: c.place.hours, timezone: c.place.timezone, now: c.place.now, text: c.place.text, dayNames: c.place.dayNames } : {}),
  }
  return `<footer class="fk fk-l-${c.layout}" style="${tokens(t)}" data-fk="${esc(JSON.stringify(data))}">
<div class="fk-upper"><div class="fk-in">
${body}
</div></div>
${floorHTML(c)}
</footer>`
}

function abovePage(c) {
  const d = c.demo ?? { title: c.brand.name, above: [{ label: c.brand.name, heading: c.brand.name }] }
  return `<main class="fk-page" id="top" style="${tokens(c.theme)}"><div class="fk-in">
${d.above.map((x, i) => `<section class="fk-above"><p class="fk-label">${esc(x.label)}</p>${i ? '<h2' : '<h1'} class="fk-h">${rich(x.heading)}${i ? '</h2>' : '</h1>'}${x.text ? `<p>${rich(x.text)}</p>` : ''}</section>`).join('\n')}
</div></main>`
}

export function build(input, outDir) {
  const file = resolve(input)
  let json
  try { json = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [] } }
  const { errors, notes, c } = validate(json)
  if (errors.length) return { errors, notes }
  const css = readFileSync(join(KIT, 'footer.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const foot = footerHTML(c)
  const title = c.demo?.title ?? c.brand.name
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="color-scheme" content="${lum(c.theme.sheet) < 0.2 ? 'dark' : 'light'}">
${fonts}
<style>
html { background: ${c.theme.board} }
body { margin: 0; background: ${c.theme.sheet}; overflow-x: clip }
${css}
</style>
</head>
<body>
${abovePage(c)}
${foot}
<script>
${js}
</script>
</body>
</html>
`
  const embed = `<!-- Footer Kit: paste this as the last thing inside <body>, after all of the page's content.
     The page above must not sit inside an element with overflow: hidden (it stops the board sticking). -->
${fonts}
<style>
${css}
</style>
${foot}
<script>
${js}
</script>
`
  const out = resolve(outDir)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'footer-embed.html'), embed)
  return { errors, notes, files: [join(out, 'index.html'), join(out, 'footer-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((x) => !x.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs footer.json [out]')
    process.exit(1)
  }
  const r = build(input, out)
  for (const n of r.notes ?? []) console.log(`note: ${n}`)
  if (r.errors.length) {
    console.log(`${r.errors.length} problem${r.errors.length > 1 ? 's' : ''} in ${input}; nothing was written:`)
    for (const e of r.errors) console.log(`  - ${e}`)
    process.exit(1)
  }
  for (const f of r.files) console.log(`wrote ${relative(process.cwd(), f) || f}`)
}
