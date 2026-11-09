#!/usr/bin/env node
// Motion Heroes kit v2: checks a built hero in headless Chrome at phone,
// tablet, laptop and desktop widths (390, 768, 1024, 1440) before it's
// handed off:
//
//   node scripts/check.mjs out/index.html
//   node scripts/check.mjs out              (every page in a folder)
//
// On top of Lookbk's page checks (below), the hero rules, each an error:
// - H6 text: shell text 14px or more on screens 760px and wider, 16px or
//   more on phones; the headline at least 7% of the viewport's height;
//   nothing within 40px of the bar (or under it); every piece of small
//   text on a solid plate (an opaque background between it and the effect).
// - H9 not the v1 template: no pill-shaped nav, no eyebrow chip above the
//   headline, no headline in two colours, no pair of pill buttons.
// It prints the measured numbers for each width.
//
// Errors (exit 1): anything wider than the screen, content cut off inside a
// box, text below WCAG AA contrast, images without alt text, form fields
// without a label, links or buttons with no name, a missing lang, viewport
// or single h1, skipped heading levels, text under 12 px.
// Warnings: placeholder links (href="#") and tap targets under 24 px
// (links inside a sentence are exempt).
//
// No packages to install. Set CHROME_PATH if Chrome isn't found.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { findChrome, inFrame } from '../chrome.mjs'

const WIDTHS = [390, 768, 1024, 1440]

