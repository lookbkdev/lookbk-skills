// Compare Table Kit: builds compare.json into
//   out/index.html          the section on its own page (to look at, check and record)
//   out/compare-embed.html  the section alone, to paste into a page
//
//   node scripts/build.mjs compare.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, MONOS, TEXTS, contrast, dateText, esc, mix, rgbOf, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

/** _turn_ in a headline, **strong** in a lede */
const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const strong = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
/** darkest/lightest a colour can move towards `to` before it reaches `min` on `bg` */
function toward(c, to, bg, min) {
  for (let t = 0; t <= 1.0001; t += 0.05) { const m = mix(c, to, t); if (contrast(m, bg) >= min) return m }
  return to
}

export function tokens(t, stickyTop = 0) {
  const d = DISPLAYS[t.display]
  const a = (x) => `rgba(${rgbOf(t.ink).join(',')},${x})`
  const v = {
    '--paper': t.paper, '--column': t.column, '--ink': t.ink, '--mute': t.mute,
    '--rule': a(t.mode === 'dark' ? 0.16 : 0.15), '--rule2': a(t.mode === 'dark' ? 0.34 : 0.32),
    '--us': t.us, '--on-us': t.onUs, '--them': t.them, '--wash': t.themWash,
    '--shade': t.mode === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(40,30,10,.16)',
    '--print-us': toward(t.us, '#000000', '#ffffff', 4.5), '--print-them': toward(t.them, '#000000', '#ffffff', 4.5),
    '--display': d.family, '--d-weight': d.weight, '--d-track': d.track, '--d-lead': d.lead, '--turn-style': d.turn,
    '--text': TEXTS[t.text].family, '--mono': MONOS[t.mono].family, '--ct-top': `${stickyTop}px`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
export const fontsHref = (t) => `https://fonts.googleapis.com/css2?${[DISPLAYS[t.display].google, TEXTS[t.text].google, MONOS[t.mono].google].join('&')}&display=swap`

function verdictOf(c, r) {
  const p = c.product.id
  const called = (id) => (id === p ? c.product.name : c.alternatives.find((a) => a.id === id).called)
  if (typeof r.verdict === 'string') return r.verdict === p ? { kind: 'us', ids: [p], text: `Ahead: ${called(p)}` } : { kind: 'them', ids: [r.verdict], text: `Ahead: ${called(r.verdict)}` }
  return { kind: 'level', ids: r.verdict.level, text: `Level: ${r.verdict.level.map(called).join(' and ')}` }
}

export function sectionHTML(c) {
  const p = c.product, S = new Map(c.sources.map((s) => [s.id, s])), n = c.alternatives.length
  const T = c.tally
  const sq = (k) => `<i class="ct-sq" aria-hidden="true"></i>`
  const markText = (s) => (s.estimate ? 'est' : String(s.n))
  const asOf = (s) => (s.period ? `Fieldwork ${esc(s.period)}` : `As of ${dateText(s.asOf)}`)
  const mark = (s) => `<button type="button" class="ct-m${s.estimate ? ' is-est' : ''}" data-s="${s.n}" aria-haspopup="dialog" aria-expanded="false" aria-label="${s.estimate ? 'Our estimate' : `Source ${s.n}`}: ${esc(s.label)}, ${asOf(s)}">${markText(s)}</button>`
  /** the fact with its mark glued to the last word, so the mark never wraps alone */
  const fact = (cell) => {
    const s = S.get(cell.source)
    const words = cell.fact.trim().split(/\s+/), last = words.pop()
    const lead = words.length ? `<span class="ct-u">${esc(words.join(' '))} </span>` : ''
    return `<span class="ct-f">${lead}<span class="ct-nb"><span class="ct-u">${esc(last)}</span>\u2060<sup>${mark(s)}</sup></span></span>`
  }
  const cellHTML = (r, id, v) => {
    const cell = r.cells[id], us = id === p.id
    const win = v.kind !== 'level' && v.ids[0] === id, lvl = v.kind === 'level' && v.ids.includes(id)
    return `<div class="ct-c ${us ? 'is-us' : 'is-alt'}${win ? ' win' : ''}${lvl ? ' lvl' : ''}" role="cell" data-col="${esc(id)}"><p class="ct-cf">${fact(cell)}</p>${cell.note ? `<p class="ct-n">${esc(cell.note)}</p>` : ''}${win ? `<span class="ct-sr"> (ahead on this row)</span>` : lvl ? `<span class="ct-sr"> (level on this row)</span>` : ''}</div>`
  }
  const verdictHTML = (v, extra = '') => `<p class="ct-v is-${v.kind}">${sq()}<span>${esc(v.text)}${extra}</span></p>`
  const [e1, e2, e3] = c.head.eyebrow
  const head = `<header class="ct-head">
  <div class="ct-hl">
    <p class="ct-eyebrow"><span>${esc(e1)}</span>${e2 ? `<span>${esc(e2)}</span>` : ''}${e3 ? `<span class="x3">${esc(e3)}</span>` : ''}</p>
    <h2 class="ct-h" id="ct-title">${turn(c.head.headline)}</h2>
  </div>
  <div class="ct-hr">
    <p class="ct-lede">${strong(c.head.lede)}</p>
    <p class="ct-sr">Across ${T.rows} rows, ${esc(p.name)} is ahead on ${T.ahead}, level on ${T.level}, and something else is ahead on ${T.behind}.</p>
    <div class="ct-tally" aria-hidden="true">
      <p class="is-us"><b>${T.ahead}<small>of ${T.rows}</small></b><span>${sq()}${esc(p.name)} ahead</span></p>
      <p class="is-level"><b>${T.level}</b><span>${sq()}Level</span></p>
      <p class="is-them"><b>${T.behind}</b><span>${sq()}Something else ahead</span></p>
    </div>
  </div>
</header>`

  // desktop and tablet: one board, its head row sticks, the product column sticks on the left when it scrolls
  const colHead = (col) => `<div class="ct-ch ${col.isUs ? 'is-us' : 'is-alt'}" role="columnheader"><span class="ct-kind">${col.isUs ? 'Us' : esc(col.kindText)}</span><span class="ct-nm">${esc(col.name)}</span><span class="ct-ds">${esc(col.desc)}</span></div>`
  let rows = ''
  c.groups.forEach((g, gi) => {
    rows += `<div class="ct-gh" role="row" data-g="${gi}"><div class="ct-ghi" role="columnheader" aria-colspan="${n + 2}"><span class="ct-no" aria-hidden="true">${String(gi + 1).padStart(2, '0')}</span><div><h3>${esc(g.question)}</h3><p class="ct-as"><b>Assumes</b> ${esc(g.assumes)}</p></div></div></div>`
    g.rows.forEach((r, ri) => {
      const v = verdictOf(c, r)
      rows += `<div class="ct-r" role="row" data-g="${gi}" data-v="${v.kind}"><div class="ct-rl" role="rowheader"><div class="ct-rli"><p class="ct-q">${esc(r.label)}</p>${verdictHTML(v)}</div></div>${c.cols.map((col) => cellHTML(r, col.id, v)).join('')}</div>`
    })
  })
  const pickWho = (col) => `Pick ${col.isUs ? esc(col.name) : esc(col.called)} if`
  rows += `<div class="ct-gh ct-pkh" role="row"><div class="ct-ghi" role="columnheader" aria-colspan="${n + 2}"><span class="ct-no" aria-hidden="true"></span><div><h3>Who should pick the other one</h3><p class="ct-as">Each column\u2019s best case, in a sentence.</p></div></div></div>`
  rows += `<div class="ct-r ct-picks" role="row"><div class="ct-rl" role="rowheader"><div class="ct-rli"><p class="ct-q">Best for</p></div></div>${c.cols.map((col) => `<div class="ct-pk ${col.isUs ? 'is-us' : 'is-alt'}" role="cell"><p class="ct-who">${pickWho(col)}</p><p>${esc(c.picks[col.id])}</p>${col.isUs ? `<a class="ct-cta" href="${esc(c.cta.href)}">${esc(c.cta.label)}<span aria-hidden="true">\u2192</span></a>` : ''}</div>`).join('')}</div>`
  const board = `<div class="ct-board" role="table" aria-label="${esc(p.name)} compared with ${c.alternatives.length} alternatives" aria-describedby="ct-sources-h" style="--n:${n}">
  <div class="ct-headbar" role="rowgroup"><div class="ct-grid" role="row"><div class="ct-ch ct-lab" role="columnheader"><span>${T.rows} questions, grouped by what buyers ask</span></div>${c.cols.map(colHead).join('')}</div></div>
  <div class="ct-scroll" role="rowgroup"><div class="ct-grid ct-body">${rows}</div></div>
</div>`

  // phone: two at a time
  const tabs = c.alternatives.map((a, i) => `<button type="button" role="tab" id="ct-tab-${esc(a.id)}" aria-controls="ct-pane-${esc(a.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">${esc(a.short)}</button>`).join('')
  const panes = c.alternatives.map((a, ai) => {
    let h = `<div class="ct-pane" role="tabpanel" id="ct-pane-${esc(a.id)}" aria-labelledby="ct-tab-${esc(a.id)}" data-i="${ai}">`
    c.groups.forEach((g, gi) => {
      h += `<div class="ct-pg" data-g="${gi}"><h3>${esc(g.question)}</h3><p class="ct-as">${esc(g.assumes)}</p>`
      g.rows.forEach((r) => {
        const v = verdictOf(c, r)
        const onScreen = v.ids.every((id) => id === p.id || id === a.id)
        const vv = onScreen ? v : { ...v, kind: v.kind === 'us' ? 'us' : v.kind }
        h += `<div class="ct-pr" role="group" aria-label="${esc(r.label)}" data-v="${v.kind}"><p class="ct-q">${esc(r.label)}</p>${verdictHTML(vv, onScreen ? '' : ', not shown')}<div class="ct-two">${cellHTML(r, p.id, v)}${cellHTML(r, a.id, v)}</div></div>`
      })
      h += `</div>`
    })
    h += `<div class="ct-pg ct-ppk"><h3>Who should pick which</h3><div class="ct-two">${[c.cols[0], c.cols[ai + 1]].map((col) => `<div class="ct-pk ${col.isUs ? 'is-us' : 'is-alt'}"><p class="ct-who">${pickWho(col)}</p><p>${esc(c.picks[col.id])}</p></div>`).join('')}</div></div></div>`
    return h
  }).join('')
  const a0 = c.alternatives[0]
  const pair = `<div class="ct-pair">
  <p class="ct-pw" id="ct-pw">Compare ${esc(p.name)} with</p>
  <div class="ct-chips" role="tablist" aria-labelledby="ct-pw">${tabs}</div>
  <div class="ct-phead" aria-hidden="true"><div class="is-us"><span>${esc(p.name)}</span><small>Us</small></div><div class="is-alt"><span class="ct-phn">${esc(a0.name)}</span><small class="ct-phk">${esc(KINDTEXT(a0))}</small></div></div>
  <div class="ct-pager" aria-hidden="true"><span class="ct-pgt">1 of ${n} \u00b7 swipe for the next</span><span class="ct-bars">${c.alternatives.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</span></div>
  <div class="ct-track">${panes}</div>
  <p class="ct-pcta"><a class="ct-cta" href="${esc(c.cta.href)}">${esc(c.cta.label)}<span aria-hidden="true">\u2192</span></a></p>
</div>`

  const host = (u) => u.replace(/^https:\/\//, '').replace(/\/$/, '')
  const sources = `<footer class="ct-sources">
  <h3 id="ct-sources-h">Sources</h3>
  <ol>${c.sources.map((s) => `<li id="ct-s-${s.n}" data-s="${s.n}" class="${s.kind === 'own' ? 'is-own' : ''}"><b class="ct-sn">${markText(s)}</b><span class="ct-st"><span class="ct-sk">${esc(s.label)}</span> ${esc(s.text)}. <span class="ct-sd">${asOf(s)}.</span>${s.url ? ` <a class="ct-su" href="${esc(s.url)}" rel="noopener">${esc(host(s.url))}</a>` : ''}</span></li>`).join('')}</ol>
  <p class="ct-method">${esc(c.method)}${c.corrections ? ` Spotted something out of date? Write to <a href="mailto:${esc(c.corrections)}">${esc(c.corrections)}</a> and we will correct it.` : ''}</p>
</footer>`
  const pop = `<div class="ct-pop" role="dialog" aria-modal="false" aria-labelledby="ct-pop-k" tabindex="-1" hidden><p class="ct-pk2" id="ct-pop-k"></p><p class="ct-px"></p><p class="ct-pa"><a class="ct-pl" href="#" rel="noopener" hidden>Open the source</a><button type="button" class="ct-pc">Close</button></p></div>`
  const data = { product: p.id, alts: c.alternatives.map((a) => ({ id: a.id, name: a.name, kind: KINDTEXT(a) })), sources: c.sources.map((s) => ({ n: s.n, id: s.id, kind: s.kind, label: s.label, estimate: !!s.estimate, text: s.text, asOf: asOf(s), url: s.url ?? null })), tally: T }
  return `<section class="ct" style="${esc(tokens(c.theme, c.stickyTop ?? 0))}" data-mode="${c.theme.mode}" aria-labelledby="ct-title">
<script type="application/json" class="ct-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<div class="ct-in">
${head}
${board}
${pair}
${sources}
<p class="ct-live ct-sr" aria-live="polite"></p>
</div>
</section>
<div class="ct-layer" style="${esc(tokens(c.theme, c.stickyTop ?? 0))}">${pop}</div>`
}
const KINDTEXT = (a) => a.kindText ?? { diy: 'Do it yourself', have: 'Already have it', software: 'Software', service: 'Service', nothing: 'Doing nothing' }[a.kind]

export function build(input, outDir, opts = {}) {
  let json
  try { json = JSON.parse(readFileSync(resolve(input), 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [], warnings: [] } }
  const { errors, notes, warnings, c } = validate(json, opts)
  if (errors.length) return { errors, notes, warnings }
  const css = readFileSync(join(KIT, 'compare.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const section = sectionHTML(c)
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.product.name)} compared · ${esc(c.brand)}</title>
<meta name="color-scheme" content="${c.theme.mode}">
${fonts}
<style>
html, body { margin: 0; background: ${c.theme.paper} }
body { overflow-x: clip }
@media print { html, body { background: #fff } }
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
  const embed = `<!-- Compare Table Kit: paste this where the comparison goes. One per page. -->
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
  writeFileSync(join(out, 'compare-embed.html'), embed)
  return { errors, notes, warnings, files: [join(out, 'index.html'), join(out, 'compare-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((x) => !x.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs compare.json [out]')
    process.exit(1)
  }
  const r = build(input, out)
  if (r.warnings?.length) {
    const bar = '!'.repeat(72)
    console.log(`${bar}\n!! WARNING: NAMED COMPETITORS\n${r.warnings.map((w) => `!! ${w}`).join('\n')}\n${bar}`)
  }
  for (const n of r.notes ?? []) console.log(`note: ${n}`)
  if (r.errors.length) {
    console.log(`${r.errors.length} problem${r.errors.length > 1 ? 's' : ''} in ${input}; nothing was written:`)
    for (const e of r.errors) console.log(`  - ${e}`)
    process.exit(1)
  }
  for (const f of r.files) console.log(`wrote ${relative(process.cwd(), f) || f}`)
}
