// Newsletter Kit: reads letter.json, lists every problem at once, and works
// out everything that can be worked out instead of typed: each issue's send
// date and time from the schedule (in the sender's time zone), the next
// issue, the send calendar, the archive's dates and "N issues since YEAR".
// A typed value that disagrees with the schedule is refused, not trusted.
//
// validate(json, { today }) -> { errors: [..], notes: [..], c, d }
//   c: the config with defaults filled in
//   d: what was derived (sends, next, calendar, archive dates, totals)
import { addDays, cadenceWords, dayIndex, DAYS, fmt, isDate, isTime, isZone, plainDate, slots, weekdayOf, WEEKDAY, zoneLabel } from './dates.mjs'
import { scanJSON } from './secrets.mjs'

export const DISPLAYS = {
  young: { family: "'Young Serif', Georgia, serif", google: 'family=Young+Serif', weight: 400, track: '-0.012em', size: 64 },
  newsreader: { family: "'Newsreader', Georgia, serif", google: 'family=Newsreader:opsz,wght@6..72,400..600', weight: 500, track: '-0.015em', size: 64 },
  geist: { family: "'Geist', system-ui, sans-serif", google: 'family=Geist:wght@400;500;600;700', weight: 600, track: '-0.035em', size: 56 },
}
export const TEXTS = {
  literata: { family: "'Literata', Georgia, serif", google: 'family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400' },
  geist: { family: "'Geist', system-ui, sans-serif", google: 'family=Geist:wght@400;500;600;700' },
  plex: { family: "'IBM Plex Sans', system-ui, sans-serif", google: 'family=IBM+Plex+Sans:wght@400;500;600' },
}
export const MONOS = {
  plex: { family: "'IBM Plex Mono', ui-monospace, monospace", google: 'family=IBM+Plex+Mono:wght@400;500' },
  geist: { family: "'Geist Mono', ui-monospace, monospace", google: 'family=Geist+Mono:wght@400;500' },
}
export const LAYOUTS = ['page', 'inline']

/**
 * How each provider is posted to. Only public values ever go in the page;
 * `action` is the address from the provider's own embed code.
 *   field: the email field's name; mode: fetch (reads the reply), json
 *   (sends JSON, reads the reply), no-cors (the reply can't be read) or
 *   navigate (a classic form post, the provider's page takes over).
 */
export const PROVIDERS = {
  post: { field: 'email', mode: 'fetch', note: 'any endpoint that takes a form post and answers 2xx (409 for already subscribed)' },
  proxy: { field: 'email', mode: 'json', note: 'your own server function, which holds the key (recipes/proxy-function.mjs)' },
  buttondown: { field: 'email', mode: 'no-cors', hidden: { embed: '1' }, note: "Buttondown's embed form address" },
  kit: { field: 'email_address', mode: 'no-cors', note: "a Kit form's subscriptions address" },
  mailchimp: { field: 'EMAIL', mode: 'navigate', note: "Mailchimp's embedded form action (its hidden b_… field goes in form.hidden)" },
  ghost: { field: 'email', mode: 'json', extra: { emailType: 'signup' }, note: "your Ghost site's members magic-link address" },
  listmonk: { field: 'email', mode: 'no-cors', note: "listmonk's public subscription form (the list's public ID goes in form.hidden as l)" },
}
export const STATES = ['empty', 'typing', 'invalid', 'sending', 'confirm', 'already', 'error']

