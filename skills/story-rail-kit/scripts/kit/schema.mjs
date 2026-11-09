// Story Rail: every rule rail.json has to meet. validate() returns
// { errors, warnings } and lists every problem at once, so the agent writing
// the file can fix them in one pass.
import { DRAWN } from '../../kit/drawn.mjs'

export const DISPLAYS = {
  geist: { family: "'SR Geist', 'Helvetica Neue', Arial, sans-serif", weight: 500, track: '-0.035em', claimWeight: 500, claimTrack: '-0.012em', em: 'normal', serif: false },
  fraunces: { family: "'SR Fraunces', Georgia, 'Times New Roman', serif", weight: 380, track: '-0.02em', claimWeight: 400, claimTrack: '-0.005em', em: 'italic', serif: true },
  system: { family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", weight: 600, track: '-0.03em', claimWeight: 500, claimTrack: '-0.01em', em: 'normal', serif: false },
}
export const MONOS = {
  plex: "'SR Plex Mono', ui-monospace, Menlo, Consolas, monospace",
  'dm-mono': "'SR DM Mono', ui-monospace, Menlo, Consolas, monospace",
  system: 'ui-monospace, Menlo, Consolas, monospace',
}
export const FONT_FILES = {
  geist: [['SR Geist', 'geist.woff2', 'normal', '100 900']],
  fraunces: [['SR Fraunces', 'fraunces.woff2', 'normal', '100 900'], ['SR Fraunces', 'fraunces-italic.woff2', 'italic', '100 900']],
  plex: [['SR Plex Mono', 'plex-mono-500.woff2', 'normal', '500']],
  'dm-mono': [['SR DM Mono', 'dm-mono-500.woff2', 'normal', '500']],
  system: [],
}

const KINDS = ['wide', 'tall', 'quote', 'number']
const STORY = ['wide', 'tall']
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
export const numberWord = (n) => NUMBER_WORDS[n] ?? String(n)

/* ---------- colour ---------- */
export function rgbOf(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function lum(hex) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a, b) {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Story cards (wide and tall) and stops (every card plus the end card). */
export const counts = (c) => ({
  stories: (c.cards ?? []).filter((k) => STORY.includes(k?.kind)).length,
  stops: (c.cards ?? []).length + 1,
})

/** Fills {count}, {Count} and {stops} in a head line. */
export function fill(s, c) {
  const { stories, stops } = counts(c)
  const word = numberWord(stories)
  return String(s ?? '')
    .replace(/\{count\}/g, String(stories))
    .replace(/\{Count\}/g, word[0].toUpperCase() + word.slice(1))
    .replace(/\{count-word\}/g, word)
    .replace(/\{stops\}/g, String(stops))
}

/** Numbers typed into a head line, outside the tokens: [{text, value}]. */
export function typedNumbers(s) {
  const bare = String(s ?? '').replace(/\{[a-z-]+\}/gi, ' ')
  const out = []
  for (const m of bare.matchAll(/(?<![\d.,–-])([2-9]|\d{2,3})(?![\d%°])(?!\s*(?:%|°|min|h\b|km|m\b|kg|g\b))/g)) out.push({ text: m[1], value: Number(m[1]) })
  for (const m of bare.matchAll(/\b([A-Za-z]+)\b/g)) {
    const i = NUMBER_WORDS.indexOf(m[1].toLowerCase())
    if (i > 1) out.push({ text: m[1], value: i })
  }
  return out
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const sentences = (s) => String(s).trim().split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/).filter(Boolean).length

export function validate(c) {
  const errors = []
  const warnings = []
  const err = (path, msg) => errors.push(`${path}: ${msg}`)
  const text = (path, v, max, required = true) => {
    if (v === undefined || v === null || v === '') { if (required) err(path, 'is required'); return }
    if (typeof v !== 'string') return err(path, 'must be text')
    if (v.length > max) err(path, `is ${v.length} characters; keep it to ${max}`)
  }
  if (!c || typeof c !== 'object') return { errors: ['rail.json must be a JSON object'], warnings }

  // links: a relative path, an #anchor, or an address on the site's own domain
  const site = c.site
  if (site !== undefined && !/^https:\/\/[a-z0-9.-]+(\/.*)?$/i.test(site)) err('site', 'must be the site address, starting with https://')
  const href = (path, v, required = true) => {
    if (!isStr(v)) { if (required) err(path, 'is required (where the card links to)'); return }
    if (/^(javascript|data):/i.test(v)) return err(path, 'must be a page address')
    if (/^https?:\/\//i.test(v)) {
      if (!site) return err(path, `is a full address; give "site" (your own site's address) or use a path such as /work/saltmarsh`)
      if (!v.startsWith(site.replace(/\/$/, ''))) err(path, `goes to another site (${v}); cards link to pages on ${site}`)
    } else if (!/^[/#.a-z0-9]/i.test(v)) err(path, 'must be a path (/work/x), an #anchor or an address on your site')
  }

  text('link', c.link, 22, false)

  // page (the standalone page only)
  if (c.page !== undefined) {
    text('page.brand', c.page?.brand, 40)
    if (c.page?.nav !== undefined && (!Array.isArray(c.page.nav) || c.page.nav.length > 6 || c.page.nav.some((n) => !isStr(n) || n.length > 16)))
      err('page.nav', 'is up to 6 short words (each up to 16 characters)')
  }

  // theme
  const t = c.theme ?? {}
  if (!c.theme) err('theme', 'is required')
  for (const k of ['bg', 'surface', 'ink', 'mute', 'rule', 'accent', 'onAccent'])
    if (!rgbOf(t[k])) err(`theme.${k}`, 'must be a colour as #rrggbb')
  if (t.chart !== undefined && (!Array.isArray(t.chart) || t.chart.length < 2 || t.chart.length > 4 || t.chart.some((x) => !rgbOf(x))))
    err('theme.chart', 'is 2 to 4 colours as #rrggbb (the number card chart)')
  if (t.display !== undefined && !DISPLAYS[t.display]) err('theme.display', `is one of ${Object.keys(DISPLAYS).join(', ')}`)
  if (t.mono !== undefined && !MONOS[t.mono]) err('theme.mono', `is one of ${Object.keys(MONOS).join(', ')}`)
  if (t.radius !== undefined && !(Number.isFinite(t.radius) && t.radius >= 0 && t.radius <= 8)) err('theme.radius', 'is 0 to 8 (px)')
  if (t.mode !== undefined && !['light', 'dark'].includes(t.mode)) err('theme.mode', 'is light or dark')
  const pair = (a, b, need, what) => {
    if (!rgbOf(t[a]) || !rgbOf(t[b])) return
    const r = contrast(t[a], t[b])
    if (r < need) err(`theme.${a}`, `${what}: ${r.toFixed(2)}:1 against theme.${b}; it needs ${need}:1`)
  }
  pair('ink', 'bg', 7, 'the main text is too faint')
  pair('ink', 'surface', 4.5, 'text on the number card is too faint')
  pair('mute', 'bg', 4.5, 'the muted text is too faint')
  pair('mute', 'surface', 4.5, 'muted text on the number card is too faint')
  pair('onAccent', 'accent', 4.5, 'the quote card text is too faint')
  pair('accent', 'bg', 3, 'the accent word in the heading is too faint')

  // head
  const h = c.head ?? {}
  if (!c.head) err('head', 'is required')
  text('head.eyebrow', h.eyebrow, 40)
  text('head.title', h.title, 70)
  text('head.dek', h.dek, 140, false)
  if (isStr(h.title) && (h.title.match(/_/g) ?? []).length > 2) err('head.title', 'can set one phrase in the accent, as _this_')

  // cards
  const cards = c.cards
  if (!Array.isArray(cards) || cards.length < 3 || cards.length > 14) err('cards', 'is a list of 3 to 14 cards')
  const list = Array.isArray(cards) ? cards : []
  list.forEach((k, i) => {
    const p = `cards[${i}]`
    if (!k || typeof k !== 'object') return err(p, 'must be an object')
    if (!KINDS.includes(k.kind)) return err(`${p}.kind`, `is one of ${KINDS.join(', ')}`)
    if (STORY.includes(k.kind)) {
      text(`${p}.name`, k.name, 32)
      text(`${p}.meta`, k.meta, 28)
      text(`${p}.claim`, k.claim, 90)
      if (isStr(k.claim) && sentences(k.claim) > 1) err(`${p}.claim`, 'is one sentence: one clear claim per card')
      text(`${p}.link`, k.link, 22, false)
      href(`${p}.href`, k.href)
      const m = k.media
      if (!m || typeof m !== 'object') err(`${p}.media`, 'is required: { "drawn" }, { "image" } or { "loop", "poster" }, each with "alt"')
      else {
        const kinds = ['drawn', 'image', 'loop'].filter((x) => m[x] !== undefined)
        if (kinds.length !== 1) err(`${p}.media`, 'has exactly one of drawn, image or loop')
        if (!isStr(m.alt)) err(`${p}.media`, 'needs "alt": what the picture shows, for people who cannot see it')
        else if (m.alt.length > 160) err(`${p}.media`, `"alt" is ${m.alt.length} characters; keep it to 160`)
        if (m.drawn !== undefined) {
          const d = DRAWN[m.drawn]
          if (!d) err(`${p}.media`, `"drawn" is one of ${Object.keys(DRAWN).join(', ')}`)
          else if (d.shape !== k.kind) warnings.push(`${p}: the drawn scene "${m.drawn}" is made for a ${d.shape} card; it will be cropped`)
        }
        if (m.image !== undefined && !/\.(webp|jpe?g|png|avif)$/i.test(m.image)) err(`${p}.media`, '"image" is a .webp, .jpg, .png or .avif file next to rail.json')
        if (m.loop !== undefined) {
          if (!/\.(mp4|webm)$/i.test(m.loop)) err(`${p}.media`, '"loop" is an .mp4 or .webm file next to rail.json')
          if (!isStr(m.poster)) err(`${p}.media`, 'a loop needs "poster" (a still shown before it plays and under reduced motion)')
          if (!(Number.isFinite(m.seconds) && m.seconds >= 2 && m.seconds <= 30)) err(`${p}.media`, 'a loop needs "seconds", its length (2 to 30), for its tag')
        }
        if (m.focus !== undefined && !/^\d{1,3}% \d{1,3}%$/.test(m.focus)) err(`${p}.media`, '"focus" is like "50% 40%"')
      }
    }
    if (k.kind === 'quote') {
      text(`${p}.text`, k.text, 120)
      text(`${p}.by`, k.by, 40)
      text(`${p}.role`, k.role, 48)
      text(`${p}.label`, k.label, 24, false)
      href(`${p}.href`, k.href, false)
    }
    if (k.kind === 'number') {
      text(`${p}.figure`, k.figure, 4)
      text(`${p}.unit`, k.unit, 4, false)
      text(`${p}.label`, k.label, 90)
      text(`${p}.source`, k.source, 80, false)
      if (!isStr(k.source)) err(`${p}.source`, 'is required: say how the number was counted ("Measured at completion, 6 projects")')
      href(`${p}.href`, k.href, false)
      if (k.compare !== undefined && k.split !== undefined) err(p, 'has either "compare" or "split", not both')
      const rows = k.compare ?? k.split
      if (rows !== undefined) {
        const name = k.compare ? 'compare' : 'split'
        if (!Array.isArray(rows) || rows.length < 2 || rows.length > 4 || rows.some((r) => !Array.isArray(r) || !isStr(r[0]) || r[0].length > 10 || !(Number.isFinite(r[1]) && r[1] >= 0)))
          err(`${p}.${name}`, 'is 2 to 4 pairs of [label up to 10 characters, number]')
        else if (k.compare && Math.max(...rows.map((r) => r[1])) <= 0) err(`${p}.compare`, 'needs at least one value above 0')
      }
    }
    const prev = list[i - 1]
    if (prev && prev.kind === k.kind && (k.kind === 'quote' || k.kind === 'number')) err(p, `two ${k.kind} cards in a row; put a story card between them`)
  })
  let run = 0
  list.forEach((k, i) => {
    run = k?.kind === 'wide' ? run + 1 : 0
    if (run === 4) err(`cards[${i}]`, 'four wide cards in a row; the rhythm goes flat (mix in a tall, quote or number card)')
  })
  if (list.length && !STORY.includes(list[0]?.kind)) err('cards[0]', 'the rail starts with a story (a wide or tall card)')
  if (list.length && !list.some((k) => k?.kind === 'quote' || k?.kind === 'number'))
    warnings.push('cards: no quote and no number card; a rail of pictures alone is a gallery, not a story')

  // end card
  const e = c.end ?? {}
  if (!c.end) err('end', 'is required: the "view all" card at the end of the rail')
  text('end.title', e.title, 24)
  text('end.note', e.note, 40, false)
  href('end.href', e.href)

  // numbers typed into the head must agree with the rail
  const { stories, stops } = counts(c)
  for (const k of ['eyebrow', 'title', 'dek']) {
    for (const n of typedNumbers(h[k])) {
      if (n.value !== stories && n.value !== stops)
        err(`head.${k}`, `says "${n.text}", but the rail holds ${stories} stories (wide and tall cards) and ${stops} stops; write {count} or {Count} and the build fills it in`)
    }
  }

  // behaviour
  const b = c.behaviour ?? {}
  if (b.autoplay !== undefined && typeof b.autoplay !== 'boolean') err('behaviour.autoplay', 'is true or false (false by default)')
  if (b.autoplay === true) {
    if (!(Number.isFinite(b.seconds) && b.seconds >= 6 && b.seconds <= 20)) err('behaviour.seconds', 'with autoplay on, each card stays 6 to 20 seconds')
  } else if (b.seconds !== undefined) warnings.push('behaviour.seconds only matters with autoplay on')
  if (b.hint !== undefined && b.hint !== false && !(isStr(b.hint) && b.hint.length <= 40)) err('behaviour.hint', 'is false or a short line (up to 40 characters)')
  return { errors, warnings }
}
