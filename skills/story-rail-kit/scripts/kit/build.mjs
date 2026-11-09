// Story Rail: builds rail.json into
//   out/index.html   a whole page: a slim brand bar, the rail section, a footer line
//   out/embed.html   the section alone (its style and script included), to paste into a site
//   out/fonts/       the self-hosted fonts the theme uses, with their licences
//   out/media/       the buyer's own pictures and loops, copied as they are
//
//   node scripts/build.mjs rail.json out
//
// Every problem in rail.json is listed at once and nothing is written until
// there are none.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DRAWN } from '../../kit/drawn.mjs'
import { DISPLAYS, FONT_FILES, MONOS, counts, fill, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const pad2 = (n) => String(n).padStart(2, '0')
const ARROW = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5"/></svg>'
const BACK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M17 10H4M9 5l-5 5 5 5"/></svg>'

export function tokens(c) {
  const t = c.theme
  const d = DISPLAYS[t.display ?? 'geist']
  const v = {
    '--bg': t.bg, '--surface': t.surface, '--ink': t.ink, '--mute': t.mute, '--rule': t.rule,
    '--accent': t.accent, '--onAccent': t.onAccent,
    '--display': d.family, '--body': d.family, '--mono': MONOS[t.mono ?? 'plex'],
    '--dw': d.weight, '--dtrack': d.track, '--cw': d.claimWeight, '--ctrack': d.claimTrack, '--em': d.em,
    '--dvar': d.serif ? '"SOFT" 50, "opsz" 96' : 'normal',
    '--radius': `${t.radius ?? 2}px`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}

function fontFaces(c) {
  const files = [...FONT_FILES[c.theme.display ?? 'geist'], ...FONT_FILES[c.theme.mono ?? 'plex']]
  return {
    files: [...new Set(files.map((f) => f[1]))],
    css: files.map(([fam, file, style, weight]) => `@font-face{font-family:'${fam}';src:url(fonts/${file}) format('woff2');font-style:${style};font-weight:${weight};font-display:swap}`).join('\n'),
  }
}

/** Gives each drawn scene's ids a prefix, so two scenes never share one. */
function scoped(svg, prefix, alt) {
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
  let out = svg
  for (const id of ids) out = out.split(`id="${id}"`).join(`id="${prefix}-${id}"`).split(`url(#${id})`).join(`url(#${prefix}-${id})`)
  return out.replace('<svg ', `<svg role="img" aria-label="${esc(alt)}" focusable="false" `)
}

function media(k, i, base, out) {
  const m = k.media
  if (m.drawn) {
    const d = DRAWN[m.drawn]
    const tag = d.loop ? `<span class="sr-tag" aria-hidden="true"><i></i>Loop · ${d.loop} s</span>` : ''
    return scoped(d.draw(), `c${i}`, m.alt) + tag
  }
  const copy = (src) => {
    const from = resolve(base, src)
    if (!existsSync(from)) throw new Error(`cards[${i}]: ${src} not found next to rail.json`)
    mkdirSync(join(out, 'media'), { recursive: true })
    copyFileSync(from, join(out, 'media', basename(src)))
    return `media/${encodeURI(basename(src))}`
  }
  const focus = m.focus ? ` style="object-position:${m.focus}"` : ''
  if (m.image) return `<img src="${copy(m.image)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" draggable="false"${focus}>`
  return `<video src="${copy(m.loop)}" poster="${copy(m.poster)}" muted loop playsinline preload="metadata" aria-label="${esc(m.alt)}"${focus}></video><span class="sr-tag" aria-hidden="true"><i></i>Loop · ${m.seconds} s</span>`
}

function cardHTML(c, k, i, base, out) {
  const no = pad2(i + 1)
  const go = (label, verb) => `<span class="sr-go"><span>${esc(label)}</span>${ARROW}</span>`
  const wrap = (href, inner, label) =>
    href ? `<a href="${esc(href)}" draggable="false" aria-label="${esc(label)}">${inner}</a>` : `<div>${inner}</div>`
  if (k.kind === 'quote') {
    const inner = `<div class="sr-qbox">${k.label ? `<p class="sr-qlab">${esc(k.label)}</p>` : '<p class="sr-qmark" aria-hidden="true">“</p>'}<blockquote class="sr-qtext">${esc(k.text)}</blockquote><p class="sr-qby"><b>${esc(k.by)}</b>${esc(k.role)}</p></div>
<div class="sr-cap"><p class="sr-meta"><span><b>${no}</b>In their words</span></p>${k.href ? go(k.link ?? 'Read the story') : ''}</div>`
    return `<li class="sr-card quote" data-kind="quote" data-label="${esc(k.by)}">${wrap(k.href, inner, `${k.by}: ${k.text}`)}</li>`
  }
  if (k.kind === 'number') {
    let viz = ''
    if (k.compare) {
      const top = Math.max(...k.compare.map((r) => r[1]))
      viz = `<div class="sr-bars" aria-hidden="true">${k.compare.map(([l, v]) => `<div class="sr-bar"><span>${esc(l)}</span><s><i style="width:${((v / top) * 100).toFixed(1)}%"></i></s><span>${v}</span></div>`).join('')}</div>`
    } else if (k.split) {
      const cols = c.theme.chart ?? [c.theme.mute, c.theme.accent, c.theme.ink, c.theme.rule]
      viz = `<div aria-hidden="true"><div class="sr-split">${k.split.map(([, v], j) => `<i style="flex:${v};background:${cols[j % cols.length]}"></i>`).join('')}</div><div class="sr-key">${k.split.map(([l, v], j) => `<span><b style="background:${cols[j % cols.length]}"></b>${esc(l)} ${v}</span>`).join('')}</div></div>`
    }
    const inner = `<div class="sr-nbox"><p class="sr-nfig">${esc(k.figure)}${k.unit ? `<small>${esc(k.unit)}</small>` : ''}</p><p class="sr-nlab">${esc(k.label)}</p>${viz}<p class="sr-nsrc">${esc(k.source)}</p></div>
<div class="sr-cap"><p class="sr-meta"><span><b>${no}</b>How we counted</span></p>${k.href ? go(k.link ?? 'See the method') : ''}</div>`
    return `<li class="sr-card number" data-kind="number" data-label="${esc(k.figure + (k.unit ?? ''))}">${wrap(k.href, inner, `${k.figure}${k.unit ?? ''} ${k.label}`)}</li>`
  }
  const inner = `<figure class="sr-media">${media(k, i, base, out)}</figure>
<div class="sr-cap"><p class="sr-meta"><span><b>${no}</b>${esc(k.name)}</span><span>${esc(k.meta)}</span></p><p class="sr-claim">${esc(k.claim)}</p>${go(k.link ?? c.link ?? 'See more')}</div>`
  return `<li class="sr-card ${k.kind}" data-kind="${k.kind}" data-label="${esc(k.name)}">${wrap(k.href, inner, `${k.name}: ${k.claim}`)}</li>`
}

export function section(c, base, out) {
  const { stops } = counts(c)
  const b = c.behaviour ?? {}
  const serif = DISPLAYS[c.theme.display ?? 'geist'].serif
  const head = c.head
  const end = `<li class="sr-card end" data-kind="end" data-label="${esc(c.end.title)}"><a href="${esc(c.end.href)}" draggable="false"><div class="sr-ebox"><span class="sr-en">${pad2(stops)}</span><p class="sr-et">${esc(c.end.title)}</p><svg class="sr-earrow" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="28" cy="28" r="27"/><path d="M17 28h22M31 20l8 8-8 8"/></svg></div>${c.end.note ? `<div class="sr-cap"><p class="sr-meta"><span>${esc(c.end.note)}</span></p></div>` : ''}</a></li>`
  const hint = b.hint === false ? '' : `<p class="sr-hint">${esc(b.hint ?? 'Drag, swipe or use ← →')}</p>`
  return `<section class="sr${serif ? ' sr-serif' : ''}" style="${tokens(c)}" aria-roledescription="carousel" aria-label="${esc(fill(head.eyebrow, c))}"${b.autoplay ? ` data-autoplay="${b.seconds}"` : ''}>
<div class="sr-in">
<header class="sr-head"><div><p class="sr-eye"><i></i>${esc(fill(head.eyebrow, c))}</p><h2 class="sr-h2">${rich(fill(head.title, c))}</h2>${head.dek ? `<p class="sr-dek">${rich(fill(head.dek, c))}</p>` : ''}</div>
<div class="sr-ctrl" hidden><span class="sr-count" aria-live="polite">01 <i>of ${pad2(stops)}</i></span><button type="button" class="sr-btn sr-pause" hidden>Pause</button><button type="button" class="sr-btn sr-prev" aria-label="Previous card">${BACK}</button><button type="button" class="sr-btn sr-next" aria-label="Next card">${ARROW}</button></div></header>
<div class="sr-vp" tabindex="0" role="group" aria-label="${esc(fill(head.eyebrow, c))}: ${stops} cards; use the arrow keys to move one card">
<ol class="sr-rail">
${c.cards.map((k, i) => cardHTML(c, k, i, base, out)).join('\n')}
${end}
</ol></div>
<div class="sr-scale" hidden><div class="sr-mm"><div class="sr-segs"></div><div class="sr-win" aria-hidden="true"></div><div class="sr-nums"></div></div>${hint}</div>
</div>
</section>`
}

export function build(c, base, outDir) {
  const out = resolve(outDir)
  mkdirSync(join(out, 'fonts'), { recursive: true })
  const ff = fontFaces(c)
  for (const f of ff.files) copyFileSync(join(KIT, 'fonts', f), join(out, 'fonts', f))
  const LICENCE = { 'geist.woff2': 'geist-OFL.txt', 'fraunces.woff2': 'fraunces-OFL.txt', 'fraunces-italic.woff2': 'fraunces-OFL.txt', 'plex-mono-500.woff2': 'plex-mono-OFL.txt', 'dm-mono-500.woff2': 'dm-mono-OFL.txt' }
  for (const f of ff.files) copyFileSync(join(KIT, 'fonts', LICENCE[f]), join(out, 'fonts', LICENCE[f]))
  const css = readFileSync(join(KIT, 'rail.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const sec = section(c, base, out)
  const style = `<style>\n${ff.css}\n${css}\n</style>`
  const script = `<script>\n${js}\n</script>`
  const t = c.theme
  const pg = c.page ?? {}
  const page = `<!doctype html>
<html lang="${esc(pg.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pg.brand ? `${pg.brand}: ${fill(c.head.eyebrow, c)}` : fill(c.head.eyebrow, c))}</title>
<meta name="color-scheme" content="${t.mode === 'dark' ? 'dark' : 'light'}">
${style}
<style>
html,body{margin:0;background:${t.bg};color:${t.ink}}
.srp-top,.srp-foot{font-family:${MONOS[t.mono ?? 'plex']};display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px clamp(16px,4.4vw,72px);font-size:14px;letter-spacing:.02em;color:${t.mute}}
.srp-top{border-bottom:1px solid ${t.rule}}
.srp-top b{font-family:${DISPLAYS[t.display ?? 'geist'].family};font-weight:600;font-size:18px;letter-spacing:-.01em;color:${t.ink}${DISPLAYS[t.display ?? 'geist'].serif ? ';font-style:italic;font-weight:500;font-size:20px' : ''}}
.srp-top nav{display:flex;gap:22px}
.srp-top a,.srp-foot a{color:inherit;text-decoration:none}
.srp-menu{display:none;color:${t.ink}}
.srp-foot{border-top:1px solid ${t.rule};padding-top:28px;padding-bottom:40px}
@media (max-width:700px){.srp-top,.srp-foot{font-size:16px}.srp-top nav{display:none}.srp-menu{display:block}.srp-foot{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body>
${pg.brand ? `<header class="srp-top"><b>${esc(pg.brand)}</b>${pg.nav?.length ? `<nav aria-label="Main">${pg.nav.map((n) => `<a href="#${esc(n.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${esc(n)}</a>`).join('')}</nav><span class="srp-menu">Menu</span>` : ''}</header>` : ''}
<main>
${sec}
</main>
${pg.brand ? `<footer class="srp-foot"><span>${esc(pg.brand)}</span><a href="${esc(c.end.href)}">${esc(c.end.title)}</a></footer>` : ''}
${script}
</body>
</html>
`
  const embed = `<!-- Story Rail: paste this where the section goes. Copy the fonts/ folder (and media/, if any) next to the page. -->
${style}
${sec}
${script}
`
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'embed.html'), embed)
  return out
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv.filter((a) => !a.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs rail.json [out]')
    process.exit(1)
  }
  let c
  try {
    c = JSON.parse(readFileSync(input, 'utf8'))
  } catch (e) {
    console.error(`${input}: ${e.code === 'ENOENT' ? 'not found' : 'is not valid JSON (' + e.message + ')'}`)
    process.exit(1)
  }
  const { errors, warnings } = validate(c)
  for (const w of warnings) console.log(`note: ${w}`)
  if (errors.length) {
    console.error(`${input} has ${errors.length} problem${errors.length > 1 ? 's' : ''}:`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  try {
    const out = build(c, dirname(resolve(input)), outDir)
    const { stories, stops } = counts(c)
    const r0 = relative(process.cwd(), out), rel = !r0 ? '.' : r0.startsWith('..') ? out : r0
    console.log(`wrote ${rel}/index.html and ${rel}/embed.html (${stories} stories, ${stops} stops)`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
