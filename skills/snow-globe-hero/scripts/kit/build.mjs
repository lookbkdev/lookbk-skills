#!/usr/bin/env node
// Motion Heroes kit v2: builds an animated hero section from hero.json.
//
//   node scripts/build.mjs hero.json out
//
// Writes out/index.html (a self-contained page: CSS, script and logo
// inline), out/embed.html (the section alone, to paste into a page you
// already have) and out/assets/ (the logo, and any files the effect ships,
// such as footage).
//
// v2 builds one of five art-directed compositions (hero.json "composition"):
// type-effect, editorial, lockup, split, story. The kit owns the layout, the
// type scale, the nav, the call to action, the solid plates under small text
// and the clearance under the bar; the effect only draws, and its CSS may
// only style its own classes. The build stops on anything that would bring
// back the v1 template (an eyebrow chip, two pill buttons, a two-colour
// headline, a left/right copy column) and on anything that can't meet the
// type and contrast rules. See scripts/kit/KIT.md.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { contrast, isDark, isHex, lum, mix, readable } from '../color.mjs'
import { inline, plain } from '../inline.mjs'
import { h, toHtml } from '../markup.mjs'

const KIT = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = dirname(KIT)
const PACKAGE = dirname(SCRIPTS)
const EFFECT_DIR = join(SCRIPTS, 'effect')
const FONTS = JSON.parse(readFileSync(join(KIT, 'fonts.json'), 'utf8'))
const THREE_JSON = JSON.parse(readFileSync(join(KIT, 'three.json'), 'utf8'))

const chars = (s) => [...String(s ?? '')].length
const isUrl = (s) => /^https:\/\//.test(String(s ?? ''))
const isHref = (s) =>
  typeof s === 'string' &&
  s.length > 0 &&
  (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(s) ||
    !/^[a-z][\w+.-]*:/i.test(s))
const type = (v) => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v)

export const MOTION = {
  speed: { type: 'number', min: 0.25, max: 2, default: 1, doc: 'How fast the scene moves; 1 is the designed pace' },
  pointer: { type: 'boolean', default: true, doc: 'The scene follows the pointer on a spring (and a slow made-up path in recordings)' },
}

/**
 * The five compositions. Each is art-directed in shell.css (its own type
 * scale, bar, call to action and field for the effect); `title` is the
 * headline's size rule, used here to check a headline can be set at 7% of
 * the viewport's height without a word overflowing.
 *   col: the headline's column as a share of the width (desktop, phone)
 *   size(W, H): the font size the CSS gives the headline
 *   lines: the most lines it may take on a phone
 */
export const COMPOSITIONS = {
  'type-effect': {
    doc: 'Type as the effect, full bleed: the headline is fitted to the width and the effect lives in or around its letters',
    col: [0.94, 0.92],
    fit: true,
    lines: 2,
  },
  editorial: {
    doc: 'Editorial asymmetric grid: a 12-column grid, the headline over columns 1-8, a ruled plate in columns 1-4, the effect over columns 5-12',
    col: [0.64, 0.92],
    size: (W, H) => Math.max(0.072 * H, Math.min(0.15 * H, 0.094 * W)),
    lines: 5,
  },
  lockup: {
    doc: 'Centred lockup, effect behind: the headline centred over a full-bleed effect, a narrow plate under it, the bar centred on the brand',
    col: [0.86, 0.92],
    size: (W, H) => Math.max(0.072 * H, Math.min(0.16 * H, 0.1 * W)),
    lines: 5,
  },
  split: {
    doc: 'Split stage: a solid panel holds the copy, the effect fills a full-height stage beside it (above it on phones)',
    col: [0.4, 0.92],
    size: (W, H) => Math.max(0.072 * H, Math.min(0.13 * H, 0.062 * W)),
    lines: 5,
  },
  story: {
    doc: 'Scroll-pinned story: the section pins while the visitor scrolls; numbered steps light up one by one beside the headline',
    col: [0.58, 0.92],
    size: (W, H) => Math.max(0.072 * H, Math.min(0.13 * H, 0.08 * W)),
    lines: 5,
  },
}
// How the headline takes part in the scene (effect.mjs `typeMode`):
//   ink      plain text over the effect; the effect's grounds must give it 3:1
//   lit      the effect lights the letters (ctx.light): a fill that brightens, or
//            darkens on a light page, where the effect's light falls
//   occlude  the effect draws parts of itself in front of the letters (ctx.front)
//   scene    the effect draws the letters itself, from the headline's measured
//            lines (view.type); the page keeps the real text for readers
export const TYPE_MODES = ['ink', 'lit', 'occlude', 'scene']
export const DRIVES = ['time', 'scroll']
// The v1 shell's signature parts. Asking for them stops the build.
const V1_FIELDS = {
  badge: 'hero.badge was the eyebrow chip above the headline; v2 has no chip. Put a short line in hero.subtitle instead',
  actions: 'hero.actions was the pair of pill buttons; v2 has one hero.cta (and an optional plain hero.link)',
  align: 'hero.align picked the v1 left/right column; v2 lays the hero out by "composition" (type-effect, editorial, lockup, split, story)',
  note: 'hero.note was the small print under the buttons; put it in the lede',
  facts: 'hero.facts (a label/value spec table) is gone: it became the new chip. Put the one number that matters in the lede or the headline',
}
// Bar height and the clearance under it. shell.css uses the same numbers.
export const BAR = { desktop: 72, phone: 60, clear: 40 }
// Minimum text sizes, enforced in shell.css and measured by check.mjs.
export const MIN_TEXT = { desktop: 14, phone: 16 }

/* ---------------------------------------------------------------- three.js */

// The kit's pinned three.js (scripts/kit/three.json): the bare "three"
// specifier and the "three/addons/" prefix map to it, and every file the
// catalogue lists carries its SRI hash.
export const THREE = {
  version: THREE_JSON.version,
  base: THREE_JSON.base,
  module: THREE_JSON.base + THREE_JSON.module,
  addons: THREE_JSON.base + THREE_JSON.addons,
}

/** The static imports of an ES module's source (comments stripped). */
function importsOf(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const out = new Set()
  // statements only: `import … from '…'`, `export … from '…'`, `import '…'` at the start of a line
  for (const m of code.matchAll(/^[ \t]*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"\n]+)['"]|^[ \t]*import\s*['"]([^'"\n]+)['"]/gm)) out.add(m[1] ?? m[2])
  return [...out]
}

