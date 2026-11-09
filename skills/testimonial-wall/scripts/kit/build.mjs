// Testimonial Wall: turns wall.json into a self-contained page (index.html)
// and a paste-in section (embed.html), with any photos and logos copied to
// assets/. Lists every problem in wall.json at once and writes nothing until
// they are fixed.
//
//   node scripts/build.mjs wall.json out
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTime, validate } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(here, '..', '..', 'template')

export const THEME = {
  letters: { bg: '#f3eee4', ink: '#1f1b16', mute: '#5b5348', rule: '#cfc5b3', accent: '#9c3b22', accent2: '#5e6b4f', star: null, panel: null,
    fonts: 'family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Hanken+Grotesk:wght@400;500;600' },
  ledger: { bg: '#0f1214', ink: '#ebe7de', mute: '#a7a59d', rule: '#2b3134', accent: '#8fd3c1', accent2: '#e8b65a', star: 'accent2', panel: '#161a1d',
    fonts: 'family=Familjen+Grotesk:ital,wght@0,400..700;1,400..700&family=Spline+Sans+Mono:wght@400;500;600' },
}

// ---------- colour ----------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
export const mix = (a, b, t) => hex(rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t)))
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

/** The palette, and the tile colours derived from it (never outside it). */
export function palette(cfg) {
  const th = THEME[cfg.theme]
  const p = { bg: th.bg, ink: th.ink, mute: th.mute, rule: th.rule, accent: cfg.accent || th.accent, accent2: cfg.accent2 || th.accent2 }
  p.star = th.star ? p[th.star] : p.ink
  p.panel = th.panel || mix(p.ink, p.bg, 0.045)
  const problems = []
  if (contrast(p.accent, p.bg) < 4.5) problems.push(`accent: ${p.accent} is ${contrast(p.accent, p.bg).toFixed(2)}:1 on the background ${p.bg}; it sets text, so it needs 4.5:1 (pick a ${cfg.theme === 'letters' ? 'darker' : 'lighter'} shade)`)
  if (cfg.theme === 'ledger' && contrast(p.accent2, p.bg) < 3) problems.push(`accent2: ${p.accent2} is ${contrast(p.accent2, p.bg).toFixed(2)}:1 on ${p.bg}; the stars need 3:1`)
  let tiles
  if (cfg.theme === 'letters') {
    // washes of the palette's own colours on the paper, kept only where ink reads on them
    tiles = [[p.accent, 0.2], [p.accent, 0.32], [p.accent2, 0.24], [p.accent2, 0.36], [p.ink, 0.1], [p.ink, 0.18], [p.mute, 0.22]]
      .map(([c, t]) => mix(c, p.bg, t)).filter((c) => contrast(p.ink, c) >= 7)
  } else {
    // outlines and monograms in the palette's colours, on the dark ground
    tiles = [p.accent, p.accent2, mix(p.accent, p.ink, 0.55), mix(p.accent2, p.ink, 0.55), p.mute].filter((c) => contrast(c, p.bg) >= 3)
  }
  if (!tiles.length) problems.push('accent/accent2: no tile colour derived from them keeps the names readable; pick other shades')
  return { p, tiles, problems }
}

