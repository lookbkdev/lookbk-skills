// Compare Table Kit: every field of compare.json, its limits, and the
// honesty rules. validate() lists every problem at once and returns the
// config with the computed tally, the source numbers and the derived colours.
//
// The rules that keep the table honest are code, not advice:
//   - every cell names a source, and every source has a kind and a date
//   - at least one row has an alternative ahead
//   - the tally is computed from the verdicts; a typed tally is refused, and
//     a count written in the head ("8 questions", "four things") must match
//   - no yes/no, true/false or tick cells: a cell says what happens
//   - an estimate cannot carry a comparison ("faster", "cheaper", "best")
//   - an alternative marked named (a real product) needs a dated, linked,
//     non-estimate source in every one of its cells, no older than maxAgeDays
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const DISPLAYS = {
  'instrument-serif': { family: '"Instrument Serif", Georgia, serif', google: 'family=Instrument+Serif:ital@0;1', weight: 400, track: '-0.01em', turn: 'italic', lead: 1 },
  newsreader: { family: '"Newsreader", Georgia, serif', google: 'family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500', weight: 420, track: '-0.015em', turn: 'italic', lead: 1.02 },
  'bricolage-grotesque': { family: '"Bricolage Grotesque", system-ui, sans-serif', google: 'family=Bricolage+Grotesque:opsz,wght@12..96,500..700', weight: 640, track: '-0.03em', turn: 'normal', lead: 0.98 },
}
export const TEXTS = {
  'source-sans-3': { family: '"Source Sans 3", system-ui, sans-serif', google: 'family=Source+Sans+3:wght@400;500;600;700' },
  'ibm-plex-sans': { family: '"IBM Plex Sans", system-ui, sans-serif', google: 'family=IBM+Plex+Sans:wght@400;500;600' },
}
export const MONOS = {
  'ibm-plex-mono': { family: '"IBM Plex Mono", ui-monospace, monospace', google: 'family=IBM+Plex+Mono:wght@400;500' },
  'jetbrains-mono': { family: '"JetBrains Mono", ui-monospace, monospace', google: 'family=JetBrains+Mono:wght@400;500' },
}
export const KINDS = { diy: 'Do it yourself', have: 'Already have it', software: 'Software', service: 'Service', nothing: 'Doing nothing' }
export const SOURCE_KINDS = { own: 'Our study', 'third-party': 'Independent', public: 'Public page' }

