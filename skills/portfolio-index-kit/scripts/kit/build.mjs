// Work Index: builds work.json into
//   out/index.html          the index (Index and Grid views, filter, the plate)
//   out/work/<slug>.html    one case page per project
//   out/embed.html          the index section alone, to paste into a site
//   out/media/              every picture as WebP at 160, 480, 960, 1600 and 2400 px wide
//                           (never wider than the original), loops copied as they are
//
//   node scripts/build.mjs work.json out
//
// Pictures are resized in headless Chrome (CHROME_PATH), so nothing needs
// installing. A resized file is reused while it is newer than its original.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'
import { DISPLAYS, STYLES, contrast, lum, mix, rgbOf, soften, validate } from './schema.mjs'
import { serve } from './serve.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const KIT = join(here, '..', '..', 'kit')
const WIDTHS = [160, 480, 960, 1600, 2400]

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rich = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>')
const pad = (n) => String(n).padStart(2, '0')
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '')

/** colour and type tokens for .wi */
export function tokens(c) {
  const t = c.theme, d = DISPLAYS[t.display], st = STYLES[c.style]
  const dark = t.mode === 'dark'
  const plate = t.plate ?? (dark ? mix(t.ground, '#ffffff', 0.04) : mix(t.ground, '#ffffff', 0.55))
  const v = {
    '--bg': t.ground, '--ink': t.ink, '--accent': t.accent, '--plate': plate,
    '--mute': soften(t.ink, t.ground, 5.4),
    '--rule': mix(t.ink, t.ground, dark ? 0.84 : 0.8), '--rule-strong': mix(t.ink, t.ground, 0.66),
    '--dot': t.accent,
    '--cap-bg': dark ? plate : t.ink, '--cap-ink': dark ? t.ink : t.ground, '--cap-rule': dark ? `1px solid ${mix(t.ink, t.ground, 0.84)}` : '0',
    '--plate-shadow': dark ? '0 30px 60px -20px rgba(0,0,0,.8)' : '0 24px 50px -24px rgba(20,16,8,.45), 0 2px 6px rgba(20,16,8,.12)',
    '--display': d.display, '--text': d.text, '--mono': d.mono,
    '--h1-weight': d.h1.weight, '--h1-size': `${d.h1.size}px`, '--h1-lh': d.h1.lh, '--h1-track': d.h1.track, '--h1-vary': d.h1.vary, '--h1-phone': `${d.h1.phone}px`,
    '--em-style': d.em.style, '--em-weight': d.em.weight, '--em-track': d.em.track,
    '--ti-weight': d.ti.weight, '--ti-track': d.ti.track, '--ti-vary': d.ti.vary, '--ti-size': `${st.ti}px`, '--ti-phone': `${st.tiPhone}px`,
    '--mark-font': d.mark.font === 'display' ? d.display : d.text, '--mark-weight': d.mark.weight, '--mark-size': `${d.mark.size}px`,
    '--case-size': `${d.caseSize}px`, '--case-phone': `${d.casePhone}px`, '--lead-size': `${d.lead}px`, '--lead-phone': `${d.leadPhone}px`, '--pn-size': `${d.pn}px`, '--pn-phone': `${d.pnPhone}px`,
    '--grid-cols': st.cols[0], '--grid-cols-t': st.cols[1], '--grid-cols-p': st.cols[2], '--grid-ar': st.ar, '--grid-ti': `${st.gridTi}px`,
  }
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')
}
const fonts = (c) => `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${DISPLAYS[c.theme.display].google}&display=swap">`

