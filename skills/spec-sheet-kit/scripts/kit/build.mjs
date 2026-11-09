// Spec Sheet Kit: builds spec.json into
//   out/index.html       the section on its own page (to look at, check and record)
//   out/spec-embed.html  the section alone, to paste into a product page
//
//   node scripts/build.mjs spec.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, MONOS, TEXTS, contrast, core, lum, mix, mute, rgbOf, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const esc = core.esc
/** _turn_ and a line break at "\n" */
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\n/g, '<br>')

export function tokens(t) {
  const d = DISPLAYS[t.display]
  const dark = t.mode === 'dark'
  let m = mute(t.ink, t.paper, 5.2)
  for (let x = 0; contrast(m, t.sheet) < 4.8 && x < 20; x++) m = mix(m, t.ink, 0.15)
  const sizes = t.display === 'archivo' ? ['clamp(46px, 4.6vw, 68px)', '40px'] : ['clamp(48px, 5vw, 72px)', '44px']
  const v = {
    '--paper': t.paper, '--sheet': t.sheet, '--ink': t.ink, '--line': t.ink, '--mute': m,
    '--rule': `rgba(${rgbOf(t.ink).join(',')},.16)`, '--rule-strong': `rgba(${rgbOf(t.ink).join(',')},.42)`,
    '--accent': t.accent, '--on-accent': t.onAccent, '--turn': t.turn, '--hl-bg': `rgba(${rgbOf(t.accent).join(',')},${dark ? '.1' : '.08'})`,
    '--fade': dark ? '.5' : '.46',
    '--display': d.family, '--h-weight': d.weight, '--h-track': d.track, '--h-stretch': d.stretch, '--turn-style': d.turn,
    '--h-size': sizes[0], '--h-size-phone': sizes[1],
    '--text': TEXTS[t.text].family, '--mono': MONOS[t.mono].family, '--radius': `${t.radius ?? 0}px`,
    '--sheet-shadow': dark ? `0 0 0 1px ${mix(t.sheet, '#ffffff', 0.04)}` : `0 1px 0 ${mix(t.paper, t.ink, 0.06)}, 0 18px 40px -24px rgba(40,30,10,.25)`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

export const fontsHref = (t) => {
  const fams = [...new Set([DISPLAYS[t.display].google, TEXTS[t.text].google, MONOS[t.mono].google])]
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}

const LEGEND = `<ul class="ss-legend" aria-hidden="true">
  <li><svg viewBox="0 0 24 14"><circle cx="12" cy="7" r="6" fill="none" stroke="currentColor"/><text x="12" y="10" font-size="8" text-anchor="middle" fill="currentColor">1</text></svg>Part, as numbered in the list</li>
  <li><svg viewBox="0 0 24 14"><path d="M2 2v10M22 2v10M3 7h18" stroke="currentColor" fill="none"/><path d="M3 7l4-2v4zM21 7l-4-2v4z" fill="currentColor"/></svg>Dimension</li>
  <li><svg viewBox="0 0 24 14"><path d="M1 7h8m2 0h1m2 0h1m2 0h6" stroke="currentColor" fill="none"/></svg>Other model, when comparing</li>
  <li><svg viewBox="0 0 24 14"><path d="M6 11l6-9 6 9z" fill="var(--accent)"/></svg>Differs between models</li>
</ul>`
const PRINT_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 2v8m-3.5-3.5L8 10l3.5-3.5M2.5 13.5h11"/></svg>'

export function sectionHTML(c) {
  const st = { model: c.start.model, compare: !!c.start.compare, len: c.units.length.primary, mass: c.units.mass.primary, view: null }
  const D = c.drawing
  const [e1, e2, e3] = c.head.eyebrow
  const ms = c.models.map((m) => `<button type="button" data-model="${esc(m.id)}" aria-pressed="${!st.compare && st.model === m.id}"${m.sub ? ` title="${esc(m.sub)}"` : ''}>${esc(m.name)}</button>`).join('')
  const cmp = c.models.length > 1 ? `<button type="button" data-compare aria-pressed="${st.compare}">Compare</button>` : ''
  const seg = (k, a, b) => `<button type="button" data-${k}="${a}" aria-pressed="${st[k] === a}">${a}</button><button type="button" data-${k}="${b}" aria-pressed="${st[k] === b}">${b}</button>`
  const scr = core.svg(c, st, { k: 420 / 783 })
  const prn = core.svg(c, st, { print: 172 / 420 })
  const front = D.views.find((v) => v.id === 'front') ?? D.views[0]
  return `<section class="ss ss-armed" style="${tokens(c.theme)}" aria-labelledby="ss-title">
<script type="application/json" class="ss-data">${JSON.stringify(c).replace(/</g, '\\u003c')}</script>
<div class="ss-in">
<header class="ss-head">
  <div>
    <p class="ss-eyebrow"><b>${esc(e1)}</b>${e2 ? `<i></i>${esc(e2)}` : ''}${e3 ? `<i class="x3i"></i><span class="x3">${esc(e3)}</span>` : ''}</p>
    <h2 id="ss-title">${rich(c.head.headline)}</h2>
    ${c.head.lede ? `<p class="ss-lede">${esc(c.head.lede)}</p>` : ''}
  </div>
  <p class="ss-printinfo"></p>
  <div class="ss-ctl" role="group" aria-label="Sheet controls">
    <div class="c4 wide"><span class="lab" id="ss-l-model">Model</span><div class="ss-seg" role="group" aria-labelledby="ss-l-model">${ms}${cmp}</div></div>
    <div class="c2 r hp"><span class="lab">Drawing</span><div class="val">${esc(D.number)}</div></div>
    <div class="c2 b"><span class="lab" id="ss-l-len">Length</span><div class="ss-seg" role="group" aria-labelledby="ss-l-len">${seg('len', 'mm', 'in')}</div></div>
    <div class="c2 b pr"><span class="lab" id="ss-l-mass">Mass</span><div class="ss-seg" role="group" aria-labelledby="ss-l-mass">${seg('mass', 'kg', 'lb')}</div></div>
    <div class="c2 b r hp"><span class="lab">Sheet</span><button type="button" class="ss-print" data-print>${PRINT_ICON}<span>Print or PDF</span></button></div>
  </div>
</header>
<div class="ss-body">
  <div class="ss-left">
    <figure class="ss-fig-wrap">
      <div class="ss-sheet"><svg class="ss-dw ss-sdw" role="img" aria-label="Drawing" viewBox="${scr.viewBox}" style="${scr.style}">${scr.body}</svg><svg class="ss-dw ss-pdw" aria-hidden="true" viewBox="${prn.viewBox}" style="${prn.style}">${prn.body}</svg></div>
      <div class="ss-views" role="group" aria-label="View">${D.views.map((v) => `<button type="button" data-view="${esc(v.id)}" aria-pressed="${v.id === front.id}">${esc(v.short)}</button>`).join('')}</div>
      <figcaption class="ss-cap"><span><b>${esc(D.number)}</b> rev ${esc(D.rev)} · scale ${esc(D.scale)}</span><span>${D.projection === 'first' ? 'First' : 'Third'}-angle projection</span></figcaption>
    </figure>
    ${LEGEND}
    <div class="ss-aside">${core.aside(c)}</div>
  </div>
  <div class="ss-sched">${core.schedule(c, st)}</div>
</div>
<p class="ss-mobile-print"><button type="button" class="ss-print" data-print>${PRINT_ICON}<span>Print or save this sheet as a PDF</span></button></p>
<p class="ss-live" aria-live="polite"></p>
</div>
</section>`
}

export function build(input, outDir) {
  let json
  try { json = JSON.parse(readFileSync(resolve(input), 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [] } }
  const { errors, notes, c } = validate(json)
  if (errors.length) return { errors, notes }
  const css = readFileSync(join(KIT, 'spec.css'), 'utf8') + `\n@media print { @page { size: ${c.print?.paper ?? 'A4'} landscape; margin: 9mm } }\n.ss-armed .ss-dim { opacity: 0 }\n`
  const js = readFileSync(join(KIT, 'core.js'), 'utf8') + '\n' + readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const section = sectionHTML(c)
  const title = `${c.models.map((m) => m.name).join(', ')} specifications · ${c.brand}`
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="color-scheme" content="${c.theme.mode}">
${fonts}
<style>
html, body { margin: 0; background: ${c.theme.paper} }
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
  const embed = `<!-- Spec Sheet Kit: paste this where the specifications section goes. One per page. -->
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
  writeFileSync(join(out, 'spec-embed.html'), embed)
  return { errors, notes, files: [join(out, 'index.html'), join(out, 'spec-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((x) => !x.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs spec.json [out]')
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
