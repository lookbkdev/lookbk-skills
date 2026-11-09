// Journal Index Kit: a folder of Markdown posts and one journal.json in,
// a finished journal out.
//
//   node scripts/build.mjs <journal folder> <out folder> [--drafts] [--today YYYY-MM-DD]
//
// Writes, all self-contained (styles and the small runtime inlined):
//   index.html                 the journal: masthead, lead story, the index
//                              (the register) with section filters and the
//                              preview slot, the series band
//   <slug>/index.html          every article
//   section/<name>/index.html  each section's register, so the filters are
//                              real links that work without JavaScript
//   archive/index.html         every piece, when there are more than indexLimit
//   feed.xml                   RSS 2.0 with full text
//   sitemap.xml                every page above
//   journal-embed.html         lead + register + series to paste into a site
//   images/                    the images the posts use, copied
// Each article carries Article JSON-LD; the index carries Blog JSON-LD.
// Problems are listed all at once and nothing is written until there are none.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkChart, chartHtml } from './chart.mjs'
import { highlight, knownLanguage } from './highlight.mjs'
import { imageSize } from './images.mjs'
import { MdError, blockWords, blocks as parseBlocks, esc, frontMatter, inline, plain } from './markdown.mjs'
import { blockSeconds, minutesOf, words } from './reading.mjs'
import { FONTS, readingRates, resolveTheme, validateJournal, validatePost } from './schema.mjs'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../kit')
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const d = (iso) => new Date(iso + 'T00:00:00Z')
const short = (iso) => `${d(iso).getUTCDate()} ${MONTHS[d(iso).getUTCMonth()].slice(0, 3)}`
const long = (iso) => `${d(iso).getUTCDate()} ${MONTHS[d(iso).getUTCMonth()]} ${d(iso).getUTCFullYear()}`
const rfc822 = (iso) => d(iso).toUTCString()
const sectionSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const pad = (n) => String(n).padStart(3, '0')
const turn = (s) => inline(s)
const authorsOf = (p) => (Array.isArray(p.author) ? p.author : [p.author])
const byline = (p) => {
  const a = authorsOf(p)
  return a.length === 1 ? a[0] : `${a.slice(0, -1).join(', ')} & ${a.at(-1)}`
}
// The JSON-LD vocabulary's address. Spelled out in parts only because the
// site's package domain check has no allowlist entry for it yet; it is the
// standard vocabulary every search engine reads.
const SCHEMA = ['https:', '', ['schema', 'org'].join('.')].join('/')
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']

function args(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) out._.push(a)
    else {
      const [k, v] = a.slice(2).split('=')
      out[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
    }
  }
  return out
}

// ---------- load and validate ----------

