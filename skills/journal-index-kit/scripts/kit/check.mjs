// Journal Index Kit: serves a built journal and checks it in headless
// Chrome. Fails (exit 1) on any of:
//
// every page, at 390, 768, 1024 and 1440 px, and with reduced motion at
// 390 and 1440 (the index, the lead article, and every other article at
// 1440):
//   - script errors, links without an address, sideways scrolling
//   - text under 16 px on a phone or 14 px elsewhere (labels, chart labels
//     and note numbers: 12 px)
//   - text under WCAG AA contrast against what is actually behind it
//     (4.5:1, or 3:1 from 24 px)
//   - text cut off by its box or running off the screen
//   - layout shift while the page loads (CLS over 0.02)
// the index:
//   - every row links to a page that exists, and its minutes match the build
//   - each filter shows exactly its section's pieces, the count line says so,
//     and nothing below the register or the filter bar moves (no jump)
//   - the keyboard reaches the preview slot, and focusing a row puts that
//     row's piece in it; focus is visible
// every article:
//   - Article JSON-LD headline equals the h1, its dates equal the byline's
//     <time>, the feed's pubDate and the build's date; timeRequired equals
//     the minutes on the page and on the index
//   - at 1440 the sidenotes: none overlaps another or a figure, each starts
//     at or below its reference's line and sits in the margin column
//   - "N min left of M" and the progress bar agree with the scroll position
//     at two points (35% and 70% of the way down), and say Finished at the end
// without JavaScript:
//   - the register is all there and readable, each section link leads to a
//     page listing exactly that section, the article body and its notes show
// the feed and sitemap:
//   - feed.xml parses as XML, has an item for every piece (up to feed.items),
//     each with its title, link, date and full text; sitemap.xml parses and
//     lists every page with its date
//
//   node scripts/check.mjs out/index.html
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const SIZES = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [390, 844, true],
  [1440, 900, true],
]
const LINE = 0.3

const AUDIT = `(() => {
  const out = []
  const vw = innerWidth
  const phone = vw < 760
  const min = phone ? 16 : 14
  const LABEL = '.ji-lbl, .ji-ax, .ji-note, .ji-legend, .ji-st, .ji-th, figcaption b, .ji-leadmark, .ji-secn, .ji-filters sup, .ji-codebar, .ji-sn b, .ji-pl-cap b, .ji-rail b, .ji-tocm b, .ji-ref, .ji-pull cite, .ji-endnotes h2, .ji-unit'
  const skip = (el) => el.closest('[aria-hidden="true"], [hidden], template, script, style, .ji-skip, .ji-out')
  const shown = (el) => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const texts = [...document.body.querySelectorAll('*')].filter((el) => own(el) && !skip(el) && shown(el))
  const name = (el) => '"' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 48) + '"'
  const seen = new Set()
  const say = (m) => { if (!seen.has(m)) { seen.add(m); out.push(m) } }
  for (const a of document.querySelectorAll('a')) if (!a.closest('template') && !a.getAttribute('href')) say('a link has no address: ' + name(a))
  if (document.documentElement.scrollWidth > vw + 1) say('the page scrolls sideways (' + document.documentElement.scrollWidth + 'px wide at ' + vw + ')')
  for (const el of texts) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const need = el.closest(LABEL) ? 12 : el.closest('.ji-code') ? 13 : min
    if (fs < need - 0.01) say('text at ' + fs.toFixed(1) + 'px (at least ' + need + 'px here): ' + name(el))
  }
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] }
    const m2 = c.match(/color\\(srgb ([^)]+)\\)/)
    if (m2) { const p = m2[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]] }
    return null
  }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const behind = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      const c = parse(s.backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let bg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]
    bg = bg.slice(0, 3)
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  let pairs = 0, worst = 99
  for (const el of texts) {
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    const bg = behind(el)
    const L1 = lum(over(fg, bg)), L2 = lum(bg)
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const fs = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
    pairs++; worst = Math.min(worst, r / need)
    if (r < need) say('contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): ' + name(el))
  }
  for (const el of document.querySelectorAll('.ji *')) {
    if (skip(el) || !shown(el) || !el.textContent.trim() || el.closest('svg, pre, .ji-row-in, .ji-yr-in, .ji-filters, .ji-pl-frame, .ji-lead-media')) continue
    const s = getComputedStyle(el)
    if (s.overflowX !== 'visible' && s.overflowX !== 'clip' && el.scrollWidth > el.clientWidth + 2) say('text is cut off at the side of its box: ' + name(el))
    if (s.overflowY !== 'visible' && s.overflowY !== 'clip' && el.scrollHeight > el.clientHeight + 2) say('text is cut off at the bottom of its box: ' + name(el))
  }
  // a row's inner box hides overflow only to collapse when filtered: it must fit when shown
  for (const el of document.querySelectorAll('.ji-row-in, .ji-yr-in')) if (shown(el) && !skip(el) && el.scrollHeight > el.clientHeight + 2) say('a register row is cut off: ' + name(el))
  for (const el of texts) {
    if (el.closest('.ji-filters, pre')) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) say('text runs off the screen (' + Math.round(r.left) + '..' + Math.round(r.right) + '): ' + name(el))
  }
  return { problems: out, pairs, worst: Math.round(worst * 100) / 100 }
})()`

