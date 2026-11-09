// Phone Screen Showcase: reads page.json, lists every problem at once, and
// writes a self-contained page (out/index.html), a paste-in section
// (out/embed.html) and the screenshots it uses (out/assets/).
//
//   node scripts/build.mjs page.json out
//
// Written for Lookbk. No dependencies: Node 18 or newer.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS, icon } from './icons.mjs'

const KIT = dirname(fileURLToPath(import.meta.url))
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i
const VIA = ['push', 'sheet', 'tab', 'fade']
const BLOCKS = ['nav', 'title', 'head', 'chips', 'rows', 'tiles', 'chart', 'note', 'toggles', 'calendar', 'seats', 'cards', 'ticket', 'text', 'button']
const FINISH = {
  titanium: ['linear-gradient(98deg,#f3efe8 0%,#bdb7ad 4%,#e6e1d8 9%,#9e988e 40%,#cdc7bd 78%,#8d877e 95%,#b9b3a9 100%)', '#a29c92', 'rgba(255,255,255,.7)'],
  graphite: ['linear-gradient(98deg,#3a3a40 0%,#8c8a90 3%,#2b2b30 8%,#1b1b1f 45%,#4a4a50 80%,#1a1a1e 96%,#55555b 100%)', '#232328', 'rgba(255,255,255,.22)'],
  silver: ['linear-gradient(98deg,#ffffff 0%,#c9ccd1 4%,#f1f2f4 9%,#a9adb3 40%,#dcdee1 78%,#9da1a7 95%,#c4c7cb 100%)', '#a6aab0', 'rgba(255,255,255,.85)'],
  sand: ['linear-gradient(98deg,#f6ead6 0%,#c9b18f 4%,#efe2cb 9%,#a58d6b 40%,#dcc8a6 78%,#97805f 95%,#c4ad8b 100%)', '#9f8867', 'rgba(255,255,255,.6)'],
}