/* ---------- pictures ---------- */
async function resizeAll(c, base, out) {
  const jobs = []
  const want = (src) => { const f = resolve(base, src); if (!jobs.some((j) => j.f === f)) jobs.push({ f, stem: basename(f, extname(f)).replace(/[^a-z0-9-]/gi, '-').toLowerCase() }) ; return f }
  for (const p of c.projects) {
    if (p.image) want(p.image.src)
    if (p.loop) want(p.loop.poster)
    for (const g of p.case?.gallery ?? []) want(g.src)
  }
  // two different files with one name get numbered
  const seen = new Map()
  for (const j of jobs) { const n = seen.get(j.stem) ?? 0; seen.set(j.stem, n + 1); if (n) j.stem += `-${n + 1}` }
  mkdirSync(join(out, 'media'), { recursive: true })
  const manifest = join(out, 'media', '.sizes.json')
  const known = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {}
  const todo = jobs.filter((j) => {
    const k = known[j.f]
    return !(k && k.mtime === statSync(j.f).mtimeMs && k.files.every((x) => existsSync(join(out, 'media', x))))
  })
  if (todo.length) {
    // serve the folder that holds every picture, so the page can read them (same origin)
    const parts = todo.map((j) => dirname(j.f).split('/'))
    let common = parts[0]
    for (const q of parts) { let k = 0; while (k < common.length && common[k] === q[k]) k++; common = common.slice(0, k) }
    const root = common.join('/') || '/'
    const server = await serve(root)
    const chrome = await launch({ width: 800, height: 600 })
    try {
      const tab = await chrome.page()
      await tab.send('Runtime.enable')
      const loaded = tab.once('Page.loadEventFired', 30000).catch(() => {})
      await tab.send('Page.enable')
      await tab.send('Page.navigate', { url: server.url + 'favicon-none' })
      await loaded
      for (const j of todo) {
        const url = server.url + relative(root, j.f).split('/').map(encodeURIComponent).join('/')
        const r = await tab.send('Runtime.evaluate', {
          awaitPromise: true, returnByValue: true,
          expression: `(async () => {
            const blob = await (await fetch(${JSON.stringify(url)})).blob()
            const bmp = await createImageBitmap(blob)
            const out = []
            for (const w of ${JSON.stringify(WIDTHS)}) {
              if (w > bmp.width && w !== ${WIDTHS[0]}) continue
              const W = Math.min(w, bmp.width), H = Math.round(bmp.height * W / bmp.width)
              const cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d')
              cx.imageSmoothingQuality = 'high'
              cx.drawImage(bmp, 0, 0, W, H)
              const b = await cv.convertToBlob({ type: 'image/webp', quality: W <= 480 ? 0.8 : 0.84 })
              const a = new Uint8Array(await b.arrayBuffer())
              let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768))
              out.push({ w: W, h: H, data: btoa(s) })
            }
            return { w: bmp.width, h: bmp.height, out }
          })()`,
        })
        if (r.exceptionDetails) throw new Error(`could not read ${relative(process.cwd(), j.f)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`)
        const v = r.result.value
        const files = v.out.map((o) => { const n = `${j.stem}-${o.w}.webp`; writeFileSync(join(out, 'media', n), Buffer.from(o.data, 'base64')); return n })
        known[j.f] = { mtime: statSync(j.f).mtimeMs, w: v.w, h: v.h, files, widths: v.out.map((o) => o.w) }
      }
    } finally {
      await chrome.close()
      server.close()
    }
    writeFileSync(manifest, JSON.stringify(known))
  }
  const pic = (src, prefix = '') => {
    const k = known[resolve(base, src)]
    const files = k.files.map((f, i) => ({ f: prefix + 'media/' + f, w: k.widths[i] }))
    const big = files.filter((x) => x.w >= 480)
    return {
      w: k.w, h: k.h,
      chip: files[0].f,
      src: (files.find((x) => x.w === 960) ?? files.at(-1)).f,
      srcset: (big.length ? big : files).map((x) => `${x.f} ${x.w}w`).join(', '),
    }
  }
  return pic
}
function copyLoop(p, base, out) {
  const f = resolve(base, p.loop.src)
  const n = basename(f).replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
  const to = join(out, 'media', n)
  if (!existsSync(to) || statSync(to).mtimeMs < statSync(f).mtimeMs) copyFileSync(f, to)
  return 'media/' + n
}

/* ---------- markup ---------- */
const ICON_INDEX = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M0 2h14M0 7h14M0 12h14" stroke="currentColor" stroke-width="1.4"/></svg>'
const ICON_GRID = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M0 0h6v6H0zM8 0h6v6H8zM0 8h6v6H0zM8 8h6v6H8z" fill="currentColor"/></svg>'
const PLUS = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0v10M0 5h10" stroke="currentColor" stroke-width="1.4"/></svg>'