// colour maths
const hex = /^#[0-9a-f]{6}$/i
export const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export function lum(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const [r, g, b] = rgbOf(h)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const mix = (a, b, t) => '#' + rgbOf(a).map((v, i) => Math.round(v + (rgbOf(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
/** ink faded towards the paper, as far as it can go and still reach `min` on every ground */
export function mute(ink, grounds, min) {
  let best = ink
  for (let t = 0; t <= 0.8; t += 0.02) {
    const m = mix(ink, grounds[0], t)
    if (grounds.every((g) => contrast(m, g) >= min)) best = m
    else break
  }
  return best
}

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 2026-10-01 -> 1 Oct 2026 */
export function dateText(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const BOOLEANS = /^(yes|no|true|false|y|n|x|n\/a|na|-|–|—|✓|✔|✗|✘|✕|✖|☑|☒|❌|✅)$/i
const COMPARATIVE = /\b(faster|fastest|cheaper|cheapest|better|best|easier|easiest|only|leading|number one|no\.\s?1|#1|unbeatable|unmatched|more than|less than|beats?|outperforms?)\b/i

/** the counts the head may state, by noun */
const COUNT_NOUNS = [
  [/^(questions?|rows?|comparisons?|answers?)$/i, 'rows'],
  [/^(alternatives?|options?|things|ways|tools|rivals|competitors)$/i, 'alts'],
]

export function validate(json, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], notes = [], warnings = []
  const err = (m) => errors.push(m)
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const str = (v, path, max, { optional = false, min = 1 } = {}) => {
    if (v === undefined || v === null || v === '') { if (!optional) err(`${path} is missing`); return false }
    if (typeof v !== 'string') { err(`${path} must be text`); return false }
    if (v.trim().length < min) { err(`${path} is empty`); return false }
    if (v.length > max) err(`${path} is ${v.length} characters; at most ${max}`)
    if (/[—]/.test(v)) err(`${path} uses an em dash; use a comma, a colon or a full stop`)
    return true
  }
  if (!isObj(json)) return { errors: ['compare.json must be an object'], notes, warnings }
  const c = structuredClone(json)

  if ('tally' in c) err('tally: remove it. The tally is computed from the rows’ verdicts and is never typed')
  str(c.brand, 'brand', 40)
  if (c.lang !== undefined) str(c.lang, 'lang', 12)
  if (c.stickyTop !== undefined && !(Number.isFinite(c.stickyTop) && c.stickyTop >= 0 && c.stickyTop <= 160)) err('stickyTop must be a number of px from 0 to 160 (the height of a sticky site header above the table)')
  if (c.maxAgeDays !== undefined && !(Number.isInteger(c.maxAgeDays) && c.maxAgeDays >= 30 && c.maxAgeDays <= 365)) err('maxAgeDays must be a whole number of days from 30 to 365')
  const maxAge = c.maxAgeDays ?? 180

  // theme
  const t = c.theme
  if (!isObj(t)) err('theme is missing')
  else {
    if (!['light', 'dark'].includes(t.mode)) err('theme.mode must be "light" or "dark"')
    const colours = ['paper', 'column', 'ink', 'us', 'onUs', 'them', 'themWash']
    let ok = true
    for (const k of colours) if (!hex.test(t[k] ?? '')) { err(`theme.${k} must be a colour like #1c1b18`); ok = false }
    if (!DISPLAYS[t.display]) err(`theme.display must be one of ${Object.keys(DISPLAYS).join(', ')}`)
    if (!TEXTS[t.text]) err(`theme.text must be one of ${Object.keys(TEXTS).join(', ')}`)
    if (!MONOS[t.mono]) err(`theme.mono must be one of ${Object.keys(MONOS).join(', ')}`)
    if (ok) {
      const need = (a, b, min, what) => { const r = contrast(t[a], t[b]); if (r < min) err(`theme: ${what} (${a} ${t[a]} on ${b} ${t[b]}) is ${r.toFixed(2)}:1; needs ${min}:1`) }
      need('ink', 'paper', 7, 'text'); need('ink', 'column', 7, 'text in the product column'); need('ink', 'themWash', 7, 'text in a cell where an alternative is ahead')
      need('us', 'paper', 4.5, 'the product’s verdict text'); need('onUs', 'us', 4.5, 'text on the product’s filled header and button')
      need('them', 'paper', 4.5, 'the “ahead” verdict text for an alternative'); need('them', 'themWash', 3, 'the underline in a cell where an alternative is ahead')
      need('us', 'column', 3, 'the underline in the product column')
      if (t.mode === 'light' && lum(t.paper) < 0.4) err('theme.paper is dark but theme.mode is light')
      if (t.mode === 'dark' && lum(t.paper) > 0.2) err('theme.paper is light but theme.mode is dark')
      t.mute = mute(t.ink, [t.paper, t.column, t.themWash], 4.8)
    }
  }

  // head
  const h = c.head
  if (!isObj(h)) err('head is missing')
  else {
    if (!Array.isArray(h.eyebrow) || h.eyebrow.length < 1 || h.eyebrow.length > 3) err('head.eyebrow must list 1 to 3 short items')
    else h.eyebrow.forEach((e, i) => str(e, `head.eyebrow[${i}]`, 32))
    if (str(h.headline, 'head.headline', 72) && (h.headline.match(/_/g) ?? []).length !== 2) err('head.headline needs exactly one _turn_ (two underscores around the words that turn)')
    str(h.lede, 'head.lede', 220)
  }

  // columns
  const ids = new Set()
  const p = c.product
  if (!isObj(p)) err('product is missing')
  else {
    if (!/^[a-z][a-z0-9-]{0,15}$/.test(p.id ?? '')) err('product.id must be 1 to 16 lowercase letters, digits or -, starting with a letter')
    else ids.add(p.id)
    str(p.name, 'product.name', 24); str(p.desc, 'product.desc', 60)
  }
  const alts = c.alternatives
  if (!Array.isArray(alts) || alts.length < 2 || alts.length > 4) err('alternatives must list 2 to 4 alternatives (include "doing it yourself" or "a spreadsheet" if that is what buyers really do)')
  else alts.forEach((a, i) => {
    const at = `alternatives[${i}]`
    if (!isObj(a)) return err(`${at} must be an object`)
    if (!/^[a-z][a-z0-9-]{0,15}$/.test(a.id ?? '')) err(`${at}.id must be 1 to 16 lowercase letters, digits or -, starting with a letter`)
    else if (ids.has(a.id)) err(`${at}.id "${a.id}" is used twice`)
    else ids.add(a.id)
    str(a.name, `${at}.name`, 28); str(a.short, `${at}.short`, 16); str(a.called, `${at}.called`, 26); str(a.desc, `${at}.desc`, 60)
    if (!KINDS[a.kind]) err(`${at}.kind must be one of ${Object.keys(KINDS).join(', ')}`)
    if (!!a.invented === !!a.named) err(`${at} must say either "invented": true (a made-up example) or "named": true (a real product or company)`)
  })
  const named = (alts ?? []).filter((a) => a?.named)

  // sources
  const src = new Map()
  if (!Array.isArray(c.sources) || c.sources.length < 1 || c.sources.length > 20) err('sources must list 1 to 20 sources')
  else c.sources.forEach((s, i) => {
    const at = `sources[${i}]`
    if (!isObj(s)) return err(`${at} must be an object`)
    if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(s.id ?? '')) err(`${at}.id must be 1 to 24 lowercase letters, digits or -`)
    else if (src.has(s.id)) err(`${at}.id "${s.id}" is used twice`)
    if (!SOURCE_KINDS[s.kind]) err(`${at}.kind is ${s.kind === undefined ? 'missing' : `"${s.kind}"`}: every source says where it comes from, "own" (your study, survey or estimate), "third-party" (an independent test or report) or "public" (a public page such as a price list)`)
    if (s.estimate && s.kind !== 'own') err(`${at}: an estimate is always your own; set "kind": "own"`)
    str(s.text, `${at}.text`, 110)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.asOf ?? '') || Number.isNaN(Date.parse(s.asOf))) err(`${at}.asOf must be the date it was checked, as YYYY-MM-DD`)
    else if (s.asOf > today) err(`${at}.asOf ${s.asOf} is in the future (today is ${today})`)
    if (s.period !== undefined) str(s.period, `${at}.period`, 28)
    if (s.url !== undefined && !/^https:\/\/[^\s]+$/.test(s.url)) err(`${at}.url must start with https://`)
    s.n = i + 1
    s.label = s.estimate ? 'Our estimate' : SOURCE_KINDS[s.kind]
    if (s.id) src.set(s.id, s)
  })

  // groups, rows, cells, verdicts
  const cols = [p?.id, ...(alts ?? []).map((a) => a?.id)].filter(Boolean)
  const tally = { ahead: 0, level: 0, behind: 0, rows: 0 }
  let honest = 0
  const used = new Set()
  if (!Array.isArray(c.groups) || c.groups.length < 1 || c.groups.length > 6) err('groups must list 1 to 6 buyer questions')
  else c.groups.forEach((g, gi) => {
    const at = `groups[${gi}]`
    if (!isObj(g)) return err(`${at} must be an object`)
    str(g.question, `${at}.question`, 60)
    if (!g.assumes) err(`${at}.assumes is missing: say the scenario the numbers are for (team size, volume, period), so they can be compared`)
    else str(g.assumes, `${at}.assumes`, 110)
    if (!Array.isArray(g.rows) || g.rows.length < 1 || g.rows.length > 6) return err(`${at}.rows must list 1 to 6 rows`)
    g.rows.forEach((r, ri) => {
      const rt = `${at}.rows[${ri}]`
      if (!isObj(r)) return err(`${rt} must be an object`)
      str(r.label, `${rt}.label`, 40)
      tally.rows++
      const v = r.verdict
      if (typeof v === 'string') {
        if (!cols.includes(v)) err(`${rt}.verdict "${v}" is not a column id (${cols.join(', ')})`)
        else if (v === p.id) tally.ahead++
        else { tally.behind++; honest++ }
      } else if (isObj(v) && Array.isArray(v.level)) {
        if (v.level.length < 2 || new Set(v.level).size !== v.level.length) err(`${rt}.verdict.level must name 2 or more different columns`)
        for (const id of v.level) if (!cols.includes(id)) err(`${rt}.verdict.level names "${id}", which is not a column id`)
        if (v.level.includes(p?.id)) tally.level++
        else { tally.behind++; honest++ }
      } else err(`${rt}.verdict must be a column id (who is ahead on this row) or { "level": [ids] }`)
      if (!isObj(r.cells)) return err(`${rt}.cells is missing`)
      for (const k of Object.keys(r.cells)) if (!cols.includes(k)) err(`${rt}.cells has "${k}", which is not a column id`)
      for (const id of cols) {
        const ct = `${rt}.cells.${id}`
        const cell = r.cells[id]
        if (cell === undefined) { err(`${ct} is missing: every column needs a fact on every row`); continue }
        if (typeof cell === 'boolean' || !isObj(cell)) { err(`${ct} must be { fact, note?, source }, not ${JSON.stringify(cell)}. Say what it does, e.g. "Read-only, last 14 days"`); continue }
        if (typeof cell.fact === 'boolean' || (typeof cell.fact === 'string' && BOOLEANS.test(cell.fact.trim()))) err(`${ct}.fact is "${cell.fact}": no yes/no or tick cells. Say what it does or costs, e.g. "Read-only, last 14 days"`)
        else str(cell.fact, `${ct}.fact`, 28)
        if (cell.note !== undefined) str(cell.note, `${ct}.note`, 60)
        if (!cell.source) { err(`${ct} has no source: every claim needs one (add it to sources and name its id here)`); continue }
        const s = src.get(cell.source)
        if (!s) { err(`${ct}.source "${cell.source}" is not in sources`); continue }
        used.add(s.id)
        const words = `${cell.fact ?? ''} ${cell.note ?? ''}`
        if (s.estimate && COMPARATIVE.test(words)) err(`${ct} says "${words.match(COMPARATIVE)[0]}" on an estimate: a comparison needs a measured or published source`)
        const alt = (alts ?? []).find((a) => a?.id === id)
        if (alt?.named) {
          if (s.estimate) err(`${ct}: ${alt.name} is a named product, so this cell needs a published or measured source, not an estimate`)
          if (s.kind === 'own') err(`${ct}: ${alt.name} is a named product; a claim about it from your own study needs an independent or public source too`)
          if (!s.url) err(`${ct}: ${alt.name} is a named product, so source "${s.id}" needs a url`)
          if (s.asOf) {
            const age = Math.round((Date.parse(today) - Date.parse(s.asOf)) / 864e5)
            if (age > maxAge) err(`${ct}: source "${s.id}" was checked ${age} days ago; claims about ${alt.name} must be rechecked within ${maxAge} days`)
          }
        }
      }
    })
  })
  if (Array.isArray(c.groups) && tally.rows && honest === 0) err('no row has an alternative ahead. Buyers stop trusting a table that never loses: find the row where something else really is better (cost, setup time, offline, owning the file) and give it that verdict')
  if (Array.isArray(c.sources)) for (const s of c.sources) if (s?.id && !used.has(s.id)) notes.push(`source "${s.id}" is not cited by any cell; it is still listed`)

  // counts written in the head must match what the build computes
  if (isObj(h) && tally.rows) {
    const texts = [...(h.eyebrow ?? []).map((e, i) => [`head.eyebrow[${i}]`, e]), ['head.headline', h.headline], ['head.lede', h.lede]]
    const want = { rows: tally.rows, alts: (alts ?? []).length }
    for (const [path, text] of texts) {
      if (typeof text !== 'string') continue
      const plain = text.replace(/[_*]/g, '')
      for (const m of plain.matchAll(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+([a-z]+)/gi)) {
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS.indexOf(m[1].toLowerCase())
        const hit = COUNT_NOUNS.find(([re]) => re.test(m[2]))
        if (hit && n !== want[hit[1]]) err(`${path} says "${m[0]}" but the table has ${want[hit[1]]} ${hit[1] === 'rows' ? 'rows' : 'alternatives'}. Counts are computed: write ${want[hit[1]]} or leave the number out`)
      }
      for (const m of plain.matchAll(/\b(ahead|win|wins|winning|behind|lose|loses|losing|level|tie|ties)\s+(?:on|in)\s+(\d+|[a-z]+)\b/gi)) {
        const n = /^\d+$/.test(m[2]) ? Number(m[2]) : NUMBER_WORDS.indexOf(m[2].toLowerCase())
        if (n < 0) continue
        const kind = /^(ahead|win)/i.test(m[1]) ? 'ahead' : /^(behind|los)/i.test(m[1]) ? 'behind' : 'level'
        if (n !== tally[kind]) err(`${path} says "${m[0]}" but the verdicts give ${tally[kind]}. The tally is computed from the rows; write ${tally[kind]} or leave the number out`)
      }
    }
  }

  // picks, cta, method
  if (!isObj(c.picks)) err('picks is missing: one sentence per column, "Pick X if ..."')
  else for (const id of cols) {
    if (!c.picks[id]) err(`picks.${id} is missing: say who should pick ${id === p?.id ? 'you' : 'this alternative'}`)
    else str(c.picks[id], `picks.${id}`, 200)
  }
  if (!isObj(c.cta)) err('cta is missing ({ label, href })')
  else {
    str(c.cta.label, 'cta.label', 32)
    if (!/^(https:\/\/|\/|#|mailto:)/.test(c.cta.href ?? '')) err('cta.href must start with https://, /, # or mailto:')
  }
  str(c.method, 'method', 360)
  if (c.corrections !== undefined && !/^[^\s@]+@[^\s@]+$/.test(c.corrections)) err('corrections must be an email address')

  // loud warning about naming real competitors
  if (named.length) warnings.push(
    `You are naming real products: ${named.map((a) => a.name).join(', ')}.`,
    'Comparative claims about a named company must be true, current and provable. Many countries treat a misleading comparison as false advertising.',
    `Every cell about them must cite a public or independent source with a url, checked within ${maxAge} days, and you must recheck before every publish.`,
    'Do not use their logos or trademarks beyond their name, and keep a copy of every source page as it looked on the asOf date.',
  )
  const inv = (alts ?? []).filter((a) => a?.invented && a.kind === 'software')
  if (inv.length) notes.push(`${inv.map((a) => a.name).join(', ')} ${inv.length > 1 ? 'are' : 'is'} marked invented. If ${inv.length > 1 ? 'they stand' : 'it stands'} for a real product, mark it "named": true; the build then holds its cells to the rules for real competitors`)

  if (!errors.length) {
    c.tally = tally
    c.sourceList = c.sources
    c.cols = [{ ...p, isUs: true }, ...alts.map((a) => ({ ...a, kindText: KINDS[a.kind] }))]
  }
  return { errors, notes, warnings, c }
}
