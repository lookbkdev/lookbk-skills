// Journal Index Kit: every field of journal.json and of a post's front
// matter, with its limits. validateJournal and validatePost return a list of
// problems (all of them, never just the first); the build prints the list
// and writes nothing until it is empty.
import { READING_DEFAULTS } from './reading.mjs'

export const PRESETS = {
  paper: { bg: '#f3efe6', band: '#e8e1d2', ink: '#1d1b17', muted: '#5c554a', faint: '#8a8274', rule: '#d6cebe', accent: '#9b3b1f', code: '#ebe5d8' },
  ink: { bg: '#0f1113', band: '#15181b', ink: '#e7e4dc', muted: '#a3a097', faint: '#858279', rule: '#2a2e33', accent: '#ff8466', code: '#16191d' },
}
export const FONTS = {
  newsreader: {
    google: 'family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&family=Schibsted+Grotesk:wght@400..600',
    display: "'Newsreader', Georgia, serif", text: "'Newsreader', Georgia, serif", ui: "'Schibsted Grotesk', system-ui, sans-serif", mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", label: "'Schibsted Grotesk', system-ui, sans-serif",
    names: 'Newsreader and Schibsted Grotesk',
  },
  geist: {
    google: 'family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300..600;1,8..60,300..600',
    display: "'Geist', system-ui, sans-serif", text: "'Source Serif 4', Georgia, serif", ui: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, Menlo, Consolas, monospace", label: "'Geist Mono', ui-monospace, Menlo, monospace",
    names: 'Geist, Source Serif 4 and Geist Mono',
  },
}

const HEX = /^#[0-9a-f]{6}$/i
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = (h) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const isStr = (v) => typeof v === 'string'
const turns = (s) => (String(s).match(/(^|[^\w])_[^_]+_/g) ?? []).length

export function resolveTheme(j) {
  const t = j.theme ?? {}
  const preset = t.preset ?? 'paper'
  return {
    preset,
    fonts: t.fonts ?? (preset === 'ink' ? 'geist' : 'newsreader'),
    leadSide: t.leadSide ?? (preset === 'ink' ? 'right' : 'left'),
    dropCap: t.dropCap ?? preset === 'paper',
    numerals: t.numerals ?? (preset === 'ink' ? 'tabular' : 'oldstyle'),
    colors: { ...(PRESETS[preset] ?? PRESETS.paper), ...(t.colors ?? {}) },
  }
}

