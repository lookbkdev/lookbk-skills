// Fee Calculator Kit: builds calculator.json into
//   out/index.html               the section on a plain page (to look at, check and record)
//   out/fee-calculator-embed.html the section alone, to paste into a landing page
//
//   node scripts/build.mjs calculator.json out
//
// The starting figures are written into the HTML by the same engine the page
// runs, so the section reads correctly before (or without) JavaScript.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontsHref, tokens, validate, zonedMs } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
export const engineSource = () => readFileSync(join(KIT, 'engine.js'), 'utf8')
export const loadEngine = () => new Function(engineSource() + '\nreturn FeeEngine')()

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const E = loadEngine()
  const notes = []
  const now = zonedMs(c.preview.now, c.arrival.cutoffZone)
  const amount = E.parse(c, c.amount.start).minor
  // the widest result the field can produce sets the result's size, so typing never resizes the layout
  let chars = 0
  for (const a of [c.amount.min, c.amount.max]) {
    const m = E.parse(c, a).minor
    for (const t of togglesAll(c)) chars = Math.max(chars, E.values(c, E.compute(c, m, t)).recv.length)
  }
  const inner = E.markup(c, { amount, toggles: E.initialToggles(c), now })
  const cfg = JSON.stringify(c).replace(/</g, '\\u003c')
  const esc = E.esc
  const section = `<section class="fk" data-layout="${c.layout}" aria-labelledby="fk-h" style="${tokens(c)};--fk-rchars:${chars}">
<script type="application/json" class="fk-cfg">${cfg}</script>
<div class="fk-wrap">${inner}</div>
</section>`
  const css = readFileSync(join(KIT, 'fees.css'), 'utf8')
  const js = engineSource() + '\n' + readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- Fee Calculator Kit: paste this where the calculator goes. It brings its own fonts, styles and script; every class starts with fk-. It fetches nothing; to show live rates, define window.FeeKitRates (see SKILL.md). -->
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
<title>${esc(c.brand)}: ${esc(c.eyebrow)}</title>
<meta name="description" content="${esc(c.lede.replace(/_/g, ''))}">
${fonts}
<style>*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:${c.theme.page};overflow-x:hidden}</style>
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
  if (!c.compare) notes.push('no compare column: the difference line and note 1 are left out')
  return { html, embed, notes, chars }
}

/** every combination of toggle values */
export function togglesAll(c) {
  let all = [{}]
  for (const t of c.toggles ?? []) all = all.flatMap((x) => t.options.map((o) => ({ ...x, [t.id]: o.value })))
  return all
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs calculator.json [out]')
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
  writeFileSync(join(outDir, 'fee-calculator-embed.html'), r.embed)
  for (const n of r.notes) console.log(`note: ${n}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'fee-calculator-embed.html'))}`)
}