function bar(c, prefix, current) {
  const s = c.site
  const nav = (s.nav ?? []).map((l, i) => `<a href="${esc(l.href)}"${ext(l.href)}${i === current ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`).join('')
  return `<header class="wi-wrap"><div class="wi-bar"><a class="wi-mark" href="${prefix}index.html">${esc(s.name)}</a><nav class="wi-nav" aria-label="Site">${nav}</nav>${s.availability ? `<p class="wi-avail"><i aria-hidden="true"></i>${esc(s.availability)}</p>` : ''}<a class="wi-menu" href="${s.nav?.length ? esc(s.nav.at(-1).href) : `mailto:${esc(s.email)}`}">${s.nav?.length ? esc(s.nav.at(-1).label) : 'Contact'}</a></div></header>`
}
function footer(c) {
  const s = c.site
  return `<footer class="wi-foot"><span>${esc(s.name)}${s.place ? ` · ${esc(s.place)}` : ''}</span><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></footer>`
}
const media = (p, pic, sizes, lazy = true, prefix = '') => {
  if (p.loop) {
    const poster = pic(p.loop.poster, prefix)
    return `<video src="${prefix}${p._loop}" poster="${poster.src}" muted loop playsinline preload="none" aria-label="${esc(p.loop.alt)}" width="${poster.w}" height="${poster.h}"></video>`
  }
  const m = pic(p.image.src, prefix)
  return `<img src="${m.src}" srcset="${m.srcset}" sizes="${sizes}" alt="${esc(p.image.alt)}" width="${m.w}" height="${m.h}"${lazy ? ' loading="lazy"' : ''} decoding="async">`
}
const dims = (p, pic) => pic(p.image ? p.image.src : p.loop.poster)