export function validateJournal(j, file = 'journal.json') {
  const errs = []
  const need = (ok, msg) => ok || errs.push(`${file}: ${msg}`)
  const str = (v, name, max, req = true) => {
    if (v === undefined || v === '') return need(!req, `"${name}" is required`)
    need(isStr(v), `"${name}" must be text`)
    if (isStr(v)) need(v.length <= max, `"${name}" is ${v.length} characters; keep it to ${max}`)
  }
  str(j.brand, 'brand', 32)
  str(j.masthead, 'masthead', 40)
  need(turns(j.masthead ?? '') <= 1, '"masthead" may have one _turn_ (in underscores), not more')
  str(j.strap, 'strap', 220)
  str(j.since, 'since', 64)
  str(j.publisher, 'publisher', 60, false)
  str(j.issueLabel, 'issueLabel', 4, false)
  str(j.language, 'language', 12, false)
  const site = j.site ?? {}
  need(isStr(site.url) && /^https?:\/\/[^/]+\/.*\/?$/.test(site.url) && site.url.endsWith('/'), '"site.url" must be the journal\'s address, ending in / (https://brand.example/journal/)')
  need(Array.isArray(site.nav ?? []) && (site.nav ?? []).length <= 6, '"site.nav" is up to 6 { "label", "href" } links')
  for (const [i, n] of (site.nav ?? []).entries()) need(isStr(n.label) && n.label.length <= 18 && isStr(n.href) && n.href, `site.nav[${i}] needs "label" (18 characters or fewer) and "href"`)
  const t = j.theme ?? {}
  need(!t.preset || t.preset in PRESETS, '"theme.preset" is paper or ink')
  need(!t.fonts || t.fonts in FONTS, `"theme.fonts" is one of ${Object.keys(FONTS).join(', ')}`)
  need(!t.leadSide || ['left', 'right'].includes(t.leadSide), '"theme.leadSide" is left or right')
  need(t.dropCap === undefined || typeof t.dropCap === 'boolean', '"theme.dropCap" is true or false')
  need(!t.numerals || ['oldstyle', 'tabular'].includes(t.numerals), '"theme.numerals" is oldstyle or tabular')
  for (const [k, v] of Object.entries(t.colors ?? {})) {
    need(k in PRESETS.paper, `"theme.colors.${k}" is not a colour the kit uses (${Object.keys(PRESETS.paper).join(', ')})`)
    need(HEX.test(v), `"theme.colors.${k}" must be a 6-digit hex colour like #1d1b17`)
  }
  if (Object.values(t.colors ?? {}).every((v) => HEX.test(v))) {
    const c = resolveTheme(j).colors
    const pair = (a, b, min, why) => {
      const r = contrast(c[a], c[b])
      need(r >= min, `${a} on ${b} is ${r.toFixed(2)}:1; ${why} needs ${min}:1`)
    }
    pair('ink', 'bg', 7, 'body text')
    pair('ink', 'band', 4.5, 'the series band')
    pair('ink', 'code', 4.5, 'code')
    pair('muted', 'bg', 4.5, 'deks, captions and dates')
    pair('muted', 'band', 4.5, 'the series band')
    pair('accent', 'bg', 4.5, 'accent labels at 12 px')
    pair('accent', 'band', 4.5, 'accent labels on the band')
    pair('faint', 'bg', 3, 'large issue numbers')
  }
  need(Array.isArray(j.sections) && j.sections.length >= 1 && j.sections.length <= 8, '"sections" is a list of 1 to 8 section names')
  for (const s of j.sections ?? []) need(isStr(s) && s.length <= 18, `section "${s}" must be text of 18 characters or fewer`)
  need(new Set(j.sections ?? []).size === (j.sections ?? []).length, '"sections" has a name twice')
  need(Array.isArray(j.series ?? []) && (j.series ?? []).length <= 3, '"series" is up to 3 series (more belong on their own page)')
  for (const [i, s] of (j.series ?? []).entries()) {
    need(isStr(s.name) && s.name.length <= 32, `series[${i}] needs "name" (32 characters or fewer)`)
    need(isStr(s.description) && s.description.length <= 160, `series[${i}] needs "description" (160 characters or fewer)`)
    need(Array.isArray(s.parts) && s.parts.length >= 2 && s.parts.length <= 12, `series[${i}] needs "parts", the titles of all its parts in order (2 to 12), written or planned`)
  }
  for (const [y, v] of Object.entries(j.volumes ?? {})) need(/^\d{4}$/.test(y) && isStr(v) && v.length <= 20, `volumes: "${y}" must be a year with a label of 20 characters or fewer`)
  need(j.indexLimit === undefined || (Number.isInteger(j.indexLimit) && j.indexLimit >= 4 && j.indexLimit <= 200), '"indexLimit" is a whole number from 4 to 200 (default 24)')
  const r = j.reading ?? {}
  need(r.wpm === undefined || (r.wpm >= 120 && r.wpm <= 400), '"reading.wpm" is 120 to 400 (default 230)')
  need(r.codeLinesPerMinute === undefined || (r.codeLinesPerMinute >= 4 && r.codeLinesPerMinute <= 60), '"reading.codeLinesPerMinute" is 4 to 60 (default 12)')
  need(r.secondsPerFigure === undefined || (r.secondsPerFigure >= 0 && r.secondsPerFigure <= 60), '"reading.secondsPerFigure" is 0 to 60 (default 12)')
  const L = j.labels ?? {}
  for (const k of ['lead', 'index', 'series', 'read', 'plate']) str(L[k], `labels.${k}`, 32, false)
  str(L.seriesIntro, 'labels.seriesIntro', 160, false)
  const f = j.footer ?? {}
  str(f.colophon, 'footer.colophon', 80, false)
  str(f.note, 'footer.note', 120, false)
  need(f.email === undefined || (isStr(f.email) && f.email.length > 0), '"footer.email" is the address of the email sign-up page')
  const feed = j.feed ?? {}
  need(feed.items === undefined || (Number.isInteger(feed.items) && feed.items >= 1 && feed.items <= 100), '"feed.items" is 1 to 100 (default 20)')
  return errs
}