/** Every problem in the config, all at once. */
export function validate(c, base) {
  const p = []
  const str = (v, path, max, { req = true, min = 1 } = {}) => {
    if (v === undefined || v === null || v === '') return req && p.push(`${path} is missing`)
    if (typeof v !== 'string') return p.push(`${path} must be text`)
    const plain = v.replace(/[_*]/g, '')
    if (plain.length < min) p.push(`${path} is too short`)
    if (plain.length > max) p.push(`${path} is ${plain.length} characters; keep it to ${max} (shorten the words rather than the type)`)
  }
  const num = (v, path, lo, hi, req = false) => {
    if (v === undefined) return req && p.push(`${path} is missing`)
    if (typeof v !== 'number' || Number.isNaN(v) || v < lo || v > hi) p.push(`${path} must be a number from ${lo} to ${hi}`)
  }
  const hex = (v, path, req = true) => {
    if (v === undefined) return req && p.push(`${path} is missing`)
    if (!HEX.test(v)) p.push(`${path} must be a colour like #1d221b (got ${JSON.stringify(v)})`)
  }
  const ic = (v, path) => v !== undefined && !ICONS[v] && p.push(`${path}: unknown icon "${v}" (known: ${Object.keys(ICONS).join(', ')})`)
  const img = (v, path) => {
    if (v === undefined) return
    if (typeof v !== 'string') return p.push(`${path} must be a file path`)
    const f = resolve(base, v)
    if (!existsSync(f)) p.push(`${path}: ${v} not found next to page.json`)
    else if (!/\.(png|jpe?g|webp)$/i.test(f)) p.push(`${path}: use a .png, .jpg or .webp`)
    else if (statSync(f).size > 600_000) p.push(`${path}: ${v} is ${Math.round(statSync(f).size / 1000)} KB; keep pictures under 600 KB (780 px wide is plenty inside a phone)`)
  }
  str(c.title, 'title', 70)
  str(c.description, 'description', 170)
  if (!c.fonts?.href || !/^https:\/\/fonts\.googleapis\.com\/css2\?/.test(c.fonts.href)) p.push('fonts.href must be a Google Fonts css2 link (https://fonts.googleapis.com/css2?family=...)')
  for (const k of ['display', 'body', 'mono']) str(c.fonts?.[k], `fonts.${k}`, 120)
  const t = c.type ?? {}
  num(t.h1Size, 'type.h1Size', 40, 120)
  num(t.h1Phone, 'type.h1Phone', 32, 64)
  num(t.h1Weight, 'type.h1Weight', 100, 900)
  num(t.h1Line, 'type.h1Line', 0.8, 1.3)
  num(t.h1Tracking, 'type.h1Tracking', -0.05, 0.05)
  num(t.chapterSize, 'type.chapterSize', 22, 44)
  num(t.chapterWeight, 'type.chapterWeight', 100, 900)
  if (t.case !== undefined && !['none', 'uppercase'].includes(t.case)) p.push('type.case must be "none" or "uppercase"')
  const col = c.colors ?? {}
  for (const k of ['bg', 'ink', 'ink2', 'muted', 'line', 'accent', 'accentInk', 'onAccent', 'shadow']) hex(col[k], `colors.${k}`)
  const L = c.light ?? {}
  if (!['window', 'beam', 'none'].includes(L.kind)) p.push('light.kind must be "window", "beam" or "none"')
  hex(L.color, 'light.color', L.kind !== 'none')
  num(L.strength, 'light.strength', 0, 1)
  num(L.grain, 'light.grain', 0, 0.15)
  if (c.phone?.finish !== undefined && !FINISH[c.phone.finish]) p.push(`phone.finish must be one of ${Object.keys(FINISH).join(', ')}`)
  str(c.brand?.name, 'brand.name', 20)
  ic(c.brand?.icon, 'brand.icon')
  if (c.nav !== undefined && (!Array.isArray(c.nav) || c.nav.length > 3)) p.push('nav: up to 3 links')
  for (const [i, n] of (c.nav ?? []).entries()) {
    str(n.label, `nav[${i}].label`, 16)
    str(n.href, `nav[${i}].href`, 300)
  }
  str(c.cta?.label, 'cta.label', 18)
  str(c.cta?.href, 'cta.href', 300)
  str(c.eyebrow, 'eyebrow', 44)
  str(c.headline, 'headline', 48)
  if (c.headline && !/_[^_]+_/.test(c.headline)) p.push('headline: mark the words to set in the accent with _underscores_')
  str(c.lede, 'lede', 180)
  if (!Array.isArray(c.buttons) || c.buttons.length < 1 || c.buttons.length > 2) p.push('buttons: one or two')
  for (const [i, b] of (c.buttons ?? []).entries()) {
    str(b.label, `buttons[${i}].label`, 28)
    str(b.href, `buttons[${i}].href`, 300)
  }
  if (c.play !== undefined && !['scroll', 'timed'].includes(c.play)) p.push('play must be "scroll" or "timed"')
  num(c.stepSeconds, 'stepSeconds', 3, 8)
  const a = c.app ?? {}
  const ac = a.colors ?? {}
  for (const k of ['bg', 'surface', 'sheet', 'ink', 'muted', 'line', 'tint', 'accent', 'onAccent', 'accent2', 'onAccent2']) hex(ac[k], `app.colors.${k}`)
  hex(ac.paper, 'app.colors.paper', false)
  if (!['dark', 'light'].includes(a.statusBar)) p.push('app.statusBar must be "dark" (dark text, for light apps) or "light"')
  if (a.titleCase !== undefined && !['none', 'uppercase'].includes(a.titleCase)) p.push('app.titleCase must be "none" or "uppercase"')
  num(a.titleWeight, 'app.titleWeight', 100, 900)
  if (a.tabs !== undefined && (!Array.isArray(a.tabs) || a.tabs.length < 2 || a.tabs.length > 5)) p.push('app.tabs: 2 to 5 tabs, or leave it out')
  for (const [i, tb] of (a.tabs ?? []).entries()) {
    str(tb.label, `app.tabs[${i}].label`, 10)
    ic(tb.icon, `app.tabs[${i}].icon`)
    if (!tb.icon) p.push(`app.tabs[${i}].icon is missing`)
  }
  const steps = c.steps
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 5) {
    p.push('steps: 3 to 5 steps (one screen each)')
    return p
  }
  steps.forEach((s, i) => {
    const at = `steps[${i}]`
    str(s.title, `${at}.title`, 30)
    str(s.body, `${at}.body`, 150, { min: 20 })
    if (i > 0 && !VIA.includes(s.via)) p.push(`${at}.via must be one of ${VIA.join(', ')} (how this screen arrives)`)
    if (s.via === 'sheet' && steps[i - 1]?.via === 'sheet') p.push(`${at}: a sheet cannot open on top of another sheet; make one of them a push`)
    const sc = s.screen
    if (!sc || typeof sc !== 'object') return p.push(`${at}.screen is missing`)
    if (sc.tab !== undefined && sc.tab !== null && (!Number.isInteger(sc.tab) || sc.tab < 0 || sc.tab >= (a.tabs?.length ?? 0))) p.push(`${at}.screen.tab must be the index of one of app.tabs, or null`)
    const last = i === steps.length - 1
    if (sc.image !== undefined) {
      img(sc.image, `${at}.screen.image`)
      if (!last) {
        if (!Array.isArray(s.tapAt) || s.tapAt.length !== 2 || s.tapAt.some((v) => typeof v !== 'number' || v < 0 || v > 100)) p.push(`${at}.tapAt: [x, y] in percent of the screenshot, where the tap lands`)
        str(s.tapLabel, `${at}.tapLabel`, 24)
      }
    } else {
      if (!Array.isArray(sc.blocks) || !sc.blocks.length) p.push(`${at}.screen: give blocks or an image`)
      const ids = new Set()
      for (const [j, b] of (sc.blocks ?? []).entries()) blockProblems(b, `${at}.screen.blocks[${j}]`, { str, num, hex, ic, img, p, ids })
      if (!last) {
        if (!s.tap) p.push(`${at}.tap: name the id of the block (or row, chip or button) the visitor taps to reach the next screen`)
        else if (!ids.has(s.tap)) p.push(`${at}.tap: no block, row, chip or button with id "${s.tap}" on this screen (ids here: ${[...ids].join(', ') || 'none'})`)
      }
      str(s.tapLabel, `${at}.tapLabel`, 24, { req: false })
    }
    if (last && s.note !== undefined) {
      str(s.note.label, `${at}.note.label`, 14)
      str(s.note.value, `${at}.note.value`, 22)
    }
    str(s.alt, `${at}.alt`, 140, { req: false })
  })
  return p
}