const HEX = /^#[0-9a-f]{6}$/i
const LINK = /^(https:\/\/[^\s]+|\/[^\s]*|#[\w-]*|mailto:[^\s]+)$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function lum(hex) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')

export function validate(j, { today: todayArg } = {}) {
  const errors = []
  const notes = []
  const err = (path, msg) => errors.push(`${path}: ${msg}`)
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const str = (v, path, { min = 1, max, need = true } = {}) => {
    if (v === undefined || v === null || v === '') { if (need) err(path, 'is missing'); return false }
    if (typeof v !== 'string') { err(path, 'must be text'); return false }
    const n = v.replace(/_/g, '').length
    if (n < min) err(path, `is too short (at least ${min} characters)`)
    if (max && n > max) err(path, `is ${n} characters; the limit is ${max}. Shorten it rather than asking for smaller type`)
    return true
  }
  const int = (v, path, min = 0, max = 1e9) => {
    if (!Number.isInteger(v) || v < min || v > max) { err(path, `must be a whole number from ${min} to ${max}`); return false }
    return true
  }
  const href = (v, path) => { if (typeof v !== 'string' || !LINK.test(v)) err(path, `"${v ?? ''}" is not a link (https://…, /path, #id or mailto:)`) }
  const color = (v, path, need = true) => {
    if (v === undefined && !need) return
    if (typeof v !== 'string' || !HEX.test(v)) err(path, `"${v ?? ''}" must be a colour like #1c1a16`)
  }
  const list = (v, path, min, max) => {
    if (!Array.isArray(v)) { err(path, 'must be a list'); return [] }
    if (v.length < min || v.length > max) err(path, `has ${v.length} items; use ${min} to ${max}`)
    return v
  }
  const date = (v, path) => { if (!isDate(v)) { err(path, `"${v ?? ''}" must be a date like 2026-11-05`); return false } return true }

  if (!isObj(j)) return { errors: ['letter.json must be an object'], notes, c: null }
  // Secrets first: a key anywhere in the config stops everything.
  for (const s of scanJSON(j)) errors.push(s)

  const c = structuredClone(j)
  if (c.today !== undefined) date(c.today, 'today')
  const today = todayArg ?? (isDate(c.today) ? c.today : new Date().toISOString().slice(0, 10))
  if (!LAYOUTS.includes(c.layout)) err('layout', `must be one of ${LAYOUTS.join(', ')}`)
  c.lang ??= 'en'

  // theme
  const t = c.theme
  if (!isObj(t)) err('theme', 'is missing')
  else {
    for (const k of ['page', 'ink', 'accent', 'onAccent']) color(t[k], `theme.${k}`)
    for (const k of ['client', 'mail', 'accent2', 'error', 'ok']) color(t[k], `theme.${k}`, false)
    t.display ??= 'young'
    t.text ??= 'literata'
    t.mono ??= 'plex'
    t.fields ??= 'square'
    if (!DISPLAYS[t.display]) err('theme.display', `must be one of ${Object.keys(DISPLAYS).join(', ')}`)
    if (!TEXTS[t.text]) err('theme.text', `must be one of ${Object.keys(TEXTS).join(', ')}`)
    if (!MONOS[t.mono]) err('theme.mono', `must be one of ${Object.keys(MONOS).join(', ')}`)
    if (!['square', 'soft'].includes(t.fields)) err('theme.fields', 'must be square or soft')
    if (HEX.test(t.page ?? '') && HEX.test(t.ink ?? '')) {
      const dark = lum(t.page) < 0.2
      t.client ??= dark ? mix(t.page, '#ffffff', 0.04) : mix(t.page, '#ffffff', 0.85)
      t.mail ??= dark ? mix(t.page, '#ffffff', 0.02) : t.client
      t.error ??= dark ? '#ff8a7a' : '#a11d2a'
      t.ok ??= dark ? '#8fd694' : '#3f5a1f'
      t.accent2 ??= dark ? '#7fb3ff' : '#4f5e2c'
      if (contrast(t.ink, t.page) < 7) err('theme.ink', `is ${contrast(t.ink, t.page).toFixed(2)}:1 on theme.page; body text needs 7:1 here so the muted tones derived from it still pass 4.5:1`)
      if (HEX.test(t.accent ?? '') && HEX.test(t.onAccent ?? '') && contrast(t.accent, t.onAccent) < 4.5) err('theme.onAccent', `is ${contrast(t.accent, t.onAccent).toFixed(2)}:1 on theme.accent; the button label needs 4.5:1`)
      for (const k of ['error', 'ok']) if (HEX.test(t[k]) && contrast(t[k], t.page) < 4.5) err(`theme.${k}`, `is ${contrast(t[k], t.page).toFixed(2)}:1 on theme.page; state messages need 4.5:1`)
      if (HEX.test(t.accent ?? '') && contrast(t.accent, t.page) < 3) notes.push(`theme.accent is ${contrast(t.accent, t.page).toFixed(2)}:1 on the page; the turn in the headline is large text and needs 3:1, so it will be drawn in ink`)
    }
  }

  // brand and words
  const b = c.brand
  if (!isObj(b)) err('brand', 'is missing')
  else {
    str(b.name, 'brand.name', { max: 32 })
    str(b.monogram, 'brand.monogram', { max: 3 })
    str(b.from, 'brand.from', { max: 40 })
    if (typeof b.address !== 'string' || !EMAIL.test(b.address)) err('brand.address', 'must be the address issues are sent from, like letters@yourname.example (it is shown, never posted to)')
    str(b.author, 'brand.author', { max: 40, need: false })
  }
  str(c.eyebrow, 'eyebrow', { max: 60 })
  str(c.headline, 'headline', { max: 70 })
  if (typeof c.headline === 'string' && (c.headline.match(/_/g) ?? []).length % 2) err('headline', 'has an odd number of _ marks; wrap the turn in a pair, like "One method, _tested four times._"')
  str(c.dek, 'dek', { max: 240 })

  // schedule
  const s = c.schedule
  let schedOK = false
  if (!isObj(s)) err('schedule', 'is missing')
  else {
    let ok = date(s.first, 'schedule.first')
    if (![1, 2, 4].includes(s.every)) { err('schedule.every', 'must be 1 (weekly), 2 (every other week) or 4 (every fourth week)'); ok = false }
    if (!DAYS.includes(s.weekday)) { err('schedule.weekday', `must be one of ${DAYS.join(', ')}`); ok = false }
    if (!isTime(s.time)) { err('schedule.time', `"${s.time ?? ''}" must be a 24-hour time like 07:30, in the sender's time zone`); ok = false }
    if (typeof s.tz !== 'string' || !isZone(s.tz)) { err('schedule.tz', `"${s.tz ?? ''}" must be a time zone name like Europe/Madrid or UTC`); ok = false }
    str(s.read, 'schedule.read', { max: 24 })
    s.skipped ??= []
    if (!Array.isArray(s.skipped)) { err('schedule.skipped', 'must be a list of dates'); ok = false }
    if (ok && weekdayOf(s.first) !== dayIndex(s.weekday)) { err('schedule.first', `${s.first} is a ${WEEKDAY[weekdayOf(s.first)]}, but schedule.weekday is ${s.weekday}`); ok = false }
    if (ok)
      for (const [i, x] of s.skipped.entries()) {
        if (!date(x, `schedule.skipped[${i}]`)) { ok = false; continue }
        const diff = (Date.parse(x) - Date.parse(s.first)) / 864e5
        if (diff <= 0 || diff % (7 * s.every)) { err(`schedule.skipped[${i}]`, `${x} is not a send day on this schedule (every ${s.every > 1 ? s.every + ' weeks' : 'week'} from ${s.first})`); ok = false }
      }
    s.zoneLabel ??= ok ? zoneLabel(s.tz) : ''
    schedOK = ok
  }

  // the issue
  const is = c.issue
  if (!isObj(is)) err('issue', 'is missing')
  else {
    int(is.no, 'issue["no"]', 1, 100000)
    str(is.subject, 'issue.subject', { max: 90 })
    str(is.preheader, 'issue.preheader', { max: 120 })
    str(is.title, 'issue.title', { max: 70 })
    const body = list(is.body, 'issue.body', 1, 3)
    if (!body.length) err('issue.body', 'needs at least one real paragraph of the issue: without it this is a waitlist, and the kit is built to show the letter itself')
    body.forEach((p, i) => str(p, `issue.body[${i}]`, { min: 40, max: 360 }))
    int(is.moreWords, 'issue.moreWords', 0, 50000)
    href(is.href, 'issue.href')
    if (is.figure !== undefined) figure(is.figure, 'issue.figure')
  }
  function figure(f, p) {
    if (!isObj(f)) return err(p, 'must be { "type": "list" | "chart" | "quote", … }')
    if (f.type === 'list') {
      str(f.title, `${p}.title`, { max: 30, need: false })
      list(f.items, `${p}.items`, 2, 5).forEach((x, i) => {
        if (!Array.isArray(x) || x.length !== 2) return err(`${p}.items[${i}]`, 'must be [text, note] like ["Escarole and white bean soup", "20 min"]')
        str(x[0], `${p}.items[${i}][0]`, { max: 48 }); str(x[1], `${p}.items[${i}][1]`, { max: 10 })
      })
    } else if (f.type === 'quote') {
      str(f.text, `${p}.text`, { max: 200 }); str(f.cite, `${p}.cite`, { max: 48 })
    } else if (f.type === 'chart') {
      str(f.title, `${p}.title`, { max: 44 }); str(f.note, `${p}.note`, { max: 30, need: false }); str(f.alt, `${p}.alt`, { max: 200 })
      if (!['log', 'linear'].includes(f.scale)) err(`${p}.scale`, 'must be log or linear')
      const xs = list(f.x, `${p}.x`, 2, 8)
      const ser = list(f.series, `${p}.series`, 1, 3)
      ser.forEach((x, i) => {
        if (!isObj(x)) return err(`${p}.series[${i}]`, 'must be { "name", "values" }')
        str(x.name, `${p}.series[${i}].name`, { max: 30 })
        if (!Array.isArray(x.values) || x.values.length !== xs.length || x.values.some((v) => typeof v !== 'number' || !(f.scale === 'linear' || v > 0))) err(`${p}.series[${i}].values`, `must be ${xs.length} numbers${f.scale === 'log' ? ' above 0 (log scale)' : ''}, one for each x label`)
      })
      if (ser.filter((x) => x?.accent).length > 1) err(`${p}.series`, 'only one series can be the accent')
      f.unit ??= ''
      ;(f.callouts ?? []).forEach((k, i) => {
        if (!isObj(k) || !Number.isInteger(k.series) || !ser[k.series] || !Number.isInteger(k.at) || k.at < 0 || k.at >= xs.length) err(`${p}.callouts[${i}]`, 'must be { "series": index, "at": index, "label" }')
        else str(k.label, `${p}.callouts[${i}].label`, { max: 10 })
      })
    } else err(`${p}.type`, 'must be list, chart or quote')
  }

  // archive
  c.archive ??= []
  const arch = list(c.archive, 'archive', 0, 8)
  arch.forEach((a, i) => {
    if (!isObj(a)) return err(`archive[${i}]`, 'must be { "no", "title", "href" }')
    int(a.no, `archive[${i}].no`, 1, 100000)
    str(a.title, `archive[${i}].title`, { max: 70 })
    str(a.read, `archive[${i}].read`, { max: 10, need: false })
    href(a.href, `archive[${i}].href`)
    if (Number.isInteger(a.no) && Number.isInteger(is?.no) && a.no >= is.no) err(`archive[${i}].no`, `is No. ${a.no}; the archive lists issues before the one shown (No. ${is.no})`)
    if (i && Number.isInteger(a.no) && a.no >= arch[i - 1].no) err(`archive[${i}].no`, 'the archive must run newest first, with no repeats')
  })

  // count, form, privacy
  const k = c.count
  if (!isObj(k)) err('count', 'is missing: { "value", "label", "source", "asOf" }')
  else {
    int(k.value, 'count.value', 1)
    str(k.label, 'count.label', { max: 20 })
    str(k.source, 'count.source', { max: 70 })
    if (date(k.asOf, 'count.asOf')) {
      if (k.asOf > today) err('count.asOf', `${k.asOf} is after today (${today}); a count can only be dated when it was taken`)
      const age = (Date.parse(today) - Date.parse(k.asOf)) / 864e5
      if (age > 90) notes.push(`count.asOf is ${Math.round(age)} days old; take the count again`)
    }
  }
  const f = c.form
  if (!isObj(f)) err('form', 'is missing')
  else {
    str(f.label, 'form.label', { max: 40 })
    str(f.placeholder, 'form.placeholder', { max: 40 })
    str(f.button, 'form.button', { max: 26 })
    f.provider ??= 'post'
    const pv = PROVIDERS[f.provider]
    if (!pv) err('form.provider', `must be one of ${Object.keys(PROVIDERS).join(', ')}`)
    if (typeof f.action !== 'string' || !(/^https:\/\/[^\s]+$/.test(f.action) || /^\/[^\s]*$/.test(f.action) || f.action === '#')) err('form.action', `"${f.action ?? ''}" must be the https:// address from your provider's embed code, a /path on your own site (proxy), or # to send nothing (a demo)`)
    if (pv) {
      f.field ??= pv.field
      f.mode ??= pv.mode
      f.hidden = { ...(pv.hidden ?? {}), ...(f.hidden ?? {}) }
      f.extra = pv.extra ?? {}
    }
    if (!['fetch', 'json', 'no-cors', 'navigate'].includes(f.mode)) err('form.mode', 'must be fetch, json, no-cors or navigate')
    if (!/^[A-Za-z_][\w-]{0,40}$/.test(f.field ?? '')) err('form.field', 'must be a form field name like email or EMAIL')
    if (!isObj(f.hidden)) err('form.hidden', 'must be { "name": "value" }')
    else for (const [n, v] of Object.entries(f.hidden)) if (typeof v !== 'string' || v.length > 80) err(`form.hidden.${n}`, 'must be a short public value')
    f.honeypot ??= 'website'
    f.doubleOptIn ??= true
    if (f.provider === 'listmonk' && !f.hidden?.l) err('form.hidden.l', "listmonk needs the list's public ID as l")
  }
  const pr = list(c.privacy, 'privacy', 3, 3)
  pr.forEach((x, i) => {
    if (!Array.isArray(x) || x.length !== 2) return err(`privacy[${i}]`, 'must be [key, line] like ["We keep", "Your email address and the date you joined."]')
    str(x[0], `privacy[${i}][0]`, { max: 12 }); str(x[1], `privacy[${i}][1]`, { max: 100 })
  })
  str(c.about, 'about', { max: 140, need: false })
  c.nav ??= []
  list(c.nav, 'nav', 0, 3).forEach((l, i) => { str(l?.label, `nav[${i}].label`, { max: 18 }); href(l?.href, `nav[${i}].href`) })
  if (c.footer !== undefined) { str(c.footer?.left, 'footer.left', { max: 60 }); str(c.footer?.right, 'footer.right', { max: 60, need: false }) }
  if (c.demo !== undefined) {
    if (!isObj(c.demo)) err('demo', 'must be an object')
    else {
      str(c.demo.title, 'demo.title', { max: 80, need: false })
      if (c.demo.readerTz !== undefined && !isZone(c.demo.readerTz)) err('demo.readerTz', 'must be a time zone name')
      if (c.demo.email !== undefined && !/^[^\s@]+@[\w-]+\.example$/.test(c.demo.email)) err('demo.email', 'must be a made-up address on .example, like ana@weiss.example (the recorder types it)')
      str(c.demo.below, 'demo.below', { max: 60, need: false })
      if (c.demo.above !== undefined) { str(c.demo.above?.label, 'demo.above.label', { max: 60 }); str(c.demo.above?.text, 'demo.above.text', { max: 240 }) }
    }
  }
  c.messages = { ...defaultMessages(), ...(c.messages ?? {}) }
  for (const [m, v] of Object.entries(c.messages)) str(v, `messages.${m}`, { max: 160 })

  // derived: sends, the issue's date, the archive's dates, totals, the calendar
  let d = null
  if (schedOK && Number.isInteger(is?.no)) {
    const all = slots(s, is.no, 120)
    const byNo = new Map(all.filter((x) => x.no).map((x) => [x.no, x]))
    const cur = byNo.get(is.no)
    const cutoff = `${today}T23:59:59Z`
    if (cur.date > today) err('issue["no"]', `No. ${is.no} is scheduled for ${plainDate(cur.date)}, after today (${today}); show the latest issue that has gone out`)
    else {
      const nextSlot = all.find((x) => x.at > cur.at && !x.skipped)
      if (nextSlot && nextSlot.date <= today && Date.parse(cutoff) > nextSlot.at) notes.push(`No. ${is.no + 1} was due on ${plainDate(nextSlot.date)}; if it went out, show it instead`)
    }
    if (is.date !== undefined && is.date !== cur.date) err('issue.date', `says ${is.date}, but on this schedule No. ${is.no} went out on ${cur.date}; fix the schedule (first, every, skipped) or the date`)
    arch.forEach((a, i) => {
      const x = Number.isInteger(a?.no) && byNo.get(a.no)
      if (x && a.date !== undefined && a.date !== x.date) err(`archive[${i}].date`, `says ${a.date}, but on this schedule No. ${a.no} went out on ${x.date}`)
    })
    const firstYear = s.first.slice(0, 4)
    if (c.stats !== undefined) {
      if (c.stats.issues !== undefined && c.stats.issues !== is.no) err('stats.issues', `says ${c.stats.issues}, but the schedule and the latest issue make it ${is.no}`)
      if (c.stats.since !== undefined && String(c.stats.since) !== firstYear) err('stats.since', `says ${c.stats.since}, but No. 1 went out in ${firstYear} (schedule.first)`)
    }
    const cells = s.every === 1 ? 12 : 10
    const past = all.filter((x) => x.at <= cur.at).slice(-(cells - 1))
    const upcoming = all.filter((x) => x.at > cur.at && !x.skipped)
    d = {
      issue: cur,
      prev: arch[0] && byNo.get(arch[0].no),
      archive: arch.map((a) => byNo.get(a.no)),
      calendar: past.map((x) => ({ at: x.at, date: x.date, no: x.no, kind: x.skipped ? 'skipped' : x.no === is.no ? 'latest' : 'sent' })),
      next: upcoming[0],
      upcoming: upcoming.map((x) => ({ at: x.at, no: x.no })),
      total: is.no,
      since: firstYear,
      cadence: cadenceWords(s),
      today,
    }
    if (c.archive.length && c.archive[0].no !== is.no - 1) notes.push(`the archive starts at No. ${c.archive[0].no}; No. ${is.no - 1} is missing from it`)
  }
  return { errors, notes, c, d }
}

export function defaultMessages() {
  return {
    hint: 'One email to confirm the address is yours, then {next} on {nextDay}.',
    invalidEmpty: 'Type your email address first.',
    invalidAt: 'That address is missing the @.',
    invalidDot: 'That address needs an ending after the name, like “.com”.',
    invalidServer: 'The list could not accept that address. Check it for typos.',
    sending: 'Sending to the list…',
    confirmTitle: 'Nearly there. Open the email we just sent to',
    confirmLine: 'Tap “Confirm” in it and {next} arrives on {nextDay}. Nothing in 10 minutes? Check spam, or try again.',
    confirmOpaque: 'If that address is new, a confirmation email is on its way. Tap “Confirm” in it. Nothing in 10 minutes? Check spam, or try again.',
    doneTitle: 'You are on the list:',
    doneLine: '{next} arrives on {nextDay}.',
    alreadyTitle: 'Already on the list:',
    alreadyLine: 'Nothing changed and nothing was sent. Every past issue is in the archive.',
    error: 'The list didn’t answer, so you are not subscribed yet. Your address is kept; press the button to try again.',
    confirmRow: 'Confirm your subscription',
    confirmRowLine: 'One tap and {next} is yours on {nextDay}.',
    nextFallback: 'the next issue',
  }
}
export { fmt }
