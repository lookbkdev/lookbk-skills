// Closing CTA Kit: builds cta.json into
//   out/index.html       the band at the end of a short demo page (to look at, check and record)
//   out/cta-embed.html   the band alone, to paste in above the footer
//
//   node scripts/build.mjs cta.json out
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISPLAYS, contrast, lum, mix, rgb, soften, validate, zoned } from './schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** _turn_ */
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')

export function tokens(c) {
  const t = c.theme
  const d = DISPLAYS[t.display ?? 'shoulders']
  const ground = c.layout === 'stub' ? t.card : t.band
  const dark = lum(t.band) < 0.2
  const v = {
    '--band': t.band, '--card': t.card ?? t.band, '--ink': t.ink,
    '--mute': soften(t.ink, ground, 5.2),
    '--placeholder': soften(t.ink, t.band, 4.6),
    '--turn': t.turn ?? t.accent, '--accent': t.accent, '--on-accent': t.onAccent,
    '--eyebrow': contrast(t.accent, t.band) >= 4.6 ? t.accent : t.ink,
    '--on-accent-rule': `rgba(${rgb(t.onAccent)},.4)`,
    '--stub-label': soften(t.onAccent, t.accent, 5),
    '--stub-dim': soften(t.onAccent, t.accent, 2.2),
    '--stamp-ink': mix(t.accent, '#000000', 0.38),
    '--rule': `rgba(${rgb(t.ink)},.16)`, '--rule-strong': `rgba(${rgb(t.ink)},.34)`,
    '--ring': t.ink,
    '--error': t.error ?? (dark ? '#ff9a7e' : '#a3271a'),
    '--shade': rgb(mix(t.band, '#000000', 0.75)),
    '--display': d.family, '--display-w': d.weight, '--display-heavy': d.heavy, '--display-track': d.track, '--display-case': d.case,
    '--em-style': d.emStyle, '--em-weight': d.emWeight, '--fig-wdth': d.figWdth, '--head-wdth': d.headWdth,
    '--text': d.text, '--mono': d.mono,
    '--radius': t.buttons === 'pill' ? '999px' : '2px',
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
const fontsHref = (c) => {
  const d = DISPLAYS[c.theme.display ?? 'shoulders']
  return `https://fonts.googleapis.com/css2?${[d.google, d.textGoogle, d.monoGoogle].filter(Boolean).join('&')}&display=swap`
}

/** open and after-close versions of a block; the runtime shows one */
const both = (open, closed) => (closed == null ? open : `<div data-when="open">${open}</div><div data-when="closed" hidden>${closed}</div>`)

const primary = (l, price) =>
  `<a class="cc-btn cc-primary" href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)} <span class="cc-ar" aria-hidden="true">→</span>${price ? `<span class="cc-price">${esc(price)}</span>` : ''}</a>`
const actions = (k) =>
  `<div class="cc-actions">${primary(k.primary, k.primary.price)}${k.secondary ? `<a class="cc-link" href="${esc(k.secondary.href)}"${ext(k.secondary.href)}>${esc(k.secondary.label)}</a>` : ''}</div>`

/** The rubber stamp: the top arc reads clockwise outside, the bottom arc left to right inside, both the right way up. */
function stamp(s, id) {
  if (!s) return ''
  return `<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
<defs>
  <path id="${id}-t" d="M 30,100 A 70,70 0 0 1 170,100"/>
  <path id="${id}-b" d="M 21,100 A 79,79 0 0 0 179,100"/>
  <filter id="${id}-ink" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation=".35"/>
  </filter>
  <filter id="${id}-speck" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="4" seed="4"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 4.2 -2.75"/>
  </filter>
  <filter id="${id}-grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.4 -2.2"/>
  </filter>
  <linearGradient id="${id}-press" x1="0" y1="0" x2="1" y2=".85">
    <stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f0f0f0"/><stop offset="1" stop-color="#a8a8a8"/>
  </linearGradient>
  <mask id="${id}-m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="220" height="220">
    <rect x="-10" y="-10" width="220" height="220" fill="url(#${id}-press)"/>
    <rect x="-10" y="-10" width="220" height="220" filter="url(#${id}-speck)" fill="#000"/>
    <rect x="-10" y="-10" width="220" height="220" filter="url(#${id}-grain)" fill="#000"/>
  </mask>
</defs>
<g mask="url(#${id}-m)"><g filter="url(#${id}-ink)" fill="currentColor" stroke="currentColor">
  <circle cx="100" cy="100" r="94" fill="none" stroke-width="4.5"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke-width="1.2"/>
  <circle cx="100" cy="100" r="58" fill="none" stroke-width="1.6"/>
  <circle cx="25" cy="102" r="2.6" stroke="none"/><circle cx="175" cy="102" r="2.6" stroke="none"/>
  <text class="cc-st-ring" stroke="none" text-anchor="middle"><textPath href="#${id}-t" startOffset="50%">${esc(s.top)}</textPath></text>
  <text class="cc-st-ring" stroke="none" text-anchor="middle"><textPath href="#${id}-b" startOffset="50%">${esc(s.bottom)}</textPath></text>
  <text class="cc-st-big" x="100" y="111" text-anchor="middle" stroke="none">${esc(s.big)}</text>
  <text class="cc-st-small" x="100" y="138" text-anchor="middle" stroke="none">${esc(s.small)}</text>
</g></g></svg>`
}

/* ---------- layouts ---------- */
function stubFact(c, after) {
  const f = c.fact
  if (after) {
    const a = after
    return `<span class="cc-lbl">${esc(a.label)}</span><div class="cc-fact"><span class="cc-num"><span>${esc(a.value)}</span></span>${a.unit ? `<span class="cc-of">${esc(a.unit)}</span>` : ''}</div>${a.note ? `<p class="cc-note">${esc(a.note)}</p>` : ''}`
  }
  let fig, unit = ''
  if (f.kind === 'count') { fig = String(f.value); unit = `of ${f.of}` }
  else if (f.kind === 'price') { fig = `${f.currency}${f.value}`; unit = f.was ? `was ${f.currency}${f.was}` : '' }
  else if (f.kind === 'date') { fig = c._closeDay; unit = f.unit ?? c._closeMonth }
  else { fig = String(f.value); unit = f.unit ?? '' }
  let seats = ''
  if (f.kind === 'count' && f.of <= 24) {
    const dots = Array.from({ length: f.of }, (_, i) => `<i class="${i < f.value ? 'cc-sfree' : 'cc-sgone'}"></i>`).join('')
    seats = `<div class="cc-seats" aria-hidden="true">${dots}</div><p class="cc-legend cc-lbl"><span><i class="cc-k-free" aria-hidden="true"></i>${f.value} ${esc(f.left ?? 'left')}</span><span><i class="cc-k-gone" aria-hidden="true"></i>${f.of - f.value} ${esc(f.taken ?? 'taken')}</span></p>`
  }
  const count = c.closes?.countdown ? `<p class="cc-note" data-days="${esc(c.closes.countdown)}"></p>` : ''
  return `<span class="cc-lbl">${esc(f.label)}</span><div class="cc-fact" aria-label="${esc(fig)} ${esc(unit)}"><span class="cc-num"><span>${esc(fig)}</span></span>${unit ? `<span class="cc-of">${esc(unit)}</span>` : ''}</div>${seats}${count}`
}

function layoutStub(c) {
  const a = c.afterClose
  const fieldList = (fs) => (fs ?? []).length
    ? `<dl class="cc-fields" style="--n:${fs.length}">${fs.map((x) => `<div><dt class="cc-lbl">${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`
    : ''
  const fields = both(fieldList(c.fields), a?.fields ? fieldList(a.fields) : null)
  const head = (k) => `<h2 class="cc-h" id="cc-h">${rich(k.headline)}</h2>${k.lede ? `<p class="cc-lede">${rich(k.lede)}</p>` : ''}`
  const closedHead = a ? `<h2 class="cc-h">${rich(a.headline)}</h2>${a.lede ? `<p class="cc-lede">${rich(a.lede)}</p>` : ''}` : null
  const foot = (title, label) => `<div class="cc-sfoot"><div>${title ? `<span class="cc-lbl">${esc(title)}</span>${esc(label)}` : ''}</div><div class="cc-barcode" aria-hidden="true"></div></div>`
  const sfoot = both(foot(c.closes?.title ?? (c.closes ? 'Closes' : ''), c.closes?.label), a?.foot ? foot(a.foot.title, a.foot.label) : null)
  return `<div class="cc-wrap"><div class="cc-shadow"><div class="cc-tk">
  <div class="cc-main">
    <div class="cc-top cc-lbl">${both(`<span>${esc(c.eyebrow)}</span>`, a?.eyebrow ? `<span>${esc(a.eyebrow)}</span>` : null)}${c.serial ? `<b>${esc(c.serial)}</b>` : ''}</div>
    ${both(head(c), closedHead)}
    ${both(actions(c), a ? actions({ primary: a.primary, secondary: a.secondary === undefined ? c.secondary : a.secondary }) : null)}
    ${fields}
  </div>
  <div class="cc-stub-face">
    ${both(stubFact(c), a?.fact ? stubFact(c, a.fact) : null)}
    ${sfoot}
  </div>
  <div class="cc-perf" aria-hidden="true"></div>
  ${c.stamp ? `<div class="cc-stamp" aria-hidden="true">${both(stamp(c.stamp, 'cc-st'), a?.stamp ? stamp(a.stamp, 'cc-st2') : null)}</div>` : ''}
</div></div></div>`
}

function figure(c, after) {
  const f = c.fact
  const digits = (s) => [...String(s)].map((x) => `<span>${esc(x)}</span>`).join('')
  if (after) return `<div class="cc-fig" aria-label="${esc(after.label)}: ${esc(after.value)}"><span class="cc-cur" aria-hidden="true">${f.kind === 'price' ? esc(f.currency) : ''}</span><span class="cc-n" aria-hidden="true">${digits(after.value)}</span>${after.note ? `<span class="cc-was">${esc(after.note)}</span>` : ''}</div>`
  if (f.kind === 'price')
    return `<div class="cc-fig" aria-label="${esc(f.label)}: ${esc(f.currency)}${f.value}${f.was ? `, was ${esc(f.currency)}${f.was}` : ''}"><span class="cc-cur" aria-hidden="true">${esc(f.currency)}</span><span class="cc-n" aria-hidden="true">${digits(f.value)}</span>${f.was ? `<span class="cc-was" aria-hidden="true">Was <s>${esc(f.currency)}${f.was}</s> · you keep ${esc(f.currency)}${f.was - f.value}</span>` : ''}</div>`
  const fig = f.kind === 'date' ? c._closeDay : String(f.value)
  const unit = f.kind === 'count' ? `of ${f.of} ${esc(f.label).toLowerCase()}` : f.kind === 'date' ? `${esc(f.unit ?? c._closeMonth)} · ${esc(f.label)}` : `${esc(f.unit ?? '')} ${esc(f.label)}`
  return `<div class="cc-fig" aria-label="${esc(fig)} ${unit}"><span class="cc-cur" aria-hidden="true"></span><span class="cc-n" aria-hidden="true">${digits(fig)}</span><span class="cc-was" aria-hidden="true">${unit}</span></div>`
}

function layoutPoster(c) {
  const a = c.afterClose
  const pr = c.proof
  const proof = pr
    ? `<div class="cc-proof"><span class="cc-score">${esc(pr.score)}<small>${esc(pr.label)}</small></span><blockquote>${esc(pr.quote)}</blockquote><cite>${esc(pr.cite)}</cite></div>`
    : ''
  const win = c.opened && c.closes
    ? `<div class="cc-win">
      <div class="cc-win-row cc-lbl"><span>${esc(c.openedLabel ?? '')}</span><b>${both(esc(c.closes.label), a?.window ? esc(a.window) : null)}</b></div>
      <div class="cc-track"><div class="cc-draw"><div class="cc-ticks"></div><div class="cc-rail"></div><div class="cc-gone"></div><div class="cc-left"></div></div>
        <div class="cc-today"><span class="cc-lbl" data-days="${esc(c.fact.window ?? 'Today · {days} days left')}"></span></div>
        <div class="cc-end" aria-hidden="true"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" pathLength="70" stroke-dasharray="70"/></svg></div></div>
    </div>`
    : ''
  const copy = (k) => `${k.lede ? `<p class="cc-lede">${rich(k.lede)}</p>` : ''}${actions(k)}`
  return `<div class="cc-ps">
  <div class="cc-ps-head cc-lbl"><span>${esc(c.brand)}</span>${c.serial ? `<b>${esc(c.serial)}</b>` : ''}</div>
  <div class="cc-ps-title">${both(`<p class="cc-eyebrow cc-lbl">${esc(c.eyebrow)}</p><h2 class="cc-h" id="cc-h">${rich(c.headline)}</h2>`, a ? `<p class="cc-eyebrow cc-lbl">${esc(a.eyebrow ?? c.eyebrow)}</p><h2 class="cc-h">${rich(a.headline)}</h2>` : null)}</div>
  <div class="cc-ps-grid">
    ${both(figure(c), a?.fact ? figure(c, a.fact) : null)}
    <div class="cc-ps-copy">${both(copy(c), a ? copy({ lede: a.lede ?? c.lede, primary: a.primary, secondary: c.secondary }) : null)}${proof}</div>
  </div>
  ${win}
</div>`
}

function layoutSentence(c) {
  const s = c.sentence
  const a = c.afterClose
  let i = 0
  const pieces = s.parts.map((x) => {
    if (typeof x === 'string') return esc(x)
    const k = Object.keys(x)[0], b = x[k], id = `cc-f${i++}`
    const cap = `<span class="cc-cap cc-lbl" aria-hidden="true">${esc(b.caption)}</span>`
    const chev = '<svg class="cc-chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
    if (k === 'count') {
      const opts = Array.from({ length: b.max - b.min + 1 }, (_, j) => b.min + j).map((n) => `<option${n === (b.default ?? b.min) ? ' selected' : ''}>${n}</option>`).join('')
      return `<span class="cc-blank"><label class="cc-sr" for="${id}">${esc(b.caption)}</label><select id="${id}" name="count">${opts}</select>${chev}<span class="cc-rule" aria-hidden="true"></span>${cap}</span>`
    }
    if (k === 'option')
      return `<span class="cc-blank"><label class="cc-sr" for="${id}">${esc(b.caption)}</label><select id="${id}" name="option">${b.values.map((v) => `<option${v === b.default ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>${chev}<span class="cc-rule" aria-hidden="true"></span>${cap}</span>`
    return `<span class="cc-blank cc-mail"><label class="cc-sr" for="${id}">${esc(b.caption)}</label><input id="${id}" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" required placeholder="${esc(b.placeholder)}" aria-describedby="cc-msg"><span class="cc-rule" aria-hidden="true"></span>${cap}</span>`
  })
  // words and blanks join with single spaces; a blank directly before punctuation keeps it tight
  let sayHtml = ''
  s.parts.forEach((x, j) => {
    const piece = pieces[j]
    if (j === 0) sayHtml = piece
    else if (typeof x === 'string' && /^[.,;:?]/.test(x)) sayHtml += piece
    else sayHtml += ' ' + piece
  })
  const count = s.parts.find((x) => x && x.count)?.count
  const n0 = count ? (count.default ?? count.min) : 1
  const label = esc(s.button)
  const btnText = `<span data-each="${label}" data-price="${s.price ?? 0}">${label.replace('{n}', n0)}</span>`
  const price = s.price ? `<span class="cc-price" data-each="${esc(s.currency)}{total}" data-price="${s.price}">${esc(s.currency)}${(s.price * n0).toLocaleString('en-GB')}</span>` : ''
  const fact = c.fact
  const right = fact.kind === 'count' ? `${fact.value} of ${fact.of} ${esc(fact.label).toLowerCase()}` : esc(fact.label)
  const open = `<form class="cc-form" action="${esc(s.action)}" method="post" novalidate>
    <p class="cc-say cc-h" id="cc-h">${sayHtml}</p>
    <p class="cc-msg" id="cc-msg" role="alert" aria-live="assertive"></p>
    <div class="cc-st-foot"><button class="cc-btn cc-primary" type="submit"><span class="cc-go">${btnText} <span class="cc-ar" aria-hidden="true">→</span></span><span class="cc-dots" hidden aria-label="Sending"><i></i><i></i><i></i></span>${price}</button><p class="cc-fine">${esc(s.fine)}</p></div>
  </form>
  <div class="cc-sent" data-say="${esc(s.sent)}">
    <p class="cc-say cc-h" tabindex="-1" aria-live="polite"></p>
    ${s.holdLabel ? `<div class="cc-hold"><div><span class="cc-lbl">${esc(s.holdLabel)}</span><span data-fill="${esc(s.holdLine ?? '')}"></span></div>${s.holdNote ? `<div><span class="cc-lbl">Next</span>${esc(s.holdNote)}</div>` : ''}</div>` : ''}
  </div>`
  const closed = a ? `<h2 class="cc-say cc-h">${rich(a.headline)}</h2>${a.lede ? `<p class="cc-lede">${rich(a.lede)}</p>` : ''}<div class="cc-st-foot">${actions({ primary: a.primary })}</div>` : null
  return `<div class="cc-st">
  <div class="cc-st-head cc-lbl">${both(`<span>${esc(c.eyebrow)}</span><b>${right}</b>`, a ? `<span>${esc(a.eyebrow ?? c.eyebrow)}</span><b>${esc(c.closes.label)}</b>` : null)}</div>
  ${both(open, closed)}
</div>`
}

const STAMP_CSS = `.cc .cc-st-ring{font:500 13.5px/1 var(--mono);letter-spacing:2.2px}.cc .cc-st-big{font:var(--display-heavy) 58px/1 var(--display)}.cc .cc-st-small{font:500 15px/1 var(--mono);letter-spacing:3px}.cc [data-when]{display:contents}.cc [hidden]{display:none!important}`

export function build(c) {
  const problems = validate(c)
  if (problems.length) return { problems }
  const notes = []
  const cfg = {}
  if (c.closes) {
    cfg.closes = zoned(c.closes.at, c.closes.tz)
    cfg.tz = c.closes.tz
    const d = new Date(cfg.closes)
    c._closeDay = new Intl.DateTimeFormat('en-GB', { timeZone: c.closes.tz, day: 'numeric' }).format(d)
    c._closeMonth = new Intl.DateTimeFormat('en-GB', { timeZone: c.closes.tz, month: 'short' }).format(d).toUpperCase()
  }
  if (c.opened) cfg.opened = zoned(c.opened, c.closes.tz)
  if (c.preview?.now) cfg.previewNow = c.preview.now
  if (c.layout === 'sentence') cfg.form = { errEmpty: c.sentence.errEmpty, errBad: c.sentence.errBad, errSend: c.sentence.errSend }
  if (c.layout === 'poster' && c.fact.kind === 'price' && !c.openedLabel) notes.push('openedLabel is empty: the price window has no start label')
  const body = { stub: layoutStub, poster: layoutPoster, sentence: layoutSentence }[c.layout](c)
  const section = `<section class="cc" data-layout="${c.layout}" aria-labelledby="cc-h" style="${tokens(c)}" data-cc='${JSON.stringify(cfg).replace(/'/g, '&#39;')}'>
${body}
</section>`
  const css = readFileSync(join(KIT, 'cta.css'), 'utf8') + STAMP_CSS
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref(c)}">`
  const embed = `<!-- Closing CTA Kit: paste this above your footer. It brings its own fonts, styles and script; every class starts with cc-. -->
${fonts}
<style>${css}</style>
${section}
<script>${js}</script>
`
  const t = c.theme
  const ink = t.ink, page = c.layout === 'stub' ? mix(t.band, '#ffffff', lum(t.band) < 0.2 ? 0.02 : 0.3) : t.band
  const above = (c.demo?.above ?? []).map(([q, x]) => `<div class="pg-q"><span>${esc(q)}</span><span>${esc(x)}</span></div>`).join('')
  const pageCss = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{-webkit-text-size-adjust:100%}body{background:${page};color:${ink};overflow-x:hidden}
.pg-above{min-height:100vh;display:flex;flex-direction:column;justify-content:flex-end;max-width:1200px;margin:0 auto;padding:72px 24px 88px;font:400 17px/1.5 ${DISPLAYS[t.display ?? 'shoulders'].text}}
.pg-above h2{font:${DISPLAYS[t.display ?? 'shoulders'].weight} 48px/1 ${DISPLAYS[t.display ?? 'shoulders'].family};text-transform:${DISPLAYS[t.display ?? 'shoulders'].case};margin-bottom:36px;letter-spacing:${DISPLAYS[t.display ?? 'shoulders'].track}}
.pg-q{display:flex;justify-content:space-between;gap:24px;border-top:1px solid rgba(${rgb(ink)},.18);padding:20px 0}.pg-q:last-child{border-bottom:1px solid rgba(${rgb(ink)},.18)}
.pg-q span:last-child{font-family:${DISPLAYS[t.display ?? 'shoulders'].mono};color:${soften(ink, page, 5.2)}}
.pg-foot{background:${mix(t.band, '#000000', lum(t.band) < 0.2 ? 0.4 : 0.12)};color:${soften(ink, mix(t.band, '#000000', lum(t.band) < 0.2 ? 0.4 : 0.12), 5.2)};padding:28px 24px calc(28px + env(safe-area-inset-bottom));font:400 14px/1.5 ${DISPLAYS[t.display ?? 'shoulders'].text}}
.pg-foot div{max-width:1200px;margin:0 auto}
@media (max-width:640px){.pg-above{padding:48px 16px 56px;font-size:16px}.pg-above h2{font-size:36px}.pg-q{flex-direction:column;gap:4px}.pg-foot{font-size:16px}}`
  const html = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.brand)}</title>
<meta name="description" content="${esc(c.eyebrow)}">
${fonts}
<style>${pageCss}</style>
<style>${css}</style>
</head>
<body>
<main>
<div class="pg-above">${above ? `<h2>Questions</h2>${above}` : ''}</div>
${section}
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
  if (!input) {
    console.log('usage: node scripts/build.mjs cta.json [out]')
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
  writeFileSync(join(outDir, 'cta-embed.html'), r.embed)
  for (const n of r.notes) console.log(`note: ${n}`)
  const shown = (p) => { const x = relative(process.cwd(), resolve(p)); return x.startsWith('..') ? resolve(p) : x }
  console.log(`wrote ${shown(join(outDir, 'index.html'))} and ${shown(join(outDir, 'cta-embed.html'))}`)
}