// ---------- text ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const md = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\*([^*]+)\*/g, '<b>$1</b>')
const plainText = (s) => String(s).replace(/[_*]/g, '')
const initials = (n) => {
  const w = n.replace(/^the\s+/i, '').split(/[\s-]+/).filter((x) => /^\p{Lu}/u.test(x))
  const pick = w.length > 1 ? [w[0], w[w.length - 1]] : w.length ? [w[0]] : [n]
  return pick.map((x) => x[0]).join('').toUpperCase()
}
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h }
const two = (n) => String(n).padStart(2, '0')
const thousands = (n) => n.toLocaleString('en-US')
const STAR = 'M10 1.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.6l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z'
const stars = (k) => `<span class="tw-stars" role="img" aria-label="${k} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<svg viewBox="0 0 20 20" aria-hidden="true"${i > k ? ' class="o"' : ''}><path d="${STAR}"/></svg>`).join('')}</span>`

export function render(cfg, base, out) {
  const { p, tiles } = palette(cfg)
  const tint = (name) => tiles[hash(name) % tiles.length]
  const assets = new Map()
  const asset = (file) => {
    if (!assets.has(file)) assets.set(file, `assets/${assets.size + 1}-${basename(file)}`)
    return assets.get(file)
  }
  const tile = (name, photo, cls = 'tw-tile') => photo
    ? `<img class="${cls}" src="${asset(photo)}" alt="" width="52" height="52" loading="lazy">`
    : `<span class="${cls}" style="--t:${tint(name)}" aria-hidden="true">${esc(initials(name))}</span>`
  const ledger = cfg.theme === 'ledger'
  const order = cfg.order || ['spread', 'cases', 'press']
  const lead = cfg.lead, wall = cfg.wall
  const label = lead.label || 'Letter'

  // head
  const title = md(cfg.title)
  const r = cfg.rating
  const rating = r ? `<div class="tw-score">
      <p class="tw-big" aria-hidden="true">${r.score.toFixed(1)}</p>
      <div class="tw-meta">${stars(Math.round(r.score))}<p><b>${thousands(r.count)}</b> ${esc(r.source)}</p></div>
      <p class="tw-sr">Rated ${r.score.toFixed(1)} out of 5 from ${thousands(r.count)} ${esc(r.source)}.</p>
      <ul class="tw-hist" aria-label="Share of reviews by stars">${r.distribution.map((v, i) => `<li><span class="tw-l" aria-label="${5 - i} stars">${5 - i}★</span><i aria-hidden="true"><b style="--w:${v / 100}"></b></i><span class="tw-l">${v}%</span></li>`).join('')}</ul>
    </div>` : ''
  const head = `<header class="tw-head">
    <div class="tw-rule"><p class="tw-l">${esc(cfg.brand)}&nbsp;&nbsp;/&nbsp;&nbsp;${esc(cfg.kicker)}</p>
      <button class="tw-pause" type="button" aria-pressed="false"><svg class="tw-pz" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" width="3" height="10"/><rect x="6" width="3" height="10"/></svg><svg class="tw-play" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0l9 5-9 5z"/></svg><span>${esc(cfg.pauseLabel || 'Pause motion')}</span></button></div>
    <h2 class="tw-title">${title}</h2>
    ${rating}
  </header>`

  // spread: the lead letter, and the wall
  const n = lead.items.length
  const slots = lead.items.map((q, i) => `<figure class="tw-slot" id="tw-slot-${i + 1}" role="tabpanel" aria-label="${esc(label)} ${i + 1} of ${n}" data-read="${readTime(q.quote).toFixed(2)}"${i ? ' hidden' : ''}>
        <div class="tw-no"><span class="tw-l">${esc(label)} No.&nbsp;${two(i + 1)} of ${two(n)}</span><span class="tw-l">Read time ${Math.round(readTime(q.quote))} s</span></div>
        <blockquote class="tw-q"><p>${esc(q.quote)}</p></blockquote>
        <figcaption class="tw-att">${tile(q.name, q.photo)}<span class="tw-who"><b>${esc(q.name)}</b><span>${esc(q.role)}${q.place ? ', ' + esc(q.place) : ''}</span></span></figcaption>
        <div class="tw-res"><span class="tw-l">Measured result</span><p class="tw-fig">${esc(q.result.value)}</p><p class="tw-fig-l">${md(q.result.label)}</p></div>
      </figure>`).join('\n      ')
  const tabs = lead.items.map((q, i) => `<button class="tw-tab" type="button" role="tab" id="tw-tab-${i + 1}" aria-controls="tw-slot-${i + 1}" aria-selected="${i ? 'false' : 'true'}" aria-label="${esc(label)} ${i + 1}: ${esc(q.tab)}" tabindex="${i ? -1 : 0}"><span class="tw-l">${two(i + 1)}</span><span class="tw-tab-n">${esc(q.tab)}</span></button>`).join('')
  const note = (x) => `<li class="tw-note" data-i="${wall.notes.indexOf(x)}"><div class="tw-note-top">${stars(x.stars)}<span class="tw-l">${esc(x.date)}</span></div><p>${md(x.quote)}</p>
          <div class="tw-by">${tile(x.name, x.photo)}<div><b>${esc(x.name)}</b><span>${esc(x.about)}</span></div></div></li>`
  const cols = Array.from({ length: wall.columns }, (_, c) => wall.notes.filter((_, k) => k % wall.columns === c))
  const spread = `<div class="tw-spread">
    <div class="tw-lead">
      <div class="tw-slots">
      ${slots}
      </div>
      <div class="tw-tabs" role="tablist" aria-label="Featured ${esc(label.toLowerCase())}s" style="--n:${n}">${tabs}</div>
    </div>
    <div class="tw-wall" data-columns="${wall.columns}">
      <ul class="tw-sr" aria-label="${esc(wall.label || 'Reviews')}">${wall.notes.map((x) => `<li>${x.stars} out of 5 stars. “${esc(plainText(x.quote))}” ${esc(x.name)}, ${esc(x.about)}, ${esc(x.date)}.</li>`).join('')}</ul>
      <div class="tw-cols" aria-hidden="true" style="--cols:${wall.columns}">
        ${cols.map((c) => `<div class="tw-col"><ul class="tw-track">${c.map(note).join('\n          ')}</ul></div>`).join('\n        ')}
      </div>
    </div>
  </div>`

  // cases
  const cases = cfg.cases ? `<section class="tw-cases" aria-labelledby="tw-cases-h">
    <div class="tw-cases-hd"><div><span class="tw-l">${esc(cfg.cases.label || 'Cases')}</span><h3 id="tw-cases-h">${esc(cfg.cases.title)}</h3></div>
      <div class="tw-arrows"><span class="tw-l tw-count" aria-live="polite">${two(1)} / ${two(cfg.cases.items.length)}</span>
        <button class="tw-arrow" type="button" data-dir="-1" aria-label="Previous case" aria-disabled="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 6 10l6 6"/></svg></button>
        <button class="tw-arrow" type="button" data-dir="1" aria-label="Next case"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6"/></svg></button></div></div>
    <div class="tw-rail-wrap"><ul class="tw-rail" tabindex="0" aria-label="${esc(cfg.cases.title)}">${cfg.cases.items.map((c) => `
      <li class="tw-card"><div class="tw-ph" style="--t:${tint(c.name)}">${c.photo ? `<img src="${asset(c.photo)}" alt="" loading="lazy">` : `<span class="tw-mono" aria-hidden="true">${esc(initials(c.name))}</span>`}<span class="tw-l tw-seg">${esc(c.segment)}</span><span class="tw-l tw-pl">${esc(c.place.split(',')[0])}</span></div>
        <div class="tw-card-bd"><p class="tw-cf">${esc(c.value)}</p><p class="tw-cl">${esc(c.label)}</p><blockquote><p>“${esc(c.quote)}”</p></blockquote>
          <div class="tw-card-ft"><div><b>${esc(c.name)}</b><span>${esc(c.place)}</span></div><a href="${esc(c.link.href)}">${esc(c.link.label)}<span class="tw-sr">: ${esc(c.name)}</span></a></div></div></li>`).join('')}
    </ul></div>
  </section>` : ''

  // press
  const press = cfg.press ? `<section class="tw-press" aria-label="${esc(cfg.press.label || 'In the press')}"><span class="tw-l" aria-hidden="true">${esc(cfg.press.label || 'In the press')}</span>
    <ul class="tw-press-row" style="--n:${cfg.press.items.length}">${cfg.press.items.map((m) => {
      const wm = m.logo ? `<img src="${asset(m.logo)}" alt="${esc(m.name)}">` : `<span>${esc(m.name)}</span>`
      const inner = `<div class="tw-wm tw-wm--${m.style || 'sans'}">${wm}</div><p>${esc(m.line)}</p>`
      return m.href ? `<li><a class="tw-pcell" href="${esc(m.href)}">${inner}</a></li>` : `<li class="tw-pcell">${inner}</li>`
    }).join('')}</ul>
  </section>` : ''

  const blocks = { spread, cases, press }
  const vars = `--bg:${p.bg};--ink:${p.ink};--mute:${p.mute};--rule:${p.rule};--accent:${p.accent};--accent2:${p.accent2};--star:${p.star};--panel:${p.panel}`
  const section = `<section class="tw tw--${cfg.theme} tw--${wall.layout}" style="${vars}" aria-label="${esc(plainText(cfg.title))}" data-tw>
  <div class="tw-grain" aria-hidden="true"></div>
  <div class="tw-wrap">
  ${head}
  ${order.map((b) => blocks[b]).join('\n  ')}
  </div>
