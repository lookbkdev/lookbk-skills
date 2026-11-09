// FAQ Kit: builds faq.json into
//   out/index.html      a page holding the section (to look at, check and record)
//   out/faq-embed.html  the section alone, to paste into a page
//
//   node scripts/build.mjs faq.json out
//
// Everything a reader needs is in the HTML the build writes: every question
// and every answer (native <details>/<summary>, so they open and close with
// JavaScript off), and the FAQPage JSON-LD, written from the same config and
// the same text. The runtime only adds search, measured open/close motion,
// deep-link opening, the copy-link button and the live contact status.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TYPES, calc, contrast, lum, mix, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** **bold**, `code` and [label](href) inside answers; nothing else is markup. */
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, l, h) => `<a href="${h}"${/^https:/.test(h) ? ' rel="noopener"' : ''}>${l}</a>`)
const turn = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
const ARROW = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>'
const LENS = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6"/><path d="m13 13 5 5"/></svg>'
const LINK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8 2.5l-.7.7M8 6a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11.5l.7-.7"/></svg>'

/** A mute colour that holds `need`:1 against `bg`, as close to the background as that allows. */
function mute(ink, bg, need = 5) {
  for (let t = 0.6; t >= 0; t -= 0.02) { const m = mix(ink, bg, t); if (contrast(m, bg) >= need) return m }
  return ink
}

