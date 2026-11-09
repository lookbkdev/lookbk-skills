// Feature Tabs Kit: builds features.json into
//   out/index.html               the section on its own page (to look at, check and record)
//   out/feature-tabs-embed.html  the section alone, to paste where it goes in your page
//
//   node scripts/build.mjs features.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, MONOS, TEXTS, lum, mix, rgb, validate } from './schema.mjs'
import { esc, views } from './views.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const pad = (i) => String(i + 1).padStart(2, '0')
/** "\n" breaks the line, _one turn_ in the accent */
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\n/g, '<br>')

export function tokens(t) {
  const d = DISPLAYS[t.display]
  const dark = t.mode === 'dark'
  const a = (c, x) => `rgba(${rgb(c)},${x})`
  const v = {
    '--bg': t.bg, '--ink': t.ink, '--mute': t.mute, '--rule': t.rule,
    '--plate': t.plate ?? mix(t.bg, t.ink, dark ? 0.0 : 0.06),
    '--sheet': t.sheet, '--sheet-ink': t.sheetInk, '--sheet-mute': t.sheetMute, '--sheet-rule': t.sheetRule,
    '--accent': t.accent, '--on-accent': t.onAccent, '--accent2': t.accent2, '--ok': t.ok,
    '--chip': mix(t.sheet, t.sheetInk, dark ? 0.08 : 0.07),
    '--bank': mix(t.sheet, dark ? '#000000' : t.bg, dark ? 0.28 : 0.55),
    '--live': a(t.accent2, dark ? 0.12 : 0.1), '--focus': a(t.accent, 0.22), '--hatch': a(t.accent, 0.3),
    '--lnum': mix(t.sheet, t.sheetMute, 0.55), '--lip': mix(t.sheet, '#ffffff', 0.08),
    '--display': d.family, '--dw': d.weight, '--dtrack': d.track, '--turn-style': d.turn === 'italic' ? 'italic' : 'normal',
    '--rail-size': d.turn === 'italic' ? '26px' : '24px',
    '--text': TEXTS[t.text].family, '--mono': MONOS[t.mono].family,
    '--radius': `${t.radius ?? 4}px`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

export const fontsHref = (t) => 'https://fonts.googleapis.com/css2?' + [...new Set([DISPLAYS[t.display].google, TEXTS[t.text].google, MONOS[t.mono].google])].join('&') + '&display=swap'

function section(c, numbers) {
  const t = c.theme
  const F = c.features
  const V = views(c, numbers)
  const states = (c.stage.states ?? []).map((s) => (typeof s === 'string' ? { text: s } : s))
  const tour = { seconds: 7, auto: true, ...c.tour }
  const labels = {
    running: tour.running ?? `Touring · ${tour.seconds} s each`,
    paused: tour.paused ?? 'Paused while you point',
    stopped: tour.stopped ?? 'Tour stopped · you are driving',
  }
  const crumb = (f) => f.crumb ?? f.title.split(' ')[0]
  const proof = (f) => `<b>${esc(f.proof.value)}</b><span class="ftk-label">${esc(f.proof.label)}</span>`
  const caption = (f, i) => `<span class="ftk-label">Fig. ${pad(i)}</span><span>${esc(f.caption)}</span>`
  const bar = (i) => `<div class="ftk-sbar"><span class="ftk-doc"><span class="ftk-mark" aria-hidden="true"></span><span class="ftk-docname">${esc(c.stage.name)}</span><span class="ftk-state${states[i]?.tone ? ` ftk-tone-${states[i].tone}` : ''}">${states[i] ? '· ' + esc(states[i].text) : ''}</span></span>`
  const data = { seconds: tour.seconds, auto: tour.auto, labels }
  const cls = ['ftk', `ftk-side-${t.railSide ?? 'left'}`, `ftk-${t.stage ?? (t.mode === 'dark' ? 'shadow' : 'plate')}`, `ftk-${t.mode}`].join(' ')
  return `<section class="${cls}" style="${tokens(t)}" data-ftk='${esc(JSON.stringify(data))}' aria-labelledby="ftk-h">
<script>document.currentScript.parentElement.classList.add('ftk-js')</script>
<div class="ftk-wrap">
  <header class="ftk-head">
    <p class="ftk-eyebrow ftk-label">${esc(c.header.eyebrow)}</p>
    <h2 class="ftk-h2" id="ftk-h">${rich(c.header.headline)}</h2>
    <p class="ftk-lede">${esc(c.header.lede)}</p>
  </header>
  <div class="ftk-ui">
    <div class="ftk-rail">
      <div class="ftk-tabs" role="tablist" aria-label="${esc(c.header.eyebrow)}" aria-orientation="vertical">
${F.map((f, i) => `        <button class="ftk-tab" type="button" role="tab" id="ftk-tab-${i}" aria-controls="ftk-panel" aria-selected="${i ? 'false' : 'true'}" tabindex="${i ? -1 : 0}"><span class="ftk-n" aria-hidden="true">${pad(i)}</span><span class="ftk-t">${esc(f.title)}</span><span class="ftk-more" aria-hidden="true"><span><span class="ftk-claim">${esc(f.claim)}</span><span class="ftk-proof">${proof(f)}</span></span></span></button>`).join('\n')}
      </div>
      <p class="ftk-tour ftk-label"><i aria-hidden="true"></i><span>${esc(labels.running)}</span></p>
    </div>
    <div class="ftk-panel" role="tabpanel" id="ftk-panel" aria-labelledby="ftk-tab-0" tabindex="-1">
      <div class="ftk-copy"><h3>${esc(F[0].title)}</h3><p>${esc(F[0].claim)}</p><div class="ftk-proof">${proof(F[0])}</div></div>
      <div class="ftk-stage">${bar(0)}<span class="ftk-crumbs" aria-hidden="true">${F.map((f, i) => `<span class="ftk-label${i ? '' : ' ftk-on'}">${esc(crumb(f))}</span>`).join('')}<i class="ftk-cu"></i></span></div><div class="ftk-sbody"></div></div>
      <p class="ftk-cap">${caption(F[0], 0)}</p>
    </div>
  </div>
  <ol class="ftk-stack">
${F.map((f, i) => `    <li class="ftk-item" data-state="${esc(states[i]?.text ?? '')}" data-tone="${esc(states[i]?.tone ?? '')}">
      <header><h3><span class="ftk-n ftk-label">${pad(i)}</span><span class="ftk-tt">${esc(f.title)}</span></h3><p class="ftk-claim">${esc(f.claim)}</p><p class="ftk-proof">${proof(f)}</p></header>
      <figure class="ftk-fig"><div class="ftk-stage">${bar(i)}</div><div class="ftk-sbody">${V[i]}</div></div><figcaption class="ftk-cap">${caption(f, i)}</figcaption></figure>
    </li>`).join('\n')}
  </ol>
</div>
<script>${readFileSync(join(KIT, 'runtime.js'), 'utf8')}</script>
</section>`
}

export function build(input, outDir) {
  const file = resolve(input)
  const c = JSON.parse(readFileSync(file, 'utf8'))
  const { problems, warnings, numbers } = validate(c)
  if (problems.length) {
    const e = new Error(`${problems.length} problem${problems.length > 1 ? 's' : ''} in ${input}:\n` + problems.map((p) => `  - ${p}`).join('\n'))
    e.problems = problems
    throw e
  }
  const css = readFileSync(join(KIT, 'feature-tabs.css'), 'utf8')
  const sec = section(c, numbers)
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${esc(fontsHref(c.theme))}" rel="stylesheet">`
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.title ?? c.header.eyebrow)}</title>
<meta name="description" content="${esc(c.header.lede)}">
${fonts}
<style>
html,body{margin:0;background:${c.theme.bg}}
${css}
</style>
</head>
<body>
${sec}
</body>
</html>
`
  const embed = `<!-- Feature Tabs Kit: paste the font links into <head> (or load the same fonts your way), and the rest where the section goes. -->
${fonts}
<style>
${css}
</style>
${sec}
`
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), page)
  writeFileSync(join(outDir, 'feature-tabs-embed.html'), embed)
  return { warnings, numbers, out: outDir }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs features.json [out]')
    process.exit(1)
  }
  try {
    const r = build(input, out)
    for (const w of r.warnings) console.warn(`warning: ${w}`)
    const rel = relative(process.cwd(), resolve(out))
    const shown = rel.startsWith('..') ? resolve(out) : rel || '.'
    const nums = Object.entries(r.numbers).map(([k, v]) => `${k} ${v}`).join(', ')
    console.log(`wrote ${shown}/index.html and ${shown}/feature-tabs-embed.html${nums ? ` (numbers checked: ${nums})` : ''}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