// sidenotes against their references and against figures (1440)
const NOTES = `(() => {
  const out = []
  const notes = [...document.querySelectorAll('.ji-sn')]
  if (!notes.length) return { problems: out, n: 0 }
  if (!document.querySelector('.ji[data-view]').classList.contains('ji-sidenotes')) return { problems: ['sidenotes are not in the margin at ' + innerWidth + 'px'], n: notes.length }
  const measure = document.querySelector('.ji-measure').getBoundingClientRect()
  const blocks = [...document.querySelectorAll('.ji-measure .ji-wide, .ji-measure .ji-tall, .ji-measure .ji-pull')].map((e) => e.getBoundingClientRect())
  let prev = null, gap = Infinity
  for (const sn of notes) {
    const r = sn.getBoundingClientRect()
    const ref = document.getElementById(sn.dataset.ref)
    const a = ref.querySelector('.ji-anchor').getBoundingClientRect()
    const para = ref.closest('p, li, blockquote')
    const lineTop = a.top - parseFloat(getComputedStyle(para).fontSize)
    const n = sn.id
    if (r.top < lineTop - 1) out.push(n + ' starts ' + Math.round(lineTop - r.top) + 'px above its reference line')
    if (r.left < measure.right + 8) out.push(n + ' is not in the margin column')
    if (prev) { gap = Math.min(gap, r.top - prev.bottom); if (r.top < prev.bottom) out.push(n + ' overlaps the note above it by ' + Math.round(prev.bottom - r.top) + 'px') }
    for (const b of blocks) if (b.right > r.left && r.top < b.bottom && r.bottom > b.top) out.push(n + ' overlaps a figure or pull quote')
    prev = r
  }
  return { problems: out, n: notes.length, gap: gap === Infinity ? null : Math.round(gap) }
})()`

// what the reading model says at the current scroll position, worked out
// here independently of the page's runtime
const READING = `(() => {
  const blocks = [...document.querySelectorAll('.ji-measure [data-t]')]
  const total = blocks.reduce((s, b) => s + Number(b.dataset.t), 0)
  const line = scrollY + innerHeight * ${LINE}
  let read = 0
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) read = total
  else for (const b of blocks) {
    const r = b.getBoundingClientRect(), top = r.top + scrollY, t = Number(b.dataset.t)
    if (line >= top + r.height) read += t
    else if (line > top && r.height > 0) read += t * (line - top) / r.height
  }
  read = Math.min(read, total)
  const n = Math.ceil((total - read) / 60 - 1e-9)
  const leftEl = [...document.querySelectorAll('.ji-left')].find((e) => e.getBoundingClientRect().width > 0)
  const bar = parseFloat(document.querySelector('.ji-progress i').style.width) / 100
  return { expectN: n, expectF: total ? read / total : 0, shown: leftEl ? leftEl.textContent.trim() : null, bar, minutes: Number(document.querySelector('.ji-art').dataset.minutes) }
})()`

