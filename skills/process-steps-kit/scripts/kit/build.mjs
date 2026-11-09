// How It Works kit: builds process.json into
//   out/index.html           the section on a short demo page (to look at, check and record)
//   out/process-embed.html   the section alone, to paste into a page
//
//   node scripts/build.mjs process.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawArtifact, esc, usesSerif } from './artifacts.mjs'
import { DISPLAYS, SERIF_GOOGLE, derive, howLong, lum, minutes, mix, money, payValue, rgb, soften, validate, when, whenShort } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const pct = (d, total) => `${+(d / total * 100).toFixed(4)}%`
const two = (n) => String(n).padStart(2, '0')

export function tokens(c) {
  const t = c.theme
  const d = DISPLAYS[t.display ?? 'newsreader']
  const dark = lum(t.page) < 0.2
  const paper = t.paper ?? (dark ? '#ece9e1' : '#fbf9f4')
  const paperInk = t.paperInk ?? '#1d1a15'
  const v = {
    '--page': t.page, '--ink': t.ink,
    '--mute': soften(t.ink, t.page, 5.2),
    '--rule': `rgba(${rgb(t.ink)},${dark ? 0.16 : 0.15})`,
    '--accent': t.accent, '--on-accent': t.onAccent, '--you': t.you,
    // bars that carry meaning hold 3:1 against the page: upcoming is an outline, done is solid
    '--bar-todo': soften(t.ink, t.page, 3.3),
    '--bar-done': soften(t.ink, t.page, 5.6),
    '--stage': t.stage, '--grid': mix(t.stage, t.ink, dark ? 0.07 : 0.07),
    '--paper': paper, '--paper-ink': paperInk, '--paper-mute': soften(paperInk, paper, 4.6),
    '--paper-rule': mix(paper, paperInk, 0.12), '--paper-soft': mix(paper, paperInk, 0.07),
    '--paper-dark': t.paperDark ?? mix(t.page, t.ink, dark ? 0.06 : 0.85),
    '--paper-dark-ink': mix(paper, '#ffffff', 0.2),
    '--past': dark ? mix(t.stage, paper, 0.16) : mix(paper, t.stage, 0.45),
    '--display': d.family, '--display-w': d.weight, '--display-track': d.track, '--display-wdth': d.wdth, '--em-style': d.em,
    '--text': d.text, '--mono': d.mono,
    '--shadow': dark ? '0 1px 0 rgba(255,255,255,.04),0 30px 60px -18px rgba(0,0,0,.72)' : `0 1px 0 rgba(0,0,0,.05),0 2px 4px rgba(${rgb(mix(t.stage, '#000000', 0.7))},.10),0 24px 40px -12px rgba(${rgb(mix(t.stage, '#000000', 0.7))},.30)`,
  }
  return esc(Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';'))
}
const fontsHref = (c) => {
  const d = DISPLAYS[c.theme.display ?? 'newsreader']
  const fams = [...d.google]
  if (usesSerif(c) && !fams.includes(SERIF_GOOGLE)) fams.push(SERIF_GOOGLE)
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}

