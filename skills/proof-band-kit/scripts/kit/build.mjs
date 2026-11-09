// Proof Band Kit: builds proof.json into
//   out/index.html        the band under a short hero (to look at, check and record)
//   out/proof-embed.html  the band alone, to paste in under your hero
//
//   node scripts/build.mjs proof.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MARKER, PRESETS, contrast, mix, rgb, soften, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')
/** _turn_ and [n] note markers */
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(MARKER, (_, n) => `<sup class="pb-ref"><a href="#pb-n${n}" aria-label="Note ${n}">${n}</a></sup>`)

export function tokens(c) {
  const pr = PRESETS[c.theme.preset]
  const page = c.theme.page ?? pr.page, ink = c.theme.ink ?? pr.ink, accent = c.theme.accent ?? pr.accent
  const dark = contrast(page, '#000000') < contrast(page, '#ffffff')
  const v = {
    '--page': page, '--ink': ink,
    '--ink2': soften(ink, page, 8),
    '--muted': soften(ink, page, 4.9),
    '--rule': mix(page, ink, dark ? 0.15 : 0.16),
    '--rule-ink': dark ? mix(page, ink, 0.55) : ink,
    '--mark': mix(ink, page, dark ? 0.16 : 0.1),
    '--accent': accent,
    '--accent-soft': `rgba(${rgb(accent)},.14)`,
    '--cell-open': mix(page, ink, dark ? 0.05 : 0.045),
    '--display': pr.display, '--ui': pr.ui, '--mono': pr.mono,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

/** The buyer's SVG, cleaned and named: no prolog or comments, one colour unless keepColour, a role and a label. */
function logo(svg, m) {
  let s = svg.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '').trim()
  const vb = /viewBox\s*=\s*"([^"]+)"/.exec(s)[1].trim().split(/[\s,]+/).map(Number)
  const frac = m.baseline ?? Number((/data-baseline\s*=\s*"([^"]+)"/.exec(s) || [])[1] || 1)
  const base = vb[1] + frac * vb[3]
  const open = /<svg\b[^>]*>/.exec(s)[0]
  let attrs = open.replace(/^<svg\b/, '').replace(/>$/, '').replace(/\s(width|height|role|aria-label|aria-hidden|focusable|class|style|data-baseline)\s*=\s*"[^"]*"/g, '')
  if (!/xmlns=/.test(attrs)) attrs += ' xmlns="http://www.w3.org/2000/svg"'
  const h = 28, w = Math.round((vb[2] / vb[3]) * h)
  s = s.replace(open, `<svg${attrs} width="${w}" height="${h}" role="img" aria-label="${esc(m.name)}" focusable="false" data-vb="${vb.join(' ')}" data-base="${Math.round(base * 1000) / 1000}"><title>${esc(m.name)}</title>`)
  if (!m.keepColour) s = s.replace(/\s(fill|stroke)\s*=\s*"(?!none)[^"]*"/g, ' $1="currentColor"').replace(/(fill|stroke)\s*:\s*(?!none)[^;"]+/g, '$1:currentColor')
  return s
}