</section>`
  const css = readFileSync(join(TEMPLATE, 'wall.css'), 'utf8')
  const js = readFileSync(join(TEMPLATE, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${THEME[cfg.theme].fonts}&display=swap">`
  const embed = `<!-- Testimonial Wall (${esc(cfg.brand)}): paste where the section goes. Keep the fonts link in <head> if you can. -->
${fonts}
<style>
${css}
</style>
${section}
<script>
${js}
</script>
`
  const page = `<!doctype html>
<html lang="${esc(cfg.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(cfg.pageTitle || plainText(cfg.title))}</title>
<meta name="color-scheme" content="${ledger ? 'dark' : 'light'}">
${fonts}
<style>
html,body{margin:0;background:${p.bg}}
${css}
</style>
</head>
<body>
${section}
<script>
${js}
</script>
</body>
</html>
`
  mkdirSync(out, { recursive: true })
  if (assets.size) mkdirSync(join(out, 'assets'), { recursive: true })
  for (const [from, to] of assets) copyFileSync(resolve(base, from), join(out, to))
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'embed.html'), embed)
  return { assets: assets.size, tiles }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outArg] = argv
  if (!input) {
    console.log('usage: node scripts/build.mjs wall.json out')
    process.exit(1)
  }
  const file = resolve(input)
  if (!existsSync(file)) {
    console.error(`${input} not found`)
    process.exit(1)
  }
  let cfg
  try {
    cfg = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`${input} is not valid JSON: ${e.message}`)
    process.exit(1)
  }
  const base = dirname(file)
  const problems = validate(cfg, base)
  if (THEME[cfg.theme]) problems.push(...palette(cfg).problems)
  if (problems.length) {
    console.error(`${problems.length} problem${problems.length > 1 ? 's' : ''} in ${input}; nothing written:`)
    for (const m of problems) console.error(`  - ${m}`)
    process.exit(1)
  }
  const out = resolve(outArg || join(base, 'out'))
  const r = render(cfg, base, out)
  console.log(`wrote ${join(out, 'index.html')} and embed.html (${cfg.theme}, ${cfg.lead.items.length} letters, ${cfg.wall.notes.length} notes, ${cfg.cases ? cfg.cases.items.length : 0} cases, ${cfg.press ? cfg.press.items.length : 0} press${r.assets ? `, ${r.assets} files in assets/` : ''})`)
}
