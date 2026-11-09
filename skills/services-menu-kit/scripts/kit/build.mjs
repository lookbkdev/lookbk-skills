// Services Menu Kit: builds services.json into
//   out/index.html          a page holding the section (to look at, check and record)
//   out/services-embed.html the section alone, to paste into a page
//
//   node scripts/build.mjs services.json out
//
// Everything is in the HTML the build writes: every service with its
// outputs, range, time, what the client brings and when to skip it, and
// every set with its itemised sums. With JavaScript off the whole menu
// reads as printed and the chooser stays hidden. The runtime adds the
// chooser (verdicts, the live tally, the address that remembers the
// choice) and the recorder's clock.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TYPES, contrast, judge, lum, mix, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/**
 * Escapes and keeps number-and-unit compounds on one line: "40-page",
 * "2 hours", "$8,000 a month" never break between the figure and its word.
 */
/**
 * Escapes text and keeps what must not break on one line: a figure with its
 * word ("40-page", "2 hours", "$8,000 a month"), a hyphenated word
 * ("out-of-date"), and a short last word with the one before it, so no line
 * ends a paragraph with "4" or "it." alone. The page's runtime uses this same
 * function for the sentences it writes.
 */
export function nb(s) {
  const e = String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const tail = e.replace(/(\S+) (\S{1,4})$/, (m, a, z) => (/[A-Za-z0-9]/.test(z) && z.replace(/[^A-Za-z0-9]/g, '').length <= 3 ? `${a}\u00a0${z}` : m))
  return tail.replace(/(\d(?:[\d.,]*\d)?-[A-Za-z]+(?:-[A-Za-z]+)*(?: [A-Za-z]+)?|(?:[^\s\d<>;]{1,2})?\d(?:[\d.,]*\d)?(?:\s?%)?[ \u00a0-][A-Za-z]+(?:-[A-Za-z]+)*|[A-Za-z]+(?:-[A-Za-z0-9]+)+|\S+\u00a0\S+$)/g, '<span class="sm-nb">$1</span>')
}
const turn = (s) => nb(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
const wk = (w) => (w[0] === w[1] ? `${w[0]} weeks` : `${w[0]} to ${w[1]} weeks`)
const wkShort = (w) => (w[0] === w[1] ? `${w[0]}` : `${w[0]}–${w[1]}`)

/** A colour between ink and bg that still holds `need`:1 on bg, as quiet as that allows. */
function quiet(ink, bg, need) {
  for (let t = 0.75; t >= 0; t -= 0.01) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

export function tokens(t) {
  const T = TYPES[t.type]
  const dark = lum(t.bg) < 0.2
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')
  // the quiet colours are measured on the panel, the harder of the two grounds
  const panel = mix(t.bg, t.ink, dark ? 0.045 : 0.05)
  const v = {
    '--bg': t.bg, '--ink': t.ink,
    '--mute': quiet(t.ink, panel, 5.6),
    '--quiet': quiet(t.ink, panel, 4.7),
    '--accent': t.accent, '--stretch': t.stretch,
    '--rule': mix(t.bg, t.ink, dark ? 0.2 : 0.24),
    '--hair': mix(t.bg, t.ink, dark ? 0.13 : 0.15),
    '--panel': panel,
    '--accent-wash': `rgba(${rgb(t.accent)},${dark ? 0.09 : 0.07})`,
    '--display': T.display, '--name': T.name, '--italic': T.italic, '--text': T.text, '--figure': T.figure,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
const fontsHref = (t) => `https://fonts.googleapis.com/css2?${TYPES[t.type].google}&display=swap`

function priceBlock(c, s, fmt) {
  const T = c.text
  if (s.monthly) {
    return `<div class="sm-price"><p class="sm-typ"><span class="sm-lbl">${esc(T.typically)}</span> <b>${esc(fmt(s.typical))}</b> <small>${esc(T.perMonth)}</small></p>
<p class="sm-from">${esc(T.from)} <b>${esc(fmt(s.from))}</b><span class="sm-min">${nb(fill(T.minimum, { n: s.monthly.minMonths }))}</span></p>
<p class="sm-takes"><span class="sm-lbl">${esc(T.takes)}</span> ${nb(fill(T.rolling, { weeks: `${s.monthly.startsWithinWeeks} week${s.monthly.startsWithinWeeks > 1 ? 's' : ''}` }))}</p></div>`
  }
  return `<div class="sm-price"><p class="sm-typ"><span class="sm-lbl">${esc(T.typically)}</span> <b>${esc(fmt(s.typical))}</b></p>
<p class="sm-from">${esc(T.from)} <b>${esc(fmt(s.from))}</b></p>
<p class="sm-takes"><span class="sm-lbl">${esc(T.takes)}</span> ${nb(wk(s.weeks))}</p></div>`
}

function phoneLine(c, s, fmt) {
  const T = c.text
  const parts = s.monthly
    ? [`<b>${esc(fmt(s.typical))}</b> ${esc(T.perMonth)}`, `${esc(T.from)} ${esc(fmt(s.from))}`, nb(fill(T.minimum, { n: s.monthly.minMonths }))]
    : [`<b>${esc(fmt(s.typical))}</b> ${esc(T.typically.toLowerCase())}`, `${esc(T.from)} ${esc(fmt(s.from))}`, nb(wk(s.weeks))]
  return `<p class="sm-pm" aria-hidden="true"><span class="sm-nb">${parts[0]}</span> <span class="sm-nb"><span class="sm-dot">· </span>${parts[1]}</span> <span class="sm-nb sm-pm-t">${parts[2]}</span></p>`
}

function service(c, s, fmt) {
  const T = c.text
  return `<li class="sm-e" id="svc-${esc(s.id)}" data-id="${esc(s.id)}">
<span class="sm-tag" aria-hidden="true"><i></i><span></span></span>
<div class="sm-head"><h4 class="sm-name">${nb(s.name)}</h4><span class="sm-lead" aria-hidden="true"></span></div>
${phoneLine(c, s, fmt)}
${priceBlock(c, s, fmt)}
<div class="sm-gets"><span class="sm-lbl sm-sr">${esc(T.youGet)}</span><ul>${s.gets.map((g) => `<li>${nb(g)}</li>`).join(' ')}</ul></div>
<dl class="sm-meta"><div class="sm-bring"><dt class="sm-lbl">${esc(T.bring)}</dt><dd>${nb(s.bring)}</dd></div><div class="sm-skip"><dt class="sm-lbl">${esc(T.skip)}</dt><dd>${nb(s.skip)}</dd></div></dl>
<p class="sm-why" hidden></p>
</li>`
}

function course(c, co, k, fmt) {
  const T = c.text
  const cols = c.layout === 'ratecard'
    ? `<div class="sm-cols" aria-hidden="true"><span>${esc(T.service)}</span><span>${esc(T.typically)}</span><span>${esc(T.from)}</span><span>${esc(T.takes)}</span><span></span></div>`
    : ''
  return `<section class="sm-course" aria-labelledby="sm-c${k}">
<header class="sm-ch"><span class="sm-code">${esc(co.code)}</span><h3 id="sm-c${k}">${nb(co.title)}</h3><p>${nb(co.note)}</p></header>
${cols}<ol class="sm-list">
${co.services.map((s) => service(c, s, fmt)).join('\n')}
</ol>
</section>`
}

function sets(c, fmt) {
  const st = c.sets
  if (!st) return ''
  const T = c.text
  const items = st.items.map((x, k) => {
    const rows = x.services.map((s) => `<tr><th scope="row">${nb(s.name)}</th><td class="sm-n">${wkShort(s.weeks)}</td><td class="sm-n sm-f">${esc(fmt(s.from))}</td><td class="sm-n">${esc(fmt(s.typical))}</td></tr>`).join('')
    const ov = x.overlapWeeks ? `<tr class="sm-ov"><th scope="row">${esc(T.overlap)}</th><td class="sm-n">−${x.overlapWeeks}</td><td class="sm-n sm-f"></td><td class="sm-n"></td></tr>` : ''
    return `<article class="sm-set" id="set-${k + 1}" data-set="${k}" aria-labelledby="sm-s${k}">
<div class="sm-head"><h4 class="sm-name" id="sm-s${k}">${nb(x.name)}</h4><span class="sm-lead" aria-hidden="true"></span><span class="sm-settyp">${esc(fmt(x.typical))}</span></div>
<p class="sm-parts">${x.services.map((s) => `<b>${nb(s.name)}</b>`).join(', then ')}.${x.note ? ' ' + nb(x.note) : ''}</p>
<table class="sm-bill" data-from="${x.from}" data-typical="${x.typical}" data-weeks="${x.weeks.join(',')}" data-overlap="${x.overlapWeeks}">
<thead><tr><td></td><th scope="col" class="sm-lbl sm-n">${esc(T.weeksCol)}</th><th scope="col" class="sm-lbl sm-n sm-f">${esc(T.from)}</th><th scope="col" class="sm-lbl sm-n">${esc(T.typically)}</th></tr></thead>
<tbody>${rows}${ov}<tr class="sm-tot"><th scope="row">${esc(T.set)}</th><td class="sm-n">${wkShort(x.weeks)}</td><td class="sm-n sm-f">${esc(fmt(x.from))}</td><td class="sm-n">${esc(fmt(x.typical))}</td></tr></tbody>
</table>
<p class="sm-fromm">${nb(fill(T.setFrom, { money: fmt(x.from) }))}</p>
<span class="sm-tag" aria-hidden="true"><i></i><span></span></span>
<p class="sm-why" hidden></p>
</article>`
  }).join('\n')
  return `<section class="sm-sets" aria-labelledby="sm-sets-h"><div class="sm-sets-in">
<header class="sm-sets-h"><span class="sm-lbl">${esc(st.kicker)}</span><h3 id="sm-sets-h">${nb(st.title)}</h3><p>${nb(st.note)}</p></header>
<div class="sm-set-grid">${items}</div>
</div></section>`
}

function chooser(c, fmt) {
  const T = c.text, ch = c.chooser
  const opts = (name, list, label) =>
    [...list, null].map((v, k) => `<label class="sm-opt"><input type="radio" name="${name}" value="${v ?? ''}"${v === null ? ' checked' : ''}><span>${v === null ? esc(T.any) : nb(label(v))}</span></label>`).join('')
  return `<form class="sm-choose" id="sm-choose" aria-labelledby="sm-choose-t" hidden>
<h3 class="sm-ct" id="sm-choose-t">${nb(ch.title)}</h3>
<fieldset><legend class="sm-lbl">${esc(T.budget)}</legend><div class="sm-opts">${opts('sm-b', ch.budgets, fmt)}</div></fieldset>
<fieldset><legend class="sm-lbl">${esc(T.within)}</legend><div class="sm-opts">${opts('sm-w', ch.weeks, (w) => `${w} weeks`)}</div></fieldset>
<div class="sm-sum"><p class="sm-tally" id="sm-tally" role="status" aria-live="polite">${esc(T.idle)}</p>
<p class="sm-keys" aria-hidden="true"><span class="sm-key sm-k-fit"><i></i>${esc(T.fit)}</span><span class="sm-key sm-k-stretch"><i></i>${esc(T.stretch)}</span><span class="sm-key sm-k-out"><i></i>${esc(T.out)}</span></p>
<button type="button" class="sm-clear" hidden>${esc(T.clear)}</button></div>
</form>
<div class="sm-stick" hidden><div class="sm-stick-in" role="region" aria-label="${esc(ch.title)}"><p class="sm-stick-t"></p><button type="button" class="sm-change">${esc(T.change)}</button></div></div>`
}

export function sectionHTML(c, fmt) {
  const i = c.intro
  const mast = `<header class="sm-mast"><div class="sm-mast-a"><p class="sm-kick"><i aria-hidden="true"></i><span class="sm-lbl">${esc(i.kicker)}</span><i aria-hidden="true"></i></p>
<h2 id="sm-h">${turn(i.headline)}</h2></div>
<div class="sm-mast-b"><p class="sm-lede">${nb(i.lede)}</p>
<ul class="sm-facts">${i.facts.map((f) => `<li>${nb(f)}</li>`).join('')}</ul></div></header>`
  const services = c.courses.flatMap((co) => co.services)
  const data = {
    money: c.money, text: c.text, preview: c.preview,
    services: services.map((s) => ({ id: s.id, from: s.from, typical: s.typical, weeks: s.weeks, monthly: s.monthly })),
    sets: (c.sets?.items ?? []).map((x) => ({ from: x.from, typical: x.typical, weeks: x.weeks })),
  }
  return `<section class="sm sm-L-${c.layout} sm-T-${c.theme.type}${c.dense ? ' sm-dense' : ''}" id="services" aria-labelledby="sm-h" style="${tokens(c.theme)}" data-sm="${esc(JSON.stringify(data))}">
<div class="sm-wrap">
${mast}
<div class="sm-double" aria-hidden="true"></div>
${chooser(c, fmt)}
${c.courses.map((co, k) => course(c, co, k, fmt)).join('\n')}
${sets(c, fmt)}
<footer class="sm-foot"><p>${nb(c.foot.text)}</p><a href="${esc(c.foot.cta.href)}">${esc(c.foot.cta.label)}</a></footer>
</div>
</section>`
}

/** The runtime with the schema's own verdict function inlined, so page and build agree. */
function runtime() {
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  return js
    .replace('/*JUDGE*/', `const judge = ${judge.toString()}`)
    .replace('/*NB*/', `const nb = ${nb.toString()}`)
}

export function build(input, outDir) {
  const file = resolve(input)
  let json
  try { json = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [] } }
  const { errors, notes, c, fmt } = validate(json)
  if (errors.length) return { errors, notes }
  const css = readFileSync(join(KIT, 'menu.css'), 'utf8')
  const js = runtime()
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const section = sectionHTML(c, fmt)
  const title = c.demo?.title ?? `${c.intro.kicker}: ${c.intro.headline.replace(/_/g, '')}`
  const page = `<!doctype html>
<html lang="${esc(c.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="color-scheme" content="${lum(c.theme.bg) < 0.2 ? 'dark' : 'light'}">
${fonts}
<style>
html, body { margin: 0; background: ${c.theme.bg} }
body { overflow-x: clip }
${css}
</style>
</head>
<body>
<main>
${section}
</main>
<script>
${js}
</script>
</body>
</html>
`
  const embed = `<!-- Services Menu Kit: paste this where the services go. Everything reads without
     JavaScript; the script adds the "help me choose" verdicts. -->
${fonts}
<style>
${css}
</style>
${section}
<script>
${js}
</script>
`
  const out = resolve(outDir)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'services-embed.html'), embed)
  return { errors, notes, files: [join(out, 'index.html'), join(out, 'services-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((x) => !x.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs services.json [out]')
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
