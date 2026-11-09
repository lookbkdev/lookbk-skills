// Newsletter Kit: builds letter.json into
//   out/index.html            the standalone page (layout "page"), or a demo
//                             page with the section in it (layout "inline")
//   out/newsletter-embed.html the section alone, to paste into a page
//
//   node scripts/build.mjs letter.json out [--today 2026-11-09]
//
// Before writing, every value in letter.json and then the finished page are
// scanned for anything that looks like a secret key; one hit and nothing is
// written.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmt, plainDate } from './dates.mjs'
import { DISPLAYS, MONOS, TEXTS, contrast, lum, mix, rgb, validate } from './schema.mjs'
import { scanText } from './secrets.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<span class="nk-turn">$1</span>')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')

/** The colour between `ink` and the backgrounds that holds `need`:1 on all of them, as quiet as allowed. */
function quiet(ink, bgs, need = 4.6) {
  for (let t = 0.62; t >= 0; t -= 0.02) { const m = mix(ink, bgs[0], t); if (bgs.every((b) => contrast(m, b) >= need)) return m }
  return ink
}
const readable = (c, bgs, fallback, need = 4.5) => (bgs.every((b) => contrast(c, b) >= need) ? c : fallback)

export function tokens(t) {
  const dark = lum(t.page) < 0.2
  const client = t.client
  const bar = dark ? mix(client, '#ffffff', 0.03) : mix(t.page, client, 0.25)
  const row = dark ? mix(client, '#ffffff', 0.05) : mix(client, t.accent, 0.05)
  const done = mix(client, t.ok, dark ? 0.1 : 0.07)
  const already = mix(client, t.accent2, dark ? 0.1 : 0.08)
  const v = {
    '--page': t.page, '--ink': t.ink, '--ink-rgb': rgb(t.ink),
    '--mute': quiet(t.ink, [t.page, client, done, already]),
    '--rule': mix(t.page, t.ink, dark ? 0.17 : 0.16), '--rule2': mix(t.page, t.ink, dark ? 0.1 : 0.09), '--rule-strong': mix(t.page, t.ink, 0.34),
    '--accent': t.accent, '--accent-rgb': rgb(t.accent), '--on-accent': t.onAccent, '--accent2': t.accent2,
    '--accent-text': readable(t.accent, [t.page], t.ink), '--accent-text-c': readable(t.accent, [client], t.ink), '--accent-text-m': readable(t.accent, [t.mail], t.ink),
    '--turn': readable(t.accent, [t.page], t.ink, 3),
    '--accent-line': contrast(t.accent, client) >= 3 ? t.accent : t.ink,
    '--field-line': t.fields === 'square' ? t.ink : quiet(t.ink, [client, t.page], 3.2),
    '--error': t.error, '--error-rgb': rgb(t.error), '--ok': t.ok,
    '--client': client, '--client-bar': bar, '--row': row, '--cink': t.ink, '--cmute': quiet(t.ink, [client, bar, row]), '--rmute': quiet(t.ink, [row]),
    '--mail': t.mail, '--mail-rgb': rgb(t.mail), '--mink': t.ink, '--mmute': quiet(t.ink, [t.mail]),
    '--series': quiet(t.ink, [t.mail], 3.2),
    '--done-bg': done, '--already-bg': already,
    '--lift': dark ? '0 0 0 1px rgba(0,0,0,.6), 0 30px 60px -20px rgba(0,0,0,.7)' : `0 1px 0 rgba(0,0,0,.04), 0 2px 4px rgba(${rgb(mix(t.ink, '#000000', 0.3))},.05), 0 24px 48px -18px rgba(${rgb(mix(t.ink, '#000000', 0.3))},.22)`,
    '--display': DISPLAYS[t.display].family, '--display-w': DISPLAYS[t.display].weight, '--track': DISPLAYS[t.display].track, '--h-desk': DISPLAYS[t.display].size + 'px',
    '--text': TEXTS[t.text].family, '--mono': MONOS[t.mono].family,
    '--r': t.fields === 'square' ? '3px' : '10px', '--r-in': t.fields === 'square' ? '2px' : '7px', '--av-r': t.fields === 'square' ? '50%' : '10px',
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
const fontsHref = (t) => {
  const fams = [...new Set([DISPLAYS[t.display].google, TEXTS[t.text].google, MONOS[t.mono].google])]
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}

/** A <time> the runtime rewrites in the reader's time zone; the text here is the sender's. */
const when = (at, tz, kind, cls = '') => `<time${cls ? ` class="${cls}"` : ''} datetime="${new Date(at).toISOString()}" data-at="${at}" data-f="${kind}">${esc(fmt(at, tz, kind))}</time>`

function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) }

