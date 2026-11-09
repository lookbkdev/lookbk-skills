// About Story Kit: builds about.json into
//   out/index.html        the About page, with the site's nav and footer (to look at, check and record)
//   out/about-embed.html  the page's sections alone, to paste into an existing site
//   out/people/           the portraits the config names, copied beside the page
//
//   node scripts/build.mjs about.json out
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TYPES, contrast, longDate, mix, monthName, months, rgb, soften, validate, yearOf } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** _turn_ and **strong** */
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')
const mark = (i) => String.fromCharCode(97 + i)
const two = (n) => String(n).padStart(2, '0')

/* ---------- names, tones, fallback patterns ---------- */
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
/** First and last capitalised words: "Mats de Vries" is MV. */
export function initials(name) {
  const w = name.split(/\s+/).filter((x) => /^\p{Lu}/u.test(x))
  const a = w[0] ?? name
  return (a[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}
function toneOf(c, person) {
  const tones = c.theme.tones?.length ? c.theme.tones : [{ tile: c.theme.surface, line: mix(c.theme.surface, c.theme.ink, 0.18), ink: c.theme.ink }]
  return tones[person.tone ?? hash(person.name) % tones.length]
}
const f1 = (n) => n.toFixed(1)
function pattern(kind, name, tone) {
  const r = rng(hash(name))
  const W = 200, H = 250
  let body = ''
  if (kind === 'rings') {
    const cx = W * (0.55 + r() * 0.5), cy = H * (-0.12 + r() * 0.4), ph = r() * 6.28, k = 2 + Math.floor(r() * 3)
    for (let i = 1; i <= 24; i++) {
      const R = i * 13 + r() * 4, amp = 2 + i * 0.55
      let d = ''
      for (let a = 0; a <= 48; a++) {
        const t = (a / 48) * Math.PI * 2
        const rr = R + Math.sin(t * k + ph + i * 0.21) * amp + Math.sin(t * 5 + i) * amp * 0.3
        d += (a ? 'L' : 'M') + f1(cx + Math.cos(t) * rr * 1.25) + ' ' + f1(cy + Math.sin(t) * rr)
      }
      body += `<path d="${d}Z" stroke-width="${i % 5 === 0 ? 1.6 : 0.8}"/>`
    }
  } else if (kind === 'hatch') {
    const ang = -25 - r() * 40, gap = 6 + Math.floor(r() * 3)
    let lines = ''
    for (let i = -40; i < 60; i++) lines += `<path d="M${i * gap} -150V400" stroke-width="${i % 5 === 0 ? 1.3 : 0.6}"/>`
    body = `<g transform="rotate(${f1(ang)} 100 125)">${lines}</g>`
  }
  return `<svg class="ab-pat" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="${W}" height="${H}" fill="${tone.tile}"/><g fill="none" stroke="${tone.line}">${body}</g></svg>`
}

/** A portrait: the buyer's photo in the palette's duotone (colour on hover), or the fallback tile. */
function portrait(c, p, cls = 'ab-tile') {
  const tone = toneOf(c, p)
  if (p._photo) {
    const pos = p.focus ? ` style="object-position:${esc(p.focus)}"` : ''
    return `<div class="${cls} ab-photo" style="--tile:${tone.tile}"><img class="ab-duo" src="${esc(p._photo)}" alt="" decoding="async"${pos}><img class="ab-col" src="${esc(p._photo)}" alt="" decoding="async"${pos}></div>`
  }
  return `<div class="${cls}" style="--tile:${tone.tile};--tile-ink:${tone.ink}">${c.theme.fallback === 'plain' ? '' : pattern(c.theme.fallback ?? 'rings', p.name, tone)}<span class="ab-mono" aria-hidden="true">${esc(initials(p.name))}</span></div>`
}

/* ---------- tokens ---------- */
export function tokens(c) {
  const t = c.theme
  const ty = TYPES[t.type ?? 'serif']
  const dark = contrast(t.bg, '#000000') < contrast(t.bg, '#ffffff')
  const v = {
    '--bg': t.bg, '--surface': t.surface, '--ink': t.ink, '--accent': t.accent, '--on-accent': t.onAccent,
    '--mute': soften(t.ink, t.surface, 5.4),
    '--rule': `rgba(${rgb(t.ink)},${dark ? 0.16 : 0.18})`, '--rule-strong': t.ink,
    '--dim': `rgba(${rgb(t.ink)},${dark ? 0.24 : 0.22})`,
    '--display': ty.display, '--text': ty.text, '--mono': ty.mono,
    '--dw': ty.weight, '--strong': ty.strong, '--track': ty.track, '--em': ty.em, '--em-w': ty.emWeight, '--mono-st': ty.monoStretch,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
/** The duotone: shadows to ink (or ground on a dark page), mid-tones through the accent, highlights to the surface. */
function duotone(c) {
  const t = c.theme
  const dark = contrast(t.bg, '#000000') < contrast(t.bg, '#ffffff')
  const lo = dark ? t.bg : t.ink, hi = dark ? t.ink : t.surface
  const mid = mix(mix(lo, hi, 0.52), t.accent, 0.16)
  const ch = (i) => [lo, mid, hi].map((h) => (parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255).toFixed(3)).join(' ')
  return `<svg class="ab-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="ab-duo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".33 .5 .17 0 0 .33 .5 .17 0 0 .33 .5 .17 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="table" tableValues="${ch(0)}"/><feFuncG type="table" tableValues="${ch(1)}"/><feFuncB type="table" tableValues="${ch(2)}"/></feComponentTransfer></filter></svg>`
}

/* ---------- sections ---------- */
const TITLES = { record: 'The record', people: 'The people', practices: 'How we work', numbers: 'Numbers', contact: 'Talk to us' }
const head = (n, title, meta, id) =>
  `<div class="ab-shead"><h2 id="${id}-h"><span class="ab-n" aria-hidden="true">${two(n)}</span>${esc(title)}</h2>${meta ? `<p class="ab-lbl ab-meta">${esc(meta)}</p>` : ''}</div>`

function hero(c) {
  const f = c.founding
  const rows = [
    ['Founded', longDate(f.founded)],
    ['Where', f.place],
    ['People', `${f.headcount.count}, as of ${longDate(f.headcount.asOf).replace(/^\d+ /, '')}`],
    ['Written', `${longDate(f.written.date).replace(/^\d+ /, '')}, by ${f.written.by}`],
  ]
  return `<section class="ab-hero ab-grid ab-rise" aria-labelledby="ab-found">
<p class="ab-eyebrow ab-lbl">${esc(f.eyebrow)}</p>
<h1 class="ab-found" id="ab-found">${rich(f.sentence)}</h1>
<p class="ab-sign">${rich(f.signedBy)}</p>
<aside class="ab-card" aria-label="On the record"><p class="ab-lbl ab-card-t">On the record</p><dl>${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></aside>
</section>`
}

function contents(c) {
  const t = { ...TITLES, ...c.titles }
  const ids = ['record', 'people', 'practices', 'numbers', 'contact']
  return `<nav class="ab-toc" aria-label="On this page"><ol>${ids.map((k, i) => `<li><a href="#ab-${k}"><span class="ab-n" aria-hidden="true">${two(i + 1)}</span>${esc(t[k])}</a></li>`).join('')}</ol></nav>`
}

function change(before, after, cls = 'ab-chg') {
  if (before == null) return ''
  return `<p class="${cls}"><span class="ab-b"><span class="ab-lbl">Before</span> <s>${esc(before)}</s></span> <span class="ab-a"><span class="ab-ar" aria-hidden="true">→</span> <span class="ab-lbl">After</span> ${esc(after)}</span></p>`
}

function record(c) {
  const t = { ...TITLES, ...c.titles }
  const E = c.timeline.entries
  const y0 = yearOf(E[0].date), y1 = yearOf(E.at(-1).date)
  const meta = `${E.length} entries · ${y0} to ${y1}`
  const entry = (e, i) => {
    const next = E[i + 1]
    const gaps = []
    if (next) for (let y = yearOf(e.date) + 1; y < yearOf(next.date); y++) gaps.push(y)
    return `<li class="ab-ent${e.key ? ' ab-key' : ''}" data-at="${months(e.date)}">
<p class="ab-when"><span class="ab-y">${yearOf(e.date)}</span> <span class="ab-m ab-lbl">${monthName(e.date)}</span></p>
<span class="ab-dot" aria-hidden="true"></span>
<div class="ab-body"><h3>${esc(e.title)}</h3><p>${esc(e.body)}<a class="ab-mk" href="#ab-ev-${mark(i)}" aria-label="Evidence ${mark(i)}">${mark(i)}</a></p>${change(e.before, e.after)}</div>
<p class="ab-note" id="ab-ev-${mark(i)}"><span class="ab-mk" aria-hidden="true">${mark(i)}</span>${esc(e.evidence)}</p>
${gaps.length ? `<p class="ab-gaps" aria-hidden="true">${gaps.map((y) => `<span>${y}</span>`).join('')}</p>` : ''}
</li>`
  }
  let rail = ''
  if (c.timeline.layout === 'rail') {
    const a = Math.floor(months(E[0].date) / 12) * 12, b = (Math.floor(months(E.at(-1).date) / 12) + 1) * 12
    const pct = (m) => (((m - a) / (b - a)) * 100).toFixed(3)
    let ticks = ''
    for (let y = a / 12; y <= b / 12; y++) ticks += `<span class="ab-tk" style="left:${pct(y * 12)}%">${y < b / 12 ? `<i>${y}</i>` : ''}</span>`
    rail = `<div class="ab-axis" aria-hidden="true"><div class="ab-line"><i></i></div>${ticks}${E.map((e, i) => `<span class="ab-pin${e.key ? ' ab-key' : ''}" style="left:${pct(months(e.date))}%" data-i="${i}" data-at="${pct(months(e.date)) / 100}"></span>`).join('')}</div><svg class="ab-leads" aria-hidden="true" focusable="false"></svg>`
  }
  return `<section class="ab-s ab-record ab-rise" id="ab-record" aria-labelledby="ab-record-h">${head(1, t.record, meta, 'ab-record')}
<div class="ab-tl ${c.timeline.layout === "rail" ? "ab-rail" : "ab-tlspine"}" style="--n:${E.length}">${rail}<div class="ab-spine" aria-hidden="true"><i></i></div><ol class="ab-ents">${E.map(entry).join('')}</ol></div>
</section>`
}

function people(c) {
  const t = { ...TITLES, ...c.titles }
  const P = c.people
  const F = P.featured
  const total = F.length + (P.others?.length ?? 0)
  const meta = P.layout === 'sheet' ? `All ${total} of us · the year each joined` : `${F.length} who lead the work · all ${total} listed`
  const dec = (p, cls) => `<p class="${cls}"><span class="ab-lbl">Decided, ${p.decided.year}</span> ${esc(p.decided.line)}</p>`
  let body
  if (P.layout === 'sheet') {
    body = `<ul class="ab-sheet">${F.map((p, i) => `<li class="ab-pp" tabindex="0" data-i="${i}"><div class="ab-tw">${portrait(c, p)}${dec(p, 'ab-dec')}</div><h3>${esc(p.name)}</h3><p class="ab-role ab-lbl">${esc(p.role)} · ${p.since}</p><p class="ab-does">${esc(p.does)}</p></li>`).join('')}</ul>`
  } else {
    const rows = F.map((p, i) => `<li class="ab-row${i === 0 ? ' ab-cur' : ''}" tabindex="0" data-i="${i}">${portrait(c, p, 'ab-th')}<div class="ab-who"><h3>${esc(p.name)}</h3><p class="ab-lbl">${esc(p.role)} · ${p.since}</p></div><p class="ab-does">${esc(p.does)}</p><span class="ab-go" aria-hidden="true">→</span>${dec(p, 'ab-rdec')}</li>`).join('')
    const panels = F.map((p, i) => `<div class="ab-vp" data-i="${i}"${i === 0 ? '' : ' hidden'}>
<div class="ab-vh">${portrait(c, p, 'ab-vt')}<div><p class="ab-vn">${esc(p.name)}</p><p class="ab-lbl">${esc(p.role)} · since ${p.since}</p></div></div>
<p class="ab-lbl ab-vy">Decided, ${p.decided.year}</p>
<p class="ab-vq">${esc(p.decided.line)}</p>
${p.decided.before != null ? `<p class="ab-lbl ab-vy">What changed</p><p class="ab-vc"><s>${esc(p.decided.before)}</s><span><span class="ab-ar" aria-hidden="true">→</span> ${esc(p.decided.after)}</span></p>` : ''}
</div>`).join('')
    body = `<div class="ab-ix"><ul class="ab-rows">${rows}</ul><aside class="ab-viewer" aria-hidden="true">${panels}</aside></div>`
  }
  const roll = P.others?.length
    ? `<div class="ab-roll"><p class="ab-lbl">Also on the team · ${P.others.length}</p><ul>${P.others.map((o) => `<li>${esc(o.name)} <span class="ab-lbl">${esc(o.role)}</span></li>`).join('')}</ul></div>`
    : ''
  return `<section class="ab-s ab-people ab-rise" id="ab-people" aria-labelledby="ab-people-h" data-headcount="${c.founding.headcount.count}">${head(2, t.people, meta, 'ab-people')}${body}${roll}</section>`
}

function practices(c) {
  const t = { ...TITLES, ...c.titles }
  const X = c.practices
  return `<section class="ab-s ab-prac ab-rise" id="ab-practices" aria-labelledby="ab-practices-h">${head(3, t.practices, `${X.length} rules we keep · and how to check`, 'ab-practices')}
<ol class="ab-rules">${X.map((x, i) => `<li><span class="ab-k ab-lbl" aria-hidden="true">R${i + 1}</span><div><h3>${esc(x.rule)}</h3><p>${esc(x.detail)}</p><p class="ab-ev"><span class="ab-lbl">Since ${x.since} · how to check</span> <strong>${esc(x.check)}</strong></p></div></li>`).join('')}</ol></section>`
}

function numbers(c) {
  const t = { ...TITLES, ...c.titles }
  const N = c.numbers
  return `<section class="ab-s ab-nums ab-rise" id="ab-numbers" aria-labelledby="ab-numbers-h">${head(4, t.numbers, `Counted, not estimated · as of ${longDate(N.asOf)}`, 'ab-numbers')}
<ul class="ab-figs">${N.items.map((x, i) => `<li><p class="ab-v">${esc(x.value)}${x.unit ? `<small>${esc(x.unit)}</small>` : ''}<a class="ab-fn" href="#ab-fn-${i + 1}" aria-label="Source ${i + 1}">${i + 1}</a></p><p class="ab-t">${esc(x.label)}</p></li>`).join('')}</ul>
<ol class="ab-fns">${N.items.map((x, i) => `<li id="ab-fn-${i + 1}"><span class="ab-fk" aria-hidden="true">${i + 1}</span><span>${esc(x.source)}</span></li>`).join('')}</ol></section>`
}

function contact(c) {
  const t = { ...TITLES, ...c.titles }
  const K = c.contact
  const byName = Object.fromEntries(c.people.featured.map((p) => [p.name, p]))
  return `<section class="ab-s ab-close ab-rise" id="ab-contact" aria-labelledby="ab-contact-h">
<div class="ab-ch"><h2 id="ab-contact-h"><span class="ab-n" aria-hidden="true">05</span><span class="ab-sr">${esc(t.contact)}: </span>${esc(K.title)}</h2>${K.lede ? `<p class="ab-lede">${esc(K.lede)}</p>` : ''}</div>
<ul class="ab-who2">${K.people.map((x) => {
    const p = byName[x.name] ?? { name: x.name }
    return `<li><p class="ab-lbl">For</p><p class="ab-for">${esc(x.for)}</p><div class="ab-person">${portrait(c, p, 'ab-av')}<p><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span></p></div><a class="ab-mail" href="mailto:${esc(x.email)}">${esc(x.email)} <span aria-hidden="true">→</span></a><p class="ab-lbl ab-reply">${esc(x.reply)}</p></li>`
  }).join('')}</ul>
${K.visit?.length ? `<p class="ab-visit">${K.visit.map((v) => `<span>${esc(v)}</span>`).join('')}</p>` : ''}
</section>`
}

/* ---------- page ---------- */
function fontsHref(c) { return `https://fonts.googleapis.com/css2?${TYPES[c.theme.type ?? 'serif'].google}&display=swap` }

/**
 * The rail's horizontal rules live between the RAIL markers in about.css.
 * They apply from the width where every entry gets about 240 px; below
 * that the record runs down a spine, so the css is cut out and wrapped.
 */
function splitCss(css, c) {
  const m = /\/\* RAIL \*\/([\s\S]*?)\/\* END RAIL \*\//.exec(css)
  if (!m) return css
  const base = css.replace(m[0], '')
  if (c.timeline.layout !== 'rail') return base
  const min = c.timeline.entries.length <= 6 ? 1024 : 1280
  return `${base}@media (min-width:${min}px){${m[1]}}`
}

function content(c) {
  return `<main class="ab ab-t-${c.theme.type ?? 'serif'}" id="top" style="${tokens(c)}" data-layout="${c.timeline.layout}/${c.people.layout}" data-hover="${c.people.hover ?? 0}">
${duotone(c)}
<div class="ab-wrap">
${hero(c)}
${contents(c)}
${record(c)}
${people(c)}
${practices(c)}
${numbers(c)}
${contact(c)}
</div>
</main>`
}

export function build(c, { css, js }) {
  const lang = c.lang ?? 'en'
  const nav = (c.nav ?? []).map((n) => `<li><a href="${esc(n.href)}"${ext(n.href)}${n.current ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')
  const style = `<style>${splitCss(css, c)}</style>`
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(fontsHref(c))}">`
  const script = `<script>${js}</script>`
  const footer = `<footer class="ab-foot ab-lbl"><span>© ${esc(c.brand)}</span><span>This page was checked against the records in ${esc(longDate(c.founding.written.date))}</span></footer>`
  const page = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>About · ${esc(c.brand)}</title>
<meta name="description" content="${esc(c.founding.sentence.replace(/_/g, ''))}">
${fonts}
${style}
</head>
<body class="ab-page" style="background:${c.theme.bg}">
<a class="ab-skip" href="#ab-found">Skip to the page</a>
<header class="ab-nav" style="${tokens(c)}"><div class="ab-wrap"><a class="ab-brand" href="#top">${esc(c.brand)}</a>${nav ? `<nav aria-label="Site"><ul>${nav}</ul></nav>` : ''}</div></header>
${content(c)}
<div class="ab-footwrap" style="${tokens(c)}"><div class="ab-wrap">${footer}</div></div>
${script}
</body>
</html>
`
  const embed = `<!-- About Story Kit: paste this where the About page's content goes. It needs no other files except people/ if you use photos. -->
${fonts}
${style}
${content(c)}
${script}
`
  return { page, embed }
}

export async function main_(argv) {
  const [input, outDir = 'out'] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs about.json out')
    process.exit(1)
  }
  const file = resolve(input)
  let c
  try { c = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { console.error(`${input}: ${e.message}`); process.exit(1) }
  const { problems, warnings } = validate(c)
  // photos, relative to about.json
  for (const [i, p] of (c.people?.featured ?? []).entries()) {
    if (!p.photo) continue
    if (/^https?:/.test(p.photo)) { problems.push(`people.featured[${i}].photo must be a file next to about.json, not a link (${p.photo})`); continue }
    const src = resolve(dirname(file), p.photo)
    if (!existsSync(src)) problems.push(`people.featured[${i}].photo: ${p.photo} not found next to ${basename(file)}`)
    else p._src = src
  }
  for (const w of warnings) console.warn(`warning: ${w}`)
  if (problems.length) {
    console.error(`${input} has ${problems.length} problem${problems.length > 1 ? 's' : ''}; nothing was written:`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  const out = resolve(outDir)
  mkdirSync(out, { recursive: true })
  for (const p of c.people.featured) {
    if (!p._src) continue
    mkdirSync(join(out, 'people'), { recursive: true })
    const name = basename(p._src)
    copyFileSync(p._src, join(out, 'people', name))
    p._photo = `people/${name}`
  }
  const css = readFileSync(join(KIT, 'about.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const { page, embed } = build(c, { css, js })
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'about-embed.html'), embed)
  const people = c.people.featured.length + (c.people.others?.length ?? 0)
  console.log(`built ${join(outDir, 'index.html')} and ${join(outDir, 'about-embed.html')}: ${c.timeline.entries.length} milestones (${c.timeline.layout}), ${people} people (${c.people.layout}), ${c.practices.length} practices, ${c.numbers.items.length} sourced numbers`)
}
export { main_ as main }