/** A specifier inside a three.js file → a path under THREE.base, or null if the kit doesn't map it. */
function threePath(spec, fromPath) {
  if (spec === 'three') return THREE_JSON.module
  if (spec.startsWith('three/addons/')) return THREE_JSON.addons + spec.slice('three/addons/'.length)
  if (spec.startsWith('./') || spec.startsWith('../')) return new URL(spec, THREE.base + fromPath).href.slice(THREE.base.length)
  return null
}

/**
 * Fetches three.js files from the pinned CDN and follows their static
 * imports: { files: { path: { integrity, imports } }, unmapped: [spec] }.
 * Used by `build.mjs --three-addon` to pin an add-on the catalogue lacks.
 */
export async function crawlThree(paths) {
  const files = {}
  const unmapped = new Set()
  const queue = [...paths]
  while (queue.length) {
    const path = queue.shift()
    if (files[path]) continue
    const r = await fetch(THREE.base + path)
    if (!r.ok) throw new Error(`${THREE.base + path}: HTTP ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    const imports = []
    for (const spec of importsOf(buf.toString('utf8'))) {
      const p = threePath(spec, path)
      if (p === null) unmapped.add(`${spec} (in ${path})`)
      else imports.push(p)
    }
    files[path] = { integrity: 'sha384-' + createHash('sha384').update(buf).digest('base64'), imports }
    queue.push(...imports)
  }
  return { files, unmapped: [...unmapped] }
}

/**
 * What the page needs for the effect's three.js: null when the effect doesn't
 * use the kit's pinned three, else { addons, integrity } with every file the
 * add-ons import (from the catalogue, or the effect's own libs).
 */
function threeFor(fx) {
  const libs = fx.libs ?? []
  const named = libs.find((l) => l.name === 'three')
  const addons = fx.addons ?? []
  if (!Array.isArray(addons) || addons.some((a) => typeof a !== 'string' || !/^[\w./-]+\.js$/.test(a) || a.includes('..')))
    throw new Error("effect.mjs: addons is a list of paths under three/examples/jsm, like 'loaders/GLTFLoader.js'")
  if (named && named.url !== THREE.module) {
    if (addons.length) throw new Error(`effect.mjs: addons need the kit's pinned three.js (${THREE.module}); libs names 'three' at ${named.url}`)
    return null
  }
  if (!named && !addons.length) return null
  const own = Object.fromEntries(libs.filter((l) => l.integrity).map((l) => [l.url, l.integrity]))
  const integrity = {}
  const seen = new Set()
  const walk = (path) => {
    if (seen.has(path)) return
    seen.add(path)
    const url = THREE.base + path
    const known = THREE_JSON.files[path]
    if (known) {
      integrity[url] = known.integrity
      known.imports.forEach(walk)
    } else if (own[url]) integrity[url] = own[url]
    else
      throw new Error(
        `effect.mjs: three.js file ${path} isn't in scripts/kit/three.json or the effect's libs. Run \`node scripts/build.mjs --three-addon ${path.slice(THREE_JSON.addons.length)}\` and add the lines it prints to libs`,
      )
  }
  walk(THREE_JSON.module)
  for (const a of addons) walk(THREE_JSON.addons + a)
  return { addons, integrity }
}

/** The effect's story (a pinned scroll or a timed run), checked; null if it has none. */
function storyFor(fx, params, theme) {
  const s = typeof fx.story === 'function' ? fx.story(params, theme) : fx.story
  if (s === undefined || s === null || s === false) return null
  const bad = (m) => {
    throw new Error(`effect.mjs story: ${m}`)
  }
  const num = (k, dflt, min, max) => {
    const v = s[k] ?? dflt
    if (typeof v !== 'number' || !(v >= min && v <= max)) bad(`${k} is a number from ${min} to ${max}`)
    return v
  }
  const drive = s.drive ?? 'time'
  if (!DRIVES.includes(drive)) bad(`drive is one of ${DRIVES.join(', ')}`)
  if (s.loop !== undefined && typeof s.loop !== 'boolean') bad('loop is true or false')
  for (const k of Object.keys(s)) if (!['drive', 'pin', 'length', 'lead', 'hold', 'loop'].includes(k)) bad(`${k} isn't a field (drive, pin, length, lead, hold, loop)`)
  return {
    drive,
    pin: num('pin', 1.5, 0.25, 8),
    length: num('length', undefined, 0.1, 120),
    lead: num('lead', 1, 0, 30),
    hold: num('hold', 2, 0, 30),
    loop: s.loop ?? true,
  }
}
/** Loads the package's effect description (scripts/effect/effect.mjs). */
export async function loadEffect() {
  const mod = await import(pathToFileURL(join(EFFECT_DIR, 'effect.mjs')).href)
  const fx = mod.default
  const src = readFileSync(join(EFFECT_DIR, 'effect.js'), 'utf8')
  return { ...fx, source: src }
}

/* ---------------------------------------------------------------- params */

/** Checks one value against a parameter schema; returns the value to use. */
function checkParam(spec, value, at, problems, ctx) {
  const dflt = typeof spec.default === 'function' ? spec.default(ctx) : spec.default
  if (value === undefined) return dflt
  const bad = (msg) => (problems.push(`${at} ${msg}`), dflt)
  switch (spec.type) {
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || Number.isNaN(value))
        return bad(`must be a number from ${spec.min} to ${spec.max} (default ${dflt})`)
      if (spec.type === 'integer' && !Number.isInteger(value))
        return bad(`must be a whole number from ${spec.min} to ${spec.max}`)
      if (value < spec.min || value > spec.max)
        return bad(`is ${value}; it goes from ${spec.min} to ${spec.max} (default ${dflt})`)
      return value
    case 'boolean':
      return typeof value === 'boolean' ? value : bad('must be true or false')
    case 'color':
      return isHex(value) ? value.toLowerCase() : bad('must be a hex colour like #1b1830')
    case 'enum':
      return spec.values.includes(value) ? value : bad(`is one of ${spec.values.join(', ')}`)
    case 'text':
      if (typeof value !== 'string') return bad('must be text')
      if (chars(value) > spec.max) return bad(`is ${chars(value)} characters; the limit is ${spec.max}`)
      return value
    case 'list': {
      if (!Array.isArray(value)) return bad(`must be a list of ${spec.min} to ${spec.max}`)
      if (value.length < spec.min || value.length > spec.max)
        return bad(`has ${value.length}; it takes ${spec.min} to ${spec.max}`)
      return value.map((item, i) => {
        if (type(item) !== 'object') return (problems.push(`${at}[${i}] must be an object`), item)
        const out = {}
        for (const [k, s] of Object.entries(spec.item)) {
          if (s.required && item[k] === undefined) problems.push(`${at}[${i}].${k} is required`)
          out[k] = checkParam(s, item[k], `${at}[${i}].${k}`, problems, ctx)
        }
        for (const k of Object.keys(item))
          if (!spec.item[k]) problems.push(`${at}[${i}].${k} isn't a field (fields: ${Object.keys(spec.item).join(', ')})`)
        return out
      })
    }
    default:
      throw new Error(`effect.mjs: ${at} has unknown type ${spec.type}`)
  }
}