function chart(f) {
  const vals = f.series.flatMap((s) => s.values)
  const ticks = (f.ticks ?? []).map(([v, l]) => ({ v, l }))
  let lo, hi
  if (f.scale === 'log') {
    lo = Math.min(...vals, ...ticks.map((x) => x.v))
    hi = Math.max(...vals, ...ticks.map((x) => x.v)) * 1.5
    if (!ticks.length) for (let p = Math.floor(Math.log10(lo)); 10 ** p <= hi; p++) ticks.push({ v: 10 ** p, l: `${10 ** p}${f.unit ? ' ' + f.unit : ''}` })
    lo = Math.min(lo, ...ticks.map((x) => x.v))
  } else {
    lo = Math.min(0, ...vals)
    hi = Math.max(...vals) * 1.12
    if (!ticks.length) { const step = 10 ** Math.floor(Math.log10(hi / 3)); for (let v = 0; v <= hi; v += step * Math.ceil(hi / step / 4)) ticks.push({ v, l: `${v}${f.unit ? ' ' + f.unit : ''}` }) }
  }
  const Y = (v) => (f.scale === 'log' ? 100 - ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100 : 100 - ((v - lo) / (hi - lo)) * 100)
  const X = (i) => 6 + (i * 88) / (f.x.length - 1)
  const r1 = (n) => Math.round(n * 10) / 10
  const lines = f.series.map((s) => `<path class="nk-line${s.accent ? ' nk-acc' : ''}" vector-effect="non-scaling-stroke" d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${r1(X(i))} ${r1(Y(v))}`).join(' ')}"/>`).join('')
  const grid = ticks.map((t) => `<line class="nk-grid-l" vector-effect="non-scaling-stroke" x1="0" x2="100" y1="${r1(Y(t.v))}" y2="${r1(Y(t.v))}"/>`).join('')
  const acc = f.series.findIndex((s) => s.accent)
  const pts = acc < 0 ? '' : f.series[acc].values.map((v, i) => `<i class="nk-pt" data-x="${r1(X(i))}" style="left:${r1(X(i))}%;top:${r1(Y(v))}%"></i>`).join('')
  const cls = (f.callouts ?? []).map((k) => `<span class="nk-cl nk-l${f.series[k.series].accent ? '' : ' nk-below'}" data-x="${r1(X(k.at))}" style="left:${r1(X(k.at))}%;top:${r1(Y(f.series[k.series].values[k.at]))}%">${esc(k.label)}</span>`).join('')
  return `<figure class="nk-chart" role="img" aria-label="${esc(f.alt)}">
  <figcaption class="nk-ct nk-l"><span>${esc(f.title)}</span>${f.note ? `<span>${esc(f.note)}</span>` : ''}</figcaption>
  <div class="nk-plotwrap" aria-hidden="true">
   <div class="nk-yax">${ticks.map((t) => `<span class="nk-l" style="top:${r1(Y(t.v))}%">${esc(t.l)}</span>`).join('')}</div>
   <div class="nk-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<g class="nk-draw">${lines}</g></svg>${pts}${cls}</div>
   <div class="nk-xax" style="position:relative;height:18px">${f.x.map((x, i) => `<span class="nk-l" style="position:absolute;left:${r1(X(i))}%;transform:translateX(-50%)">${esc(x)}</span>`).join('')}</div>
  </div>
  <ul class="nk-legend" aria-hidden="true">${f.series.map((s) => `<li><i${s.accent ? ' class="nk-acc"' : ''}></i>${esc(s.name)}</li>`).join('')}</ul>
</figure>`
}