function blockProblems(b, at, { str, num, hex, ic, img, p, ids }) {
  if (!b || !BLOCKS.includes(b.type)) return p.push(`${at}.type must be one of ${BLOCKS.join(', ')}`)
  if (b.id) ids.add(b.id)
  const items = (min, max) => {
    if (!Array.isArray(b.items) || b.items.length < min || b.items.length > max) {
      p.push(`${at}.items: ${min} to ${max}`)
      return []
    }
    return b.items
  }
  switch (b.type) {
    case 'nav':
      str(b.back, `${at}.back`, 14, { req: false })
      str(b.location, `${at}.location`, 26, { req: false })
      str(b.title, `${at}.title`, 20, { req: false })
      str(b.left, `${at}.left`, 18, { req: false })
      for (const [k, n] of (b.icons ?? []).entries()) ic(n, `${at}.icons[${k}]`)
      break
    case 'title':
      str(b.over, `${at}.over`, 32, { req: false })
      str(b.text, `${at}.text`, b.size === 'xl' ? 16 : 22)
      break
    case 'head':
      str(b.text, `${at}.text`, 22)
      str(b.meta, `${at}.meta`, 22, { req: false })
      break
    case 'chips':
      for (const [k, it] of items(2, 5).entries()) {
        const o = typeof it === 'string' ? { label: it } : it
        str(o.label, `${at}.items[${k}].label`, 12)
        if (o.id) ids.add(o.id)
      }
      if (b.style !== undefined && !['pill', 'small', 'mono'].includes(b.style)) p.push(`${at}.style must be pill, small or mono`)
      break
    case 'rows':
      for (const [k, it] of items(1, 5).entries()) {
        str(it.title, `${at}.items[${k}].title`, 26)
        str(it.line, `${at}.items[${k}].line`, 32, { req: false })
        str(it.value, `${at}.items[${k}].value`, 10, { req: false })
        str(it.pill, `${at}.items[${k}].pill`, 8, { req: false })
        str(it.initials, `${at}.items[${k}].initials`, 2, { req: false })
        ic(it.icon, `${at}.items[${k}].icon`)
        if (it.tone !== undefined && !['hot', 'soft'].includes(it.tone)) p.push(`${at}.items[${k}].tone must be hot or soft`)
        if (it.id) ids.add(it.id)
      }
      break
    case 'tiles':
      for (const [k, it] of items(2, 3).entries()) {
        str(it.label, `${at}.items[${k}].label`, 10)
        str(it.value, `${at}.items[${k}].value`, 7)
      }
      str(b.title, `${at}.title`, 22, { req: false })
      str(b.meta, `${at}.meta`, 18, { req: false })
      break
    case 'chart':
      str(b.title, `${at}.title`, 22)
      str(b.meta, `${at}.meta`, 18, { req: false })
      if (!['line', 'bars'].includes(b.kind)) p.push(`${at}.kind must be line or bars`)
      if (!Array.isArray(b.values) || b.values.length < 4 || b.values.length > 30 || b.values.some((v) => typeof v !== 'number')) p.push(`${at}.values: 4 to 30 numbers`)
      if (b.threshold) {
        num(b.threshold.value, `${at}.threshold.value`, -1e9, 1e9, true)
        str(b.threshold.label, `${at}.threshold.label`, 22)
      }
      break
    case 'note':
      str(b.title, `${at}.title`, 20)
      str(b.meta, `${at}.meta`, 14, { req: false })
      str(b.text, `${at}.text`, 24)
      break
    case 'toggles':
      for (const [k, it] of items(1, 4).entries()) {
        str(it.label, `${at}.items[${k}].label`, 24)
        if (typeof it.on !== 'boolean') str(it.on, `${at}.items[${k}].on`, 10)
      }
      break
    case 'calendar':
      num(b.start, `${at}.start`, 0, 6, true)
      num(b.days, `${at}.days`, 28, 31, true)
      num(b.today, `${at}.today`, 1, 31)
      if (!Array.isArray(b.filled)) p.push(`${at}.filled: a list of days or [from, to] ranges`)
      str(b.title, `${at}.title`, 22, { req: false })
      str(b.meta, `${at}.meta`, 18, { req: false })
      break
    case 'seats': {
      num(b.rows, `${at}.rows`, 4, 12, true)
      num(b.cols, `${at}.cols`, 6, 14, true)
      const ok = (s) => typeof s === 'string' && /^[A-L]\d{1,2}$/.test(s)
      for (const k of ['taken', 'mine']) if (!Array.isArray(b[k]) || !b[k].every(ok)) p.push(`${at}.${k}: seats like "F7" (row letter A to L, seat number)`)
      str(b.label, `${at}.label`, 12, { req: false })
      break
    }
    case 'cards':
      for (const [k, it] of items(2, 5).entries()) {
        str(it.title, `${at}.items[${k}].title`, 18)
        str(it.line, `${at}.items[${k}].line`, 30, { req: false })
        img(it.image, `${at}.items[${k}].image`)
        for (const [m, cc] of (it.colors ?? []).entries()) hex(cc, `${at}.items[${k}].colors[${m}]`)
        if (it.pattern !== undefined && !['glow', 'stripes', 'fade'].includes(it.pattern)) p.push(`${at}.items[${k}].pattern must be glow, stripes or fade`)
        if (it.id) ids.add(it.id)
      }
      break
    case 'ticket':
      str(b.over, `${at}.over`, 40, { req: false })
      str(b.title, `${at}.title`, 18)
      str(b.code, `${at}.code`, 24)
      img(b.image, `${at}.image`)
      for (const [m, cc] of (b.colors ?? []).entries()) hex(cc, `${at}.colors[${m}]`)
      if (!Array.isArray(b.fields) || b.fields.length < 3 || b.fields.length > 6) p.push(`${at}.fields: 3 to 6 [label, value] pairs`)
      for (const [k, f] of (b.fields ?? []).entries()) {
        str(f?.[0], `${at}.fields[${k}][0]`, 8)
        str(f?.[1], `${at}.fields[${k}][1]`, 8)
      }
      break
    case 'text':
      str(b.text, `${at}.text`, 60)
      break
    case 'button':
      str(b.label, `${at}.label`, 22)
      str(b.right, `${at}.right`, 14, { req: false })
      break
  }
}