/* ---------------------------------------------------------------- fonts */

// The weights the shell uses (body 400, labels and buttons 500–700) plus the
// headline weight. A Google Fonts request names exactly these.
const shellWeights = (headline) => [...new Set([400, 500, 600, 700, headline])].sort((a, b) => a - b)

const googleHref = (name, weights) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}${weights.length ? `:wght@${weights.join(';')}` : ''}&display=swap`

function fontFor(name, notes, weights) {
  if (name === false || name === 'system') return { stack: null, links: [] }
  const known = FONTS[name]
  if (known) {
    const css = [known.css].flat()
    const integrity = [known.integrity].flat()
    return { family: known.family, links: css.map((href, i) => ({ href, integrity: integrity[i] })) }
  }
  notes.push(
    `"${name}" isn't in the pinned font list (scripts/kit/fonts.json); it loads from Google Fonts, which isn't version-pinned`,
  )
  return { family: name, google: { name, weights }, links: [{ href: googleHref(name, weights) }] }
}

/**
 * Google Fonts answers HTTP 400 when any requested weight doesn't exist for a
 * family (Fredoka and Quicksand stop at 700), and the page then quietly falls
 * back to system fonts. Ask for the weights we use; if that fails, keep only
 * the weights the family has. A family that loads in no weight is an error.
 * Being offline is only a note: the build can't tell either way.
 */
async function settleGoogleFonts(fonts, problems, notes) {
  const ask = async (href) => {
    const r = await fetch(href, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' } })
    return r.ok && /@font-face/.test(await r.text())
  }
  const done = new Map()
  for (const f of Object.values(fonts)) {
    if (!f.google) continue
    const { name, weights } = f.google
    const key = `${name}|${weights}`
    if (!done.has(key)) {
      done.set(
        key,
        (async () => {
          try {
            if (await ask(googleHref(name, weights))) return { weights }
            const have = []
            for (const w of weights) if (await ask(googleHref(name, [w]))) have.push(w)
            if (have.length) return { weights: have }
            return (await ask(googleHref(name, []))) ? { weights: [] } : { fail: true }
          } catch {
            return { offline: true }
          }
        })(),
      )
    }
    const got = await done.get(key)
    if (got.fail) problems.push(`font "${name}" doesn't load from Google Fonts in any weight: check the spelling, or pick a family from scripts/kit/fonts.json`)
    else if (got.offline) notes.push(`couldn't reach Google Fonts to check "${name}"; if it doesn't exist the page shows system fonts`)
    else {
      if (got.weights.join() !== weights.join()) {
        const missing = weights.filter((w) => !got.weights.includes(w))
        notes.push(`"${name}" has no ${missing.join(', ')} weight on Google Fonts; loading ${got.weights.length ? got.weights.join(', ') : 'its default weight'} and the browser fakes the rest`)
      }
      f.links = [{ href: googleHref(name, got.weights) }]
    }
  }
}

/* ---------------------------------------------------------------- checks the effect */

/** The effect's type mode for a composition: a string, a map by composition, or a function. */
function typeModeFor(fx, comp, params, theme) {
  const m = fx.typeMode
  const v = typeof m === 'function' ? m(comp, params, theme) : m && typeof m === 'object' ? m[comp] : m
  return v ?? 'ink'
}

/**
 * effect.css may only style the effect's own classes (prefixed with its
 * `cssPrefix`). Anything that reaches the kit's classes (.mh-*) could move the
 * headline, the plates or the bar, so the build refuses it.
 */
export function lintEffectCss(css, prefix) {
  const problems = []
  const src = String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
  if (!src.trim()) return problems
  if (!prefix) return ['effect.mjs needs a cssPrefix (like "bpf") when it has css: its rules may only style classes starting with it']
  for (const m of src.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (let sel of m[1].split(',')) {
      sel = sel.trim()
      if (!sel || /^(from|to|[\d.]+%)$/.test(sel)) continue
      const kit = sel.match(/\.mh-[\w-]+/)
      if (kit) problems.push(`effect.css: "${sel}" styles the kit's ${kit[0]}; in v2 the layout, type, bar and plates belong to shell.css`)
      else if (!new RegExp(`\\.${prefix}[\\w-]*`).test(sel)) problems.push(`effect.css: "${sel}" doesn't name a .${prefix}-… class; effect styles stay on the effect's own elements`)
      if (/(^|[\s>+~])(h1|header|nav|section|body|html|a|p)\b/.test(sel)) problems.push(`effect.css: "${sel}" styles page elements; style only the effect's own classes`)
    }
  }
  return [...new Set(problems)]
}

/** Average advance of the display face as a share of its size, for the size checks below. */
const advanceOf = (title, f) => {
  if (typeof f.advance === 'number') return f.advance
  const letters = title.replace(/[^A-Za-z]/g, '')
  const upper = letters.replace(/[^A-Z]/g, '').length / Math.max(1, letters.length)
  return upper > 0.7 ? 0.64 : 0.55
}

/**
 * Can the headline be set at 7% of the viewport's height or more, at a
 * laptop and a phone size, without a word or line running out of its
 * column? Estimated from character counts; check.mjs measures the real page.
 */