function figureHTML(f) {
  if (!f) return ''
  if (f.type === 'chart') return chart(f)
  if (f.type === 'quote') return `<blockquote class="nk-quote"><p>${esc(f.text)}</p><cite>${esc(f.cite)}</cite></blockquote>`
  return `<div class="nk-list"><p class="nk-l">${esc(f.title ?? 'In this issue')}</p><ol>${f.items.map((x, i) => `<li><span class="nk-l">${i + 1}</span><span>${esc(x[0])}</span><span class="nk-l">${esc(x[1])}</span></li>`).join('')}</ol></div>`
}

export function sectionHTML(c, d) {
  const s = c.schedule, tz = s.tz, is = c.issue, b = c.brand
  const nextNo = d.next ? `No. ${d.next.no}` : c.messages.nextFallback
  const nextDay = d.next ? fmt(d.next.at, tz, 'day') : ''
  const v = { next: nextNo, nextDay }
  const T = (k) => esc(fill(c.messages[k], v))
  const nowAt = Date.parse(`${d.today}T12:00:00Z`)
  const cad = `${d.cadence}, ${s.time} ${s.zoneLabel}`
  const page = c.layout === 'page'
  const H = page ? 'h1' : 'h2'

  const cal = `<ol class="nk-cal" style="--n:${d.calendar.length + 1}" aria-hidden="true">${d.calendar.map((x) => `<li class="nk-${x.kind}"></li>`).join('')}<li class="nk-next"></li></ol>
    <p class="nk-calkey nk-l"><span>${when(d.calendar[0].at, tz, 'short')}</span><span><b>No. ${is.no}</b> sent ${when(d.issue.at, tz, 'short')}${d.next ? `<span class="nk-sep" aria-hidden="true">·</span><b class="nk-nx"><span data-nk="next-no">${esc(nextNo)}</span></b> <span data-nk="next-day">${esc(nextDay)}</span>` : ''}</span></p>`

  const form = c.form
  const hidden = Object.entries(form.hidden).map(([k, x]) => `<input type="hidden" name="${esc(k)}" value="${esc(x)}">`).join('')
  const zone = `<div class="nk-zone">
    <form class="nk-form" action="${esc(form.action)}" method="post" novalidate data-success="${T('confirmTitle')} your inbox.">
      <label class="nk-label nk-l" for="nk-email">${esc(form.label)}</label>
      <div class="nk-field"><input id="nk-email" name="${esc(form.field)}" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="${esc(form.placeholder)}" aria-describedby="nk-msg"><button type="submit"><span class="nk-btxt">${esc(fill(form.button, v))} <span class="nk-ar" aria-hidden="true">→</span></span><span class="nk-dots" aria-hidden="true"><i></i><i></i><i></i></span></button></div>
      <div class="nk-hp" aria-hidden="true"><label for="nk-hp">Leave this empty</label><input id="nk-hp" name="${esc(form.honeypot)}" tabindex="-1" autocomplete="off"></div>${hidden}
      <p class="nk-msg" id="nk-msg" role="status" aria-live="polite">${T('hint')}</p>
    </form>
    <div class="nk-done nk-confirm" tabindex="-1" role="status" aria-live="polite"><span class="nk-l">Step 2 of 2 · Check your inbox</span><strong>${T('confirmTitle')} <span class="nk-addr" data-nk="addr">${esc(form.placeholder)}</span></strong><p data-nk="confirm-line">${T('confirmLine')}</p></div>
    <div class="nk-done nk-already" tabindex="-1" role="status" aria-live="polite"><span class="nk-l">Already subscribed</span><strong>${T('alreadyTitle')} <span class="nk-addr" data-nk="addr">${esc(form.placeholder)}</span></strong><p>${T('alreadyLine')}</p></div>
    <div class="nk-done nk-subd" tabindex="-1" role="status" aria-live="polite"><span class="nk-l">Subscribed</span><strong>${T('doneTitle')} <span class="nk-addr" data-nk="addr">${esc(form.placeholder)}</span></strong><p>${T('doneLine')}</p></div>
  </div>`

  const peek = `<a class="nk-peek" href="#nk-issue"><span class="nk-l">Latest · No. ${is.no} · ${when(d.issue.at, tz, 'short')}</span><b>${esc(is.subject)}</b><span class="nk-pre">${esc(is.preheader)}</span><span class="nk-go">Read it before you sign up <span aria-hidden="true">↓</span></span></a>`

  const pitch = `<div class="nk-pitch">
   <p class="nk-eyebrow nk-l">${esc(c.eyebrow)}</p>
   <${H} class="nk-h">${turn(c.headline)}</${H}>
   <p class="nk-dek">${esc(c.dek)}</p>
   ${peek}
   <div class="nk-facts">
     <p class="nk-fact"><span><b>${esc(cad)}</b> <span class="nk-yours" data-nk="yours"></span></span><span class="nk-l">${esc(s.read)}</span></p>
     <div class="nk-calwrap">${cal}</div>
     <p class="nk-fact nk-count"><b>${c.count.value.toLocaleString('en-GB')} ${esc(c.count.label)}</b><span class="nk-src">${esc(c.count.source)}, ${esc(plainDate(c.count.asOf))}</span></p>
   </div>
   ${zone}
   <dl class="nk-privacy">${c.privacy.map(([k, x]) => `<dt class="nk-l">${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>
   ${page ? '' : archiveHTML(c, d, true)}
  </div>`

  const prev = d.prev && c.archive[0]
  const specimen = `<figure class="nk-spec" id="nk-issue" aria-label="Issue ${is.no} as it arrives in an inbox">
   <figcaption class="nk-cap nk-l"><span>The latest issue, as it arrives</span><span>No. ${is.no} · ${when(d.issue.at, tz, 'long')}</span></figcaption>
   <div class="nk-client">
    <div class="nk-bar nk-l"><span class="nk-box"><b>Inbox</b><span data-nk="unread">1 unread</span></span>${when(nowAt, tz, 'day', 'nk-today')}</div>
    <div class="nk-rowbox"><ul class="nk-rows">
     <li class="nk-row nk-confirmrow"><span class="nk-dot"></span><span class="nk-from">${esc(b.from)}</span><span class="nk-sub"><b>${T('confirmRow')}</b> <span>· ${T('confirmRowLine')}</span></span><span class="nk-l">Now</span></li>
     <li class="nk-row nk-sel"><span class="nk-dot"></span><span class="nk-from">${esc(b.from)}</span><span class="nk-sub"><b>${esc(is.subject)}</b> <span>· ${esc(is.preheader)}</span></span>${when(d.issue.at, tz, 'short', 'nk-l')}</li>
     ${prev ? `<li class="nk-row nk-old"><span class="nk-dot"></span><span class="nk-from">${esc(b.from)}</span><span class="nk-sub">${esc(prev.title)} <span>· No. ${prev.no}</span></span>${when(d.prev.at, tz, 'short', 'nk-l')}</li>` : ''}
    </ul></div>
    <div class="nk-open">
     <div class="nk-head"><span class="nk-av" aria-hidden="true">${esc(b.monogram)}</span>
      <span class="nk-who"><b>${esc(b.from)}</b> <span>&lt;${esc(b.address)}&gt;</span></span>
      <span class="nk-when nk-l">${when(d.issue.at, tz, 'daytime')}</span>
      <span class="nk-to">to <output for="nk-email" data-nk="to">you</output></span>
      <h3>${esc(is.subject)}</h3></div>
     <div class="nk-mail"><div class="nk-mail-in${is.dropCap ? ' nk-drop' : ''}">
      <div class="nk-mhead"><span class="nk-mn">${esc(b.name)}</span><span class="nk-l">No. ${is.no} · ${when(d.issue.at, tz, 'short')} · ${esc(s.read)}</span></div>
      <h4>${esc(is.title)}</h4>
      ${is.body.map((p) => `<p class="nk-p">${esc(p)}</p>`).join('')}
      ${figureHTML(is.figure)}
     </div></div>
     <div class="nk-fold"><span class="nk-l">First screen ends here · ${is.moreWords.toLocaleString('en-GB')} more words</span><a href="${esc(is.href)}"${ext(is.href)}>Read No. ${is.no} in full <span class="nk-ar" aria-hidden="true">→</span></a></div>
    </div>
   </div>
  </figure>`

  const data = {
    tz, readerTz: c.demo?.readerTz ?? null, today: c.today ?? null, layout: c.layout,
    latest: { no: is.no, at: d.issue.at }, upcoming: d.upcoming.slice(0, 120),
    sched: { time: s.time, zone: s.zoneLabel },
    form: { mode: form.mode, field: form.field, provider: form.provider, doubleOptIn: form.doubleOptIn, extra: form.extra, honeypot: form.honeypot },
    msg: c.messages, button: form.button, demoEmail: c.demo?.email ?? null,
  }
  const grid = `<div class="nk-grid">${pitch}${specimen}</div>`
  if (!page) return `<section class="nk nk-inline" aria-labelledby="nk-h" data-state="empty" style="${tokens(c.theme)}" data-nk="${esc(JSON.stringify(data))}"><div class="nk-wrap">${grid.replace('<h2 class="nk-h">', '<h2 class="nk-h" id="nk-h">')}</div></section>`

  const colo = `<section class="nk-colo" aria-labelledby="nk-colo"><h2 id="nk-colo">Before you sign up</h2><dl>
     <div><dt class="nk-l">What arrives</dt><dd>${esc(`${d.cadence} at ${s.time} ${s.zoneLabel}, ${s.read}.`)}${c.about ? ' ' + esc(c.about) : ''}</dd></div>
     <div><dt class="nk-l">Confirming</dt><dd>${form.doubleOptIn ? 'We send one email to confirm the address is yours. Until you tap it, nothing else arrives.' : 'There is no confirming step: the next issue simply arrives.'}</dd></div>
     ${c.privacy.map(([k, x]) => `<div><dt class="nk-l">${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}
   </dl></section>`
  return `<div class="nk nk-page" data-state="empty" style="${tokens(c.theme)}" data-nk="${esc(JSON.stringify(data))}">
<header class="nk-mast"><a class="nk-name" href="#top">${esc(b.name)}</a>${c.nav.length ? `<nav aria-label="${esc(b.name)}"><ul>${c.nav.map((l) => `<li><a href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a></li>`).join('')}</ul></nav>` : ''}</header>
<div class="nk-rule2" aria-hidden="true"></div>
<p class="nk-dateline nk-l"><span>${esc(`${d.cadence} since ${d.since}`)}</span><span>No. ${is.no} · ${when(d.issue.at, tz, 'long')}</span></p>
<main class="nk-wrap" id="top">${grid}
 <div class="nk-lower">${archiveHTML(c, d, false)}${colo}</div>
</main>
${c.footer ? `<footer class="nk-foot"><span>${esc(c.footer.left)}</span>${c.footer.right ? `<span>${esc(c.footer.right)}</span>` : ''}</footer>` : ''}
</div>`
}

function archiveHTML(c, d, mini) {
  if (!c.archive.length) return ''
  const tz = c.schedule.tz
  const rows = mini ? c.archive.slice(0, 4) : c.archive
  return `<section class="nk-arch${mini ? ' nk-mini' : ''}" aria-labelledby="nk-arch"><h2><span class="nk-t${mini ? ' nk-l' : ''}" id="nk-arch">${mini ? 'Recent issues' : 'From the archive'}</span>${mini ? '' : `<span class="nk-l">${d.total} issues since ${d.since}</span>`}</h2>
   <ol>${rows.map((a, i) => `<li><a href="${esc(a.href)}"${ext(a.href)}><span class="nk-no nk-l">No. ${a.no}</span><span class="nk-tt">${esc(a.title)}</span>${when(d.archive[i].at, tz, 'short', 'nk-l nk-dt')}${a.read ? `<span class="nk-l nk-rt">${esc(a.read)}</span>` : ''}</a></li>`).join('')}</ol></section>`
}

export function build(input, outDir, opts = {}) {
  const file = resolve(input)
  let json
  try { json = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [] } }
  const { errors, notes, c, d } = validate(json, { today: opts.today })
  if (errors.length) return { errors, notes }
  const css = readFileSync(join(KIT, 'newsletter.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const section = sectionHTML(c, d)
  const t = c.theme
  const title = c.demo?.title ?? `${c.brand.name} · ${d.cadence}`
  const ctx = c.layout === 'inline' && c.demo?.above
    ? `<div class="nk-ctx nk" style="${tokens(t)}"><p class="nk-l">${esc(c.demo.above.label)}</p><p>${esc(c.demo.above.text)}</p></div>`
    : ''
  const after = c.layout === 'inline' && c.demo?.below ? `<div class="nk-ctx nk" style="${tokens(t)}"><p class="nk-l">${esc(c.demo.below)}</p></div>` : ''
  const page = `<!doctype html>
<html lang="${esc(c.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(c.dek)}">
<meta name="color-scheme" content="${lum(t.page) < 0.2 ? 'dark' : 'light'}">
${fonts}
<style>
html, body { margin: 0; background: ${t.page} }
body { overflow-x: clip; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left) }
${css}
</style>
</head>
<body>
${ctx}
${section}
${after}
<script>
${js}
</script>
</body>
</html>
`
  const embed = `<!-- Newsletter Kit: paste this where the section should sit. It brings its own fonts, styles and script. -->
${fonts}
<style>
${css}
</style>
${section}
<script>
${js}
</script>
`
  // The finished page, scanned again: nothing key-like may reach it.
  const leaks = [...scanText(section, 'the built section')]
  if (leaks.length) return { errors: leaks, notes }
  const out = resolve(outDir)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'newsletter-embed.html'), embed)
  return { errors, notes, d, files: [join(out, 'index.html'), join(out, 'newsletter-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const ti = argv.indexOf('--today')
  const today = ti >= 0 ? argv[ti + 1] : undefined
  const [input, out = 'out'] = argv.filter((x, i) => !x.startsWith('--') && !(ti >= 0 && i === ti + 1))
  if (!input) {
    console.log('usage: node scripts/build.mjs letter.json [out] [--today YYYY-MM-DD]')
    process.exit(1)
  }
  const r = build(input, out, { today })
  for (const n of r.notes ?? []) console.log(`note: ${n}`)
  if (r.errors.length) {
    console.log(`${r.errors.length} problem${r.errors.length > 1 ? 's' : ''} in ${input}; nothing was written:`)
    for (const e of r.errors) console.log(`  - ${e}`)
    process.exit(1)
  }
  console.log(`No. ${r.d.issue.no} went out ${plainDate(r.d.issue.date)}; next: ${r.d.next ? `No. ${r.d.next.no} on ${plainDate(new Date(r.d.next.at).toISOString().slice(0, 10))}` : 'none scheduled'}; ${r.d.total} issues since ${r.d.since}`)
  for (const f of r.files) console.log(`wrote ${relative(process.cwd(), f) || f}`)
}