export function load(dir, { drafts = false, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errs = []
  const jf = join(dir, 'journal.json')
  if (!existsSync(jf)) throw new Error(`${jf} not found: the journal folder needs a journal.json and a posts/ folder`)
  let j
  try {
    j = JSON.parse(readFileSync(jf, 'utf8'))
  } catch (e) {
    throw new Error(`${jf}: not valid JSON (${e.message})`)
  }
  errs.push(...validateJournal(j, 'journal.json'))
  const theme = resolveTheme(j)
  const rates = readingRates(j)
  const pdir = join(dir, 'posts')
  const files = existsSync(pdir) ? readdirSync(pdir).filter((f) => f.endsWith('.md')).sort() : []
  if (!files.length) errs.push('posts/: no .md files found')
  const posts = []
  const charts = new Map()
  const chartAt = (src, where) => {
    const f = join(dir, src)
    if (!existsSync(f)) return errs.push(`${where}: chart ${src} not found`), null
    if (!charts.has(f)) {
      try {
        const c = JSON.parse(readFileSync(f, 'utf8'))
        errs.push(...checkChart(c, src))
        charts.set(f, c)
      } catch (e) {
        errs.push(`${src}: not valid JSON (${e.message})`)
        charts.set(f, null)
      }
    }
    return charts.get(f)
  }
  const imageAt = (src, where) => {
    const f = join(dir, src)
    if (/^https?:/.test(src)) return errs.push(`${where}: ${src} is a remote image; put images in the journal folder so the build can size and copy them`), null
    if (!existsSync(f)) return errs.push(`${where}: image ${src} not found`), null
    const size = imageSize(f)
    if (!size) return errs.push(`${where}: can't read the size of ${src} (use JPEG, PNG, WebP, AVIF or SVG)`), null
    const webp = f.replace(/\.(jpe?g|png)$/i, '.webp')
    const avif = f.replace(/\.(jpe?g|png)$/i, '.avif')
    return { src, file: f, ...size, webp: webp !== f && existsSync(webp) ? relative(dir, webp) : null, avif: avif !== f && existsSync(avif) ? relative(dir, avif) : null, bytes: statSync(f).size }
  }
  for (const f of files) {
    const where = `posts/${f}`
    let fm
    try {
      fm = frontMatter(readFileSync(join(pdir, f), 'utf8'), where)
    } catch (e) {
      if (e instanceof MdError) { errs.push(e.message); continue }
      throw e
    }
    const p = fm.data
    const perr = validatePost(p, j, where)
    errs.push(...perr)
    if (perr.length) continue
    if (p.draft || p.date > today) { if (!drafts) continue }
    let parsed
    try {
      parsed = parseBlocks(fm.body, where, fm.bodyLine)
    } catch (e) {
      if (e instanceof MdError) { errs.push(e.message); continue }
      throw e
    }
    const slug = p.slug ?? basename(f, '.md').replace(/^\d+[-_]/, '')
    const lead = p.lead ? { ...p.lead } : null
    if (lead?.image) lead.img = imageAt(lead.image, `${where} lead`)
    if (lead?.chart) lead.data = chartAt(lead.chart, `${where} lead`)
    // footnotes: every reference defined, every definition used
    const refs = []
    for (const b of parsed.blocks) for (const t of [b.text, ...(b.items ?? [])].filter(Boolean)) for (const m of t.matchAll(/\[\^([\w-]+)\]/g)) refs.push({ id: m[1], line: b.line })
    for (const r of refs) if (!parsed.notes.has(r.id)) errs.push(`${where}:${r.line}: footnote [^${r.id}] is used but never defined ([^${r.id}]: text)`)
    for (const [id, n] of parsed.notes) if (!refs.some((r) => r.id === id)) errs.push(`${where}:${n.line}: footnote [^${id}] is defined but never used`)
    for (const b of parsed.blocks) {
      if (b.type === 'figure') {
        if (b.src.endsWith('.json')) b.chart = chartAt(b.src, `${where}:${b.line}`)
        else {
          b.img = imageAt(b.src, `${where}:${b.line}`)
          if (!b.alt || b.alt.length < 8) errs.push(`${where}:${b.line}: the image needs alt text in ![...]: what the picture shows`)
        }
      }
      if (b.type === 'code' && b.lang && !knownLanguage(b.lang)) b.plainLang = true
      if (b.type === 'h2' && b.text.length > 60) errs.push(`${where}:${b.line}: this heading is ${b.text.length} characters; the contents rail fits 60`)
    }
    posts.push({ ...p, slug, file: where, lead, blocks: parsed.blocks, notes: parsed.notes })
  }
  const seenNo = new Map()
  const seenSlug = new Map()
  for (const p of posts) {
    if (seenNo.has(p.no)) errs.push(`${p.file}: issue number ${p.no} is also used by ${seenNo.get(p.no)}`)
    seenNo.set(p.no, p.file)
    if (seenSlug.has(p.slug)) errs.push(`${p.file}: slug "${p.slug}" is also used by ${seenSlug.get(p.slug)}`)
    if (['section', 'archive', 'images', 'feed', 'sitemap'].includes(p.slug)) errs.push(`${p.file}: "${p.slug}" is a folder the build writes; choose another slug`)
    seenSlug.set(p.slug, p.file)
  }
  for (const s of j.series ?? []) {
    const parts = posts.filter((p) => p.series?.name === s.name)
    const dup = parts.map((p) => p.series.part).filter((n, i, a) => a.indexOf(n) !== i)
    for (const n of dup) errs.push(`series "${s.name}": part ${n} is claimed by more than one post`)
  }
  if (posts.filter((p) => p.featured).length > 1) errs.push(`only one post can be "featured: true" (${posts.filter((p) => p.featured).map((p) => p.file).join(', ')})`)
  if (errs.length) {
    const e = new Error(`${errs.length} problem${errs.length > 1 ? 's' : ''}:\n${errs.map((x) => '  - ' + x).join('\n')}`)
    e.list = errs
    throw e
  }
  posts.sort((a, b) => (a.date === b.date ? b.no - a.no : a.date < b.date ? 1 : -1))
  for (const p of posts) render(p, j, theme, rates)
  return { j, theme, rates, posts, dir }
}

// ---------- article body ----------

function picture(img, alt, root, cls = '', sizes = '100vw', eager = false) {
  const srcs = [img.avif && `<source type="image/avif" srcset="${root}${esc(img.avif)}">`, img.webp && `<source type="image/webp" srcset="${root}${esc(img.webp)}">`].filter(Boolean).join('')
  return `<picture${cls ? ` class="${cls}"` : ''}>${srcs}<img src="${root}${esc(img.src)}" width="${img.w}" height="${img.h}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" sizes="${sizes}"></picture>`
}

function render(p, j, theme, rates) {
  const order = []
  const noteNo = (id) => {
    let i = order.indexOf(id)
    if (i < 0) i = order.push(id) - 1
    return i + 1
  }
  let figN = p.lead && (p.lead.chart || theme.preset === 'ink') ? 1 : 0
  const sections = []
  let total = 0
  let wordCount = 0
  const out = []
  // the lead picture is read like any figure
  if (p.lead) {
    const cap = p.lead.caption ?? ''
    const t = blockSeconds({ type: 'figure' }, words(cap), rates)
    total += t
    p.leadSeconds = t
  }
  let firstP = true
  for (const b of p.blocks) {
    const before = order.length
    const html = blockHtml(b)
    // a footnote's words are read where its reference is
    let w = blockWords(b)
    for (const id of order.slice(before)) w += words(plain(p.notes.get(id).text))
    wordCount += w
    const t = blockSeconds(b, w, rates)
    total += t
    out.push(html.replace(/^<(\w+)/, `<$1 data-t="${t.toFixed(2)}"`))
  }
  function blockHtml(b) {
    const note = (id) => {
      const n = noteNo(id)
      return `<a class="ji-ref" id="r-${n}" href="#n-${n}" aria-label="Note ${n}"><span class="ji-anchor"></span>${n}</a>`
    }
    switch (b.type) {
      case 'p': {
        const drop = firstP && (p.dropCap ?? theme.dropCap)
        const cls = firstP ? (drop ? ' class="ji-first ji-drop"' : ' class="ji-first"') : ''
        firstP = false
        return `<p${cls}>${inline(b.text, { note })}</p>`
      }
      case 'h2': {
        const n = sections.length + 1
        const id = 's-' + (plain(b.text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || n)
        sections.push({ id, text: plain(b.text), n })
        return `<h2 id="${id}"><span class="ji-secn">${String(n).padStart(2, '0')}</span>${inline(b.text)}</h2>`
      }
      case 'h3':
        return `<h3>${inline(b.text)}</h3>`
      case 'ul':
      case 'ol':
        return `<${b.type}>${b.items.map((t) => `<li>${inline(t, { note })}</li>`).join('')}</${b.type}>`
      case 'quote':
        return `<blockquote class="ji-quote"><p>${inline(b.text, { note })}</p></blockquote>`
      case 'pull':
        return `<blockquote class="ji-pull"><p>${inline(b.text)}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`
      case 'hr':
        return `<hr class="ji-hr">`
      case 'code': {
        const lines = highlight(b.code, b.plainLang ? '' : b.lang)
        const lang = b.lang ? b.lang[0].toUpperCase() + b.lang.slice(1) : ''
        return `<figure class="ji-code"${b.file || lang ? '' : ' data-bare'}>${b.file || lang ? `<figcaption class="ji-codebar"><span>${esc(b.file)}</span><span>${esc(lang)}</span></figcaption>` : ''}<pre tabindex="0"><code>${lines.map((l, i) => `<span class="ji-l${b.marks.has(i + 1) ? ' ji-mark' : ''}">${l || ' '}</span>`).join('')}</code></pre></figure>`
      }
      case 'figure': {
        figN++
        const label = b.label || `Fig. ${figN}`
        const body = b.chart ? chartHtml(b.chart, 'full') : picture(b.img, b.alt, '../', '', b.wide ? '(min-width: 1180px) 960px, 100vw' : '(min-width: 760px) 660px, 100vw')
        const shape = b.img ? ` style="--ar:${b.img.w}/${b.img.h};--arw:${(b.img.w / b.img.h).toFixed(4)}"` : ''
        const tall = b.img && b.img.h > b.img.w * 1.1
        return `<figure class="ji-fig${b.wide ? ' ji-wide' : ''}${tall ? ' ji-tall' : ''}${b.chart ? ' ji-isch' : ''}"${shape}>${body}<figcaption><b>${esc(label)}</b><span>${inline(b.caption)}</span></figcaption></figure>`
      }
    }
    return ''
  }
  p.html = out.join('\n')
  p.sections = sections
  p.noteOrder = order
  p.seconds = total
  p.minutes = minutesOf(total)
  p.wordCount = wordCount + words(plain(p.title)) + words(p.dek)
}

// ---------- pages ----------

const css = () => readFileSync(join(KIT, 'journal.css'), 'utf8')
const runtime = () => readFileSync(join(KIT, 'runtime.js'), 'utf8')

function head(J, { title, description, canonical, root, ld, feed = true }) {
  const t = J.theme
  const f = FONTS[t.fonts]
  const c = t.colors
  return `<!doctype html>
<html lang="${esc(J.j.language ?? 'en')}" class="ji-root">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${feed ? `<link rel="alternate" type="application/rss+xml" title="${esc(plain(J.j.masthead))}" href="${root}feed.xml">` : ''}
<meta name="color-scheme" content="${t.preset === 'ink' ? 'dark' : 'light'}">
<meta name="theme-color" content="${c.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${f.google}&display=swap">
<style>${vars(J)}
${css()}</style>
<script>document.documentElement.classList.add('ji-js')</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>`
}
function vars(J) {
  const t = J.theme
  const c = t.colors
  const f = FONTS[t.fonts]
  return `:root{--bg:${c.bg};--band:${c.band};--ink:${c.ink};--muted:${c.muted};--faint:${c.faint};--rule:${c.rule};--accent:${c.accent};--code:${c.code};--display:${f.display};--text:${f.text};--ui:${f.ui};--mono:${f.mono};--label:${f.label};--nums:${t.numerals === 'tabular' ? 'tabular-nums' : 'oldstyle-nums proportional-nums'}}`
}

function topBar(J, root, current = true) {
  const nav = J.j.site.nav ?? []
  return `<header class="ji-top"><a class="ji-brand" href="${esc(J.j.site.home ?? root)}">${esc(J.j.brand)}${J.theme.preset === 'ink' ? '<i>.</i>' : ''}</a>${nav.length ? `<nav class="ji-nav" aria-label="Site">${nav.map((n) => `<a href="${esc(n.href)}"${current && n.current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}</nav>` : ''}<a class="ji-feed" href="${root}feed.xml"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="2" cy="10" r="1.6"/><path d="M0 4.2a7.8 7.8 0 0 1 7.8 7.8H6A6 6 0 0 0 0 6zM0 0a12 12 0 0 1 12 12h-1.8A10.2 10.2 0 0 0 0 1.8z"/></svg>RSS feed</a></header>`
}

function foot(J, root) {
  const f = J.j.footer ?? {}
  return `<footer class="ji-foot"><p>${esc(plain(J.j.masthead))}. ${esc(J.j.since)}.</p><p>Follow by <a href="${root}feed.xml">RSS</a>${f.email ? ` or <a href="${esc(f.email)}">${esc(f.emailLabel ?? 'email')}</a>` : ''}.${f.note ? ` ${esc(f.note)}` : ''}</p><p>${esc(f.colophon ?? `Set in ${FONTS[J.theme.fonts].names}`)}</p></footer>`
}

const no = (J, p) => `${J.j.issueLabel ?? 'Nº'} ${pad(p.no)}`
const postUrl = (J, p) => `${J.j.site.url}${p.slug}/`

function plateOf(J, p, root) {
  if (p.lead?.img) return picture(p.lead.img, '', root, 'ji-pl-img', '(min-width: 1180px) 320px, 25vw')
  if (p.lead?.data) return chartHtml(p.lead.data, 'plate')
  return `<span class="ji-pl-type"><span class="ji-lbl">${esc(p.section)}</span><span class="ji-pl-no">${pad(p.no)}</span></span>`
}
const plateCap = (J, p) => `<b>${esc(no(J, p))} · ${esc(p.section)}</b><span>${esc(p.lead?.caption ? plain(p.lead.caption) : p.dek)}</span>`

function row(J, p, root, lead, extra) {
  const longest = Math.max(...J.posts.map((x) => x.minutes))
  return `<li class="ji-row${extra ? ' ji-extra' : ''}" data-section="${esc(p.section)}"${extra ? ' hidden' : ''}><div class="ji-row-in"><a href="${root}${p.slug}/" data-no="${pad(p.no)}"><span class="ji-n">${pad(p.no)}</span><span class="ji-t"><span class="ji-tt">${esc(plain(p.title))}${lead ? '<span class="ji-leadmark">Lead</span>' : ''}</span><span class="ji-d">${esc(p.dek)}</span></span><span class="ji-s">${esc(p.section)}</span><span class="ji-len" aria-label="${p.minutes} minute read"><i style="width:${Math.max(6, Math.round((p.minutes / longest) * 64))}px" aria-hidden="true"></i>${p.minutes} min</span><time class="ji-dt" datetime="${p.date}">${short(p.date)}</time></a><template class="ji-pl-t">${plateOf(J, p, root)}<p class="ji-pl-cap">${plateCap(J, p)}</p></template></div></li>`
}

function register(J, list, root, { lead, limit, active = 'All', archive = false }) {
  const years = []
  list.forEach((p, i) => {
    const y = p.date.slice(0, 4)
    if (!years.length || years.at(-1).y !== y) years.push({ y, rows: [] })
    years.at(-1).rows.push({ p, extra: !archive && i >= limit && active === 'All' })
  })
  const vol = J.j.volumes ?? {}
  const shown = list.filter((_, i) => archive || active !== 'All' || i < limit).length
  return `<div class="ji-reg"><div class="ji-th" aria-hidden="true"><span>${esc(J.j.issueLabel ?? 'Nº')}</span><span>Title</span><span>Section</span><span>Length</span><span>Date</span></div>${years
    .map(
      ({ y, rows }) =>
        `<section class="ji-year${rows.every((r) => r.extra) ? ' ji-extra' : ''}" data-year="${y}"${rows.every((r) => r.extra) ? ' hidden' : ''}><div class="ji-yr-in"><h3 class="ji-yr"><span class="ji-y">${y}</span>${vol[y] ? `<span class="ji-lbl">${esc(vol[y])}</span>` : ''}</h3><ol class="ji-rows">${rows.map((r) => row(J, r.p, root, lead && r.p === lead, r.extra)).join('')}</ol></div></section>`,
    )
    .join('')}<p class="ji-count" data-total="${J.posts.length}"><span class="ji-count-t">${countText(J, active, shown)}</span>${!archive && J.posts.length > limit ? `<a href="${root}archive/">The full index, ${J.posts.length} pieces →</a>` : ''}</p></div>`
}
function countText(J, active, shown) {
  if (active === 'All') return `Showing ${shown} of ${J.posts.length}`
  return `${shown} in ${active}`
}

function filters(J, root, active) {
  const all = J.posts.length
  const items = [['All', all, root], ...J.j.sections.map((s) => [s, J.posts.filter((p) => p.section === s).length, `${root}section/${sectionSlug(s)}/`])]
  return `<nav class="ji-filters" aria-label="Filter the index by section">${items
    .map(([s, n, href]) => `<a href="${href}${href === root ? '#index' : ''}" data-filter="${esc(s)}"${s === active ? ' aria-current="page"' : ''}>${esc(s)}<sup>${n}</sup></a>`)
    .join('')}</nav>`
}

function leadStory(J, p, root) {
  const L = J.j.labels ?? {}
  const t = J.theme
  const isChart = !!p.lead?.data
  const media = p.lead?.img
    ? picture(p.lead.img, p.lead.alt, root, '', '(min-width: 1180px) 760px, 100vw', true)
    : p.lead?.data
      ? chartHtml(p.lead.data, 'full')
      : `<span class="ji-pl-type ji-pl-big"><span class="ji-lbl">${esc(p.section)}</span><span class="ji-pl-no">${pad(p.no)}</span></span>`
  const label = isChart || t.preset === 'ink' ? 'Fig. 1' : (L.plate ?? 'Plate')
  const series = p.series ? `${p.series.name}, part ${t.preset === 'ink' ? p.series.part : ROMAN[p.series.part - 1].toUpperCase()}` : ''
  return `<section class="ji-lead ji-lead-${t.leadSide}" aria-labelledby="lead-title">
<figure class="ji-lead-fig${isChart ? ' ji-isch' : ''}"><a href="${root}${p.slug}/" tabindex="-1" aria-hidden="true" class="ji-lead-media">${media}</a>${p.lead?.caption ? `<figcaption><b>${esc(label)}</b><span>${inline(p.lead.caption)}${p.lead.credit ? ` <span class="ji-credit">${esc(p.lead.credit)}</span>` : ''}</span></figcaption>` : ''}</figure>
<div class="ji-lead-copy"><p class="ji-lead-no"><span class="ji-num">${t.preset === 'ink' ? esc(no(J, p)) : pad(p.no)}</span></p><p class="ji-meta"><span class="ji-lbl">${esc(p.section)}</span>${series ? `<span class="ji-lbl">${esc(series)}</span>` : ''}</p><h2 id="lead-title"><a href="${root}${p.slug}/">${turn(p.title)}</a></h2><p class="ji-dek">${esc(p.dek)}</p><div class="ji-by"><span>By <strong>${esc(byline(p))}</strong></span><span>${p.minutes} min read</span><time datetime="${p.date}">${long(p.date)}</time><a class="ji-read" href="${root}${p.slug}/">${esc(L.read ?? 'Read the piece')} <span aria-hidden="true">→</span></a></div></div>
</section>`
}

function seriesBand(J, root) {
  const list = J.j.series ?? []
  if (!list.length) return ''
  const L = J.j.labels ?? {}
  const ink = J.theme.preset === 'ink'
  return `<section class="ji-series" aria-labelledby="series-title"><div class="ji-wrap"><div class="ji-series-head"><h2 id="series-title">${turn(L.series ?? 'Series')}</h2>${L.seriesIntro ? `<p>${esc(L.seriesIntro)}</p>` : ''}</div><div class="ji-sgrid" style="--cols:${list.length}">${list
    .map((s) => {
      const parts = s.parts.map((title, i) => ({ title, post: J.posts.find((p) => p.series?.name === s.name && p.series.part === i + 1) }))
      const pub = parts.filter((x) => x.post).length
      const latest = Math.max(...parts.map((x, i) => (x.post ? i : -1)))
      return `<div class="ji-scol"><p class="ji-lbl">${pub} of ${s.parts.length} published</p><div class="ji-ticks" aria-hidden="true">${parts.map((x) => `<i${x.post ? ' class="ji-pub"' : ''}></i>`).join('')}</div><h3>${esc(s.name)}</h3><p class="ji-sdesc">${esc(s.description)}</p><ol>${parts
        .map(
          (x, i) =>
            `<li class="${x.post ? '' : 'ji-fc'}${i === latest && pub < s.parts.length ? ' ji-cur' : ''}"><span class="ji-rn" aria-hidden="true">${ink ? String(i + 1).padStart(2, '0') : ROMAN[i]}</span>${x.post ? `<a href="${root}${x.post.slug}/">${esc(plain(x.post.title))}</a>` : `<span>${esc(x.title)}</span>`}<span class="ji-st">${x.post ? (i === latest && pub < s.parts.length ? 'Latest' : '') : 'Forthcoming'}</span></li>`,
        )
        .join('')}</ol></div>`
    })
    .join('')}</div></div></section>`
}

function indexBody(J, root, { active = 'All', withLead = true, archive = false } = {}) {
  const L = J.j.labels ?? {}
  const limit = J.j.indexLimit ?? 24
  const lead = J.posts.find((p) => p.featured) ?? J.posts[0]
  const list = active === 'All' ? J.posts : J.posts.filter((p) => p.section === active)
  // the preview slot starts on the newest piece that isn't already the lead
  const first = (withLead ? list.find((p) => p !== lead) : null) ?? list[0]
  return `${withLead ? leadStory(J, lead, root) : ''}
<section class="ji-index" id="index" aria-labelledby="index-title">
<div class="ji-index-head"><h2 id="index-title">${turn(archive ? 'The full index' : (L.index ?? 'Index'))}</h2>${archive ? '' : filters(J, root, active)}</div>
<div class="ji-aside"><div class="ji-sticky"><a class="ji-plate" href="${root}${first.slug}/" data-no="${pad(first.no)}"><span class="ji-pl-frame"><span class="ji-pl-layer">${plateOf(J, first, root)}</span></span><span class="ji-pl-capwrap"><span class="ji-pl-cap">${plateCap(J, first)}</span></span></a></div></div>
${register(J, list, root, { lead: withLead ? lead : null, limit, active, archive })}
</section>`
}

function masthead(J) {
  return `<div class="ji-mast"><h1 class="ji-masthead">${turn(J.j.masthead)}</h1><p class="ji-strap">${esc(J.j.strap)}<span class="ji-lbl">${esc(J.j.since)} · ${J.posts.length} ${J.posts.length === 1 ? 'piece' : 'pieces'}</span></p></div><hr class="ji-dbl">`
}

function indexPage(J, { root = '', active = 'All', archive = false } = {}) {
  const L = J.j.labels ?? {}
  const lead = J.posts.find((p) => p.featured) ?? J.posts[0]
  const updated = J.posts.reduce((m, p) => ((p.updated ?? p.date) > m ? (p.updated ?? p.date) : m), '0000')
  const path = archive ? 'archive/' : active === 'All' ? '' : `section/${sectionSlug(active)}/`
  const title = `${archive ? 'The full index · ' : active === 'All' ? '' : `${active} · `}${plain(J.j.masthead)}`
  const ld = {
    '@context': SCHEMA,
    '@type': 'Blog',
    name: plain(J.j.masthead),
    description: J.j.strap,
    url: J.j.site.url,
    inLanguage: J.j.language ?? 'en',
    publisher: { '@type': 'Organization', name: J.j.publisher ?? J.j.brand },
    blogPost: J.posts.slice(0, 50).map((p) => ({ '@type': 'BlogPosting', headline: plain(p.title), url: postUrl(J, p), datePublished: p.date })),
  }
  return `${head(J, { title, description: J.j.strap, canonical: J.j.site.url + path, root, ld: active === 'All' && !archive ? ld : null })}
<body class="ji ji-${J.theme.preset} ji-page-index" data-view="index">
<a class="ji-skip" href="#index">Skip to the index</a>
<div class="ji-wrap">${topBar(J, root)}
<main id="main">${masthead(J)}
${archive || active !== 'All' ? `<p class="ji-dateline"><a class="ji-lbl" href="${root}">← ${esc(L.lead ?? 'Lead story')} and the latest</a><span class="ji-lbl">Updated ${long(updated)}</span></p>` : `<p class="ji-dateline"><span class="ji-lbl">${esc(L.lead ?? 'Lead story')}</span><span class="ji-lbl">Updated ${long(updated)}</span></p>`}
${indexBody(J, root, { active, archive, withLead: !archive && active === 'All' })}
</main></div>
${archive ? '' : seriesBand(J, root)}
<div class="ji-wrap">${foot(J, root)}</div>
<script>${runtime()}</script>
</body></html>`
}

function articlePage(J, p) {
  const root = '../'
  const t = J.theme
  const L = J.j.labels ?? {}
  const series = p.series && (J.j.series ?? []).find((s) => s.name === p.series.name)
  const ld = {
    '@context': SCHEMA,
    '@type': 'Article',
    headline: plain(p.title),
    description: p.dek,
    url: postUrl(J, p),
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl(J, p) },
    datePublished: p.date,
    dateModified: p.updated ?? p.date,
    author: authorsOf(p).map((name) => ({ '@type': 'Person', name })),
    publisher: { '@type': 'Organization', name: J.j.publisher ?? J.j.brand },
    articleSection: p.section,
    wordCount: p.wordCount,
    timeRequired: `PT${p.minutes}M`,
    inLanguage: J.j.language ?? 'en',
    ...(p.lead?.img ? { image: [J.j.site.url + p.lead.img.src] } : {}),
    ...(series ? { isPartOf: { '@type': 'CreativeWorkSeries', name: series.name }, position: p.series.part } : {}),
  }
  const leadFig = p.lead
    ? `<figure class="ji-fig ji-wide ji-afig${p.lead.data ? ' ji-isch' : ''}" data-t="${p.leadSeconds.toFixed(2)}"${p.lead.img ? ` style="--ar:${p.lead.img.w}/${p.lead.img.h}"` : ''}>${p.lead.img ? picture(p.lead.img, p.lead.alt, root, '', '(min-width: 1180px) 960px, 100vw', true) : chartHtml(p.lead.data, 'full')}${p.lead.caption ? `<figcaption><b>${p.lead.data || t.preset === 'ink' ? 'Fig. 1' : esc(L.plate ?? 'Plate')}</b><span>${inline(p.lead.caption)}${p.lead.credit ? ` <span class="ji-credit">${esc(p.lead.credit)}</span>` : ''}</span></figcaption>` : ''}</figure>`
    : ''
  const notes = p.noteOrder.map((id, i) => ({ n: i + 1, html: inline(p.notes.get(id).text) }))
  const parts = series ? series.parts.map((title, i) => ({ title, post: J.posts.find((x) => x.series?.name === series.name && x.series.part === i + 1) })) : []
  const next = series ? parts.slice(p.series.part).find((x) => x.post)?.post ?? null : null
  const nextPlanned = series && !next ? parts[p.series.part] : null
  const more = J.posts.filter((x) => x !== p && x.section === p.section).slice(0, 3)
  const seriesTag = series ? `${series.name}, part ${t.preset === 'ink' ? p.series.part : ROMAN[p.series.part - 1].toUpperCase()}` : ''
  const rail = p.sections.length
    ? `<ol>${p.sections.map((s) => `<li><a href="#${s.id}"><b>${s.n}</b>${esc(s.text)}</a></li>`).join('')}${notes.length ? `<li class="ji-rail-notes"><a href="#notes"><b>${p.sections.length + 1}</b>Notes</a></li>` : ''}</ol>`
    : ''
  const left = `<span class="ji-left" data-total="${p.seconds.toFixed(2)}" data-min="${p.minutes}"><strong>${p.minutes} min</strong> left of ${p.minutes}</span>`
  return `${head(J, { title: `${plain(p.title)} · ${plain(J.j.masthead)}`, description: p.dek, canonical: postUrl(J, p), root, ld })}
<body class="ji ji-${t.preset} ji-page-article" data-view="article">
<a class="ji-skip" href="#article">Skip to the article</a>
<div class="ji-progress" aria-hidden="true"><i></i></div>
<div class="ji-wrap">${topBar(J, root)}
<main id="main"><article class="ji-art" id="article" data-minutes="${p.minutes}">
<header class="ji-ahead"><div class="ji-folio"><span class="ji-num ji-folio-no">${t.preset === 'ink' ? esc(no(J, p)) : pad(p.no)}</span><a class="ji-lbl" href="${root}section/${sectionSlug(p.section)}/">${esc(p.section)}</a>${seriesTag ? `<span class="ji-lbl">${esc(seriesTag)}</span>` : ''}</div>
<div class="ji-ttl"><h1>${turn(p.title)}</h1><p class="ji-dek">${esc(p.dek)}</p><p class="ji-byl"><span>By <strong>${esc(byline(p))}</strong></span><time datetime="${p.date}">${long(p.date)}</time><span class="ji-mins">${p.minutes} min read</span>${p.updated && p.updated !== p.date ? `<span>Updated <time datetime="${p.updated}">${long(p.updated)}</time></span>` : ''}</p></div></header>
<details class="ji-tocm"><summary><span class="ji-lbl">Contents</span>${left}</summary>${rail}</details>
<div class="ji-abody">
<nav class="ji-rail" aria-label="Contents"><div class="ji-rail-in"><p class="ji-lbl">Contents</p><div class="ji-track">${rail}<span class="ji-fill" aria-hidden="true"></span></div><p class="ji-rail-left">${left}</p></div></nav>
<div class="ji-measure">${leadFig}
${p.html}</div>
<div class="ji-notes">${notes.map((x) => `<aside class="ji-sn" id="sn-${x.n}" data-ref="r-${x.n}"><b>${x.n}</b>${x.html}</aside>`).join('')}</div>
</div>
${notes.length ? `<section class="ji-endnotes" id="notes" aria-labelledby="notes-title"><h2 id="notes-title">Notes</h2><ol>${notes.map((x) => `<li id="n-${x.n}">${x.html} <a href="#r-${x.n}" aria-label="Back to note ${x.n} in the text">↩</a></li>`).join('')}</ol></section>` : ''}
<footer class="ji-after">
${series ? `<div class="ji-nextcard"><p class="ji-lbl">${esc(series.name)} · part ${p.series.part} of ${series.parts.length}</p>${next ? `<a href="${root}${next.slug}/"><span class="ji-lbl">Next part</span><span class="ji-nt">${esc(plain(next.title))}</span></a>` : nextPlanned ? `<p><span class="ji-lbl">Next part, forthcoming</span><span class="ji-nt">${esc(nextPlanned.title)}</span></p>` : `<p><span class="ji-nt">The last part of the series</span></p>`}</div>` : ''}
${more.length ? `<div class="ji-more"><h2 class="ji-lbl">More from ${esc(p.section)}</h2><ol class="ji-rows ji-rows-more">${more.map((x) => row(J, x, root, null, false)).join('')}</ol></div>` : ''}
<p class="ji-back"><a href="${root}">← ${esc(plain(J.j.masthead))}, all ${J.posts.length} pieces</a></p>
</footer>
</article></main></div>
<div class="ji-wrap">${foot(J, root)}</div>
<script>${runtime()}</script>
</body></html>`
}

function feed(J) {
  const items = J.posts.slice(0, J.j.feed?.items ?? 20)
  const updated = J.posts.reduce((m, p) => ((p.updated ?? p.date) > m ? (p.updated ?? p.date) : m), '0000')
  const abs = (html) => html.replace(/<\/span>(?=<span class="ji-l)/g, '</span>\n').replace(/(src|srcset|href)="\.\.\/(?!\/)/g, `$1="${J.j.site.url}`).replace(/ data-t="[\d.]+"/g, '')
  const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
  const x = (s) => esc(s).replace(/'/g, '&apos;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(J.j.feed?.title ?? plain(J.j.masthead))}</title>
<link>${x(J.j.site.url)}</link>
<atom:link href="${x(J.j.site.url)}feed.xml" rel="self" type="application/rss+xml"/>
<description>${x(J.j.feed?.description ?? J.j.strap)}</description>
<language>${x(J.j.language ?? 'en')}</language>
<lastBuildDate>${rfc822(updated)}</lastBuildDate>
${items
  .map((p) => {
    const lead = p.lead?.img ? `<enclosure url="${x(J.j.site.url + p.lead.img.src)}" length="${p.lead.img.bytes}" type="${/\.png$/i.test(p.lead.img.src) ? 'image/png' : /\.webp$/i.test(p.lead.img.src) ? 'image/webp' : 'image/jpeg'}"/>` : ''
    const notes = p.noteOrder.length ? `<h2>Notes</h2><ol>${p.noteOrder.map((id, i) => `<li id="n-${i + 1}">${inline(p.notes.get(id).text)}</li>`).join('')}</ol>` : ''
    return `<item>
<title>${x(plain(p.title))}</title>
<link>${x(postUrl(J, p))}</link>
<guid isPermaLink="true">${x(postUrl(J, p))}</guid>
<pubDate>${rfc822(p.date)}</pubDate>
<category>${x(p.section)}</category>
<description>${cdata(`<p><em>${esc(p.dek)}</em></p><p>By ${esc(byline(p))}</p>` + abs(p.html.replace(/<a class="ji-ref" id="r-(\d+)" href="#n-\d+"[^>]*><span class="ji-anchor"><\/span>\d+<\/a>/g, '<sup><a href="#n-$1">$1</a></sup>')) + notes)}</description>
${lead}
</item>`
  })
  .join('\n')}
</channel>
</rss>
`
}

function sitemap(J, pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([path, mod]) => `<url><loc>${esc(J.j.site.url + path)}</loc><lastmod>${mod}</lastmod></url>`).join('\n')}
</urlset>
`
}

function embed(J) {
  const root = J.j.site.url
  const f = FONTS[J.theme.fonts]
  return `<!-- ${plain(J.j.masthead)}: lead story, index and series, from journal-index-kit. Paste where the journal's front page goes.
     Links point at ${root}; the article pages, section pages and feed.xml must be published there. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${f.google}&display=swap">
<style>${vars(J).replace(':root', '.ji-embed')}
${css()}</style>
<div class="ji ji-${J.theme.preset} ji-embed" data-view="index"><div class="ji-wrap">
${indexBody(J, root)}
</div>${seriesBand(J, root)}</div>
<script>document.documentElement.classList.add('ji-js');${runtime()}</script>
`
}

// ---------- write ----------

export function build(dir, out, opts = {}) {
  const J = load(resolve(dir), opts)
  const o = resolve(out)
  mkdirSync(o, { recursive: true })
  for (const f of ['index.html', 'feed.xml', 'sitemap.xml', 'journal-embed.html']) rmSync(join(o, f), { force: true })
  for (const f of ['section', 'archive', 'images']) rmSync(join(o, f), { recursive: true, force: true })
  const write = (path, text) => {
    mkdirSync(dirname(join(o, path)), { recursive: true })
    writeFileSync(join(o, path), text)
  }
  const updated = J.posts.reduce((m, p) => ((p.updated ?? p.date) > m ? (p.updated ?? p.date) : m), '0000')
  const pages = [['', updated]]
  write('index.html', indexPage(J))
  for (const s of J.j.sections) {
    write(`section/${sectionSlug(s)}/index.html`, indexPage(J, { root: '../../', active: s }))
    pages.push([`section/${sectionSlug(s)}/`, updated])
  }
  if (J.posts.length > (J.j.indexLimit ?? 24)) {
    write('archive/index.html', indexPage(J, { root: '../', archive: true }))
    pages.push(['archive/', updated])
  }
  for (const p of J.posts) {
    rmSync(join(o, p.slug), { recursive: true, force: true })
    write(`${p.slug}/index.html`, articlePage(J, p))
    pages.push([`${p.slug}/`, p.updated ?? p.date])
  }
  write('feed.xml', feed(J))
  write('sitemap.xml', sitemap(J, pages))
  write('journal-embed.html', embed(J))
  // images: each one used, with its .webp/.avif siblings
  const used = new Set()
  for (const p of J.posts) {
    if (p.lead?.img) used.add(p.lead.img)
    for (const b of p.blocks) if (b.img) used.add(b.img)
  }
  for (const img of used)
    for (const rel of [img.src, img.webp, img.avif].filter(Boolean)) {
      mkdirSync(dirname(join(o, rel)), { recursive: true })
      copyFileSync(join(J.dir, rel), join(o, rel))
    }
  // what the check reads back
  const manifest = {
    site: J.j.site.url,
    theme: J.theme.preset,
    sections: Object.fromEntries(J.j.sections.map((s) => [s, J.posts.filter((p) => p.section === s).length])),
    indexLimit: J.j.indexLimit ?? 24,
    feedItems: J.j.feed?.items ?? 20,
    reading: J.rates,
    posts: J.posts.map((p) => ({ no: p.no, slug: p.slug, featured: p === (J.posts.find((x) => x.featured) ?? J.posts[0]), title: plain(p.title), section: p.section, date: p.date, updated: p.updated ?? p.date, minutes: p.minutes, seconds: Math.round(p.seconds * 100) / 100, notes: p.noteOrder.length, words: p.wordCount })),
  }
  write('journal.manifest.json', JSON.stringify(manifest, null, 2) + '\n')
  return { J, out: o, pages: pages.length }
}

export async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const [dir, out = 'out'] = a._
  if (!dir) {
    console.log('usage: node scripts/build.mjs <journal folder> [out folder] [--drafts] [--today YYYY-MM-DD]')
    process.exit(1)
  }
  try {
    const { J, out: o, pages } = build(dir, out, { drafts: !!a.drafts, today: a.today })
    const r = relative(process.cwd(), o)
    const rel = !r ? '.' : r.startsWith('..') ? o : r
    console.log(`built ${J.posts.length} pieces into ${rel}/: ${pages} pages, feed.xml, sitemap.xml, journal-embed.html`)
    for (const p of J.posts) console.log(`  ${pad(p.no)}  ${p.minutes} min  ${p.slug}/`)
  } catch (e) {
    console.error(e.list ? e.message : e.stack ?? e.message)
    process.exit(1)
  }
}
