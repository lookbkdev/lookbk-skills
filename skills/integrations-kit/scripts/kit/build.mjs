// Integrations kit: builds integrations.json into
//   out/index.html               the section on a short demo page (to look at, check and record)
//   out/integrations-embed.html  the section alone, to paste into a page
//
//   node scripts/build.mjs integrations.json out
//
// The page is written so it reads without JavaScript: the directory and the
// not-supported list are plain HTML, and every integration's wiring is a
// static table inside <details>. The runtime then draws the wiring diagram
// for the chosen app, runs the packets, and turns on search and filters.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, SPEED, STATUSES, TIERS, contrast, derive, fill, lum, mix, rgb, soften, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')

/** An app's mark: one geometric shape and one cut, drawn in code. Never a real logo. */
export function mark(m, size = 30) {
  const c = m.color, k = m.ink
  const shape = {
    circle: `<circle cx="15" cy="15" r="14" fill="${c}"/>`,
    square: `<rect x="1" y="1" width="28" height="28" rx="7" fill="${c}"/>`,
    hex: `<path d="M15 1 27.1 8v14L15 29 2.9 22V8z" fill="${c}"/>`,
    diamond: `<rect x="5" y="5" width="20" height="20" rx="3" transform="rotate(45 15 15)" fill="${c}"/>`,
    tri: `<path d="M15 2 28.5 27H1.5z" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,
    pill: `<rect x="1" y="7" width="28" height="16" rx="8" fill="${c}"/>`,
  }[m.shape]
  const st = `stroke="${k}" stroke-width="2.6" stroke-linecap="round" fill="none"`
  const cut = {
    bar: `<path d="M9 15h12" ${st}/>`,
    bars: `<path d="M10 11.5h10M10 18.5h10" ${st}/>`,
    dot: `<circle cx="15" cy="${m.shape === 'tri' ? 19 : 15}" r="3.6" fill="${k}"/>`,
    ring: `<circle cx="15" cy="15" r="5.6" ${st}/>`,
    slash: `<path d="M11 20 19 10" ${st}/>`,
    chev: `<path d="M10 17.5l5-5 5 5" ${st}/>`,
    cross: `<path d="M15 9.5v11M9.5 15h11" ${st}/>`,
    half: `<path d="M15 ${m.shape === 'pill' ? 7 : 3}v${m.shape === 'pill' ? 16 : 24}" stroke="${k}" stroke-width="2.6"/>`,
  }[m.cut]
  return `<svg class="ik-mk" width="${size}" height="${size}" viewBox="0 0 30 30" aria-hidden="true" focusable="false">${shape}${cut}</svg>`
}

export function tokens(c) {
  const t = c.theme
  const d = DISPLAYS[t.display ?? 'newsreader']
  const dark = lum(t.page) < 0.2
  const both = [t.page, t.surface]
  const v = {
    '--ik-page': t.page, '--ik-surface': t.surface, '--ik-ink': t.ink,
    '--ik-mute': soften(t.ink, t.page, 5.4, both),
    '--ik-rule': `rgba(${rgb(t.ink)},${dark ? 0.15 : 0.14})`,
    // lines that carry meaning (node frames, chip outlines, the hatch) hold 3:1
    '--ik-line': soften(t.ink, t.page, 3.2, both),
    '--ik-wire': soften(t.ink, t.page, 7, both),
    '--ik-btn': dark ? t.accent : t.ink, '--ik-btn-ink': dark ? t.onAccent : t.page,
    '--ik-accent': t.accent, '--ik-on-accent': t.onAccent, '--ik-packet': t.packet,
    '--ik-native': t.status.native, '--ik-webhook': t.status.webhook, '--ik-community': t.status.community, '--ik-coming': t.status.coming,
    '--ik-tint': mix(t.page, t.accent, dark ? 0.08 : 0.06),
    '--ik-display': d.family, '--ik-display-w': d.weight, '--ik-display-track': d.track, '--ik-display-wdth': d.wdth, '--ik-em': d.em, '--ik-caps': d.caps,
    '--ik-text': d.text, '--ik-mono': d.mono,
  }
  return esc(Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';'))
}
const fontsHref = (c) => `https://fonts.googleapis.com/css2?${DISPLAYS[c.theme.display ?? 'newsreader'].google.join('&')}&display=swap`

const chip = (s) => `<span class="ik-chip ik-s-${s}"><i aria-hidden="true"></i>${STATUSES[s]}</span>`
const arrows = { in: '←', out: '→', both: '↔' }
const dirWords = (dir, brand, app) => dir === 'in' ? `${app} to ${brand}` : dir === 'out' ? `${brand} to ${app}` : 'Both ways'

/** One app's wiring as a table: what the diagram says, in words. Shown without JavaScript. */
function staticWiring(a, brand) {
  const rows = a.flows.map((f) => `<tr><th scope="row">${esc(f.record)}</th><td>${esc(dirWords(f.dir, brand, a.name))}</td><td>${esc(f.when)}</td><td>${esc(f.theirs)}</td><td>${esc(f.ours)}</td></tr>`).join('')
  const stays = a.stays.length ? `<p class="ik-st-stays"><b>Stays in ${esc(a.name)}:</b> ${a.stays.map((s) => `${esc(s.record)} (${esc(s.why)})`).join('; ')}.</p>` : ''
  const setup = a.setup.length
    ? `<ol class="ik-st-setup">${a.setup.map((s) => `<li>${esc(s.step)} <span class="ik-lbl">${s.minutes} min · ${s.who === 'you' ? 'you' : 'us'}</span></li>`).join('')}</ol>`
    : `<p class="ik-st-stays">${esc(a.eta)}</p>`
  return `<details class="ik-st"${a.id === undefined ? '' : ` id="ik-st-${esc(a.id)}"`}><summary>${mark(a.mark, 26)}<span>${esc(a.name)}</span>${chip(a.status)}</summary>
<div class="ik-st-body"><table class="ik-st-t"><caption class="ik-sr">What crosses between ${esc(brand)} and ${esc(a.name)}</caption><thead><tr><th scope="col">Record</th><th scope="col">Direction</th><th scope="col">When</th><th scope="col">In ${esc(a.name)}</th><th scope="col">In ${esc(brand)}</th></tr></thead><tbody>${rows}</tbody></table>${stays}${setup}</div></details>`
}

function section(c) {
  const D = derive(c)
  const brand = c.brand
  const byId = Object.fromEntries(D.apps.map((a) => [a.id, a]))
  const sel = c.selected ?? c.featured[0]
  const facts = [
    ['Integrations', D.stated.integrations, ''],
    ['Native, built by us', D.stated.native, ''],
    ['We don’t support', D.stated.unsupported, '<small>listed below</small>'],
  ].map(([k, n, x]) => `<div><dt class="ik-lbl">${k}</dt><dd><b>${n}</b>${x}</dd></div>`).join('')

  // directory rows
  const rows = D.apps.map((a) => {
    const q = [a.name, a.summary, a.category, STATUSES[a.status], ...a.flows.flatMap((f) => [f.record, f.theirs, f.ours]), ...a.stays.map((s) => s.record)].join(' ').toLowerCase()
    const flow = a.status === 'coming' ? '<span class="ik-dim">planned</span>' : `<span title="records into ${esc(brand)}">← ${a.nIn}</span> <span title="records out of ${esc(brand)}">→ ${a.nOut}</span>`
    const mins = a.status === 'coming' ? '<span class="ik-dim">not yet</span>' : `${a.you} min`
    return `<tr class="ik-row" data-id="${esc(a.id)}" data-cat="${esc(a.category)}" data-status="${a.status}" data-q="${esc(q)}">
<td class="ik-c-app"><span class="ik-c-mk">${mark(a.mark)}</span><span class="ik-c-nm">${esc(a.name)}</span><span class="ik-c-sum">${esc(a.summary)}${a.status === 'coming' ? ` ${esc(a.eta)}.` : ''}</span></td>
<td class="ik-c-cat">${esc(a.category)}</td><td class="ik-c-fl">${flow}</td><td class="ik-c-tm">${mins}</td><td class="ik-c-st">${chip(a.status)}</td>
<td class="ik-c-go"><a class="ik-go" href="#ik-st-${esc(a.id)}" data-app="${esc(a.id)}" aria-label="Show the wiring for ${esc(a.name)}">Wiring<span aria-hidden="true"> ↑</span></a></td></tr>`
  }).join('\n')

  const catChips = [`<button type="button" class="ik-f" data-cat="" aria-pressed="true">All <small data-n>${D.stated.integrations}</small></button>`, ...c.categories.map((k) => `<button type="button" class="ik-f" data-cat="${esc(k)}" aria-pressed="false">${esc(k)} <small data-n>${D.byCat[k]}</small></button>`)].join('')
  const stChips = Object.keys(STATUSES).map((s) => `<button type="button" class="ik-f ik-fs ik-s-${s}" data-status="${s}" aria-pressed="false"><i aria-hidden="true"></i>${STATUSES[s]} <small data-n>${D.stated[s]}</small></button>`).join('')
  const noIcon = `<svg class="ik-no-i" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true"><line x1="1" x2="9" y1="11" y2="11"/><circle cx="9" cy="11" r="2.2" class="f"/><line x1="9" x2="18" y1="11" y2="3"/><circle cx="20" cy="11" r="2.2"/></svg>`
  const unsupported = c.unsupported.map((u) => `<li data-k="${esc([u.what, ...(u.keywords ?? [])].join(' ').toLowerCase())}">${noIcon}<b>${esc(u.what)}</b><span class="ik-why">${esc(u.why)}<strong>${esc(u.instead)}</strong></span></li>`).join('')

  // what the runtime needs
  const data = {
    brand, mark: mark(c.mark, 26), markL: mark(c.mark, 30), featured: c.featured, selected: sel,
    cta: c.cta, request: c.request, speed: SPEED, tiers: TIERS.map((t) => ({ upTo: t.upTo === Infinity ? null : t.upTo, interval: t.interval })),
    apps: D.apps.map((a) => ({
      id: a.id, name: a.name, category: a.category, status: a.status, summary: a.summary, eta: a.eta, by: a.by, plans: a.plans, conflict: a.conflict, log: a.log,
      mk: mark(a.mark, 30), mkS: mark(a.mark, 26), mkL: mark(a.mark, 44), nIn: a.nIn, nOut: a.nOut, you: a.you, us: a.us,
      flows: a.flows.map((f) => ({ record: f.record, dir: f.dir, when: f.when, theirs: f.theirs, ours: f.ours, seconds: f.seconds, interval: f.interval })),
      stays: a.stays, setup: a.setup,
    })),
    unsupported: c.unsupported.map((u) => ({ what: u.what, why: u.why, instead: u.instead, k: [u.what, ...(u.keywords ?? [])].join(' ').toLowerCase(), kw: (u.keywords?.[0] ?? u.what.split(' ').find((w) => w.length > 3) ?? u.what).toLowerCase() })),
  }
  const rail = c.featured.map((id) => { const a = byId[id]; return `<button type="button" class="ik-tab" role="tab" id="ik-tab-${esc(id)}" data-app="${esc(id)}" aria-selected="${id === sel}" aria-controls="ik-stage" tabindex="${id === sel ? 0 : -1}"><span class="ik-tab-mk">${mark(a.mark)}</span><span class="ik-tab-nm">${esc(a.name)}</span><span class="ik-tab-ct">${esc(a.category)}</span></button>` }).join('')
  const key = `<div class="ik-key" aria-hidden="true"><p class="ik-lbl">How to read it</p>
<p><svg width="44" height="12" viewBox="0 0 44 12"><line x1="0" x2="44" y1="6" y2="6" class="w"/><rect x="14" y="2.5" width="16" height="7" rx="3.5" class="p"/></svg><span>a record crossing, the way the arrow points</span></p>
<p><svg width="44" height="16" viewBox="0 0 44 16"><line x1="44" x2="24" y1="12" y2="12" class="m"/><line x1="24" x2="10" y1="12" y2="2" class="m"/><circle cx="24" cy="12" r="2.4" class="mf"/><circle cx="8" cy="12" r="2.4" class="mo"/></svg><span>an open switch: this never crosses</span></p>
<p><svg width="44" height="12" viewBox="0 0 44 12"><rect x="0" y="2" width="20" height="8" class="y"/><rect x="23.5" y="2.5" width="20" height="7" class="h"/></svg><span>your minutes, then ours</span></p></div>`

  return `<section class="ik" aria-labelledby="ik-h" style="${tokens(c)}" data-ik='${JSON.stringify(data).replace(/&/g, '&amp;').replace(/'/g, '&#39;')}'>
<div class="ik-wrap">
<header class="ik-head">
<div><p class="ik-eyebrow ik-lbl">${esc(fill(c.eyebrow, D))}</p><h2 class="ik-h" id="ik-h">${rich(fill(c.headline, D))}</h2>${c.lede ? `<p class="ik-lede">${esc(fill(c.lede, D))}</p>` : ''}</div>
<dl class="ik-facts">${facts}</dl>
</header>
<div class="ik-panel" id="ik-panel">
<div class="ik-railcol"><p class="ik-lbl ik-rail-h" id="ik-rail-h">Choose one to see the wiring</p><div class="ik-rail" role="tablist" aria-labelledby="ik-rail-h" aria-orientation="vertical">${rail}</div>
<p class="ik-more"><a href="#ik-dir">${D.stated.integrations - c.featured.length} more in the directory<span aria-hidden="true"> ↓</span></a></p>${key}</div>
<div class="ik-stage" id="ik-stage" role="tabpanel" aria-labelledby="ik-tab-${esc(sel)}" tabindex="-1"></div>
<div class="ik-static"><p class="ik-lbl">What crosses, integration by integration</p>${D.apps.map((a) => staticWiring(a, brand)).join('\n')}</div>
</div>
<section class="ik-dir" id="ik-dir" aria-labelledby="ik-dir-h">
<div class="ik-dh"><h2 class="ik-h2" id="ik-dir-h">All ${D.stated.integrations} integrations</h2>
<div class="ik-search" hidden><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5"/><path d="M11.6 11.6 16 16"/></svg><input type="search" id="ik-q" placeholder="Search by app, record or category" aria-label="Search integrations" autocomplete="off" spellcheck="false"></div></div>
<div class="ik-filters" hidden><div class="ik-fg" role="group" aria-label="Category">${catChips}</div><div class="ik-fg" role="group" aria-label="Status">${stChips}</div></div>
<p class="ik-live ik-lbl" aria-live="polite" hidden></p>
<table class="ik-table"><caption class="ik-sr">Every integration: category, records in and out of ${esc(brand)}, your setup time and status</caption>
<thead><tr><th scope="col">App</th><th scope="col">Category</th><th scope="col">In · out</th><th scope="col">Your time</th><th scope="col">Status</th><th scope="col"><span class="ik-sr">Wiring</span></th></tr></thead>
<tbody>
${rows}
</tbody></table>
<div class="ik-empty" hidden></div>
</section>
<section class="ik-no" id="ik-no" aria-labelledby="ik-no-h">
<div><h2 class="ik-h3" id="ik-no-h">Not supported, and what to do instead</h2><p class="ik-no-l">We would rather say no here than have you find out after connecting.</p><p class="ik-no-r"><a href="${esc(c.request.href)}">${esc(c.request.label)}</a></p></div>
<ul>${unsupported}</ul>
</section>
</div>
</section>`
}

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const sec = section(c)
  const css = readFileSync(join(KIT, 'integrations.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- Integrations kit: paste this where the section belongs. It brings its own fonts, styles and script; every class starts with ik-. -->
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
.pg-nav b{display:flex;gap:12px;align-items:center;font:${d.weight} 22px/1 ${d.family};letter-spacing:${d.track};text-transform:${d.caps};font-variation-settings:${d.wdth}}
.pg-nav nav{display:flex;gap:26px;color:${soften(t.ink, t.page, 5.4)}}.pg-nav nav span[aria-current]{color:${t.ink}}
.pg-foot{background:${foot};color:${soften(t.ink, foot, 5.4)};padding:28px 24px calc(28px + env(safe-area-inset-bottom));font:400 15px/1.5 ${d.text}}
.pg-foot div{max-width:1240px;margin:0 auto}
@media (max-width:699px){.pg-nav{padding:18px 16px}.pg-nav nav span:not([aria-current]){display:none}.pg-foot{font-size:16px;padding-left:16px;padding-right:16px}}`
  const html = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.brand)} · ${esc(c.demo?.title ?? 'Integrations')}</title>
<meta name="description" content="${esc(fill(c.eyebrow, derive(c)))}">
${fonts}
<style>${pageCss}</style>
<style>${css}</style>
</head>
<body>
<header class="pg-nav"><b>${mark(c.mark, 26)}${esc(c.brand)}</b><nav aria-label="Demo"><span>${esc(c.demo?.nav?.[0] ?? 'Pricing')}</span><span aria-current="page">${esc(c.demo?.title ?? 'Integrations')}</span><span>${esc(c.demo?.nav?.[1] ?? 'Help')}</span></nav></header>
<main>
${sec}
</main>
<footer class="pg-foot"><div>${esc(c.demo?.footer ?? `© ${c.brand}`)}</div></footer>
<script>${js}</script>
</body>
</html>
`
  return { html, embed, notes: [] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv
  if (!input) { console.log('usage: node scripts/build.mjs integrations.json [out]'); process.exit(1) }
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
  writeFileSync(join(outDir, 'integrations-embed.html'), r.embed)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'integrations-embed.html'))}`)
}
export { contrast }