function titleFits(title, comp, adv, problems) {
  const c = COMPOSITIONS[comp]
  const lines = title.split('\n').map((l) => plain(l))
  const sizes = [
    [1440, 900, 'a 1440×900 laptop', 0],
    [390, 844, 'a 390×844 phone', 1],
  ]
  for (const [W, H, what, d] of sizes) {
    const pad = d ? 32 : Math.min(112, Math.max(32, 0.068 * W))
    const col = Math.max(120, W * c.col[d] - (c.col[d] > 0.9 ? pad : 0))
    const min = 0.07 * H
    if (c.fit) {
      const longest = Math.max(...lines.map(chars))
      const size = col / (longest * adv)
      if (size < min)
        problems.push(
          `hero.title: in the ${comp} composition each line is fitted to the width; the longest line (${longest} characters) fits ${what} only at about ${Math.round(size)}px, under 7% of its height (${Math.round(min)}px). Keep each line to ${Math.floor(col / (min * adv))} characters or fewer`,
        )
      if (lines.length > c.lines) problems.push(`hero.title: the ${comp} composition takes at most ${c.lines} lines; break it into ${c.lines} or fewer`)
      continue
    }
    const size = c.size(W, H)
    const words = lines.join(' ').split(/\s+/).filter(Boolean)
    const wide = words.find((w) => chars(w) * adv * size > col)
    if (wide)
      problems.push(
        `hero.title: "${wide}" is too long to set at 7% of the height on ${what} (${Math.round(size)}px type in a ${Math.round(col)}px column); shorten it or split it`,
      )
    // greedy wrap, to count lines
    let n = 0
    for (const l of lines) {
      let w = 0
      n++
      for (const word of l.split(/\s+/).filter(Boolean)) {
        const ww = (chars(word) + 1) * adv * size
        if (w && w + ww > col) {
          n++
          w = 0
        }
        w += ww
      }
    }
    if (n > c.lines) problems.push(`hero.title: on ${what} the headline would take about ${n} lines at 7% of the height; the ${comp} composition allows ${c.lines}. Use fewer words`)
  }
}

/* ---------------------------------------------------------------- validate */

/**
 * Every problem in hero.json at once, plus the resolved document the page
 * is built from (defaults filled in, colours worked out).
 */