function section(c) {
  const D = derive(c)
  const { week, weeks } = D
  const total = c.calendar.total
  const cur = c.price?.currency ?? '£'
  const n = c.steps.length
  // facts: two computed, one stated
  const yt = D.your
  const facts = [
    `<div><dt class="ps-lbl">Start to finish</dt><dd><b>${weeks}</b> week${weeks > 1 ? 's' : ''}</dd></div>`,
    `<div class="ps-yours"><dt class="ps-lbl">Your time, in total</dt><dd data-minutes="${D.minutes}">${yt.about ? 'about ' : ''}<b>${yt.value}</b> ${yt.unit}</dd></div>`,
    c.price ? `<div><dt class="ps-lbl">${esc(c.price.label)}</dt><dd><b>${esc(money(c.price.value, cur))}</b></dd></div>` : '',
  ].join('')

  // the programme, drawn to scale
  const axis = Array.from({ length: weeks }, (_, w) => `<span class="ps-lbl" style="left:${pct(w * week + week / 2, total)}">W${w + 1}</span>`).join('')
  const grid = Array.from({ length: weeks + 1 }, (_, w) => `<i style="left:${pct(w * week, total)}"></i>`).join('')
  const rows = c.steps.map((s, i) => `<div class="ps-row"><div class="ps-nm"><span class="ps-lbl ps-n">${two(i + 1)}</span><span class="ps-tt">${esc(s.title)}</span><span class="ps-lbl ps-ws">${esc(whenShort(s, week))}</span></div><div class="ps-lane"><div class="ps-grid">${grid}</div><i class="ps-bar" data-i="${i}" style="left:${pct(s.start, total)};width:${pct(s.length, total)}"></i></div></div>`).join('')
  const touches = c.steps.flatMap((s) => s.you ?? []).sort((a, b) => a.day - b.day)
  const marks = touches.map((y) => `<span class="ps-mk" style="left:${pct(y.day + 0.5, total)}" data-day="${y.day}" data-min="${y.minutes}"><i></i><b class="ps-lbl">${esc(minutes(y.minutes))}</b></span>`).join('')
  const list = touches.map((y) => `${minutes(y.minutes)} on day ${y.day + 1}`).join(' · ')
  const said = c.steps.map((s) => `${s.title}: ${when(s, week).toLowerCase()}, ${howLong(s, week)}${s.parallel ? ', alongside' : ''}`).join('. ')
  const legend = `${esc(c.studio)} does the work · ◆ the hours we need from you`
  const prog = `<figure class="ps-prog">
<figcaption class="ps-sr">The programme, ${weeks} weeks. ${esc(said)}. Your time: ${esc(list)}.</figcaption>
<div class="ps-chart" aria-hidden="true">
<div class="ps-axisrow"><span class="ps-lbl ps-t">Programme</span><div class="ps-axis">${axis}<span class="ps-flag ps-lbl"></span></div></div>
${rows}
<div class="ps-row ps-yrow"><div class="ps-nm"><span class="ps-lbl">Your time</span></div><div class="ps-lane"><div class="ps-grid">${grid}</div>${marks}</div></div>
</div>
<p class="ps-ylist ps-lbl" aria-hidden="true"><span>Your time</span> ${esc(list)}</p>
<div class="ps-foot ps-lbl" aria-hidden="true"><span>${esc(c.calendar.note ?? `Bars drawn to scale · 1 week = ${week} working days`)}</span><span>${legend}</span></div>
</figure>`

  // the steps
  const items = c.steps.map((s, i) => {
    const w = when(s, week), hl = howLong(s, week)
    const long = s.length > 1 ? `${w}, ${hl}` : w
    const pay = s.pay ? `<p class="ps-pay"><span class="ps-lbl">${esc(s.pay.label)}</span> <b>${esc(payValue(s.pay, cur))}</b></p>` : ''
    return `<li class="ps-step" data-i="${i}">
<div class="ps-seg" aria-hidden="true"><div class="ps-when"><b>${esc(w)}</b>${s.length > 1 ? esc(hl) : ''}</div><i class="ps-tick"></i><i class="ps-span"></i><div class="ps-wks"></div></div>
<div class="ps-in">
<p class="ps-kw" aria-hidden="true">${esc(w)}${s.length > 1 ? `<small>${esc(hl)}</small>` : ''}</p>
<p class="ps-k ps-lbl"><span class="ps-num">${two(i + 1)} / ${two(n)}</span><span aria-hidden="true">·</span><span>${esc(s.who)}</span>${s.parallel ? '<span aria-hidden="true">·</span><span>Alongside</span>' : ''}</p>
<h3 class="ps-t3">${esc(s.title)}</h3>
<p class="ps-d">${esc(s.summary)}</p>
<p class="ps-sr">Pictured: ${esc(s.artifact.alt)}</p>
<div class="ps-inline" aria-hidden="true"><div class="ps-desk"><div class="ps-art">${drawArtifact(s.artifact, i)}</div></div></div>
<dl class="ps-dl"><div><dt class="ps-lbl">How long</dt><dd>${esc(long)}</dd></div><div class="ps-give"><dt class="ps-lbl">You give</dt><dd>${esc(s.give)}</dd></div><div><dt class="ps-lbl">You get</dt><dd>${esc(s.get)}</dd></div></dl>
${pay}
</div>
</li>`
  }).join('\n')

  const mini = c.steps.map((s, i) => `<i data-i="${i}" style="left:${pct(s.start, total)};width:${pct(s.length, total)}"></i>`).join('')
  const stage = c.steps.map((s, i) => `<div class="ps-art" data-i="${i}">${drawArtifact(s.artifact, i)}</div>`).join('')
  const cfg = {
    total, week, n,
    steps: c.steps.map((s) => ({ s: s.start, l: s.length, p: !!s.parallel, t: s.title, get: s.get })),
    end: c.calendar.endLabel ?? 'Handed over',
  }
  return `<section class="ps" aria-labelledby="ps-h" style="${tokens(c)}" data-ps='${JSON.stringify(cfg).replace(/'/g, '&#39;')}'>
<div class="ps-wrap">
<header class="ps-intro">
<div><p class="ps-eyebrow ps-lbl">${esc(c.eyebrow)}</p><h2 class="ps-h" id="ps-h">${rich(c.headline)}</h2>${c.lede ? `<p class="ps-lede">${esc(c.lede)}</p>` : ''}</div>
<dl class="ps-facts">${facts}</dl>
</header>
${prog}
<div class="ps-body">
<div class="ps-list"><div class="ps-rail" aria-hidden="true"><i class="ps-track"></i><i class="ps-fill"></i></div>
<ol class="ps-steps">
${items}
</ol></div>
<aside class="ps-stagecol" aria-hidden="true">
<div class="ps-mini">${mini}<b class="ps-mcur"></b></div>
<div class="ps-stop ps-lbl"><span class="ps-snow"></span><b class="ps-swk"></b></div>
<div class="ps-stage">${stage}</div>
<div class="ps-cap"><span class="ps-lbl ps-capk">You get</span><span class="ps-capv"></span><span class="ps-lbl ps-hand"></span></div>
</aside>
</div>
</div>
</section>`
}

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const notes = []
  const sec = section(c)
  const css = readFileSync(join(KIT, 'process.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- How It Works kit: paste this where the section belongs. It brings its own fonts, styles and script; every class starts with ps-. -->
${fonts}
<style>${css}</style>
${sec}
<script>${js}</script>
`
  const t = c.theme
  const d = DISPLAYS[t.display ?? 'newsreader']
  const dark = lum(t.page) < 0.2
  const foot = mix(t.page, dark ? '#000000' : t.ink, dark ? 0.4 : 0.06)
  const pageCss = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{-webkit-text-size-adjust:100%}body{background:${t.page};color:${t.ink};overflow-x:hidden}
.pg-nav{max-width:1288px;margin:0 auto;padding:22px 24px;display:flex;justify-content:space-between;align-items:center;font:500 16px/1 ${d.text};border-bottom:1px solid rgba(${rgb(t.ink)},.12)}
.pg-nav b{font:${d.weight} 22px/1 ${d.family};letter-spacing:${d.track}}
.pg-nav nav{display:flex;gap:26px;color:${soften(t.ink, t.page, 5.2)}}.pg-nav nav span[aria-current]{color:${t.ink}}
.pg-foot{background:${foot};color:${soften(t.ink, foot, 5.2)};padding:28px 24px calc(28px + env(safe-area-inset-bottom));font:400 15px/1.5 ${d.text}}
.pg-foot div{max-width:1240px;margin:0 auto}
@media (max-width:699px){.pg-nav{padding:18px 16px}.pg-nav nav span:not([aria-current]){display:none}.pg-foot{font-size:16px;padding-left:16px;padding-right:16px}}`
  const html = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.brand)} · ${esc(c.demo?.title ?? 'How it works')}</title>