/* ----------------------------------------------------------------- render */
const inline = (s) => esc(s).replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
const plain = (s) => String(s ?? '').replace(/[_*]/g, '')
const STATUS = (time) =>
  `<div class="pss-sb"><b>${esc(time)}</b><span><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 8.9a3.4 3.4 0 0 1 4.8 0zM3.4 6.7a6.5 6.5 0 0 1 9.2 0l-1.3 1.4a4.6 4.6 0 0 0-6.6 0zM1.2 4.5a9.6 9.6 0 0 1 13.6 0l-1.3 1.3a7.8 7.8 0 0 0-11 0z"/></svg><svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.2" y="2.2" width="15.6" height="7.6" rx="1.8"/></svg></span></div>`
const idAttr = (o) => (o?.id ? ` data-id="${esc(o.id)}"` : '')

function chartSVG(b) {
  const W = 310
  const H = 140
  const v = b.values
  const max = Math.max(...v, b.threshold?.value ?? -Infinity)
  const min = Math.min(0, ...v)
  const y = (n) => H - ((n - min) / (max - min || 1)) * (H - 10)
  const th = b.threshold
    ? `<line x1="0" x2="${W}" y1="${y(b.threshold.value).toFixed(1)}" y2="${y(b.threshold.value).toFixed(1)}" stroke="var(--a-accent2)" stroke-width="1.5" stroke-dasharray="4 5"/><text x="0" y="${(y(b.threshold.value) + 16).toFixed(1)}" font-family="var(--a-mono)" font-size="11" letter-spacing=".06em" fill="var(--a-accent2)">${esc(b.threshold.label.toUpperCase())}</text>`
    : ''
  if (b.kind === 'bars') {
    const bw = W / v.length
    const hi = b.highlight ?? v.length - 1
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${v
      .map((n, i) => `<rect x="${(i * bw + bw * 0.18).toFixed(1)}" y="${y(n).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - y(n)).toFixed(1)}" rx="3" fill="${i === hi ? 'var(--a-accent)' : 'var(--a-line)'}"/>`)
      .join('')}${th}</svg>`
  }
  const pts = v.map((n, i) => [(i * W) / (v.length - 1), y(n)])
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ')
  const end = pts.at(-1)
  const gid = `g${Math.abs(hash(d)) % 1e6}`
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--a-accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--a-accent)" stop-opacity="0"/></linearGradient></defs>${th}<path d="${d} L${W} ${H} L0 ${H}z" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="var(--a-accent)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="6" fill="var(--a-accent2)" stroke="var(--a-surface)" stroke-width="3"/></svg>`
}
function hash(s) {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}
function barcode(code) {
  let x = 0
  let s = ''
  let seed = hash(code)
  for (let i = 0; i < 54; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const w = 1 + (seed % 3)
    if (i % 2 === 0) s += `<rect x="${x}" y="0" width="${w * 2}" height="64" fill="#141210"/>`
    x += w * 2
  }
  return `<svg viewBox="0 0 ${x} 64" width="100%" height="64" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`
}
function art(it, asset) {
  if (it.image) return `background-image:url('${asset(it.image)}')`
  const [c1 = '#444444', c2 = '#111111'] = it.colors ?? []
  if (it.pattern === 'stripes') return `background:repeating-linear-gradient(0deg,${c1} 0 14px,${c2} 14px 28px)`
  if (it.pattern === 'fade') return `background:linear-gradient(180deg,${c1},${c2} 70%)`
  return `background:radial-gradient(90% 60% at 70% 20%,${c1},transparent 70%),linear-gradient(160deg,${c2},#0b0a0a)`
}

function block(b, ctx) {
  const id = idAttr(b)
  switch (b.type) {
    case 'nav': {
      const left = b.back
        ? `<span class="l">${icon('back', 22, 2.2)}${esc(b.back)}</span>`
        : b.location
          ? `<span class="l loc">${icon('pin', 16)}${esc(b.location)}</span>`
          : b.left
            ? `<span class="l">${esc(b.left)}</span>`
            : '<span class="l"></span>'
      const right = (b.icons ?? []).map((n) => `<span class="ib">${icon(n, 20)}</span>`).join('')
      return `<div class="b-nav"${id}>${left}${b.title ? `<span class="c">${esc(b.title)}</span>` : ''}<span class="r">${right || (b.title ? '<span class="ib" style="visibility:hidden"></span>' : '')}</span></div>`
    }
    case 'title':
      return `<div class="b-title${b.size === 'xl' ? ' xl' : ''}"${id}>${b.over ? `<div class="s">${esc(b.over)}</div>` : ''}<h3>${esc(b.text)}</h3></div>`
    case 'head':
      return `<div class="b-head"${id}><b>${esc(b.text)}</b>${b.meta ? `<small>${esc(b.meta)}</small>` : ''}</div>`
    case 'chips':
      return `<div class="b-chips ${b.style ?? ''}"${id}>${b.items
        .map((it, k) => {
          const o = typeof it === 'string' ? { label: it } : it
          return `<span class="b-chip${k === (b.on ?? 0) ? ' on' : ''}"${idAttr(o)}>${esc(o.label)}</span>`
        })
        .join('')}</div>`
    case 'rows':
      return `<div class="b-rows"${id}>${b.items
        .map((it) => {
          const th = it.icon ? `<span class="th">${icon(it.icon, 22)}</span>` : it.initials ? `<span class="th">${esc(it.initials)}</span>` : ''
          const end = it.pill ? `<span class="pill${it.tone === 'hot' ? ' hot' : ''}">${esc(it.pill)}</span>` : it.value ? `<span class="v${it.tone === 'soft' ? ' muted' : ''}">${esc(it.value)}</span>` : '<span></span>'
          return `<div class="b-row${th ? '' : ' noicon'}"${idAttr(it)}>${th}<span style="min-width:0"><b>${esc(it.title)}</b>${it.line ? `<small>${esc(it.line)}</small>` : ''}</span>${end}</div>`
        })
        .join('')}</div>`
    case 'tiles': {
      const tiles = `<div class="b-tiles" style="--c:${b.items.length}">${b.items.map((it) => `<div class="b-tile"><small>${esc(it.label)}</small><b>${esc(it.value)}</b></div>`).join('')}</div>`
      return b.title ? `<div class="b-card"${id}><div class="hd"><b>${esc(b.title)}</b>${b.meta ? `<small>${esc(b.meta)}</small>` : ''}</div>${tiles}</div>` : tiles.replace('class="b-tiles"', `class="b-tiles"${id}`)
    }
    case 'chart':
      return `<div class="b-card"${id}><div class="hd"><b>${esc(b.title)}</b>${b.meta ? `<small>${esc(b.meta)}</small>` : ''}</div><div class="b-chart">${chartSVG(b)}</div></div>`
    case 'note':
      return `<div class="b-card tint"${id}><div class="hd"><b>${esc(b.title)}</b>${b.meta ? `<small>${esc(b.meta)}</small>` : ''}</div><div class="big">${esc(b.text)}</div></div>`
    case 'toggles':
      return `<div class="b-toggles"${id}>${b.items
        .map((it) => `<div class="tg"><span>${esc(it.label)}</span>${typeof it.on === 'boolean' ? `<span class="sw${it.on ? '' : ' off'}"></span>` : `<span>${esc(it.on)}</span>`}</div>`)
        .join('')}</div>`
    case 'calendar': {
      const filled = new Set()
      for (const f of b.filled) if (Array.isArray(f)) for (let d = f[0]; d <= f[1]; d++) filled.add(d)
      else filled.add(f)
      let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i class="dow">${d}</i>`).join('')
      for (let k = 0; k < b.start; k++) cells += '<i class="x"></i>'
      for (let d = 1; d <= b.days; d++) cells += `<i class="${filled.has(d) ? 'f' : ''}${d === b.today ? ' t' : ''}">${d}</i>`
      const grid = `<div class="b-cal">${cells}</div>`
      return `<div class="b-card"${id}>${b.title ? `<div class="hd" style="margin-bottom:12px"><b>${esc(b.title)}</b>${b.meta ? `<small>${esc(b.meta)}</small>` : ''}</div>` : ''}${grid}</div>`
    }
    case 'seats': {
      const taken = new Set(b.taken)
      const mine = new Set(b.mine)
      const aisles = new Set(b.aisles ?? [])
      const cols = b.cols + aisles.size
      let cells = ''
      for (let r = 0; r < b.rows; r++) {
        let seat = 0
        for (let c = 0; c < cols; c++) {
          if (aisles.has(c)) {
            cells += '<i class="x"></i>'
            continue
          }
          seat++
          const name = `${String.fromCharCode(65 + r)}${seat}`
          cells += `<i class="${mine.has(name) ? 'me' : taken.has(name) ? 'tk' : ''}"></i>`
        }
      }
      const lg = b.legend !== false ? `<div class="lg"><span><i style="background:var(--a-line)"></i>Free</span><span><i style="outline:1px dashed var(--a-muted);outline-offset:-1px"></i>Taken</span><span><i style="background:var(--a-accent)"></i>${esc(b.mine.join(', '))}</span></div>` : ''
      return `<div class="b-seats"${id}><div class="arc">${esc((b.label ?? 'Screen').toUpperCase())}</div><div class="g" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>${lg}</div>`
    }
    case 'cards':
      return `<div class="b-cards"${id}>${b.items
        .map((it) => `<div class="b-poster${it.image ? ' ph' : ''}" style="${art(it, ctx.asset)}"${idAttr(it)}><b>${esc(it.title).replace(/ /, '<br>')}</b>${it.line ? `<small>${esc(it.line)}</small>` : ''}</div>`)
        .join('')}</div>`
    case 'ticket': {
      const fields = b.fields.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')
      return `<div class="b-ticket"${id}><div class="top" style="--tk:${art(b, ctx.asset).replace(/^background(-image)?:/, '')}">${b.over ? `<small>${esc(b.over)}</small>` : ''}<b>${esc(b.title).replace(/ /, '<br>')}</b></div><div class="kv">${fields}</div><div class="perf"></div><div class="bc">${barcode(b.code)}<span>${esc(b.code)}</span></div></div>`
    }
    case 'text':
      return `<p class="b-text"${id}>${esc(b.text)}</p>`
    case 'button':
      return `<div class="b-button${b.right ? ' split' : ''}${b.dock ? ' dock' : ''}"${id}${b.dock ? ` style="--dock:${ctx.tabs ? 102 : 40}px"` : ''}><span>${esc(b.label)}</span>${b.right ? `<span>${esc(b.right)}</span>` : ''}</div>`
  }
  return ''
}

function screenHTML(s, i, c, asset) {
  const sc = s.screen
  const tabsOn = sc.tab !== undefined && sc.tab !== null && c.app.tabs?.length && s.via !== 'sheet'
  const ctx = { asset, tabs: !!tabsOn }
  const time = c.app.time ?? '9:41'
  if (sc.image) return `<div class="pss-scr shot" data-i="${i}"><img src="${esc(asset(sc.image))}" alt="" decoding="async"><i class="pss-dim"></i></div>`
  const body = sc.blocks.map((b) => block(b, ctx)).join('')
  const tabs = tabsOn ? `<nav class="pss-tabs" style="--tn:${c.app.tabs.length}">${c.app.tabs.map((t, k) => `<i class="${k === sc.tab ? 'on' : ''}">${icon(t.icon, 24)}${esc(t.label)}</i>`).join('')}</nav>` : ''
  if (s.via === 'sheet') return `<div class="pss-scr sheet" data-i="${i}"><div class="pss-sheetp"><div class="pss-body"><span class="pss-grab"></span>${body}</div></div><i class="pss-home"></i></div>`
  return `<div class="pss-scr" data-i="${i}">${STATUS(time)}<div class="pss-body">${body}</div>${tabs}<i class="pss-home"></i><i class="pss-dim"></i></div>`
}

export function render(c, base) {
  const assets = new Map()
  const asset = (p) => {
    if (!assets.has(p)) assets.set(p, `assets/${String(assets.size + 1).padStart(2, '0')}-${basename(p).replace(/[^\w.-]/g, '_')}`)
    return assets.get(p)
  }
  const n = c.steps.length
  const t = c.type
  const col = c.colors
  const ac = c.app.colors
  const fin = FINISH[c.phone?.finish ?? 'titanium']
  const L = c.light
  const strength = L.strength ?? 0.9
  const dark = isDark(col.bg)
  const vars = {
    '--n': n,
    '--step-vh': 70,
    '--bg': col.bg, '--ink': col.ink, '--ink-2': col.ink2, '--muted': col.muted, '--line': col.line,
    '--accent': col.accent, '--accent-ink': col.accentInk, '--on-accent': col.onAccent, '--shadow': col.shadow,
    '--display': c.fonts.display, '--body': c.fonts.body, '--mono': c.fonts.mono,
    '--h1-w': t.h1Weight ?? 400, '--h1-s': `${t.h1Size ?? 66}px`, '--h1-vw': `${(((t.h1Size ?? 66) / 1440) * 100).toFixed(3)}vw`, '--h1-vh': `${(((t.h1Size ?? 66) / 900) * 100).toFixed(3)}vh`, '--h1-m': `${t.h1Phone ?? 40}px`, '--h1-lh': t.h1Line ?? 1.02, '--h1-t': `${t.h1Tracking ?? 0}em`, '--h1-case': t.case ?? 'none',
    '--ch-w': t.chapterWeight ?? t.h1Weight ?? 400, '--ch-s': `${t.chapterSize ?? 30}px`, '--ch-vw': `${(((t.chapterSize ?? 30) / 1440) * 100).toFixed(3)}vw`, '--em-style': t.em ?? 'normal',
    '--brand-w': t.brandWeight ?? 600, '--brand-case': t.brandCase ?? 'none', '--brand-t': `${t.brandTracking ?? 0}em`, '--btn-r': `${t.buttonRadius ?? 99}px`,
    '--metal': fin[0], '--metal-side': fin[1], '--metal-hi': fin[2],
    '--lite': rgba(L.color ?? '#ffffff', 0.95 * strength), '--lite-2': rgba(L.color ?? '#ffffff', 0.5 * strength),
    '--beam': rgba(L.color ?? '#ffffff', 0.62 * strength), '--beam-2': rgba(L.color ?? '#ffffff', 0.2 * strength),
    '--grain': L.grain ?? 0.07, '--gl': dark ? 0.1 : 0.16, '--refl-o': L.kind === 'window' ? 0.12 * strength : 0, '--refl-on': L.kind === 'window' ? 1 : 0, '--shade': L.kind === 'window' ? rgba(col.shadow, dark ? 0.3 : 0.24) : 'transparent', '--streak-o': L.kind === 'beam' ? 0.16 * strength : 0,
    '--cast-o': dark ? 0.75 : 0.42,
    '--a-bg': ac.bg, '--a-surface': ac.surface, '--a-sheet': ac.sheet, '--a-ink': ac.ink, '--a-muted': ac.muted, '--a-line': ac.line, '--a-tint': ac.tint,
    '--a-accent': ac.accent, '--a-on': ac.onAccent, '--a-accent2': ac.accent2, '--a-on2': ac.onAccent2, '--a-paper': ac.paper ?? '#f1ebdf',
    '--a-status': c.app.statusBar === 'light' ? '#ffffff' : '#111111',
    '--a-display': c.app.fonts?.display ?? c.fonts.display, '--a-body': c.app.fonts?.body ?? c.fonts.body, '--a-mono': c.app.fonts?.mono ?? c.fonts.mono,
    '--a-title-w': c.app.titleWeight ?? 400, '--a-title-t': `${c.app.titleTracking ?? 0}em`, '--a-title-case': c.app.titleCase ?? 'none',
  }
  const style = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')
  const num = (i) => String(i + 1).padStart(2, '0')
  const tapLabel = (s) => s.tapLabel ?? labelOf(s)
  const notes = c.steps.map((s, i) => (i === n - 1 ? s.note ?? { label: 'Done', value: s.title } : { label: 'Tap', value: tapLabel(s) }))
  const data = {
    n,
    play: c.play ?? 'scroll',
    hold: c.stepSeconds ?? 4,
    light: L.kind,
    via: c.steps.map((s, i) => (i === 0 ? null : s.via)),
    tap: c.steps.map((s, i) => (i === n - 1 ? null : s.screen.image ? { at: s.tapAt } : { id: s.tap })),
    notes: notes.map((x, i) => [`${num(i)} / ${num(n - 1)} · ${x.label}`, x.value]),
  }
  const alt = `${c.brand.name} app, ${n} screens: ` + c.steps.map((s, i) => `${i + 1}. ${s.alt ?? s.title}`).join('; ')
  const bodies = c.steps.map((s) => s.body)
  const chapters = c.steps
    .map(
      (s, i) =>
        `<li class="pss-ch${i === 0 ? ' on' : ''}" data-i="${i}"><button class="pss-chb" type="button" aria-controls="pss-rig" ${i === 0 ? 'aria-current="step"' : ''}><span class="n" data-label>${num(i)}</span><span class="t">${esc(s.title)}</span></button><div class="pss-chbody">${bodies
          .map((b, k) => (k === i ? `<p class="own">${inline(b)}</p>` : `<p aria-hidden="true">${inline(b)}</p>`))
          .join('')}</div><i class="pss-pr" aria-hidden="true"></i></li>`,
    )
    .join('')
  const caps = c.steps
    .map((s, i) => `<div ${i === 0 ? '' : 'aria-hidden="true" '}data-i="${i}"><div class="mt"><span data-label>${num(i)}</span><h2>${esc(s.title)}</h2></div><p>${inline(s.body)}</p></div>`)
    .join('')
  const segs = c.steps.map((s, i) => `<li><button type="button" aria-label="Step ${i + 1}: ${esc(s.title)}"><i><b></b></i></button></li>`).join('')
  const ctas = `<div class="pss-ctas">${c.buttons.map((b, i) => `<a class="pss-btn ${i ? 's' : 'p'}" href="${esc(b.href)}">${esc(b.label)}${i ? '' : icon('arrow', 18, 2)}</a>`).join('')}</div>`
  const light =
    L.kind === 'window'
      ? '<div class="pss-cast"></div><div class="pss-gobo"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      : L.kind === 'beam'
        ? '<div class="pss-cast"></div><div class="pss-beam"><i class="halo"><b></b></i><i class="core"><b></b></i><i class="ray"><b></b></i></div><canvas class="pss-dust"></canvas>'
        : '<div class="pss-cast"></div>'
  const glassExtra = L.kind === 'window' ? '<div class="pss-refl"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : L.kind === 'beam' ? '<div class="pss-streak"></div>' : ''
  const screens = c.steps.map((s, i) => screenHTML(s, i, c, asset)).join('')
  const section = `<section class="pss" id="pss" data-play="${esc(data.play)}" data-light="${esc(L.kind)}" style="${esc(style)}" aria-label="${esc(plain(c.headline))}">
<div class="pss-pin">
<div class="pss-light" aria-hidden="true">${light}<div class="pss-grain"></div></div>
<header class="pss-bar"><a class="pss-brand" href="${esc(c.brand.href ?? '#')}"><span class="mk">${icon(c.brand.icon ?? 'sparkle', 16, 2.2)}</span>${esc(c.brand.name)}</a><nav class="pss-nav" aria-label="Main">${(c.nav ?? []).map((x) => `<a href="${esc(x.href)}">${esc(x.label)}</a>`).join('')}<a class="cta" href="${esc(c.cta.href)}">${esc(c.cta.label)}</a></nav></header>
<div class="pss-stage">
<div class="pss-copy"><p class="pss-eyebrow" data-label>${esc(c.eyebrow)}</p><h1 class="pss-h1">${inline(c.headline)}</h1><p class="pss-lede">${inline(c.lede)}</p>
<ol class="pss-chap" aria-label="How it works">${chapters}</ol>${ctas}</div>
<figure class="pss-rig" id="pss-rig" role="img" aria-label="${esc(alt)}"><div class="pss-contact"></div><div class="pss-tilt"><div class="pss-ph"><i class="pss-key a"></i><i class="pss-key v1"></i><i class="pss-key v2"></i><i class="pss-key pw"></i><div class="pss-bezel"><div class="pss-screen"><div class="pss-app" aria-hidden="true">${screens}<i class="pss-tap"></i></div><div class="pss-island"></div><div class="pss-glass">${glassExtra}</div></div></div></div></div><p class="pss-note" aria-hidden="true" data-label><span></span><b></b></p></figure>
<div class="pss-cap"><ol class="pss-segs" aria-label="Steps">${segs}</ol><div class="pss-caps" aria-live="polite">${caps}</div></div>
</div>
</div>
<div class="pss-stack" aria-hidden="true"></div>
<div class="pss-after">${ctas}</div>
<script type="application/json" class="pss-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</section>`
  return { section, assets }
}

function labelOf(s) {
  const find = (blocks) => {
    for (const b of blocks ?? []) {
      if (b.id === s.tap) return b.label ?? b.text ?? b.title ?? s.tap
      for (const it of b.items ?? []) {
        const o = typeof it === 'string' ? { label: it } : it
        if (o.id === s.tap) return o.label ?? o.title ?? s.tap
      }
    }
    return s.tap
  }
  return find(s.screen.blocks)
}
function rgba(hex, a) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16))
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`
}
function isDark(hex) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4
}

export function build(input, outDir) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found`)
  let c
  try {
    c = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`${input} is not valid JSON: ${e.message}`)
  }
  const base = dirname(file)
  const problems = validate(c, base)
  if (problems.length) {
    const e = new Error(`${problems.length} problem${problems.length > 1 ? 's' : ''} in ${input}; nothing was written:\n  - ${problems.join('\n  - ')}`)
    e.problems = problems
    throw e
  }
  const css = readFileSync(join(KIT, 'page.css'), 'utf8')
  const js = readFileSync(join(KIT, 'runtime.js'), 'utf8')
  const { section, assets } = render(c, base)
  const out = resolve(outDir)
  mkdirSync(out, { recursive: true })
  if (assets.size) mkdirSync(join(out, 'assets'), { recursive: true })
  for (const [src, dst] of assets) copyFileSync(resolve(base, src), join(out, dst))
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(c.fonts.href)}">`
  const page = `<!doctype html>
<html lang="${esc(c.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<meta name="theme-color" content="${esc(c.colors.bg)}">
${fonts}
<style>
html,body{margin:0;background:${c.colors.bg}}
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
  const embed = `<!-- Phone Screen Showcase section. Put the three font lines in your <head> (or keep them here), then paste the rest where the hero goes. -->
${fonts}
<style>
${css}
</style>
${section}
<script>
${js}
</script>
`
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(join(out, 'embed.html'), embed)
  return { out, steps: c.steps.length, assets: assets.size }
}

export async function main(argv = process.argv.slice(2)) {
  const [input, outDir = 'out'] = argv.filter((a) => !a.startsWith('--'))
  if (!input) {
    console.log('usage: node scripts/build.mjs page.json [out]')
    process.exit(1)
  }
  try {
    const r = build(input, outDir)
    const rel = relative(process.cwd(), r.out)
    const shown = !rel ? '.' : rel.startsWith('..') ? r.out : rel
    console.log(`wrote ${shown}/index.html and ${shown}/embed.html (${r.steps} steps${r.assets ? `, ${r.assets} pictures in assets/` : ''})`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

export { extname }
