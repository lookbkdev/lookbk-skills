// Itinerary Kit: every field of trip.json, its limits, and the rules the
// build enforces. validate() returns every problem at once; nothing is
// written until the list is empty.

export const STYLES = {
  paper: {
    mode: 'light',
    fonts: 'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500',
    t: {
      '--bg': '#f1ede3', '--panel': '#f6f3eb', '--ink': '#1f2422', '--muted': '#565b55', '--rule': '#d3ccbb', '--rule2': '#a59c87',
      '--accent': '#a8401a', '--on-accent': '#fbf7ef', '--accent2': '#2f6762', '--sea': '#e3e6dc', '--hatch': '#c3ccc2', '--land': '#f6f3eb',
      '--cont': '#ddd3bd', '--cont2': '#c9bb9c', '--river': '#5f8a84', '--done': '#1f2422', '--todo': '#9a927f', '--btn': '#1f2422', '--on-btn': '#f6f3eb',
      '--display': "'Newsreader', Georgia, serif", '--text': "'Public Sans', system-ui, sans-serif", '--mono': "'IBM Plex Mono', ui-monospace, monospace",
      '--dw': '500', '--dwide': 'normal', '--dcase': 'none', '--turn': 'italic', '--turnw': '400', '--labelcase': 'none', '--labelstyle': 'italic', '--labelfont': "'Newsreader', Georgia, serif", '--labelsize': '15px', '--labeltrack': '0',
    },
  },
  night: {
    mode: 'dark',
    fonts: 'family=Archivo:wdth,wght@62..125,400..800&family=JetBrains+Mono:wght@400;500;600',
    t: {
      '--bg': '#12110f', '--panel': '#171513', '--ink': '#ece5d8', '--muted': '#a69d8f', '--rule': '#2d2925', '--rule2': '#5a5046',
      '--accent': '#eaa250', '--on-accent': '#161210', '--accent2': '#9fa9dc', '--sea': '#12110f', '--hatch': '#12110f', '--land': '#171513',
      '--cont': '#3a332b', '--cont2': '#62523f', '--river': '#7d86b8', '--done': '#ece5d8', '--todo': '#62584d', '--btn': '#eaa250', '--on-btn': '#161210',
      '--display': "'Archivo', system-ui, sans-serif", '--text': "'Archivo', system-ui, sans-serif", '--mono': "'JetBrains Mono', ui-monospace, monospace",
      '--dw': '700', '--dwide': "'wdth' 74", '--dcase': 'uppercase', '--turn': 'normal', '--turnw': '700', '--labelcase': 'uppercase', '--labelstyle': 'normal', '--labelfont': "'JetBrains Mono', ui-monospace, monospace", '--labelsize': '13px', '--labeltrack': '0.06em',
    },
  },
}

export const MARKS = {
  wave: '<path d="M2 17c3-3 5-3 8 0s5 3 8 0 5-3 6-1"/><path d="M5 11l4-6 4 5 3-3 5 5"/>',
  mesa: '<path d="M2 20h22"/><path d="M5 20v-6h7v-4h6v10"/><circle cx="19" cy="6" r="2.4"/>',
  peak: '<path d="M2 21l8-13 4 6 3-4 7 11z"/>',
  none: '',
}