export const readingRates = (j) => ({ ...READING_DEFAULTS, ...(j.reading ?? {}) })

const DATE = /^\d{4}-\d{2}-\d{2}$/
const realDate = (s) => DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s)

export function validatePost(p, j, file) {
  const errs = []
  const need = (ok, msg) => ok || errs.push(`${file}: ${msg}`)
  need(Number.isInteger(p.no) && p.no > 0 && p.no < 100000, '"no" (the issue number) must be a whole number, 1 or more')
  need(isStr(p.title) && p.title.length >= 2 && p.title.length <= 90, '"title" is required, 90 characters or fewer')
  need(turns(p.title ?? '') <= 1, '"title" may have one _turn_ (in underscores), not more')
  need(isStr(p.dek) && p.dek.length >= 10 && p.dek.length <= 200, '"dek" is required: one or two sentences, 200 characters or fewer (it is the second line of the index row)')
  need((j.sections ?? []).includes(p.section), `"section" must be one of: ${(j.sections ?? []).join(', ')}`)
  need(isStr(p.date) && realDate(p.date), '"date" must be a real date written YYYY-MM-DD')
  if (p.updated !== undefined) need(isStr(p.updated) && realDate(p.updated) && p.updated >= (p.date ?? ''), '"updated" must be a YYYY-MM-DD date on or after "date"')
  const authors = Array.isArray(p.author) ? p.author : [p.author]
  need(authors.length >= 1 && authors.length <= 4 && authors.every((a) => isStr(a) && a.length <= 40), '"author" is a name, or a list of up to 4 names')
  if (p.series !== undefined) {
    const s = (j.series ?? []).find((x) => x.name === p.series?.name)
    need(!!s, `"series.name" must be one of the series in journal.json (${(j.series ?? []).map((x) => x.name).join(', ') || 'none defined'})`)
    if (s) need(Number.isInteger(p.series.part) && p.series.part >= 1 && p.series.part <= s.parts.length, `"series.part" must be 1 to ${s.parts.length} for ${s.name}`)
  }
  if (p.lead !== undefined) {
    const l = p.lead
    need(typeof l === 'object' && (isStr(l.image) || isStr(l.chart)) && !(l.image && l.chart), '"lead" needs "image" (a photo or drawing) or "chart" (a .json chart), not both')
    if (l.image) need(isStr(l.alt) && l.alt.length >= 8 && l.alt.length <= 200, '"lead.alt" is required with an image: what the picture shows, for people who can\'t see it')
    need(l.caption === undefined || (isStr(l.caption) && l.caption.length <= 180), '"lead.caption" is 180 characters or fewer')
    need(l.credit === undefined || (isStr(l.credit) && l.credit.length <= 60), '"lead.credit" is 60 characters or fewer')
  }
  for (const k of ['dropCap', 'featured', 'draft']) need(p[k] === undefined || typeof p[k] === 'boolean', `"${k}" is true or false`)
  need(p.slug === undefined || (isStr(p.slug) && /^[a-z0-9][a-z0-9-]{0,79}$/.test(p.slug)), '"slug" is lowercase letters, digits and hyphens')
  const known = new Set(['no', 'title', 'dek', 'section', 'date', 'updated', 'author', 'series', 'lead', 'dropCap', 'featured', 'draft', 'slug'])
  for (const k of Object.keys(p)) need(known.has(k), `"${k}" is not a field the kit reads (did you mean one of ${[...known].join(', ')}?)`)
  return errs
}