function indexSection(c, pic) {
  const s = c.site, P = c.projects
  const discs = c.disciplines ?? [...new Set(P.map((p) => p.discipline))]
  const years = P.map((p) => +p.year)
  const note = s.note ?? `${P.length} projects · ${Math.min(...years)}–${Math.max(...years)}`
  const statement = rich(s.statement)
  const rows = P.map((p, i) => {
    const d = dims(p, pic)
    const chipSrc = pic(p.image ? p.image.src : p.loop.poster)
    return `<li class="wi-row" data-i="${i}" data-d="${esc(p.discipline)}">
<a class="wi-r" href="work/${p.slug}.html"><span class="wi-no">${pad(i + 1)}</span><span class="wi-chip"><img src="${chipSrc.chip}" srcset="${chipSrc.srcset}, ${chipSrc.chip} 160w" sizes="64px" alt="" width="${d.w}" height="${d.h}" loading="lazy" decoding="async"></span><span class="wi-ti">${esc(p.title)}</span><span class="wi-cl">${esc(p.client)}${p.place ? `<small>${esc(p.place)}</small>` : ''}</span><span class="wi-ds wi-lbl">${esc(p.discipline)}</span><span class="wi-oc">${esc(p.outcome)}</span><span class="wi-yr">${esc(p.year)}</span></a>
<button class="wi-tg" type="button" aria-expanded="false" aria-controls="wi-p${i}"><span class="th"><img src="${chipSrc.chip}" alt="" width="${d.w}" height="${d.h}" loading="lazy"></span><span class="tl wi-lbl"><span>Plate</span>${PLUS}</span><span class="wi-sr"> for ${esc(p.title)}</span></button>
<div class="wi-inl" id="wi-p${i}" hidden><div><figure style="aspect-ratio:${d.w} / ${d.h}">${media(p, pic, '(max-width: 760px) 92vw, 600px')}</figure><div class="wi-icap"><span>Pl. ${pad(i + 1)} · ${esc(p.year)}</span><a href="work/${p.slug}.html">Open the case</a></div></div></div>
</li>`
  }).join('\n')
  const items = P.map((p) => {
    const d = dims(p, pic)
    return { title: p.title, client: p.client, year: p.year, w: d.w, h: d.h, src: d.src, srcset: d.srcset, ...(p.loop ? { loop: p._loop, poster: d.src, seconds: p.loop.seconds } : {}) }
  })
  const st = STYLES[c.style]
  const pv = c.preview ?? {}
  const data = {
    items, plate: st.plate, dim: c.theme.mode === 'dark' ? 0.4 : 0.34,
    gridSizes: `(max-width: 760px) ${Math.round(100 / st.cols[2])}vw, (max-width: 1100px) ${Math.round(100 / st.cols[1])}vw, ${Math.round(1360 / st.cols[0])}px`,
    preview: { hover: pv.hover ?? [1, Math.min(3, P.length - 1)], filter: pv.filter ?? discs[0], open: pv.open ?? 1 },
    loopSeconds: P.find((p) => p.loop)?.loop.seconds ?? 12,
  }
  return `<main class="wi-wrap" id="work">
<section class="wi-mast"><h1>${statement}</h1><div class="wi-sub"><p>${esc(s.lede).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')}</p><span class="wi-cnt wi-lbl">${esc(note)}</span></div>${s.availability ? `<p class="wi-avail-m"><i aria-hidden="true"></i>${esc(s.availability)}</p>` : ''}</section>
<div class="wi-ctrl"><div class="wi-filters" role="group" aria-label="Filter by discipline"><button type="button" aria-pressed="true" data-f="*">All<sup>${P.length}</sup></button>${discs.map((d) => `<button type="button" aria-pressed="false" data-f="${esc(d)}">${esc(d)}<sup>${P.filter((p) => p.discipline === d).length}</sup></button>`).join('')}</div>
<div class="wi-views" role="group" aria-label="View"><button type="button" aria-pressed="true" data-v="index" aria-label="Index">${ICON_INDEX}<span class="lbl">Index</span></button><button type="button" aria-pressed="false" data-v="grid" aria-label="Grid">${ICON_GRID}<span class="lbl">Grid</span></button></div></div>
<p class="wi-sr" id="wi-count" aria-live="polite">${P.length} projects shown</p>
<div class="wi-idx" data-view="index"><div class="wi-head wi-lbl" aria-hidden="true"><span>No.</span><span class="h-ch"></span><span>Project</span><span>Client</span><span class="h-ds">Discipline</span><span>Outcome</span><span>Year</span></div>
<ol class="wi-list">
${rows}
</ol></div>
${footer(c)}
</main>
<div class="wi-plate" aria-hidden="true"><div class="wi-frame"></div><div class="wi-pcap"></div></div>
<div class="wi-cursor" aria-hidden="true"><svg viewBox="0 0 22 22" width="22" height="22"><path d="M2 1 L2 18 L6.5 13.6 L9.6 20.6 L12.6 19.3 L9.6 12.4 L15.8 12.4z" fill="#111" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg><span class="ring"></span></div>
<script type="application/json" id="wi-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

function page(c, title, body, { css, js = '', prefix = '', desc = '' }) {
  return `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
${fonts(c)}
<style>${css}</style>
</head>
<body class="wi" data-style="${c.style}" data-mode="${c.theme.mode}" style="${tokens(c)}">
<a class="wi-skip" href="#work">Skip to the work</a>
${bar(c, prefix, 0)}
${body}
${js ? `<script>${js}</script>` : ''}
</body>
</html>
`
}

function casePage(c, i, pic) {
  const P = c.projects, p = P[i], n = P.length, k = p.case ?? {}
  const prev = P[(i + n - 1) % n], next = P[(i + 1) % n]
  const d = dims(p, pic)
  const thumb = (q) => { const m = pic(q.image ? q.image.src : q.loop.poster, '../'); return `<span class="th"><img src="${m.chip}" srcset="${m.srcset}" sizes="96px" alt="" loading="lazy"></span>` }
  const hero = media(p, pic, '(max-width: 760px) 100vw, 1200px', false, '../').replace('preload="none"', 'preload="auto" autoplay')
  const meta = [['Client', p.client], ['Year', p.year], ['Discipline', p.discipline], ...(p.place ? [['Place', p.place]] : []), ['Outcome', p.outcome]]
  const gallery = (k.gallery ?? []).map((g) => { const m = pic(g.src, '../'); return `<figure><img src="${m.src}" srcset="${m.srcset}" sizes="(max-width: 760px) 100vw, 660px" alt="${esc(g.alt)}" width="${m.w}" height="${m.h}" loading="lazy" decoding="async">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>` }).join('')
  const body = `<main id="work">
<section class="wi-wrap wi-case-top"><div><p class="wi-k wi-lbl"><a href="../index.html">Index</a><span>${pad(i + 1)} / ${pad(n)}</span><span>${esc(p.discipline)}</span><span>${esc(p.year)}</span></p><h1>${esc(p.title)}</h1></div>
<dl class="wi-meta">${meta.map(([a, b]) => `<dt class="wi-lbl">${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl></section>
<div class="wi-hero"><figure style="--ar:${d.w} / ${d.h}">${hero}</figure></div>
<section class="wi-wrap wi-case-body"><div><p class="wi-lead">${esc(k.intro ?? p.outcome)}</p><div class="wi-body">${(k.body ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}</div></div>
<div class="wi-credits"><h2 class="wi-lbl">Credits</h2><dl>${k.credits.map((x) => `<dt>${esc(x.role)}</dt><dd>${esc(x.name)}</dd>`).join('')}</dl>${k.links?.length ? `<p class="wi-links">${k.links.map((l) => `<a href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}</a>`).join('')}</p>` : ''}</div></section>
${gallery ? `<section class="wi-wrap wi-gallery" aria-label="More pictures">${gallery}</section>` : ''}
<nav class="wi-wrap wi-pn" aria-label="More work"><a href="${prev.slug}.html" rel="prev">${thumb(prev)}<span><span class="s wi-lbl">← Previous · ${pad(((i + n - 1) % n) + 1)}</span><span class="t">${esc(prev.title)}</span></span></a><a href="${next.slug}.html" rel="next"><span><span class="s wi-lbl">Next · ${pad(((i + 1) % n) + 1)} →</span><span class="t">${esc(next.title)}</span></span>${thumb(next)}</a></nav>
<div class="wi-wrap">${footer(c)}</div>
</main>`
  const js = `(function(){var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;document.querySelectorAll('.wi-hero video').forEach(function(v){if(rm){v.removeAttribute('autoplay');v.pause();v.controls=true}});addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft')location.href=${JSON.stringify(prev.slug + '.html')};if(e.key==='ArrowRight')location.href=${JSON.stringify(next.slug + '.html')}})})()`
  return { body, js }
}

export async function build(input, outDir) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found`)
  let c
  try { c = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new Error(`${input} is not valid JSON: ${e.message}`) }
  const base = dirname(file)
  const { errors, warnings } = validate(c, base)
  for (const w of warnings) console.warn(`warning: ${w}`)
  if (errors.length) {
    const e = new Error(`${errors.length} problem${errors.length > 1 ? 's' : ''} in ${input}:\n${errors.map((x) => `  - ${x}`).join('\n')}`)
    e.listed = true
    throw e
  }
  const out = resolve(outDir)
  mkdirSync(join(out, 'work'), { recursive: true })
  const pic = await resizeAll(c, base, out)
  for (const p of c.projects) if (p.loop) p._loop = copyLoop(p, base, out)
  const css = readFileSync(join(KIT, 'index.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const section = indexSection(c, pic)
  const s = c.site
  writeFileSync(join(out, 'index.html'), page(c, `${s.name} · Work`, section, { css, js, desc: s.lede.replace(/\*\*/g, '') }))
  // the embed: the index section with its own style and runtime, for a page that already has a header
  writeFileSync(join(out, 'embed.html'), `<!-- Work Index embed: paste inside <body>; keep the work/ and media/ folders next to the page. -->\n${fonts(c)}\n<style>${css}</style>\n<div class="wi" data-style="${c.style}" data-mode="${c.theme.mode}" style="${tokens(c)}">\n${section}\n</div>\n<script>${js}</script>\n`)
  c.projects.forEach((p, i) => {
    const { body, js: cjs } = casePage(c, i, pic)
    writeFileSync(join(out, 'work', `${p.slug}.html`), page(c, `${p.title} · ${s.name}`, body, { css, js: cjs, prefix: '../', desc: p.outcome }))
  })
  return { out, pages: c.projects.length + 1, warnings }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, out = 'out'] = argv.filter((a) => !a.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs work.json [out]')
    process.exit(1)
  }
  try {
    const r = await build(input, out)
    const shown = relative(process.cwd(), r.out) || '.'
    console.log(`wrote ${shown}/index.html, ${shown}/embed.html and ${r.pages - 1} case pages in ${shown}/work/`)
  } catch (e) {
    console.error(e.listed ? e.message : `build failed: ${e.message}`)
    process.exit(1)
  }
}
void contrast; void lum; void rgbOf