function stat(s, i) {
  return `<div class="pb-stat" data-e="fig" id="pb-f${s.note}-${i}">
  <dt class="pb-label">${esc(s.label)}</dt>
  <dd class="pb-fig" aria-describedby="pb-n${s.note}"><span class="pb-v">${s.prefix ? `<span class="pb-pre">${esc(s.prefix)}</span>` : ''}${esc(s.value)}${s.unit ? `<span class="pb-u">${esc(s.unit)}</span>` : ''}</span><sup class="pb-ref" data-e="ref"><a href="#pb-n${s.note}" aria-label="Note ${s.note}: basis, source and date">${s.note}</a></sup></dd>
</div>`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}` }

function notesBlock(c) {
  const first = {}
  c.stats.forEach((s, i) => { first[s.note] ??= `pb-f${s.note}-${i}` })
  const items = c.notes.map((n, i) => {
    const k = i + 1
    const back = first[k] ? ` <a class="pb-back" href="#${first[k]}" aria-label="Back to the figure">↑</a>` : ''
    return `<li id="pb-n${k}"><b aria-hidden="true">${k}</b><span>${esc(n.basis)}${back}<span class="pb-src">Source: <span>${esc(n.source)}</span><br>As of <time datetime="${n.asOf}">${fmtDate(n.asOf)}</time></span></span></li>`
  }).join('')
  return `<footer class="pb-notes" data-e="notes"><i class="pb-ln pb-ln-ink" data-e="rule" aria-hidden="true"></i><h3 class="pb-lbl">${esc(c.notesHead ?? 'Notes')}</h3><ol>${items}</ol></footer>`
}

function markItem(m, i, c, svg, run) {
  const href = m.href ? `<a href="${esc(m.href)}"${ext(m.href)}>Read the case <span aria-hidden="true">→</span></a>` : ''
  const sector = !run && m.sector ? `<span class="pb-sector pb-lbl">${esc(m.sector)}</span>` : ''
  const ctl = run ? 'pb-cap' : `pb-use-${i}`
  return `<li class="pb-mark" data-i="${i}" data-e="mark" data-align="${m.align ?? 'baseline'}">${sector}<button class="pb-btn" type="button" aria-expanded="false" aria-controls="${ctl}"><span class="pb-logo">${logo(svg, m)}</span></button><p class="pb-use" id="pb-use-${i}"><span class="pb-use-t">${esc(m.use)}</span> ${href}</p></li>`
}

export function build(c, { dir = '.', now } = {}) {
  const v = validate(c, { dir, now })
  if (v.problems.length) return { problems: v.problems }
  const run = c.layout !== 'grid'
  const marks = `<ul class="pb-marks" role="list">${c.marks.map((m, i) => markItem(m, i, c, v.svgs[i], run)).join('')}</ul>`
  const eyebrow = `<p class="pb-eyebrow pb-lbl"><span>${rich(c.eyebrow[0])}</span><i class="pb-ln" data-e="rule" aria-hidden="true"></i>${c.eyebrow[1] ? `<span class="pb-eb-r">${rich(c.eyebrow[1])}</span>` : ''}</p>`
  const head = `${eyebrow}<h2 class="pb-statement" id="pb-h">${rich(c.statement)}</h2>`
  const stats = `<dl class="pb-stats">${c.stats.map(stat).join('')}</dl>`
  const caption = `<p class="pb-caption" id="pb-cap" aria-live="polite"><span class="pb-cap-k pb-lbl">${esc(c.captionLabel ?? 'What they use it for')}</span><span class="pb-cap-t" data-hint="${esc(c.captionHint ?? 'Select a name to see what they use it for.')}">${esc(c.captionHint ?? 'Select a name to see what they use it for.')}</span></p>`
  const pause = c.marquee ? `<button class="pb-pause" type="button" aria-pressed="false" hidden><span class="pb-pause-i" aria-hidden="true"></span><span class="pb-pause-t">Pause</span></button>` : ''
  const runBlock = `<div class="pb-run">${c.runLabel ? `<h3 class="pb-run-h pb-lbl">${esc(c.runLabel)}</h3>` : ''}<div class="pb-runbox"><i class="pb-ln pb-ln-ink" data-e="rule" aria-hidden="true"></i><div class="pb-viewport">${marks}</div></div><div class="pb-capline">${caption}${pause}</div></div>`
  let body
  if (c.layout === 'grid') body = `${head}<div class="pb-gridbox"><i class="pb-ln pb-ln-ink" data-e="rule" aria-hidden="true"></i>${marks}<i class="pb-ln pb-ln-ink pb-ln-b" data-e="rule" aria-hidden="true"></i></div>${stats}${notesBlock(c)}`
  else if (c.layout === 'figures') body = `${head}<div class="pb-statsbox"><i class="pb-ln pb-ln-ink" data-e="rule" aria-hidden="true"></i>${stats}</div>${runBlock}${notesBlock(c)}`
  else body = `${head}${runBlock}${stats}${notesBlock(c)}`

  const cfg = {
    layout: c.layout,
    columns: c.columns ?? 4,
    balance: { area: 3300, densityWeight: 0.5, maxHeight: 54, ...(c.balance ?? {}) },
    marquee: c.marquee ?? null,
    open: c.preview?.open ?? [1, 3],
    marks: c.marks.map((m) => ({ name: m.name, use: m.use, href: m.href ?? null })),
  }
  const pr = PRESETS[c.theme.preset]
  const section = `<section class="pb pb-L-${c.layout} pb-T-${c.theme.preset}" aria-labelledby="pb-h" style="${tokens(c)}" data-pb='${JSON.stringify(cfg).replace(/'/g, '&#39;').replace(/</g, '\\u003c')}'>
<div class="pb-in">
${body}
</div>
</section>`
  const css = readFileSync(join(KIT, 'proof.css'), 'utf8')
  const js = readFileSync(join(KIT, 'balance.js'), 'utf8') + ';\n' + readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>\n${pr.fonts.map(([href, sri]) => `<link rel="stylesheet" href="${href}" integrity="${sri}" crossorigin="anonymous">`).join('\n')}`
  const embed = `<!-- Proof Band Kit: paste this under your hero. It brings its own fonts, styles and script; every class starts with pb-. -->
${fonts}
<style>${css}</style>
${section}
<script>${js}</script>
`
  const d = c.demo ?? {}
  const nav = (d.nav ?? []).map((l) => `<a href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a>`).join('')
  const hero = `<header class="pg-hero">
  <nav class="pg-nav"><span class="pg-brand">${esc(c.brand)}</span><span class="pg-links">${nav}</span></nav>
  <div class="pg-hero-in"><h1>${esc(d.headline ?? c.brand)}</h1>${d.lede ? `<p>${esc(d.lede)}</p>` : ''}${d.cta ? `<a class="pg-cta" href="${esc(d.cta.href)}"${ext(d.cta.href)}>${esc(d.cta.label)} <span aria-hidden="true">→</span></a>` : ''}</div>
</header>`
  const html = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.brand)}</title>
<meta name="description" content="${esc(c.statement.replace(/_/g, '').replace(MARKER, ''))}">
${fonts}
<style>${css}</style>
</head>
<body class="pg pg-T-${c.theme.preset}" style="${tokens(c)}">
${hero}
<main>
${section}
</main>
<footer class="pg-foot"><div>${esc(d.footer ?? `© ${c.brand}`)}</div></footer>
<script>${js}</script>
</body>
</html>
`
  return { html, embed, warnings: v.warnings }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs proof.json [out]')
    process.exit(1)
  }
  let c
  try {
    c = JSON.parse(readFileSync(input, 'utf8'))
  } catch (e) {
    console.error(`${input}: ${e.message}`)
    process.exit(1)
  }
  const r = build(c, { dir: dirname(resolve(input)) })
  if (r.problems) {
    console.error(`${input}: ${r.problems.length} problem${r.problems.length > 1 ? 's' : ''}, nothing written:`)
    for (const p of r.problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), r.html)
  writeFileSync(join(outDir, 'proof-embed.html'), r.embed)
  for (const w of r.warnings) console.log(`warning: ${w}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'proof-embed.html'))}`)
}