export function resolveDoc(doc, fx, base) {
  const problems = []
  const notes = []
  const need = (ok, msg) => ok || problems.push(msg)
  const text = (obj, key, max, at, required = false) => {
    const v = obj?.[key]
    if (v === undefined || v === null || v === '') {
      if (required) problems.push(`${at}.${key} is required`)
      return
    }
    if (typeof v !== 'string') problems.push(`${at}.${key} must be text`)
    else if (chars(plain(v.replace(/\n/g, ' '))) > max)
      problems.push(`${at}.${key} is ${chars(plain(v))} characters; the limit is ${max}`)
  }
  const link = (l, at, max) => {
    if (type(l) !== 'object') return problems.push(`${at} must be { "label", "href" }`)
    text(l, 'label', max, at, true)
    need(isHref(l.href), `${at}.href is a URL, a path like /pricing or an #anchor`)
    for (const k of Object.keys(l)) if (!['label', 'href'].includes(k)) problems.push(`${at}.${k} isn't a field (label, href)`)
  }
  if (type(doc) !== 'object') return { problems: ['hero.json must be an object'] }
  const known = ['composition', 'brand', 'nav', 'action', 'hero', 'theme', 'effect', 'meta', 'motion', '$schema', '_']
  for (const k of Object.keys(doc))
    if (!known.includes(k)) problems.push(`"${k}" isn't a field of hero.json (fields: ${known.slice(0, 9).join(', ')})`)

  // composition
  const comps = fx.compositions ?? Object.keys(COMPOSITIONS)
  const comp = doc.composition
  if (comp === undefined) problems.push(`composition is required: one of ${comps.join(', ')} (see KIT.md)`)
  else if (!COMPOSITIONS[comp]) problems.push(`composition is one of ${Object.keys(COMPOSITIONS).join(', ')}`)
  else if (!comps.includes(comp)) problems.push(`${fx.name} is art-directed for ${comps.join(', ')}; "${comp}" isn't one of them`)

  // brand
  const brand = doc.brand ?? {}
  if (!doc.brand) problems.push('brand is required')
  text(brand, 'name', 28, 'brand', true)
  if (brand.href !== undefined) need(isHref(brand.href), 'brand.href is a URL or a path')
  let logo = null
  if (brand.logo !== undefined) {
    if (typeof brand.logo !== 'string' || !brand.logo) problems.push('brand.logo is an .svg file next to hero.json, or up to 3 characters of text')
    else if (/\.svg$/i.test(brand.logo)) {
      const file = resolve(base, brand.logo)
      if (!existsSync(file)) problems.push(`brand.logo: ${brand.logo} not found next to hero.json`)
      else {
        const svg = readFileSync(file, 'utf8')
        if (!/<svg[\s>]/i.test(svg)) problems.push(`brand.logo: ${brand.logo} isn't an SVG`)
        else if (/<script|\son\w+\s*=|javascript:|<foreignObject/i.test(svg))
          problems.push(`brand.logo: ${brand.logo} has scripts or event handlers; save a plain SVG`)
        else if (!/viewBox=/i.test(svg)) problems.push(`brand.logo: ${brand.logo} needs a viewBox so it can be sized`)
        else logo = { kind: 'svg', svg: svg.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/gi, '').trim(), file }
      }
    } else if (chars(brand.logo) > 3) problems.push('brand.logo as text is at most 3 characters (a monogram); use an .svg file for a real logo')
    else logo = { kind: 'text', text: brand.logo }
  }

  // nav and the bar's link
  if (doc.nav !== undefined) {
    if (!Array.isArray(doc.nav)) problems.push('nav is a list of { "label", "href" }')
    else {
      need(doc.nav.length <= 4, `nav has ${doc.nav.length} links; the limit is 4`)
      doc.nav.forEach((l, i) => link(l, `nav[${i}]`, 16))
    }
  }
  if (doc.action !== undefined && doc.action !== false) link(doc.action, 'action', 20)

  // hero copy
  const hero = doc.hero ?? {}
  if (!doc.hero) problems.push('hero is required')
  for (const [k, why] of Object.entries(V1_FIELDS)) if (hero[k] !== undefined) problems.push(why)
  const heroKnown = ['title', 'subtitle', 'lede', 'cta', 'link', 'steps']
  for (const k of Object.keys(hero)) if (!heroKnown.includes(k) && !V1_FIELDS[k]) problems.push(`hero.${k} isn't a field (fields: ${heroKnown.join(', ')})`)
  text(hero, 'title', 60, 'hero', true)
  if (typeof hero.title === 'string') {
    need((hero.title.match(/\*/g) ?? []).length % 2 === 0, 'hero.title has an unclosed *emphasis*')
    need(hero.title.split('\n').length <= 3, 'hero.title is at most 3 lines')
  }
  text(hero, 'subtitle', 64, 'hero')
  text(hero, 'lede', 200, 'hero', true)
  if (hero.cta === undefined) problems.push('hero.cta is required: { "label", "href" }, the one call to action')
  else link(hero.cta, 'hero.cta', 26)
  if (hero.link !== undefined) link(hero.link, 'hero.link', 26)
  if (comp === 'story') {
    if (!Array.isArray(hero.steps) || hero.steps.length < 2 || hero.steps.length > 5) problems.push('hero.steps is required in the story composition: 2 to 5 { "title", "text" }')
    else
      hero.steps.forEach((s, i) => {
        if (type(s) !== 'object') return problems.push(`hero.steps[${i}] must be { "title", "text" }`)
        text(s, 'title', 28, `hero.steps[${i}]`, true)
        text(s, 'text', 110, `hero.steps[${i}]`, true)
      })
  } else if (hero.steps !== undefined) problems.push('hero.steps only belongs to the story composition')

  // theme
  const theme = doc.theme ?? {}
  if (!doc.theme) problems.push('theme is required')
  for (const k of ['background', 'ink', 'accent'])
    need(isHex(theme[k]), `theme.${k} must be a hex colour like #f2f0f7`)
  if (theme.plate !== undefined) need(isHex(theme.plate), 'theme.plate must be a solid hex colour (the plates under small text are always opaque)')
  if (theme.scrim !== undefined) problems.push('theme.scrim is gone in v2: small text always sits on a solid plate (theme.plate)')
  const colours = isHex(theme.background) && isHex(theme.ink) && isHex(theme.accent) && (theme.plate === undefined || isHex(theme.plate))
  let mode = theme.mode
  if (mode !== undefined && !['light', 'dark'].includes(mode)) problems.push('theme.mode is light or dark')
  if (theme.rules !== undefined && !['on', 'off', 'fade-with-story'].includes(theme.rules))
    problems.push('theme.rules is on, off or fade-with-story (the editorial column rules)')
  if (isHex(theme.background)) {
    const dark = isDark(theme.background) || lum(theme.background) < 0.25
    if (mode === undefined) mode = dark ? 'dark' : 'light'
    else if (['light', 'dark'].includes(mode) && (mode === 'dark') !== dark)
      problems.push(`theme.mode is ${mode} but theme.background ${theme.background} is ${dark ? 'dark' : 'light'}`)
  }
  const plate = (isHex(theme.plate) ? theme.plate : theme.background)?.toLowerCase()
  if (colours) {
    const r = contrast(theme.ink, plate)
    need(r >= 7, `theme.ink on the plate (${plate}) is ${r.toFixed(1)}:1; text on plates needs 7:1`)
  }
  const f = theme.fonts ?? {}
  if (theme.fonts !== undefined && type(theme.fonts) !== 'object') problems.push('theme.fonts is { "display", "body", "mono", "weight", "advance" }')
  for (const k of ['display', 'body', 'mono'])
    if (f[k] !== undefined && f[k] !== false && (typeof f[k] !== 'string' || !f[k]))
      problems.push(`theme.fonts.${k} is a font family name, or false for the system font`)
  if (f.weight !== undefined)
    need(Number.isInteger(f.weight) && f.weight >= 300 && f.weight <= 900, 'theme.fonts.weight is 300 to 900 (the headline weight)')
  if (f.advance !== undefined)
    need(typeof f.advance === 'number' && f.advance >= 0.3 && f.advance <= 0.8, "theme.fonts.advance is 0.3 to 0.8: the display face's average letter width as a share of its size (0.42 for condensed faces)")

  // motion
  const motion = {}
  const mo = doc.motion ?? {}
  if (doc.motion !== undefined && type(doc.motion) !== 'object') problems.push('motion is { "speed", "pointer" }')
  for (const [k, s] of Object.entries(MOTION)) motion[k] = checkParam(s, mo[k], `motion.${k}`, problems, {})
  for (const k of Object.keys(mo)) if (!MOTION[k]) problems.push(`motion.${k} isn't a field (fields: speed, pointer)`)

  // meta
  const meta = doc.meta ?? {}
  if (!doc.meta) problems.push('meta is required')
  text(meta, 'title', 70, 'meta', true)
  text(meta, 'description', 170, 'meta', true)
  if (meta.url !== undefined) need(isUrl(meta.url), "meta.url is the page's full https:// address")
  if (meta.image !== undefined) need(isUrl(meta.image), 'meta.image is a full https:// address of a 1200×630 picture')
  if (meta.lang !== undefined) need(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(meta.lang), 'meta.lang is a language tag like en or pt-BR')

  // effect parameters (checked even when other fields have problems, so every problem shows at once)
  const ctx = { theme: colours ? { ...theme, mode, plate } : { background: '#ffffff', ink: '#111111', accent: '#3355ff', mode: 'light', plate: '#ffffff' }, composition: comp }
  const params = {}
  const ef = doc.effect ?? {}
  const before = problems.length
  if (doc.effect !== undefined && type(doc.effect) !== 'object') problems.push("effect is an object of this effect's settings")
  for (const [k, s] of Object.entries(fx.params)) params[k] = checkParam(s, ef[k], `effect.${k}`, problems, ctx)
  for (const k of Object.keys(ef))
    if (!fx.params[k]) problems.push(`effect.${k} isn't a setting of ${fx.name} (settings: ${Object.keys(fx.params).join(', ')})`)
  if (colours) {
    try {
      fx.check?.(params, { ...ctx.theme, composition: comp }, problems)
    } catch {
      if (problems.length === before) throw new Error('effect.mjs check() failed on valid settings')
    }
  }

  // the headline: 7% of the viewport's height, at every size
  if (typeof hero.title === 'string' && COMPOSITIONS[comp]) titleFits(hero.title, comp, advanceOf(hero.title, f), problems)
  if (problems.length || !colours) return { problems, notes }

  // the headline's colours, by how it takes part in the scene
  const th = { ...ctx.theme, composition: comp }
  const typeMode = typeModeFor(fx, comp, params, th)
  if (!TYPE_MODES.includes(typeMode)) throw new Error(`effect.mjs typeMode is one of ${TYPE_MODES.join(', ')}`)
  const grounds = [theme.background, ...(fx.grounds?.(params, th, { composition: comp }) ?? [])]
  const worst = (c) => Math.min(...grounds.map((g) => contrast(c, g)))
  let lit = null
  if (typeMode === 'ink' || typeMode === 'occlude') {
    if (worst(theme.ink) < 3)
      problems.push(`the headline (theme.ink) falls to ${worst(theme.ink).toFixed(1)}:1 where the effect is behind it; large text needs 3:1. Pick another ink or tone the effect down (its grounds)`)
  } else if (typeMode === 'lit') {
    if (!/\bctx\.light\s*\(/.test(fx.source)) problems.push('effect.mjs says typeMode "lit" but effect.js never calls ctx.light(); the letters would never be lit')
    lit = fx.lit?.(params, th) ?? { base: theme.ink, lit: mix(theme.ink, theme.mode === 'dark' ? '#ffffff' : '#000000', 0.5) }
    for (const [k, c] of Object.entries(lit))
      if (!isHex(c)) throw new Error(`effect.mjs lit() returns hex colours; ${k} is ${c}`)
      else if (worst(c) < 3) problems.push(`the lit headline's ${k} colour ${c} falls to ${worst(c).toFixed(1)}:1 over the effect; large text needs 3:1`)
  } else if (typeMode === 'scene') {
    if (!/\bview\.type\b|\bctx\.type\b/.test(fx.source)) problems.push('effect.mjs says typeMode "scene" but effect.js never reads view.type; the headline would vanish')
    const pairs = fx.typeGrounds?.(params, th)
    if (!Array.isArray(pairs) || !pairs.length) problems.push('effect.mjs typeMode "scene" needs typeGrounds(params, theme): the [{ fg, bg }] pairs it guarantees for the letters it draws')
    else
      for (const { fg, bg } of pairs) {
        const r = contrast(fg, bg)
        if (r < 3) problems.push(`the letters the effect draws (${fg}) read at ${r.toFixed(1)}:1 on ${bg}; large text needs 3:1`)
      }
  }
  if (typeMode === 'occlude' && !/\bctx\.front\b/.test(fx.source)) problems.push('effect.mjs says typeMode "occlude" but effect.js never draws on ctx.front')
  if (problems.length) return { problems, notes }

  const mute = readable(mix(theme.ink, plate, 0.24), [plate], 6)
  const weights = shellWeights(f.weight ?? 600)
  const fonts = {
    display: fontFor(f.display ?? 'Space Grotesk', notes, weights),
    body: fontFor(f.body ?? 'Inter', notes, weights),
    // the editorial and story compositions set their bar, index and call to action in a mono face
    ...(['editorial', 'story'].includes(comp) ? { mono: fontFor(f.mono ?? 'IBM Plex Mono', notes, [400, 500, 700]) } : {}),
  }
  return {
    problems,
    notes,
    doc: {
      composition: comp,
      typeMode,
      brand: { name: brand.name, href: brand.href ?? '/', logo },
      nav: doc.nav ?? [],
      action: doc.action === false ? null : (doc.action ?? null),
      hero,
      theme: {
        mode,
        background: theme.background.toLowerCase(),
        ink: theme.ink.toLowerCase(),
        accent: theme.accent.toLowerCase(),
        plate,
        rules: theme.rules ?? 'on',
        mute,
        lit,
        weight: f.weight ?? 600,
        fonts,
      },
      params,
      motion,
      meta: { lang: 'en', ...meta },
    },
  }
}