// Runs inside the page and returns what it found.
function inspect() {
  const errors = []
  const warnings = []
  const W = innerWidth
  const name = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : '') +
    (typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '')
  const text = (el) =>
    (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const parse = (c) => {
    const m = String(c).match(/[\d.]+/g) || [0, 0, 0, 0]
    const srgb = /^color\(srgb/.test(c)
    return {
      rgb: [0, 1, 2].map((i) => (srgb ? 255 : 1) * Number(m[i])),
      a: m.length > 3 ? Number(m[3]) : 1,
    }
  }
  const lum = (rgb) => {
    const l = rgb.map((v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
  }
  const over = (top, bottom, a) =>
    top.map((v, i) => v * a + bottom[i] * (1 - a))
  // Visible on screen: not hidden, and bigger than the 1px box that
  // screen-reader-only text is squeezed into.
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return (
      r.width * r.height > 1 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none'
    )
  }

  // Wider than the screen.
  if (document.documentElement.scrollWidth > W + 1) {
    const wide = [...document.body.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect()
      return (
        r.right > W + 1 &&
        r.width > 0 &&
        getComputedStyle(el).position !== 'fixed'
      )
    })
    const top = wide
      .filter((el) => !wide.includes(el.parentElement))
      .slice(0, 4)
    errors.push(
      `page is ${document.documentElement.scrollWidth}px wide on a ${W}px screen: ${top.map(name).join(', ')}`,
    )
  }

  // Contrast of every visible run of text against the colour behind it.
  const seen = new Set()
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.data.trim(),
    )
    if (!own || !visible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')
      continue
    // the effect draws a scene-mode headline itself; its contrast is checked
    // at build time (typeGrounds) and on the recorded stills
    if (el.closest('[data-mh-type=scene]')) continue
    const fg = parse(cs.color)
    let opacity = 1
    const layers = []
    let layered = false
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p)
      opacity *= Number(ps.opacity)
      if (ps.backgroundImage !== 'none') layered = true
      const b = parse(ps.backgroundColor)
      if (b.a > 0) layers.push(b)
      if (b.a >= 1) break
    }
    if (layered) continue // over an image or gradient: can't be measured here
    // See-through backgrounds laid over the opaque one below them (or the
    // white canvas when nothing is opaque).
    let back = [255, 255, 255]
    for (const b of layers.reverse()) back = over(b.rgb, back, b.a)
    const front = over(fg.rgb, back, fg.a * opacity)
    const [a, b] = [lum(front), lum(back)]
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    const key = `${text(el)}|${ratio.toFixed(1)}`
    if (ratio < need && !seen.has(key)) {
      seen.add(key)
      errors.push(
        `contrast ${ratio.toFixed(2)}:1 (needs ${need}:1) on "${text(el)}" (${name(el)})`,
      )
    }
    if (size < 12 && !seen.has(`small|${text(el)}`)) {
      seen.add(`small|${text(el)}`)
      errors.push(`text is ${size}px, under 12px: "${text(el)}"`)
    }
  }

  // Content cut off by a box with overflow hidden (a card too small for
  // its text, say). Mark a box data-clip-ok when cropping is the point.
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (el.hasAttribute('data-clip-ok') || !visible(el)) continue
    const clips = (o) => o === 'hidden' || o === 'clip'
    for (const [axis, o, scroll, client, pad] of [
      [
        'taller',
        cs.overflowY,
        el.scrollHeight,
        el.clientHeight,
        parseFloat(cs.paddingBottom),
      ],
      [
        'wider',
        cs.overflowX,
        el.scrollWidth,
        el.clientWidth,
        parseFloat(cs.paddingRight),
      ],
    ]) {
      const extra = scroll - client
      if (
        !clips(o) ||
        extra <= 1 ||
        el === document.body ||
        el === document.documentElement
      )
        continue
      const what = text(el.querySelector('h1,h2,h3,h4') || el)
      if (extra > pad + 1)
        errors.push(
          `content is ${extra - Math.round(pad)}px ${axis} than its box and is cut off: ${name(el)} "${what}"`,
        )
      else
        warnings.push(
          `content runs into the padding by ${extra}px: ${name(el)} "${what}"`,
        )
    }
  }

  // Structure and names.
  if (!document.documentElement.lang) errors.push('<html> has no lang')
  if (!document.querySelector('meta[name=viewport]'))
    errors.push('no viewport meta tag')
  const h1 = document.querySelectorAll('h1').length
  if (h1 !== 1) errors.push(`${h1} h1 elements; a page needs exactly one`)
  let last = 0
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const level = Number(h.tagName[1])
    if (last && level > last + 1)
      errors.push(`heading jumps from h${last} to h${level} at "${text(h)}"`)
    last = level
  }
  for (const img of document.querySelectorAll('img'))
    if (!img.hasAttribute('alt'))
      errors.push(`image without alt: ${img.getAttribute('src')}`)
  for (const f of document.querySelectorAll(
    'input:not([type=hidden]),select,textarea',
  )) {
    const labelled =
      f.labels?.length ||
      f.getAttribute('aria-label') ||
      f.getAttribute('aria-labelledby')
    if (!labelled) errors.push(`form field without a label: ${name(f)}`)
  }
  for (const el of document.querySelectorAll('a,button')) {
    const label =
      text(el) ||
      el.getAttribute('aria-label') ||
      [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join('')
    if (!label)
      errors.push(
        `${el.tagName.toLowerCase()} with no text or aria-label: ${name(el)}`,
      )
    if (el.tagName === 'A' && ['#', ''].includes(el.getAttribute('href') ?? ''))
      warnings.push(`placeholder link: "${text(el)}"`)
    // A link inside a sentence is exempt (WCAG 2.5.8, "inline").
    const inSentence =
      getComputedStyle(el).display === 'inline' &&
      el.parentElement.textContent.trim().length >
        el.textContent.trim().length + 1
    if (
      W < 500 &&
      visible(el) &&
      !inSentence &&
      el.getBoundingClientRect().height < 24
    )
      warnings.push(
        `small tap target (${Math.round(el.getBoundingClientRect().height)}px): "${text(el)}"`,
      )
  }

  // ---- the hero rules (Motion Heroes kit v2) ----
  const metrics = {}
  const mh = document.querySelector('.mh')
  if (mh) {
    const H = innerHeight
    const phone = W < 760
    const minText = phone ? 16 : 14
    const bar = mh.querySelector('.mh-bar')
    const barR = bar ? bar.getBoundingClientRect() : null
    const h1 = mh.querySelector('h1')
    const alpha = (c) => parse(c).a
    // where the letters themselves start: the capitals' real top (from the
    // font's metrics at the text's baseline), not the taller line box
    const meas = document.createElement('canvas').getContext('2d')
    const glyphTop = (el) => {
      const cs = getComputedStyle(el)
      const r = document.createRange()
      r.selectNodeContents(el)
      const rs = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0)
      if (!rs.length) return el.getBoundingClientRect().top
      // a headline turned to run up the screen: its box is the letters
      if (el.closest('.mh[data-rot] h1')) return el.closest('h1').getBoundingClientRect().top
      meas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const m = meas.measureText(el.textContent.trim())
      const asc = m.actualBoundingBoxAscent
      const fa = m.fontBoundingBoxAscent ?? asc
      const fd = m.fontBoundingBoxDescent ?? 0
      // a text box spans the font's ascent and descent around the baseline
      const first = rs.reduce((a, b) => (b.top < a.top ? b : a))
      const baseline = first.top + (first.height * fa) / Math.max(1, fa + fd)
      return baseline - asc
    }
    let smallest = Infinity
    let nearest = Infinity
    for (const el of mh.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())
      if (!own || !visible(el) || el.closest('[aria-hidden=true]')) continue
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      smallest = Math.min(smallest, size)
      if (size < minText) errors.push(`H6: text is ${size}px, under ${minText}px on a ${phone ? 'phone' : W + 'px screen'}: "${text(el)}"`)
      if (barR && !bar.contains(el)) {
        const gap = glyphTop(el) - barR.bottom
        nearest = Math.min(nearest, gap)
        if (gap < 40) errors.push(`H6: "${text(el)}" starts ${Math.round(gap)}px under the bar; keep 40px clear`)
      }
      // small text sits on a solid plate, never straight on the effect
      if (!el.closest('h1') && size < 32) {
        let solid = false
        for (let p = el; p && p !== mh; p = p.parentElement) if (alpha(getComputedStyle(p).backgroundColor) >= 0.95) { solid = true; break }
        if (!solid) errors.push(`H6: "${text(el)}" sits on the effect without a solid plate`)
      }
    }
    if (bar && alpha(getComputedStyle(bar).backgroundColor) < 0.95) errors.push('H6: the bar is not a solid plate; the effect would show through the nav')
    if (h1) {
      const hs = parseFloat(getComputedStyle(h1).fontSize)
      metrics.headline = Math.round(hs)
      metrics.headlinePct = +((hs / H) * 100).toFixed(1)
      if (hs < 0.07 * H) errors.push(`H6: the headline is ${hs.toFixed(0)}px, under 7% of the ${H}px viewport (${Math.ceil(0.07 * H)}px)`)
    } else errors.push('H6: no headline (h1) in the hero')
    metrics.smallest = smallest === Infinity ? null : smallest
    metrics.clearance = nearest === Infinity ? null : Math.round(nearest)

    // H9: the v1 default lockup, part by part
    const signals = []
    const pill = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const rad = parseFloat(cs.borderTopLeftRadius) || 0
      const filled = alpha(cs.backgroundColor) > 0.05 || parseFloat(cs.borderTopWidth) > 0 || cs.backdropFilter !== 'none'
      return r.height >= 20 && rad >= r.height / 2 - 1 && filled
    }
    for (const nav of mh.querySelectorAll('nav')) if (visible(nav) && pill(nav)) signals.push('a pill-shaped nav')
    if (h1) {
      const hr = h1.getBoundingClientRect()
      for (const el of mh.querySelectorAll('p,span,div,small,strong')) {
        if (!visible(el) || el.closest('h1') || el.closest('a') || bar?.contains(el)) continue
        const r = el.getBoundingClientRect()
        if (r.height > 52 || !text(el)) continue
        if (r.bottom <= hr.top + 4 && hr.top - r.bottom < 200 && pill(el)) {
          signals.push(`an eyebrow chip above the headline ("${text(el)}")`)
          break
        }
      }
      const hc = getComputedStyle(h1).color
      for (const el of h1.querySelectorAll('*')) {
        const c = getComputedStyle(el).color
        if (visible(el) && text(el) && c !== hc && alpha(c) > 0 && alpha(hc) > 0) {
          signals.push(`a two-colour headline ("${text(el)}" in ${c})`)
          break
        }
      }
    }
    const groups = new Map()
    for (const el of mh.querySelectorAll('a,button')) {
      if (!visible(el) || bar?.contains(el) || el.getBoundingClientRect().height < 36 || !pill(el)) continue
      groups.set(el.parentElement, (groups.get(el.parentElement) || 0) + 1)
    }
    if ([...groups.values()].some((n) => n >= 2)) signals.push('a pair of pill buttons')
    metrics.h9 = signals.length
    for (const s of signals) errors.push(`H9: ${s}, part of the v1 template`)
  }
  return { errors, warnings, metrics }
}