export function tokens(t) {
  const T = TYPES[t.type]
  const dark = lum(t.bg) < 0.2
  const btn = t.button === 'accent' ? t.accent : t.ink
  const btnInk = t.button === 'accent' ? (contrast(t.bg, t.accent) >= contrast(t.ink, t.accent) ? t.bg : t.ink) : t.bg
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')
  const { live } = t
  const liveRing = `rgba(${rgb(live)},.22)`, barBg = `rgba(${rgb(t.bg)},.94)`
  const v = {
    '--bg': t.bg, '--ink': t.ink, '--mute': mute(t.ink, t.bg), '--accent': t.accent, '--turn': t.turn,
    '--rule': mix(t.bg, t.ink, dark ? 0.16 : 0.17), '--panel': mix(t.bg, t.ink, dark ? 0.06 : 0.07),
    '--mark': t.mark, '--mark-ink': t.markInk, '--live': live, '--live-ring': liveRing,
    '--btn': btn, '--btn-ink': btnInk, '--bar-bg': barBg,
    '--radius': t.corners === 'pill' ? '999px' : '2px',
    '--display': T.display, '--text': T.text, '--mono': T.mono,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
const fontsHref = (t) => `https://fonts.googleapis.com/css2?${TYPES[t.type].google}&display=swap`

const isNum = (cell) => /^[^\d\s]{0,2}\s?-?[\d.,]+(\s?\/\s?\S+)?$/.test(cell.trim())

/** An answer block as HTML. Block elements are separated by newlines so that
 *  the text a reader sees (whitespace collapsed) is the text the JSON-LD gets. */
function block(b) {
  if ('p' in b) return `<p>${inline(b.p)}</p>`
  if ('note' in b) return `<p class="fq-note">${inline(b.note)}</p>`
  if ('steps' in b) return `<ol>\n${b.steps.map((s) => `<li><span>${inline(s)}</span></li>`).join('\n')}\n</ol>`
  if ('more' in b) return `<p class="fq-more">\n${b.more.map((m) => `<a href="${esc(m.href)}"${/^https:/.test(m.href) ? ' rel="noopener"' : ''}>${esc(m.label)}</a>`).join('\n')}\n</p>`
  if ('table' in b) {
    const t = b.table, cp = t.computed
    const rows = t.rows.map((r, i) =>
      `<tr>\n${r.map((cell, k) => {
        const calcAttr = cp && k === cp.column ? ` data-calc="${esc(cp.exprs[i])}" data-dp="${cp.decimals}"` : ''
        return `<td${isNum(cell) ? ' class="fq-num"' : ''}${calcAttr}>${esc(cell)}</td>`
      }).join('\n')}\n</tr>`).join('\n')
    return `<table>\n${t.caption ? `<caption>${esc(t.caption)}</caption>\n` : ''}<thead><tr>\n${t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('\n')}\n</tr></thead>\n<tbody>\n${rows}\n</tbody>\n</table>`
  }
  return ''
}
const bodyHTML = (it) => it.a.map(block).join('\n')

/** Visible text of a piece of the HTML above: tags dropped, entities decoded, whitespace collapsed. */
export const textOf = (html) =>
  html.replace(/<\/?(strong|code|em|b|a|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
/** The answer the JSON-LD carries: the short answer, then the long one, as the reader sees them. */
export const answerText = (short, body) => `${/[.!?]$/.test(short.trim()) ? short.trim() : short.trim() + '.'} ${textOf(body)}`

function entry(c, it, addr) {
  return `<details class="fq-q" id="${esc(it.id)}" data-addr="${esc(addr)}"${c.open.includes(it.id) ? ' open data-open-on-load' : ''}>
<summary><span class="fq-addr">${esc(addr)}</span><span class="fq-qt">${esc(it.q)}</span><span class="fq-v">${esc(it.short)}</span><span class="fq-pm" aria-hidden="true"></span></summary>
<div class="fq-ans"><div class="fq-ans-in">
<div class="fq-body">
${bodyHTML(it)}
</div>
<div class="fq-foot"><button type="button" data-copy="${esc(it.id)}">${LINK}<span>${esc(c.text.linkTo)} ${esc(addr)}</span></button><span aria-hidden="true">#${esc(it.id)}</span></div>
</div></div>
</details>`
}

function searchHTML(c) {
  const s = c.search
  return `<div class="fq-search" role="search">
<label for="fq-input">${esc(s.label)}</label>
<div class="fq-field">${LENS}<input id="fq-input" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(s.placeholder)}" aria-describedby="fq-count">${s.hotkey ? '<kbd aria-hidden="true">/</kbd>' : ''}</div>
<p class="fq-count" id="fq-count" aria-live="polite"></p>
</div>`
}
const barHTML = (c, total) => `<div class="fq-bar"><div><button type="button" data-find>${LENS}${esc(fill(c.text.searchBar, { total }))}</button><span class="fq-cur" aria-hidden="true"></span></div></div>`

function contactHTML(c) {
  const k = c.contact
  return `<section class="fq-stuck" id="fq-stuck" aria-labelledby="fq-stuck-h">
<div class="fq-lead"><h3 id="fq-stuck-h">${turn(k.headline)}</h3><p>${inline(k.text)}</p></div>
<div class="fq-who"><ul class="fq-roster">${k.people.map((p) => `<li><b>${esc(p.name)}</b><span>${esc(p.remit)}</span></li>`).join('')}</ul>
<p class="fq-status" aria-live="polite"><i aria-hidden="true"></i><span></span></p>
<div class="fq-actions">${k.actions.map((a, i) => `<a class="fq-btn${i === 0 ? ' fq-primary' : ''}" href="${esc(a.href)}"${/^https:/.test(a.href) ? ' rel="noopener"' : ''}>${esc(a.label)} ${ARROW}</a>`).join('')}</div></div>
</section>`
}

export function sectionHTML(c) {
  const head = `<p class="fq-eyebrow">${esc(c.intro.eyebrow)}</p><h2 class="fq-head" id="fq-h">${turn(c.intro.headline)}</h2>${c.intro.lede ? `<p class="fq-lede">${esc(c.intro.lede)}</p>` : ''}`
  const all = c.groups ? c.groups.flatMap((g) => g.items) : c.items
  const total = all.length
  let inner
  if (c.layout === 'index') {
    const contents = `<nav aria-label="${esc(c.text.topics)}"><ol class="fq-contents">${c.groups.map((g, i) => `<li><a href="#g-${esc(g.id)}" data-g="${esc(g.id)}"><span class="fq-n">${i + 1}</span><span class="fq-t"><span class="fq-full">${esc(g.title)}</span><span class="fq-short">${esc(g.short ?? g.title)}</span></span><span class="fq-c">${g.items.length}</span></a></li>`).join('')}</ol></nav>`
    const first = c.contact.people[0].name.split(' ')[0]
    const note = `<p class="fq-railnote">${esc(c.text.railNote)} <a href="#fq-stuck">${esc(fill(c.text.railAsk, { name: first }))}</a>. ${esc(fill(c.text.railReplies, { promise: c.contact.promise }))}</p>`
    const groups = c.groups.map((g, i) => `<section class="fq-group" id="g-${esc(g.id)}" data-g="${esc(g.id)}" aria-labelledby="fq-gh-${esc(g.id)}">
<div class="fq-ghead"><span class="fq-n">${String(i + 1).padStart(2, '0')}</span><span class="fq-tl"><h3 id="fq-gh-${esc(g.id)}">${esc(g.title)}</h3><span class="fq-c">${g.items.length}</span></span><span class="fq-vl" aria-hidden="true">${esc(c.text.shortAnswer)}</span><span></span></div>
${g.items.map((it, k) => entry(c, it, `${i + 1}.${k + 1}`)).join('\n')}
</section>`).join('\n')
    inner = `<div class="fq-grid"><div class="fq-side"><div class="fq-side-in">${head}${searchHTML(c)}${contents}${note}</div></div>
<div class="fq-list">${barHTML(c, total)}
${groups}
<div class="fq-empty" role="status"></div></div></div>`
  } else {
    inner = `<div class="fq-top"><div class="fq-intro">${head}</div>${searchHTML(c)}</div>
<div class="fq-list">${barHTML(c, total)}<div class="fq-cols" aria-hidden="true"><span>${esc(c.text.number)}</span><span>${esc(c.text.question)}</span><span>${esc(c.text.shortAnswer)}</span><span></span></div>
<section class="fq-group" aria-labelledby="fq-h">
${all.map((it, i) => entry(c, it, String(i + 1).padStart(2, '0'))).join('\n')}
</section>
<div class="fq-empty" role="status"></div></div>`
  }
  const data = {
    layout: c.layout, total, text: c.text, preview: c.preview, hotkey: !!c.search.hotkey,
    groups: (c.groups ?? []).map((g) => ({ id: g.id, title: g.title, short: g.short ?? g.title })),
    contact: { timezone: c.contact.timezone, hours: c.contact.hours, city: c.contact.city, now: c.contact.now, promise: c.contact.promise, first: c.contact.people[0].name.split(' ')[0] },
  }
  return `<section class="fq fq-L-${c.layout} fq-T-${c.theme.type}" id="faq" aria-labelledby="fq-h" style="${tokens(c.theme)}" data-fq="${esc(JSON.stringify(data))}">
${inner}
${contactHTML(c)}
</section>`
}

/** FAQPage structured data, from the same config and the same text as the page. */
export function jsonLD(c) {
  const all = c.groups ? c.groups.flatMap((g) => g.items) : c.items
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: answerText(it.short, bodyHTML(it)) } })),
  }
  return `<script type="application/ld+json" id="fq-ld">\n${JSON.stringify(ld, null, 1).replace(/</g, '\\u003c')}\n</script>`
}