<meta name="description" content="${esc(c.eyebrow)}">
${fonts}
<style>${pageCss}</style>
<style>${css}</style>
</head>
<body>
<header class="pg-nav"><b>${esc(c.brand)}</b><nav aria-label="Demo"><span>${esc(c.demo?.nav?.[0] ?? 'Work')}</span><span aria-current="page">${esc(c.demo?.title ?? 'How it works')}</span><span>${esc(c.demo?.nav?.[1] ?? 'Contact')}</span></nav></header>
<main>
${sec}
</main>
<footer class="pg-foot"><div>${esc(c.demo?.footer ?? `© ${c.brand}`)}</div></footer>
<script>${js}</script>
</body>
</html>
`
  return { html, embed, notes }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) { console.log('usage: node scripts/build.mjs process.json [out]'); process.exit(1) }
  let c
  try { c = JSON.parse(readFileSync(input, 'utf8')) } catch (e) { console.error(`${input}: ${e.message}`); process.exit(1) }
  const r = build(c)
  if (r.problems) {
    console.error(`${input}: ${r.problems.length} problem${r.problems.length > 1 ? 's' : ''}, nothing written:`)
    for (const p of r.problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), r.html)
  writeFileSync(join(outDir, 'process-embed.html'), r.embed)
  for (const x of r.notes) console.log(`note: ${x}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'process-embed.html'))}`)
}