// Pages to check: the files named, and every .html file in a folder named.
function pagesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'screens') return []
    const p = join(dir, e.name)
    if (e.isDirectory()) return pagesIn(p)
    return e.name.endsWith('.html') ? [p] : []
  })
}
const inputs = (process.argv.slice(2).length ? process.argv.slice(2) : ['out/index.html'])
  .filter((a) => !a.startsWith('--'))
  .map((a) => resolve(a))
for (const input of inputs)
  if (!existsSync(input)) {
    console.error(`check: ${input} not found; build the page first`)
    process.exit(1)
  }
const pages = inputs.flatMap((p) => (statSync(p).isDirectory() ? pagesIn(p).sort() : [p]))
const chrome = findChrome()
if (!chrome) {
  console.error('check: no Chrome, Chromium or Edge found; set CHROME_PATH')
  process.exit(1)
}

let failed = false
for (const page of pages) {
  if (pages.length > 1) console.log(relative(process.cwd(), page) || page)
  const pad = pages.length > 1 ? '  ' : ''
  const results = inFrame(chrome, page, WIDTHS, inspect)
  for (const [i, w] of WIDTHS.entries()) {
    if (!results[i]) {
      console.error(`${pad}${w}px: the page didn't finish loading`)
      failed = true
      continue
    }
    const unique = (list) => [...new Set(list)]
    const errors = unique(results[i].errors)
    const warnings = unique(results[i].warnings)
    const m = results[i].metrics || {}
    const nums = m.headline ? ` (text >= ${m.smallest}px, headline ${m.headline}px = ${m.headlinePct}% of the height, ${m.clearance}px under the bar, H9 signals ${m.h9})` : ''
    console.log(
      `${pad}${w}px: ${errors.length ? `${errors.length} to fix` : 'ok'}${warnings.length ? `, ${warnings.length} to look at` : ''}${nums}`,
    )
    for (const e of errors) console.log(`${pad}  ✗ ${e}`)
    for (const e of warnings) console.log(`${pad}  · ${e}`)
    if (errors.length) failed = true
  }
}
process.exit(failed ? 1 : 0)