/* ---------------------------------------------------------------- page */

const SYSTEM = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const stack = (f) => (f.family ? `"${f.family}", ${SYSTEM}` : SYSTEM)

/**
 * The headline, one block per line, so the effect can read each line's box
 * (view.type) and set it in the scene: *emphasis* is the display face's
 * italic in the same colour, never a second colour.
 */
function title(t) {
  return t.split('\n').map((line) =>
    h(
      'span',
      { class: 'mh-line' },
      h('i', { class: 'mh-bl', 'aria-hidden': 'true' }),
      // one element per word, so the effect can set each word where the browser put it (lines may wrap on phones)
      line.split(/\*([^*]+)\*/g).flatMap((p, j) =>
        p
          .split(/(\s+)/)
          .filter(Boolean)
          .map((w) => (/^\s+$/.test(w) ? ' ' : j % 2 ? h('em', { class: 'mh-part' }, w) : h('span', { class: 'mh-part' }, w))),
      ),
    ),
  )
}

const ARROW = h(
  'svg',
  { class: 'mh-arrow', viewBox: '0 0 16 16', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'aria-hidden': 'true' },
  h('path', { d: 'M1 8h13M9 3l5 5-5 5' }),
)

// Raw HTML (an SVG) goes into the tree as a token that is swapped back in
// after the tree is printed, so markup.mjs can stay as it is.
function rawStore() {
  const list = []
  return {
    raw: (s) => `@@MHRAW${list.push(s) - 1}@@`,
    out: (htmlText) => htmlText.replace(/@@MHRAW(\d+)@@/g, (_, i) => list[Number(i)]),
  }
}

function logoMark(logo, raw) {
  if (!logo) return null
  if (logo.kind === 'text') return h('span', { class: 'mh-logo mh-logo-text', 'aria-hidden': 'true' }, logo.text)
  return h('span', { class: 'mh-logo mh-logo-svg', 'aria-hidden': 'true' }, raw(logo.svg))
}