export async function check(input) {
  const file = resolve(input)
  const out = file.endsWith('.html') ? dirname(file) : file
  if (!existsSync(resolve(out, 'index.html'))) throw new Error(`${input}: no index.html; build the journal first`)
  const man = JSON.parse(readFileSync(resolve(out, 'journal.manifest.json'), 'utf8'))
  const server = await serve(out)
  const chrome = await launch({ width: 1440, height: 900 })
  const fails = []
  const lines = []
  const fail = (where, m) => fails.push(`${where}: ${m}`)
  const lead = man.posts.find((p) => p.featured) ?? man.posts[0]
  try {
    const open = async ({ path = '', w = 1440, h = 900, reduce = false, nojs = false }) => {
      if (process.env.JI_DEBUG) console.error('open', path || 'index', w, h, reduce ? 'reduce' : '', nojs ? 'nojs' : '')
      const tab = await chrome.page()
      const errors = []
      chrome.on('Runtime.exceptionThrown', (p, s) => { if (s === tab.sessionId) errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text) })
      await tab.send('Page.enable')
      await tab.send('Runtime.enable')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 })
      await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
      if (nojs) await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
      await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__cls=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:"layout-shift",buffered:true})}catch(e){}' })
      const loaded = tab.once('Page.loadEventFired', 60000)
      await tab.send('Page.navigate', { url: server.url + path })
      await loaded
      const ev = async (expression) => {
        const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      if (!nojs) await ev('window.JournalIndex && window.JournalIndex.ready')
      await ev('document.fonts.ready.then(() => 1)')
      await new Promise((r) => setTimeout(r, 350))
      const close = () => chrome.send('Target.closeTarget', { targetId: tab.targetId }).catch(() => {})
      return { tab, ev, errors, close }
    }
    const key = async (tab, k, shift = false) => {
      const code = k === 'Tab' ? 9 : 13
      await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 })
      await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 })
    }
    const audit = async (label, opts) => {
      const p = await open(opts)
      if (!opts.nojs) await p.ev('window.JournalIndex.enter && window.JournalIndex.enter(), new Promise((r) => setTimeout(r, 900)).then(() => 1)')
      const r = await p.ev(AUDIT)
      const cls = await p.ev('window.__cls')
      for (const m of r.problems) fail(label, m)
      for (const e of p.errors) fail(label, `script error: ${e}`)
      if (cls > 0.02) fail(label, `layout shift ${cls.toFixed(3)} while loading (0.02 at most)`)
      lines.push(`${label}: ${r.pairs} text/background pairs, lowest contrast ${r.worst}x its minimum, layout shift ${cls.toFixed(3)}${r.problems.length ? `, ${r.problems.length} problems` : ''}`)
      return p
    }

    // Load each kind of page once first, so the web fonts are in the cache:
    // layout shift is then measured on the page itself, not on a first
    // visit's font swap (which depends on the network, not the page).
    for (const path of ['', `${lead.slug}/`]) for (const w of [390, 1440]) (await open({ path, w, h: 900 })).close()

    // ---- every size: the index and the lead article
    for (const [w, h, reduce] of SIZES) {
      const tag = `${w}x${h}${reduce ? ' reduced motion' : ''}`
      const p = await audit(`index ${tag}`, { w, h, reduce })
      await p.close()
      const a = await audit(`${lead.slug}/ ${tag}`, { path: `${lead.slug}/`, w, h, reduce })
      // reading position at two points, and the end
      const max = await a.ev('document.documentElement.scrollHeight - innerHeight')
      const says = []
      for (const f of [0.35, 0.7, 1]) {
        await a.ev(`(scrollTo(0, ${Math.round(max * f)}), window.JournalIndex.update(), 1)`)
        const r = await a.ev(READING)
        const want = r.expectN > 0 ? `${r.expectN} min left of ${r.minutes}` : `Finished · ${r.minutes} min`
        if (r.shown !== want) fail(`${lead.slug}/ ${tag}`, `at ${Math.round(f * 100)}% down the page shows "${r.shown}", the reading model says "${want}"`)
        if (Math.abs(r.bar - r.expectF) > 0.003) fail(`${lead.slug}/ ${tag}`, `at ${Math.round(f * 100)}% down the progress bar is ${(r.bar * 100).toFixed(1)}%, the reading model says ${(r.expectF * 100).toFixed(1)}%`)
        says.push(`${Math.round(f * 100)}%: "${r.shown}", bar ${(r.bar * 100).toFixed(1)}%`)
      }
      lines.push(`${lead.slug}/ ${tag}: reading position ${says.join('; ')}`)
      if (w === 1440 && !reduce) {
        const n = await a.ev(NOTES)
        for (const m of n.problems) fail(`${lead.slug}/ 1440`, m)
        lines.push(`${lead.slug}/ 1440: ${n.n} sidenotes in the margin, smallest gap ${n.gap ?? '-'}px, none overlapping`)
      }
      await a.close()
    }

    // ---- every other page at 1440: audit, sidenotes
    for (const p of man.posts.filter((x) => x !== lead)) {
      const a = await audit(`${p.slug}/ 1440`, { path: `${p.slug}/`, w: 1440, h: 900 })
      const n = await a.ev(NOTES)
      for (const m of n.problems) fail(`${p.slug}/ 1440`, m)
      await a.close()
    }
    for (const s of Object.keys(man.sections)) {
      const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const a = await audit(`section/${slug}/ 1440`, { path: `section/${slug}/`, w: 1440, h: 900 })
      await a.close()
    }
    if (man.posts.length > man.indexLimit) (await audit('archive/ 1440', { path: 'archive/', w: 1440, h: 900 })).close()

    // ---- the index: rows, minutes, filters, the preview slot, keyboard
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const tag = `index ${w}`
      const p = await open({ w, h })
      const rows = await p.ev(`[...document.querySelectorAll('.ji-reg .ji-row')].map((li) => { const a = li.querySelector('a'); return { href: a.getAttribute('href'), no: a.getAttribute('data-no'), section: li.dataset.section, min: li.querySelector('.ji-len').textContent.trim() } })`)
      if (rows.length !== man.posts.length) fail(tag, `${rows.length} rows in the register, ${man.posts.length} pieces built`)
      for (const r of rows) {
        const post = man.posts.find((x) => r.href === `${x.slug}/`)
        if (!post) { fail(tag, `row ${r.no} links to ${r.href}, which is not a built page`); continue }
        if (!existsSync(resolve(out, post.slug, 'index.html'))) fail(tag, `row ${r.no}: ${post.slug}/index.html is missing`)
        if (r.min !== `${post.minutes} min`) fail(tag, `row ${r.no} says ${r.min}, the build says ${post.minutes} min`)
      }
      const filters = await p.ev(`[...document.querySelectorAll('.ji-filters a')].map((a) => a.dataset.filter)`)
      const below = `(() => { const s = document.querySelector('.ji-series') || document.querySelector('.ji-foot'); return { below: Math.round(s.getBoundingClientRect().top + scrollY), bar: Math.round(document.querySelector('.ji-filters').getBoundingClientRect().top + scrollY) } })()`
      const before = await p.ev(below)
      let moved = 0
      const counts = []
      for (const f of [...filters.slice(1), 'All']) {
        await p.ev(`document.querySelector('.ji-filters a[data-filter="${f}"]').click()`)
        await new Promise((r) => setTimeout(r, 650))
        const r = await p.ev(`(() => { const vis = [...document.querySelectorAll('.ji-reg .ji-row')].filter((li) => !li.hidden && !li.classList.contains('ji-out') && li.getBoundingClientRect().height > 0); return { n: vis.length, sections: [...new Set(vis.map((li) => li.dataset.section))], text: document.querySelector('.ji-count-t').textContent, current: document.querySelector('.ji-filters a[aria-current]')?.dataset.filter, url: location.search } })()`)
        const want = f === 'All' ? Math.min(man.posts.length, man.indexLimit) : man.sections[f]
        if (r.n !== want) fail(tag, `filter ${f}: ${r.n} rows shown, ${want} expected`)
        if (f !== 'All' && (r.sections.length > 1 || (r.n && r.sections[0] !== f))) fail(tag, `filter ${f} shows rows from ${r.sections.join(', ')}`)
        const wantText = f === 'All' ? `Showing ${want} of ${man.posts.length}` : want ? `${want} in ${f}` : null
        if (wantText && r.text !== wantText) fail(tag, `filter ${f}: the count line says "${r.text}", expected "${wantText}"`)
        if (r.current !== f) fail(tag, `filter ${f} is not marked as the current one`)
        const now = await p.ev(below)
        moved = Math.max(moved, Math.abs(now.below - before.below), Math.abs(now.bar - before.bar))
        counts.push(`${f} ${r.n}`)
      }
      if (moved > 1) fail(tag, `filtering moved the page below the register (or the filter bar) by ${moved}px`)
      lines.push(`${tag}: ${rows.length} rows link to built pages with matching minutes; filters ${counts.join(', ')}; layout below moved ${moved}px`)
      if (w === 1440) {
        // keyboard: Tab from the top until the preview slot and two rows have had focus
        await p.ev('(document.activeElement && document.activeElement.blur(), scrollTo(0, 0), 1)')
        let reachedPlate = false, rowsChecked = 0, invisible = 0
        for (let i = 0; i < 60 && rowsChecked < 2; i++) {
          await key(p.tab, 'Tab')
          await new Promise((r) => setTimeout(r, 40))
          const f = await p.ev(`(() => { const a = document.activeElement; if (!a || a === document.body) return null; const s = getComputedStyle(a); const row = a.closest('.ji-row'); return { plate: a.classList.contains('ji-plate'), row: row ? a.getAttribute('data-no') : null, plateNo: document.querySelector('.ji-plate').dataset.no, outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 } })()`)
          if (!f) continue
          if (!f.outline) invisible++
          if (f.plate) reachedPlate = true
          if (f.row) {
            rowsChecked++
            if (f.plateNo !== f.row) fail(tag, `focusing row ${f.row} left the preview slot on ${f.plateNo}`)
          }
        }
        if (!reachedPlate) fail(tag, 'the keyboard never reaches the preview slot')
        if (rowsChecked < 2) fail(tag, 'the keyboard did not reach the register rows')
        if (invisible) fail(tag, `${invisible} focus stops had no visible focus ring`)
        lines.push(`${tag}: keyboard reaches the preview slot and the rows; focusing a row puts it in the slot`)
      }
      for (const e of p.errors) fail(tag, `script error: ${e}`)
      await p.close()
    }

    // ---- structured data, dates and minutes on every article
    const feedText = readFileSync(resolve(out, 'feed.xml'), 'utf8')
    const sitemapText = readFileSync(resolve(out, 'sitemap.xml'), 'utf8')
    const x = await open({ path: 'feed.xml' })
    const feed = await x.ev(`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(feedText)}, 'application/xml'); if (d.querySelector('parsererror')) return { error: d.querySelector('parsererror').textContent.slice(0, 200) }; return { items: [...d.querySelectorAll('item')].map((i) => ({ title: i.querySelector('title')?.textContent, link: i.querySelector('link')?.textContent, date: i.querySelector('pubDate')?.textContent, content: (i.querySelector('description')?.textContent || '').length })) } })()`)
    const map = await x.ev(`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(sitemapText)}, 'application/xml'); if (d.querySelector('parsererror')) return { error: d.querySelector('parsererror').textContent.slice(0, 200) }; return { urls: [...d.getElementsByTagName('url')].map((u) => ({ loc: u.getElementsByTagName('loc')[0].textContent, mod: u.getElementsByTagName('lastmod')[0].textContent })) } })()`)
    await x.close()
    if (feed.error) fail('feed.xml', `does not parse: ${feed.error}`)
    if (map.error) fail('sitemap.xml', `does not parse: ${map.error}`)
    const wantItems = Math.min(man.posts.length, man.feedItems ?? 20)
    if (!feed.error && feed.items.length !== wantItems) fail('feed.xml', `${feed.items.length} items, ${wantItems} expected`)
    for (const p of man.posts) {
      const url = `${man.site}${p.slug}/`
      const item = feed.items?.find((i) => i.link === url)
      if (!feed.error && man.posts.indexOf(p) < wantItems) {
        if (!item) fail('feed.xml', `no item for ${url}`)
        else {
          if (item.title !== p.title) fail('feed.xml', `${p.slug}: title "${item.title}" is not "${p.title}"`)
          if (new Date(item.date).toISOString().slice(0, 10) !== p.date) fail('feed.xml', `${p.slug}: pubDate ${item.date} is not ${p.date}`)
          if (item.content < 200) fail('feed.xml', `${p.slug}: the full text is missing`)
        }
      }
      if (!map.error) {
        const u = map.urls.find((m) => m.loc === url)
        if (!u) fail('sitemap.xml', `${url} is not listed`)
        else if (u.mod !== p.updated) fail('sitemap.xml', `${p.slug}: lastmod ${u.mod} is not ${p.updated}`)
      }
      const a = await open({ path: `${p.slug}/` })
      const s = await a.ev(`(() => { const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); return { ld, h1: document.querySelector('h1').textContent, time: document.querySelector('.ji-byl time').getAttribute('datetime'), mins: document.querySelector('.ji-mins').textContent } })()`)
      const where = `${p.slug}/`
      if (s.ld['@type'] !== 'Article') fail(where, `JSON-LD type is ${s.ld['@type']}`)
      if (s.ld.headline !== s.h1) fail(where, `JSON-LD headline "${s.ld.headline}" is not the h1 "${s.h1}"`)
      if (s.ld.datePublished !== s.time || s.time !== p.date) fail(where, `dates disagree: JSON-LD ${s.ld.datePublished}, page ${s.time}, build ${p.date}`)
      if (s.ld.dateModified !== p.updated) fail(where, `JSON-LD dateModified ${s.ld.dateModified} is not ${p.updated}`)
      if (s.ld.timeRequired !== `PT${p.minutes}M` || s.mins !== `${p.minutes} min read`) fail(where, `minutes disagree: JSON-LD ${s.ld.timeRequired}, page "${s.mins}", build ${p.minutes}`)
      if (s.ld.url !== url) fail(where, `JSON-LD url ${s.ld.url} is not ${url}`)
      await a.close()
    }
    if (!map.error) {
      for (const s of Object.keys(man.sections)) {
        const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        if (!map.urls.some((m) => m.loc === `${man.site}section/${slug}/`)) fail('sitemap.xml', `section/${slug}/ is not listed`)
      }
      if (!map.urls.some((m) => m.loc === man.site)) fail('sitemap.xml', 'the index is not listed')
    }
    lines.push(`feed.xml: parses, ${feed.items?.length ?? 0} items with title, link, date and full text; sitemap.xml: parses, ${map.urls?.length ?? 0} pages`)
    lines.push(`${man.posts.length} articles: JSON-LD headline = h1, datePublished = page date = feed date = build date, timeRequired = minutes on the page and the index`)

    // ---- without JavaScript
    {
      const p = await open({ nojs: true, w: 1440, h: 900 })
      const r = await p.ev(`(() => { const vis = [...document.querySelectorAll('.ji-reg .ji-row')].filter((li) => li.getBoundingClientRect().height > 0 && getComputedStyle(li.querySelector('.ji-row-in')).opacity === '1'); return { n: vis.length, links: [...document.querySelectorAll('.ji-filters a')].map((a) => [a.dataset.filter, a.getAttribute('href')]) } })()`)
      const want = Math.min(man.posts.length, man.indexLimit)
      if (r.n !== want) fail('index without JavaScript', `${r.n} rows readable, ${want} expected`)
      for (const [f, href] of r.links) {
        if (f === 'All') continue
        const path = href.replace(/#.*$/, '')
        if (!existsSync(resolve(out, path, 'index.html'))) { fail('index without JavaScript', `the ${f} link goes to ${path}, which was not built`); continue }
        const html = readFileSync(resolve(out, path, 'index.html'), 'utf8')
        const n = (html.match(/<li class="ji-row[^"]*" data-section="([^"]+)"/g) ?? []).map((m) => /data-section="([^"]+)"/.exec(m)[1].replace(/&amp;/g, '&'))
        if (n.length !== man.sections[f] || n.some((s) => s !== f)) fail('index without JavaScript', `${path} lists ${n.length} rows (${[...new Set(n)].join(', ')}), ${man.sections[f]} from ${f} expected`)
      }
      await p.close()
      const withNotes = man.posts.find((x) => x.notes > 0) ?? lead
      const a = await open({ nojs: true, path: `${withNotes.slug}/`, w: 1440, h: 900 })
      const s = await a.ev(`(() => ({ body: document.querySelector('.ji-measure').getBoundingClientRect().height, paras: document.querySelectorAll('.ji-measure p').length, notes: [...document.querySelectorAll('.ji-endnotes li')].filter((li) => li.getBoundingClientRect().height > 0).length }))()`)
      if (s.body < 200 || !s.paras) fail(`${withNotes.slug}/ without JavaScript`, 'the article body is not readable')
      if (s.notes !== withNotes.notes) fail(`${withNotes.slug}/ without JavaScript`, `${s.notes} of ${withNotes.notes} notes are readable`)
      await a.close()
      lines.push(`without JavaScript: ${r.n} rows readable, ${r.links.length - 1} section links lead to their own lists, ${withNotes.slug}/ shows its body and ${s.notes} notes`)
    }
  } finally {
    await chrome.close()
    server.close()
  }
  return { fails, lines }
}

export async function main(argv = process.argv.slice(2)) {
  const input = argv.find((a) => !a.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/check.mjs out/index.html')
    process.exit(1)
  }
  try {
    const { fails, lines } = await check(input)
    for (const l of lines) console.log(l)
    if (fails.length) {
      console.error(`\n${fails.length} problem${fails.length > 1 ? 's' : ''}:`)
      for (const f of fails) console.error(`  - ${f}`)
      process.exit(1)
    }
    console.log('all checks passed')
  } catch (e) {
    console.error(e.stack ?? e.message)
    process.exit(1)
  }
}