/** Effort rule: points = (km + climb / 100) x terrain factor; graded by EFFORT_STEPS. */
export const TERRAIN = {
  path: { factor: 1, words: 'on a good path' },
  rough: { factor: 1.15, words: 'on rough ground' },
  exposed: { factor: 1.25, words: 'on an exposed path' },
  scramble: { factor: 1.4, words: 'with some scrambling' },
}
export const EFFORT = ['Easy', 'Gentle', 'Steady', 'Hard', 'Very hard']
export const EFFORT_STEPS = [8, 14, 20, 26]
export function effortOf(km, up, terrain = 'path') {
  const points = Math.round((km + up / 100) * TERRAIN[terrain].factor * 10) / 10
  let grade = 0
  while (grade < 4 && points >= EFFORT_STEPS[grade]) grade++
  return { points, grade: grade + 1, word: EFFORT[grade] }
}
export const EFFORT_RULE = `Effort is worked out from each day's distance and climb on foot: every 100 m of climb counts as 1 km, then the total is multiplied by ${TERRAIN.rough.factor} on rough ground, ${TERRAIN.exposed.factor} on an exposed path and ${TERRAIN.scramble.factor} where there is scrambling. Under ${EFFORT_STEPS[0]} is Easy, ${EFFORT_STEPS[0]} to ${EFFORT_STEPS[1]} Gentle, ${EFFORT_STEPS[1]} to ${EFFORT_STEPS[2]} Steady, ${EFFORT_STEPS[2]} to ${EFFORT_STEPS[3]} Hard, ${EFFORT_STEPS[3]} and over Very hard.`