export function build(input, outDir) {
  const file = resolve(input)
  let json
  try { json = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return { errors: [`${input}: ${e.message}`], notes: [] } }
  const { errors, notes, c } = validate(json)
  if (errors.length) return { errors, notes }
  // computed cells, once more on the final text (validate checked them too)
  for (const it of c.groups ? c.groups.flatMap((g) => g.items) : c.items)
    for (const b of it.a) if (b.table?.computed) b.table.computed.exprs.forEach((e) => calc(e))
  const css = readFileSync(join(KIT, 'faq.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fontsHref(c.theme))}">`
  const section = sectionHTML(c)
  const ld = c.schema === false ? '' : jsonLD(c)
  const title = c.demo?.title ?? textOf(turn(c.intro.headline))
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="color-scheme" content="${lum(c.theme.bg) < 0.2 ? 'dark' : 'light'}">
${fonts}
${ld}
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
  const embed = `<!-- FAQ Kit: paste this where the questions go. The <script type="application/ld+json">
     is the FAQPage structured data for the same questions; keep it on the page with them. -->
${fonts}
${ld}
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
  writeFileSync(join(out, 'faq-embed.html'), embed)
  return { errors, notes, files: [join(out, 'index.html'), join(out, 'faq-embed.html')] }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((x) => !x.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs faq.json [out]')
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