/** The section's markup (shared by the page and the embed). */
function section(d, fx, id) {
  const { hero, composition: comp } = d
  const { raw, out } = rawStore()
  const still = fx.still(d.params, { ...d.theme, composition: comp })
  const half = Math.ceil(d.nav.length / 2)
  const navLinks = (list, off) => list.map((l, i) => h('a', { href: l.href }, h('span', { class: 'mh-n', 'aria-hidden': 'true' }, String(off + i + 1).padStart(2, '0')), l.label))
  const navA = d.nav.slice(0, half)
  const navB = d.nav.slice(half)
  const action = d.action ? h('a', { class: 'mh-action', href: d.action.href }, d.action.label) : null
  // the lockup centres the brand between two groups; the bar's link joins the right-hand one
  const actionInNav = comp === 'lockup' && action && d.nav.length
  return out(toHtml(h(
    'section',
    { class: 'mh', id, 'data-comp': comp, 'data-type': d.typeMode, 'data-mode': d.theme.mode, 'data-rules': d.theme.rules, 'aria-label': plain(d.brand.name) },
    h(
      'div',
      { class: 'mh-stage', 'aria-hidden': 'true', 'data-clip-ok': true },
      h('div', { class: 'mh-still' }, raw(still.backdrop)),
      still.object ? h('div', { class: 'mh-still-obj' }, raw(still.object)) : null,
      h('canvas', { class: 'mh-canvas' }),
    ),
    comp === 'editorial' ? h('div', { class: 'mh-rules', 'aria-hidden': 'true' }, Array.from({ length: 12 }, () => h('i'))) : null,
    h('div', { class: 'mh-field', 'aria-hidden': 'true' }),
    comp === 'split' ? h('div', { class: 'mh-panel mh-plate', 'aria-hidden': 'true' }) : null,
    h(
      'header',
      { class: 'mh-bar mh-plate' },
      h('a', { class: 'mh-brand', href: d.brand.href }, logoMark(d.brand.logo, raw), h('span', null, d.brand.name)),
      d.nav.length
        ? h('nav', { class: 'mh-nav', 'aria-label': 'Main' }, h('div', { class: 'mh-nav-a' }, navLinks(navA, 0)), navB.length || actionInNav ? h('div', { class: 'mh-nav-b' }, navLinks(navB, half), actionInNav ? action : null) : null)
        : null,
      actionInNav ? null : action,
    ),
    h('h1', { class: 'mh-title', 'data-mh-type': d.typeMode }, title(hero.title)),
    d.typeMode === 'occlude' ? h('canvas', { class: 'mh-front', 'aria-hidden': 'true' }) : null,
    h(
      'div',
      { class: 'mh-copy mh-plate' },
      hero.subtitle ? h('p', { class: 'mh-sub' }, inline(hero.subtitle)) : null,
      h('p', { class: 'mh-lede' }, inline(hero.lede)),
      h(
        'div',
        { class: 'mh-act' },
        h('a', { class: 'mh-cta', href: hero.cta.href }, h('span', null, hero.cta.label), ARROW),
        hero.link ? h('a', { class: 'mh-link', href: hero.link.href }, hero.link.label) : null,
      ),
    ),
    comp === 'story'
      ? h(
          'ol',
          { class: 'mh-steps mh-plate' },
          hero.steps.map((s, i) => h('li', { class: 'mh-step', 'data-step': String(i) }, h('span', { class: 'mh-step-n', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), h('strong', null, s.title), h('span', { class: 'mh-step-t' }, s.text))),
        )
      : null,
  )))
}

function css(d, fx, id) {
  const t = d.theme
  const base = readFileSync(join(KIT, 'shell.css'), 'utf8')
  const lit = t.lit ?? { base: t.ink, lit: t.ink }
  const vars = `#${id}{--mh-bg:${t.background};--mh-ink:${t.ink};--mh-mute:${t.mute};--mh-accent:${t.accent};--mh-plate:${t.plate};--mh-weight:${t.weight};--mh-display:${stack(t.fonts.display)};--mh-body:${stack(t.fonts.body)};--mh-mono:${t.fonts.mono ? stack(t.fonts.mono).replace(SYSTEM, MONO) : MONO};--mh-line:${mix(t.plate, t.ink, 0.42)};--mh-hair:${mix(t.plate, t.ink, 0.16)};--mh-on-ink:${t.plate};--mh-lit-base:${lit.base};--mh-lit:${lit.lit};--mh-clear:${BAR.clear}px}`
  return `${vars}\n${base.trim()}\n${(fx.css ?? '').trim()}`
}

function scripts(d, fx, id, assets) {
  const runtime = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const libs = Object.fromEntries((fx.libs ?? []).filter((l) => l.name).map((l) => [l.name, l.url]))
  const three = threeFor(fx)
  if (three && !libs.three) libs.three = THREE.module
  const story = storyFor(fx, d.params, d.theme)
  const config = {
    id,
    effect: fx.id,
    composition: d.composition,
    typeMode: d.typeMode,
    needs: fx.needs ?? 'none',
    libs,
    params: d.params,
    theme: { mode: d.theme.mode, background: d.theme.background, ink: d.theme.ink, accent: d.theme.accent, plate: d.theme.plate },
    motion: d.motion,
    stillTime: fx.stillTime ?? 3,
    posterTime: fx.posterTime ?? 3,
    stillScale: fx.stillScale ?? 0.8,
    assets,
  }
  if (three) config.three = { addons: three.addons }
  if (story) config.story = story
  if (d.composition === 'story') config.steps = d.hero.steps.length
  const body = fx.source.replace(/^export default\s+/m, 'return ')
  return [
    `<script type="application/json" id="${id}-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>`,
    libsMap(fx),
    `<script type="module">\n${runtime.trim()}\nMotionHeroRun((() => {\n${body.trim()}\n})(), ${JSON.stringify(id)})\n</script>`,
  ]
    .filter(Boolean)
    .join('\n')
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function page(d, fx, assets = {}) {
  const id = 'mh-' + fx.id
  const m = d.meta
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escAttr(m.title)}</title>`,
    `<meta name="description" content="${escAttr(m.description)}">`,
    `<meta name="theme-color" content="${d.theme.plate}">`,
    `<meta property="og:title" content="${escAttr(m.title)}">`,
    `<meta property="og:description" content="${escAttr(m.description)}">`,
    `<meta property="og:type" content="website">`,
    m.url ? `<meta property="og:url" content="${escAttr(m.url)}">\n<link rel="canonical" href="${escAttr(m.url)}">` : '',
    m.image ? `<meta property="og:image" content="${escAttr(m.image)}">\n<meta name="twitter:card" content="summary_large_image">` : '',
    d.brand.logo?.kind === 'svg' ? '<link rel="icon" href="assets/logo.svg" type="image/svg+xml">' : '',
    fontLinks(d),
  ].filter(Boolean)
  const markup = section(d, fx, id)
  const style = css(d, fx, id)
  const pageCss = `html{background:${d.theme.background};color-scheme:${d.theme.mode}}body{margin:0;background:${d.theme.background};color:${d.theme.ink}}`
  const index = `<!doctype html>
<html lang="${escAttr(m.lang)}">
<head>
${head.join('\n')}
<style>
${pageCss}
${style}
</style>
</head>
<body>
${markup}
${scripts(d, fx, id, assets)}
</body>
</html>
`
  const embed = `<!-- ${d.brand.name} motion hero (${fx.name}, ${d.composition} composition). Paste into your page where the hero goes.
     Fonts: move the <link> lines into your <head> if you prefer. The section is scoped under #${id}.${Object.keys(assets).length ? ' Copy the assets/ folder next to the page: the effect loads its files from there.' : ''}
     If your site already has an <script type="importmap">, merge the "integrity" entries into it.${threeFor(fx) ? ' Merge the "imports" too (three, three/addons/).' : ''} -->
${fontLinks(d)}
<style>
${style}
</style>
${markup}
${scripts(d, fx, id, assets)}
`
  return { index, embed }
}

/* ---------------------------------------------------------------- main */

export async function main() {
  const at = process.argv.indexOf('--three-addon')
  if (at > 0) return threeAddon(process.argv.slice(at + 1).filter((a) => !a.startsWith('--')))
  const [input, outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!input) {
    console.error('usage: node scripts/build.mjs hero.json [out]')
    process.exit(1)
  }
  const file = resolve(input)
  if (!existsSync(file)) {
    console.error(`build: ${input} not found`)
    process.exit(1)
  }
  let doc
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`build: ${input} isn't valid JSON: ${e.message}`)
    process.exit(1)
  }
  const fx = await loadEffect()
  const n = (fx.source.match(/^export default\s/gm) ?? []).length
  if (n !== 1 || /^\s*import\s/m.test(fx.source))
    throw new Error('scripts/effect/effect.js must have one `export default` and no static imports (load libraries with ctx.load)')
  const { problems, notes, doc: d } = resolveDoc(doc, fx, dirname(file))
  // the effect's CSS may not reach the kit's layout (checked on every build)
  problems.push(...lintEffectCss(fx.css, fx.cssPrefix))
  // files the effect ships (footage): they must exist
  const assets = {}
  for (const a of fx.assets ?? []) {
    const src = join(PACKAGE, a)
    if (!existsSync(src)) problems.push(`effect.mjs assets: ${a} is missing from the package`)
    else assets[basename(a)] = 'assets/' + basename(a)
  }
  if (d) await settleGoogleFonts(d.theme.fonts, problems, notes)
  if (problems.length) {
    console.error(`build: fix ${relative(process.cwd(), file) || file} first`)
    for (const p of problems) console.error(`  ✗ ${p}`)
    process.exit(1)
  }
  const out = resolve(outArg ?? join(dirname(file), 'out'))
  mkdirSync(join(out, 'assets'), { recursive: true })
  const { index, embed } = page(d, fx, assets)
  writeFileSync(join(out, 'index.html'), index)
  writeFileSync(join(out, 'embed.html'), embed)
  if (d.brand.logo?.kind === 'svg') writeFileSync(join(out, 'assets', 'logo.svg'), d.brand.logo.svg + '\n')
  for (const a of fx.assets ?? []) copyFileSync(join(PACKAGE, a), join(out, 'assets', basename(a)))
  const shown = (p) => {
    const r = relative(process.cwd(), p)
    return r.startsWith('..') ? p : r
  }
  const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`
  console.log(`built ${shown(join(out, 'index.html'))} (${kb(index)}) and embed.html (${kb(embed)})`)
  console.log(`  ${fx.name}, ${d.composition} composition, headline ${d.typeMode}`)
  console.log(`  settings: ${Object.entries(d.params).map(([k, v]) => `${k} ${Array.isArray(v) ? v.length : v}`).join(', ')}`)
  for (const note of new Set([...notes, ...(fx.notes?.(d.params, d.theme) ?? [])])) console.log(`  · ${note}`)
}

function libsMap(fx) {
  const libs = fx.libs ?? []
  const three = threeFor(fx)
  if (!libs.length && !three) return ''
  const integrity = Object.fromEntries(libs.filter((l) => l.integrity).map((l) => [l.url, l.integrity]))
  const imports = {}
  if (three) {
    // bare "three" is the same URL as ctx.load('three'), so add-ons share one copy
    imports.three = THREE.module
    imports['three/addons/'] = THREE.addons
    for (const [url, hash] of Object.entries(three.integrity)) {
      if (integrity[url] && integrity[url] !== hash) throw new Error(`effect.mjs libs: ${url} has a different integrity from scripts/kit/three.json`)
      integrity[url] = hash
    }
  }
  return `<script type="importmap">${JSON.stringify({ imports, integrity })}</script>`
}

function fontLinks(d) {
  const seen = new Set()
  return Object.values(d.theme.fonts)
    .flatMap((f) => f.links)
    .filter((l) => l && !seen.has(l.href) && seen.add(l.href))
    .map((l) =>
      l.integrity
        ? `<link rel="stylesheet" href="${l.href}" integrity="${l.integrity}" crossorigin="anonymous">`
        : `<link rel="stylesheet" href="${l.href}">`,
    )
    .join('\n')
}




/** node scripts/build.mjs --three-addon loaders/FBXLoader.js: prints libs entries for an add-on the catalogue lacks. */
async function threeAddon(names) {
  if (!names.length) {
    console.error('usage: node scripts/build.mjs --three-addon <path under three/examples/jsm> [...]')
    process.exit(1)
  }
  const { files, unmapped } = await crawlThree(names.map((n) => THREE_JSON.addons + n.replace(/^three\/addons\//, '')))
  // every file the add-ons pull in (the build itself is always pinned), so
  // the hashes reach the page even where the catalogue doesn't know the importer
  const list = Object.entries(files).filter(([p]) => !p.startsWith('build/'))
  const fresh = list.filter(([p]) => !THREE_JSON.files[p])
  if (!fresh.length) console.log('// nothing to add: scripts/kit/three.json pins all of it; just list the add-ons in addons')
  else {
    console.log(`// three.js ${THREE.version}: add these to the effect's libs, and the add-on names to addons`)
    for (const [p, f] of list) console.log(`{ url: '${THREE.base + p}', integrity: '${f.integrity}' },`)
  }
  for (const u of unmapped) console.log(`// not mapped by the kit's import map, so it won't load: ${u}`)
}