/** Naismith's rule: 5 km an hour plus an hour for every 600 m of climb, to the quarter hour. */
export function naismith(km, up) {
  const q = Math.max(1, Math.round((km / 5 + up / 600) * 4))
  const h = Math.floor(q / 4), m = (q % 4) * 15
  return `about ${h ? h + ' h' : ''}${h && m ? ' ' : ''}${m ? m + (h ? '' : ' min') : ''}`
}

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const fmtN = (n) => Math.round(n).toLocaleString('en-GB')
export const money = (cur, n) => cur + Math.round(n).toLocaleString('en-GB')

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ISO = /^\d{4}-\d{2}-\d{2}$/
const parts = (d) => d.split('-').map(Number)
export function dateRange(a, b, style = 'dmy') {
  const [y1, m1, d1] = parts(a), [y2, m2, d2] = parts(b)
  if (style === 'mdy') {
    if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${d1} to ${d2}, ${y1}`
    if (y1 === y2) return `${MONTHS[m1 - 1]} ${d1} to ${MONTHS[m2 - 1]} ${d2}, ${y1}`
    return `${MONTHS[m1 - 1]} ${d1}, ${y1} to ${MONTHS[m2 - 1]} ${d2}, ${y2}`
  }
  if (y1 === y2 && m1 === m2) return `${d1} to ${d2} ${MONTHS[m1 - 1]} ${y1}`
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]} ${y1}`
  return `${d1} ${MONTHS[m1 - 1]} ${y1} to ${d2} ${MONTHS[m2 - 1]} ${y2}`
}
export function dateOne(a, style = 'dmy') {
  const [y, m, d] = parts(a)
  return style === 'mdy' ? `${MONTHS[m - 1]} ${d}, ${y}` : `${d} ${MONTHS[m - 1]} ${y}`
}

const HREF = /^(https:\/\/|\/|#|mailto:|tel:)/
const HEX = /^#[0-9a-fA-F]{6}$/
const PRICE = /^(free|included|[+]?[£$€]\d[\d,]*(\.\d\d)?)$/i

/** Validates trip.json; returns a list of problems (empty when it builds). */
export function validate(c) {
  const p = []
  const str = (v, path, max, min = 1) => {
    if (typeof v !== 'string' || v.trim().length < min) { p.push(`${path}: required text${min > 1 ? ` (at least ${min} characters)` : ''}`); return }
    if (v.length > max) p.push(`${path}: ${v.length} characters, at most ${max}; shorten it`)
  }
  const opt = (v, path, max) => { if (v !== undefined) str(v, path, max) }
  const num = (v, path, lo, hi) => { if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) p.push(`${path}: a number from ${lo} to ${hi}`) }
  const href = (v, path) => { if (typeof v !== 'string' || !HREF.test(v)) p.push(`${path}: a link starting https://, /, #, mailto: or tel:`) }
  if (!c || typeof c !== 'object') return ['trip.json: not a JSON object']

  if (c.style !== undefined && !STYLES[c.style]) p.push(`style: "paper" or "night"`)
  if (c.accent !== undefined && !HEX.test(c.accent)) p.push('accent: a colour like "#a8401a"')
  if (c.dates !== undefined && !['dmy', 'mdy'].includes(c.dates)) p.push('dates: "dmy" (18 to 24 April 2027) or "mdy" (April 18 to 24, 2027)')

  const b = c.brand ?? {}
  str(b.name, 'brand.name', 28)
  if (b.mark !== undefined && !MARKS[b.mark]) p.push(`brand.mark: one of ${Object.keys(MARKS).join(', ')}`)
  if (b.links !== undefined) {
    if (!Array.isArray(b.links) || b.links.length > 4) p.push('brand.links: up to 4 links')
    else b.links.forEach((l, i) => { str(l?.label, `brand.links[${i}].label`, 14); href(l?.href, `brand.links[${i}].href`) })
  }
  str(b.cta?.label, 'brand.cta.label', 18); href(b.cta?.href, 'brand.cta.href')

  const t = c.trip ?? {}
  if (!Array.isArray(t.kicker) || t.kicker.length < 1 || t.kicker.length > 3) p.push('trip.kicker: 1 to 3 short items')
  else t.kicker.forEach((k, i) => str(k, `trip.kicker[${i}]`, 28))
  str(t.title, 'trip.title', 60)
  if (typeof t.title === 'string' && (t.title.match(/_/g) || []).length % 2) p.push('trip.title: an _underscored_ turn needs an underscore on both sides')
  str(t.lede, 'trip.lede', 280, 60)
  if (!['walk', 'drive'].includes(t.mode)) p.push('trip.mode: "walk" (days measured on foot) or "drive" (days by vehicle, with time on foot given per day)')
  num(t.group, 'trip.group', 1, 40)

  const m = c.map ?? {}
  if (typeof m.route !== 'string') p.push('map.route: the route file, a GeoJSON FeatureCollection with one LineString per day (see SKILL.md)')
  if (typeof m.geo !== 'string') p.push('map.geo: your GeoJSON file of land, rivers, lakes and contours, or "natural-earth" for the bundled coastline')

  const days = c.days
  if (!Array.isArray(days) || days.length < 2 || days.length > 14) p.push('days: 2 to 14 days')
  else days.forEach((d, i) => {
    const at = `days[${i}] (day ${i + 1})`
    str(d.from, `${at}.from`, 24); str(d.to, `${at}.to`, 24)
    str(d.text, `${at}.text`, 260, 40)
    num(d.km, `${at}.km (the distance you state; the build measures the track and compares)`, 0.1, 1500)
    if (d.terrain !== undefined && !TERRAIN[d.terrain]) p.push(`${at}.terrain: one of ${Object.keys(TERRAIN).join(', ')}`)
    if (d.effort !== undefined) p.push(`${at}.effort: leave it out. Effort is worked out from distance, climb and terrain (set "terrain" if the ground is rough, exposed or a scramble)`)
    if (t.mode === 'drive') {
      str(d.drive, `${at}.drive (time at the wheel, like "1 h 30")`, 16)
      if (d.onFoot !== undefined) {
        num(d.onFoot.km, `${at}.onFoot.km`, 0, 60); num(d.onFoot.up, `${at}.onFoot.up`, 0, 3000)
        if (d.onFoot.terrain !== undefined && !TERRAIN[d.onFoot.terrain]) p.push(`${at}.onFoot.terrain: one of ${Object.keys(TERRAIN).join(', ')}`)
      }
    } else if (d.drive !== undefined || d.onFoot !== undefined) p.push(`${at}: "drive" and "onFoot" are for trip.mode "drive"`)
    const s = d.sleep
    if (!s || typeof s !== 'object') p.push(`${at}.sleep: { "name", "detail" }, or { "none": true, "detail" } on a day that ends without a night`)
    else { if (!s.none) str(s.name, `${at}.sleep.name`, 40); str(s.detail, `${at}.sleep.detail`, 60) }
    const ml = d.meals
    if (!ml || ['breakfast', 'lunch', 'dinner'].some((k) => typeof ml[k] !== 'boolean')) p.push(`${at}.meals: { "breakfast": true|false, "lunch": true|false, "dinner": true|false }`)
    opt(d.mealNote, `${at}.mealNote`, 70)
    if (d.optional !== undefined) {
      if (!Array.isArray(d.optional) || d.optional.length > 3) p.push(`${at}.optional: up to 3 items`)
      else d.optional.forEach((o, k) => { str(o?.label, `${at}.optional[${k}].label`, 60); if (typeof o?.price !== 'string' || !PRICE.test(o.price)) p.push(`${at}.optional[${k}].price: what it costs, like "+£18", "£6" or "free"`) })
    }
    if (d.note !== undefined) { str(d.note?.label, `${at}.note.label`, 12); str(d.note?.text, `${at}.note.text`, 120) }
  })

  const list = (v, path, lo, hi, max) => { if (!Array.isArray(v) || v.length < lo || v.length > hi) p.push(`${path}: ${lo} to ${hi} lines`); else v.forEach((x, i) => str(x, `${path}[${i}]`, max)) }
  list(c.included, 'included', 1, 6, 80)
  list(c.notIncluded, 'notIncluded', 1, 6, 80)

  const dep = c.departures ?? {}
  if (typeof dep.asOf !== 'string' || !ISO.test(dep.asOf)) p.push('departures.asOf: the date the places were last counted, "YYYY-MM-DD"; it is printed under the table')
  num(dep.capacity, 'departures.capacity', 1, 40)
  if (typeof t.group === 'number' && typeof dep.capacity === 'number' && dep.capacity !== t.group) p.push(`departures.capacity (${dep.capacity}) and trip.group (${t.group}) differ; a departure holds one group`)
  if (!Array.isArray(dep.list) || dep.list.length < 1 || dep.list.length > 8) p.push('departures.list: 1 to 8 departures')
  else dep.list.forEach((d, i) => {
    const at = `departures.list[${i}]`
    if (!ISO.test(d.start ?? '') || !ISO.test(d.end ?? '')) p.push(`${at}: "start" and "end" as "YYYY-MM-DD"`)
    else if (d.end < d.start) p.push(`${at}: ends before it starts`)
    else if (Array.isArray(days)) { const n = Math.round((Date.parse(d.end) - Date.parse(d.start)) / 864e5) + 1; if (n !== days.length) p.push(`${at}: runs ${n} days but the itinerary has ${days.length}`) }
    if (!Number.isInteger(d.left) || d.left < 0 || d.left > (dep.capacity ?? 40)) p.push(`${at}.left: whole places left, 0 to capacity (${dep.capacity})`)
    num(d.price, `${at}.price`, 1, 1e6)
  })

  const pr = c.price ?? {}
  if (typeof pr.currency !== 'string' || !/^[£$€]$/.test(pr.currency)) p.push('price.currency: "£", "$" or "€"')
  num(pr.amount, 'price.amount', 1, 1e6)
  str(pr.per, 'price.per', 60)
  list(pr.covers, 'price.covers', 2, 6, 50)
  if (Array.isArray(pr.covers) && Array.isArray(days)) for (const line of pr.covers)
    if (/\b(all|every) meals?\b/i.test(line) && !/marked/i.test(line) && days.some((d) => d.meals && !(d.meals.breakfast && d.meals.lunch && d.meals.dinner)))
      p.push(`price.covers: "${line}" claims every meal, but not every day includes all three; say "every meal marked on the days above"`)
  if (pr.terms !== undefined) {
    if (!Array.isArray(pr.terms) || pr.terms.length > 3) p.push('price.terms: up to 3')
    else pr.terms.forEach((x, i) => { str(x?.label, `price.terms[${i}].label`, 18); str(x?.text, `price.terms[${i}].text`, 40) })
  }
  if (Array.isArray(dep.list) && typeof pr.amount === 'number' && dep.list.length && !dep.list.some((d) => d.price === pr.amount))
    p.push(`price.amount (${pr.amount}) is not the price of any departure`)
  return p
}
