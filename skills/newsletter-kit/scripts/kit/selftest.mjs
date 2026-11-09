// Newsletter Kit: proves the build refuses what it should. It takes example
// 1's letter.json, breaks it one way at a time (a typed date that disagrees
// with the schedule, a wrong issue count, a future issue, a secret key in
// the form, …) and expects validate() to refuse each with the right field
// named; it also checks a few things that must pass (public form IDs, a
// list's public UUID) and the time-zone arithmetic across a summer-time
// change. Prints one line per case and exits 1 if any case is wrong.
//
//   node scripts/selftest.mjs [letter.json]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmt, zoned } from './dates.mjs'
import { validate } from './schema.mjs'
import { scanText } from './secrets.mjs'

const here = dirname(fileURLToPath(import.meta.url))

export function cases(base) {
  const k = (s) => s.split('').reverse().join('') // keys are assembled backwards so no key-shaped text sits in this file
  return [
    ['an archive date that disagrees with the schedule', (c) => { c.archive[0].date = '2026-10-23' }, 'archive[0].date'],
    ["the issue's own date off by a week", (c) => { c.issue.date = '2026-10-29' }, 'issue.date'],
    ['a typed issue count that disagrees', (c) => { c.stats = { issues: 90 } }, 'stats.issues'],
    ['a typed first year that disagrees', (c) => { c.stats = { since: 2022 } }, 'stats.since'],
    ['a first issue that is not on the weekday', (c) => { c.schedule.first = '2023-07-21' }, 'schedule.first'],
    ['a skipped date that is not a send day', (c) => { c.schedule.skipped = ['2025-01-01'] }, 'schedule.skipped[0]'],
    ['an issue that has not gone out yet', (c) => { c.issue.no = 88; delete c.issue.date; c.archive = [] }, 'issue["no"]'],
    ['a count dated after today', (c) => { c.count.asOf = '2026-12-01' }, 'count.asOf'],
    ['an issue with no body', (c) => { c.issue.body = [] }, 'issue.body'],
    ['a time zone that does not exist', (c) => { c.schedule.tz = 'Europe/Atlantis' }, 'schedule.tz'],
    ['a payment secret key in a hidden field', (c) => { c.form.hidden = { k: k('9xQ2pL7vR4mK8nT3wZ6yB1cD_evil_ks') } }, 'form.hidden.k'],
    ['an API key in the action address', (c) => { c.form.action = 'https://list.example/subscribe?' + k('yek_ipa') + '=9f8e7d6c5b4a3f2e1d0c' }, 'form.action'],
    ['a field called apiKey', (c) => { c.form.apiKey = 'anything' }, 'form.apiKey'],
    ['a mailing-list API key with its data-centre suffix', (c) => { c.form.hidden = { u: '0123456789abcdef' + '0123456789abcdef-us21' } }, 'form.hidden.u'],
    ['a long random token', (c) => { c.form.hidden = { t: 'Zq8Lr3Vx7Kp2Nw9Ys4Ht6Bm1Jc5Fd0Ga' } }, 'form.hidden.t'],
    ['a signed token (JWT)', (c) => { c.form.hidden = { t: ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlMTIz'].join('.') } }, 'form.hidden.t'],
    ['a key-shaped value in the dek', (c) => { c.dek = 'Our key is ' + k('Kp2Nw9Ys4Ht6Bm1Jc5Fd0GaZq8Lr3Vx7_evil_ks') + ' and more words.' }, 'letter.json.dek'],
  ].map(([name, mutate, field]) => {
    const c = structuredClone(base)
    mutate(c)
    return { name, c, field, refuse: true }
  }).concat([
    ['the example as written', () => {}],
    ["a listmonk list's public UUID in form.hidden", (c) => { c.form.provider = 'listmonk'; c.form.hidden = { l: '6f1c2a4e-9b7d-4c3e-8a2f-1d5e7b9c0a3f' } }],
    ['a skipped send moving every later issue by one slot', (c) => { c.schedule.first = '2023-07-06'; c.schedule.skipped = ['2023-12-21'] }],
  ].map(([name, mutate]) => { const c = structuredClone(base); mutate(c); return { name, c, refuse: false } }))
}

export function run(file = join(here, '..', '..', 'examples', 'brine-crumb', 'letter.json')) {
  const base = JSON.parse(readFileSync(file, 'utf8'))
  let bad = 0
  for (const t of cases(base)) {
    const { errors } = validate(t.c, { today: base.today })
    const ok = t.refuse ? errors.some((e) => e.startsWith(t.field + ':') || e.startsWith(t.field + ' ') || e.includes(t.field)) : errors.length === 0
    if (!ok) bad++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${t.refuse ? 'refuses' : 'accepts'} ${t.name}${ok ? '' : `: ${errors.join(' | ') || 'no errors'}`}`)
  }
  // summer time: Thursdays at 07:30 in Madrid are 06:30 UTC in March, 05:30 UTC in April
  const z = [['2026-03-26', '06:30'], ['2026-04-02', '05:30']].map(([d, utc]) => [d, fmt(zoned(d, '07:30', 'Europe/Madrid'), 'UTC', 'time'), utc])
  for (const [d, got, want] of z) {
    const ok = got === want
    if (!ok) bad++
    console.log(`${ok ? 'ok  ' : 'FAIL'} 07:30 in Madrid on ${d} is ${want} UTC${ok ? '' : ` (got ${got})`}`)
  }
  // the scan never fires on ordinary page text
  const quiet = scanText('Every other Thursday, 07:30 Madrid time. family=Literata:ital,opsz,wght@0,7..72,400 cubic-bezier(.2,.7,.2,1) 6f1c2a4e-9b7d-4c3e-8a2f-1d5e7b9c0a3f prefersReducedMotionMatches', 'x')
  if (quiet.length) bad++
  console.log(`${quiet.length ? 'FAIL' : 'ok  '} ordinary text and font addresses are not mistaken for keys${quiet.length ? ': ' + quiet.join(' | ') : ''}`)
  return bad
}

export async function main(argv = process.argv.slice(2)) {
  const bad = run(argv[0])
  if (bad) { console.log(`${bad} case${bad > 1 ? 's' : ''} wrong`); process.exit(1) }
  console.log('all cases right')
}
